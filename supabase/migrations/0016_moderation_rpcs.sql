-- ─────────────────────────────────────────────────────────────────────────────
-- 0016_moderation_rpcs.sql
--
-- Panel de moderación (D3). Cola de reportes pending + decisiones del moderador.
-- Confirmado por el founder (lane "Panel /moderar").
--
--  (1) moderation_queue(p_limit, p_offset) → cola de personas pending, ordenada
--      por la regla #20 (ai_priority desc, medical_urgent desc, is_minor desc,
--      created_at asc). Incluye coords EXACTAS (el moderador SÍ las ve, #1) y
--      NUNCA PII de reportante en claro (#2): solo nombre/relación/país + un flag
--      has_reporter_contact. Devuelve { total, items }.
--  (2) moderation_stats() → conteos por moderation_status (encabezado del panel).
--  (3) moderate_person(p_id, p_decision, p_moderator_id, p_notes) → aplica la
--      decisión (approved|rejected|duplicate|needs_info) de forma ATÓMICA: update
--      de persons + audit_log explícito con actor = moderador. Valida que el
--      moderador esté activo y la decisión sea de la whitelist. Espeja el patrón
--      de reactivate_aid_point (0014).
--
-- Idempotente. Reusa: persons, moderators, audit_log (0001/0006). Solo
-- service_role ejecuta las RPCs (el panel corre server-side con service_role; la
-- autorización del moderador la impone el endpoint vía locals.moderator).
-- Tras aplicar:  notify pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Índice para la cola de moderación ───────────────────────────────────────
-- Orden de la regla #20 sobre el subconjunto pending. Parcial (solo pending) →
-- pequeño y siempre caliente aunque la tabla crezca a cientos de miles.
create index if not exists persons_moderation_queue_idx
  on persons (ai_priority desc nulls last, medical_urgent desc, is_minor desc, created_at asc)
  where moderation_status = 'pending' and withdrawn_at is null;

-- ─── (1) moderation_queue ─────────────────────────────────────────────────────
create or replace function moderation_queue(p_limit int default 25, p_offset int default 0)
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  with q as (
    select p.*
    from persons p
    where p.moderation_status = 'pending' and p.withdrawn_at is null
    order by p.ai_priority desc nulls last, p.medical_urgent desc, p.is_minor desc, p.created_at asc
    limit greatest(0, least(coalesce(p_limit, 25), 200))
    offset greatest(0, coalesce(p_offset, 0))
  )
  select jsonb_build_object(
    'total', (
      select count(*) from persons
      where moderation_status = 'pending' and withdrawn_at is null
    ),
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'pfif_id', q.pfif_id,
          'source', q.source,
          'source_id', q.source_id,
          'source_url', q.source_url,
          'source_date', q.source_date,
          'given_name', q.given_name,
          'family_name', q.family_name,
          'full_name', q.full_name,
          'alternate_names', q.alternate_names,
          'sex', q.sex,
          'age', q.age,
          'is_minor', q.is_minor,
          'unaccompanied_minor', q.unaccompanied_minor,
          'status', q.status,
          'home_neighborhood', q.home_neighborhood,
          'home_city', q.home_city,
          'home_state', q.home_state,
          'last_known_location_text', q.last_known_location_text,
          -- Coords EXACTAS — el moderador las ve (#1). Solo viajan al navegador
          -- del moderador autenticado, nunca al público.
          'lat_exact', ST_Y(q.last_known_location_point::geometry),
          'lng_exact', ST_X(q.last_known_location_point::geometry),
          'lat_obfuscated', ST_Y(q.last_known_location_obfuscated::geometry),
          'lng_obfuscated', ST_X(q.last_known_location_obfuscated::geometry),
          'last_seen_at', q.last_seen_at,
          'description', q.description,
          'height_cm', q.height_cm,
          'hair_color', q.hair_color,
          'eye_color', q.eye_color,
          'skin_tone', q.skin_tone,
          'clothing_top', q.clothing_top,
          'clothing_bottom', q.clothing_bottom,
          'clothing_shoes', q.clothing_shoes,
          'distinguishing_marks', q.distinguishing_marks,
          'photo_url', q.photo_url,
          'photo_visibility', q.photo_visibility,
          'medical_urgent', q.medical_urgent,
          'medical_category', q.medical_category,
          'medical_notes', q.medical_notes,
          -- PII de reportante: NUNCA el email/phone (cifrados, #2). Solo lo no
          -- sensible + un flag de si hay forma de contacto (para saber si el relay
          -- es posible) — sin revelar el dato.
          'reporter_relation', q.reporter_relation,
          'reporter_name', q.reporter_name,
          'reporter_country', q.reporter_country,
          'has_reporter_contact',
            (q.reporter_email_encrypted is not null or q.reporter_phone_encrypted is not null),
          'ai_priority', q.ai_priority,
          'ai_reasoning', q.ai_reasoning,
          'ai_classified_at', q.ai_classified_at,
          'created_at', q.created_at
        )
        order by q.ai_priority desc nulls last, q.medical_urgent desc, q.is_minor desc, q.created_at asc
      ),
      '[]'::jsonb
    )
  )
  from q;
$$;

comment on function moderation_queue(int, int) is
  'Cola de moderación: personas pending ordenadas por regla #20. Coords EXACTAS (moderador, #1); NUNCA email/phone de reportante (#2). Solo service_role; el endpoint exige locals.moderator.';

revoke all on function moderation_queue(int, int) from public, anon, authenticated;
grant execute on function moderation_queue(int, int) to service_role;

-- ─── (2) moderation_stats ─────────────────────────────────────────────────────
create or replace function moderation_stats()
returns jsonb
language sql
security definer
set search_path = public, extensions
stable
as $$
  select jsonb_build_object(
    'pending',   count(*) filter (where moderation_status = 'pending'   and withdrawn_at is null),
    'approved',  count(*) filter (where moderation_status = 'approved'  and withdrawn_at is null),
    'rejected',  count(*) filter (where moderation_status = 'rejected'),
    'duplicate', count(*) filter (where moderation_status = 'duplicate'),
    'needs_info',count(*) filter (where moderation_status = 'needs_info' and withdrawn_at is null)
  )
  from persons;
$$;

revoke all on function moderation_stats() from public, anon, authenticated;
grant execute on function moderation_stats() to service_role;

-- ─── Supresión del audit-fantasma en moderación (revisión adversarial, critic-1) ─
-- moderate_person hace UPDATE sobre persons → dispara trg_audit_persons (0006),
-- que bajo service_role registra una fila actor='service_role'/sub=NULL action='update'
-- (un actor NO humano) ADEMÁS de la fila explícita correcta. Para un trail Habeas
-- Data limpio, redefinimos el trigger para que respete un flag TRANSACCIONAL que
-- solo moderate_person activa: cuando está activo, NO escribe la fila genérica (la
-- RPC ya inserta la fila semántica con actor=moderador). Todo lo demás (inserts/
-- updates normales de persons) sigue auditando igual (flag ausente = lógica 0006).
create or replace function trg_audit_persons()
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
    'person',
    coalesce(new.id, old.id)::text,
    case
      when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
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

-- ─── (3) moderate_person ──────────────────────────────────────────────────────
-- Decisión atómica: update + audit_log en una sola transacción. Si el audit
-- fallara, la decisión NO queda (Habeas Data: toda acción de moderación auditada).
create or replace function moderate_person(
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
  -- Whitelist dura de decisiones (espeja el enum Zod del borde).
  if p_decision not in ('approved', 'rejected', 'duplicate', 'needs_info') then
    raise exception 'decisión de moderación no permitida: %', p_decision;
  end if;
  v_new := p_decision::moderation_status_type;

  -- Motivo obligatorio salvo para aprobar (rendición de cuentas).
  v_notes := nullif(trim(coalesce(p_notes, '')), '');
  if v_new <> 'approved' and v_notes is null then
    raise exception 'rechazar/duplicado/falta-info exige un motivo';
  end if;

  -- El moderador debe existir y estar ACTIVO. Defensa en profundidad: el endpoint
  -- ya validó locals.moderator (getUser + tabla), pero la RPC no confía en eso.
  select role, email into v_role, v_email
  from moderators
  where id = p_moderator_id and active = true;
  if not found then
    raise exception 'moderador % no autorizado', p_moderator_id;
  end if;

  -- El reporte debe existir. Se permite re-moderar (p.ej. corregir un rechazo a
  -- aprobado), registrando la transición en el audit.
  select moderation_status into v_old from persons where id = p_id;
  if not found then
    raise exception 'persona % no existe', p_id;
  end if;

  -- Suprimir la fila de audit genérica del trigger SOLO para este UPDATE: el
  -- audit semántico (con actor=moderador) lo inserta esta RPC justo abajo. El flag
  -- es transaccional (se limpia al cerrar la tx; en PostgREST cada RPC = 1 tx).
  perform set_config('faro.skip_persons_audit', '1', true);

  update persons
     set moderation_status = v_new,
         moderated_by      = p_moderator_id,
         moderated_at      = now(),
         moderation_notes  = v_notes
   where id = p_id;

  perform set_config('faro.skip_persons_audit', '0', true);

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason, diff)
  values (
    v_role::text,                  -- 'admin' | 'moderator'
    p_moderator_id::text,
    case v_new
      when 'approved' then 'approve'
      when 'rejected' then 'reject'
      else v_new::text             -- 'duplicate' | 'needs_info'
    end,
    'person',
    p_id::text,
    v_notes,
    jsonb_build_object('from', v_old, 'to', v_new, 'moderator_email', v_email)
  );

  return jsonb_build_object('id', p_id, 'from', v_old, 'to', v_new);
end;
$$;

comment on function moderate_person(uuid, text, uuid, text) is
  'Aplica una decisión de moderación a una persona (atómico: update + audit_log con actor=moderador). Valida moderador activo + decisión. Solo service_role.';

revoke all on function moderate_person(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function moderate_person(uuid, text, uuid, text) to service_role;

-- ─── Seed: el founder como admin (superadmin, CLAUDE.md). Idempotente. ────────
-- Sin esto la tabla moderators está vacía y nadie podría entrar al panel. El
-- magic-link solo se envía a un moderador activo (anti-enumeración en el login).
insert into moderators (email, full_name, role, active)
values ('bleiquelc@gmail.com', 'Bleiquel Colina', 'admin', true)
on conflict (email) do update set role = 'admin', active = true;

-- Recargar el cache de PostgREST tras los cambios de schema.
notify pgrst, 'reload schema';
