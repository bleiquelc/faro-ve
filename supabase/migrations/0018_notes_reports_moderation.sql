-- ─────────────────────────────────────────────────────────────────────────────
-- 0018_notes_reports_moderation.sql
--
-- Avistamientos / "Tengo información": cualquiera puede aportar info sobre una
-- persona del mapa (vi a X, tengo un dato). Reconexión de doble vía.
--
--  (1) create_note_report(payload) — alta pública de una nota (sighting/info_update)
--      sobre una persona existente. Cifra/hashea la PII del autor (igual que el
--      reportante), ofusca la ubicación del avistamiento (land-aware, vía el
--      trigger 0017), inserta como 'pending'. Solo service_role.
--  (2) notes_moderation_queue / notes_moderation_stats — cola de notas pending con
--      el nombre de la persona referida + coords EXACTAS del avistamiento (solo
--      moderador, #1) y SIN PII del autor (#2).
--  (3) moderate_note(id, decision, moderator_id, notes) — aprobar/rechazar una nota
--      (atómico: update + audit con actor=moderador). Espeja moderate_person (0016).
--  (4) trg_notes_audit redefinido para honrar el flag faro.skip_persons_audit
--      (evita la fila de audit-fantasma del trigger genérico, igual que en 0016).
--
-- Reusa: notes, notes_public (0001), hash_email/encrypt_pii (0004),
-- obfuscate_point_on_land (0017), audit_log (0006). Idempotente.
-- Tras aplicar:  notify pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice para la cola de moderación de notas (pending, FIFO).
create index if not exists notes_moderation_queue_idx
  on notes (created_at asc)
  where moderation_status = 'pending' and not hidden;

-- 🔒 PRIVACIDAD/MODERACIÓN (revisión adversarial — crítico). 0003 concedió a anon
-- INSERT directo en notes/persons (policy *_anon_insert con check pending). Eso
-- deja un POST directo a PostgREST (la anon key es PÚBLICA) que SALTA Turnstile,
-- el rate-limit, el cifrado de PII y la whitelist de tipo. Toda alta DEBE pasar por
-- las RPC SECURITY DEFINER (create_note_report / create_person_report, service_role,
-- que sí imponen toda la cadena). Espeja el endurecimiento de aid_points (0014).
-- Las RPC son SECURITY DEFINER → siguen insertando como dueño, sin afectarse.
revoke insert on notes   from anon, authenticated;
revoke insert on persons from anon, authenticated;
drop policy if exists notes_anon_insert on notes;
drop policy if exists persons_anon_insert_pending on persons;

-- ─── (1) create_note_report ──────────────────────────────────────────────────
create or replace function create_note_report(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id        uuid;
  v_person    uuid;
  v_type      note_type;
  v_text      text;
  v_lat       double precision;
  v_lng       double precision;
  v_point     geography(Point, 4326);
  v_email     text;
  v_phone     text;
begin
  -- La nota debe referenciar una persona PÚBLICA (approved, no withdrawn). Validar
  -- solo "exists" filtraría existencia de personas no-públicas por UUID (oráculo de
  -- enumeración) y permitiría notas sobre registros pending/rejected (revisión
  -- adversarial: privacy-001/database-004).
  v_person := nullif(payload->>'person_id','')::uuid;
  if v_person is null or not exists (
    select 1 from persons
    where id = v_person and moderation_status = 'approved' and withdrawn_at is null
  ) then
    raise exception 'person_id inválido';
  end if;

  -- Tipo: subconjunto que el público puede crear (no moderator_note/status_change).
  v_type := coalesce(nullif(payload->>'type','')::note_type, 'info_update');
  if v_type not in ('sighting', 'info_update') then
    raise exception 'tipo de nota no permitido para reporte público: %', v_type;
  end if;

  v_text := nullif(trim(coalesce(payload->>'text','')), '');
  if v_text is null then
    raise exception 'el texto de la información es obligatorio';
  end if;

  -- Coords del avistamiento (opcionales, juntas o ninguna). El trigger
  -- trg_notes_obfuscate (0017) las ofusca land-aware al insertar el point.
  v_lat := nullif(payload->>'lat','')::double precision;
  v_lng := nullif(payload->>'lng','')::double precision;
  if (v_lat is null) <> (v_lng is null) then
    raise exception 'lat y lng deben venir juntas o ninguna';
  end if;
  if v_lat is not null then
    v_point := ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography;
  end if;

  -- PII del autor (cifrada/hasheada en DB, nunca pública).
  v_email := nullif(trim(coalesce(payload->>'author_email','')), '');
  v_phone := nullif(trim(coalesce(payload->>'author_phone','')), '');

  insert into notes (
    person_id, source, type, text,
    sighting_location_text, sighting_location_point, sighting_date,
    author_name,
    author_email_hash, author_email_encrypted,
    author_phone_hash, author_phone_encrypted,
    author_made_contact,
    ip_hashed, client_uuid,
    moderation_status
  ) values (
    v_person, 'faro-ve', v_type, v_text,
    nullif(trim(coalesce(payload->>'sighting_location_text','')), ''),
    v_point,
    nullif(payload->>'sighting_date','')::timestamptz,
    nullif(trim(coalesce(payload->>'author_name','')), ''),
    case when v_email is not null then hash_email(v_email) else null end,
    encrypt_pii(v_email),
    case when v_phone is not null then hash_phone(v_phone) else null end,
    encrypt_pii(v_phone),
    (v_email is not null or v_phone is not null),
    nullif(payload->>'ip_hashed',''),
    nullif(payload->>'client_uuid',''),
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

comment on function create_note_report(jsonb) is
  'Alta pública de una nota (sighting/info_update) sobre una persona. Cifra/hashea PII del autor, ofusca el avistamiento (land-aware), inserta pending. Solo service_role.';

revoke all on function create_note_report(jsonb) from public, anon, authenticated;
grant execute on function create_note_report(jsonb) to service_role;

-- ─── (2) notes_moderation_queue / stats ──────────────────────────────────────
create or replace function notes_moderation_queue(p_limit int default 25, p_offset int default 0)
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  with q as (
    select n.*
    from notes n
    where n.moderation_status = 'pending' and not n.hidden
    order by n.created_at asc
    limit greatest(0, least(coalesce(p_limit, 25), 200))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', (select count(*) from notes where moderation_status = 'pending' and not hidden),
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'person_id', q.person_id,
          'person_name', (select full_name from persons where id = q.person_id),
          'type', q.type,
          'text', q.text,
          'sighting_location_text', q.sighting_location_text,
          -- Coord EXACTA del avistamiento — solo el moderador (#1).
          'lat_exact', ST_Y(q.sighting_location_point::geometry),
          'lng_exact', ST_X(q.sighting_location_point::geometry),
          'sighting_date', q.sighting_date,
          -- Autor: NUNCA email/phone (cifrados, #2); solo si dejó contacto.
          'author_name', q.author_name,
          'has_author_contact', q.author_made_contact,
          'created_at', q.created_at
        )
        order by q.created_at asc
      ),
      '[]'::jsonb
    )
  )
  from q;
$$;

revoke all on function notes_moderation_queue(int, int) from public, anon, authenticated;
grant execute on function notes_moderation_queue(int, int) to service_role;

create or replace function notes_moderation_stats()
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  select jsonb_build_object(
    'pending',  count(*) filter (where moderation_status = 'pending' and not hidden),
    'approved', count(*) filter (where moderation_status = 'approved' and not hidden),
    'rejected', count(*) filter (where moderation_status = 'rejected')
  )
  from notes;
$$;

revoke all on function notes_moderation_stats() from public, anon, authenticated;
grant execute on function notes_moderation_stats() to service_role;

-- ─── (3) trg_notes_audit con guarda de flag (anti audit-fantasma) ────────────
create or replace function trg_audit_notes()
returns trigger language plpgsql security definer as $$
begin
  if coalesce(current_setting('faro.skip_persons_audit', true), '') = '1' then
    return coalesce(new, old);  -- una RPC ya escribe el audit explícito (moderación)
  end if;
  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, diff)
  values (
    coalesce(auth.jwt() ->> 'role', 'public'),
    coalesce(auth.jwt() ->> 'sub', null),
    lower(tg_op),
    'note',
    coalesce(new.id, old.id)::text,
    case
      -- Restar la PII cifrada del autor del diff (mínima retención; el ciphertext
      -- no aporta valor auditable). Revisión adversarial: privacy-002/database-003.
      when tg_op = 'INSERT' then jsonb_build_object(
        'new', to_jsonb(new) - 'author_email_encrypted' - 'author_phone_encrypted'
      )
      when tg_op = 'UPDATE' then jsonb_build_object(
        'before', to_jsonb(old) - 'author_email_encrypted' - 'author_phone_encrypted',
        'after',  to_jsonb(new) - 'author_email_encrypted' - 'author_phone_encrypted'
      )
      when tg_op = 'DELETE' then jsonb_build_object('deleted', jsonb_build_object('id', old.id))
    end
  );
  return coalesce(new, old);
end;
$$;

-- Consistencia: trg_audit_persons (0006/0016) tampoco resta la PII cifrada del
-- reportante en el diff de INSERT (sí en UPDATE). Lo igualamos aquí (mínima
-- retención). Mantiene la guarda del flag y el resto del comportamiento.
create or replace function trg_audit_persons()
returns trigger language plpgsql security definer as $$
begin
  if coalesce(current_setting('faro.skip_persons_audit', true), '') = '1' then
    return coalesce(new, old);
  end if;
  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, diff)
  values (
    coalesce(auth.jwt() ->> 'role', 'public'),
    coalesce(auth.jwt() ->> 'sub', null),
    lower(tg_op),
    'person',
    coalesce(new.id, old.id)::text,
    case
      when tg_op = 'INSERT' then jsonb_build_object(
        'new', to_jsonb(new) - 'reporter_email_encrypted' - 'reporter_phone_encrypted'
      )
      when tg_op = 'UPDATE' then jsonb_build_object(
        'before', to_jsonb(old) - 'reporter_email_encrypted' - 'reporter_phone_encrypted',
        'after',  to_jsonb(new) - 'reporter_email_encrypted' - 'reporter_phone_encrypted'
      )
      when tg_op = 'DELETE' then jsonb_build_object('deleted', jsonb_build_object('id', old.id))
    end
  );
  return coalesce(new, old);
end;
$$;

-- ─── (4) moderate_note ───────────────────────────────────────────────────────
create or replace function moderate_note(
  p_id uuid,
  p_decision text,
  p_moderator_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role  moderator_role;
  v_email text;
  v_old   moderation_status_type;
  v_new   moderation_status_type;
  v_notes text;
begin
  -- Solo approved/rejected para notas: 'duplicate'/'needs_info' dejarían la nota
  -- hidden y fuera de la cola (irrecuperable), sin valor en este flujo simple
  -- (revisión adversarial: database-002). Así los conteos de stats quedan completos.
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decisión de moderación no permitida para notas: %', p_decision;
  end if;
  v_new := p_decision::moderation_status_type;

  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_new <> 'approved' and v_notes is null then
    raise exception 'rechazar exige un motivo';
  end if;

  select role, email into v_role, v_email
  from moderators where id = p_moderator_id and active = true;
  if not found then
    raise exception 'moderador % no autorizado', p_moderator_id;
  end if;

  select moderation_status into v_old from notes where id = p_id;
  if not found then
    raise exception 'nota % no existe', p_id;
  end if;

  -- Suprimir la fila de audit genérica para este UPDATE (la explícita va abajo).
  perform set_config('faro.skip_persons_audit', '1', true);

  update notes
     set moderation_status = v_new,
         moderated_by      = p_moderator_id,
         moderated_at      = now(),
         hidden            = (v_new = 'rejected')   -- rechazada → fuera del público
   where id = p_id;

  perform set_config('faro.skip_persons_audit', '0', true);

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason, diff)
  values (
    v_role::text,
    p_moderator_id::text,
    case v_new when 'approved' then 'approve' when 'rejected' then 'reject' else v_new::text end,
    'note',
    p_id::text,
    v_notes,
    jsonb_build_object('from', v_old, 'to', v_new, 'moderator_email', v_email)
  );

  return jsonb_build_object('id', p_id, 'from', v_old, 'to', v_new);
end;
$$;

comment on function moderate_note(uuid, text, uuid, text) is
  'Aplica una decisión de moderación a una nota (atómico: update + audit con actor=moderador). Aprobada → pública; rechazada/dup/info → hidden. Solo service_role.';

revoke all on function moderate_note(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function moderate_note(uuid, text, uuid, text) to service_role;

notify pgrst, 'reload schema';
