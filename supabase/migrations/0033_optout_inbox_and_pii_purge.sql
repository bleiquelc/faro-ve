-- ─────────────────────────────────────────────────────────────────────────────
-- 0033_optout_inbox_and_pii_purge.sql · Las dos reglas inmutables que llevaban
-- meses SIN software que las cumpliera (29-jul-2026).
--
--   · Regla #10 — cron lector del inbox opt-out. El Email Routing de Cloudflare
--     está completo desde el 12-jul (opt-out@ / contacto@ / federacion@ → Gmail
--     del founder), pero NADIE leía el buzón: el SLA público de 24h impreso en
--     el footer y en /atribucion era una promesa sin mecanismo.
--   · Regla #6 — purga de PII a los 30 días post-retiro (Habeas Data, Art. 28
--     Const. Venezuela). La columna `purge_pii_at` existe desde 0001 esperando
--     su cron. Medido hoy: 22 retirados, el primer vencimiento es el 31-jul
--     (21 personas) — o sea, en 2 días. Ninguno lleva PII de reportante todavía
--     (son registros ingestados), pero el mecanismo tiene que existir ANTES de
--     que un reporte hecho en Faro con email sea retirado.
--
-- DECISIÓN DEL FOUNDER (29-jul) sobre la purga por opt-out: auto-ejecutar SOLO
-- si el remitente coincide con el dominio de la fuente. Como el `From` de un
-- correo se falsifica trivialmente, acá se exige ADEMÁS que DKIM haya pasado
-- (lo verifica Cloudflare antes de entregar y lo registra el Worker). Sin las
-- dos cosas, la petición queda en 'needs_review' y la ejecuta el founder.
-- Esto protege un DELETE potencial de 47.800 personas del mapa que la gente usa
-- para buscar a los suyos.
--
-- Aplicar en el SQL Editor de Supabase (un pegado).
-- Tras aplicar:  notify pgrst, 'reload schema';  (incluido al final)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Buzón de cuarentena: lo que llega a opt-out@ ────────────────────────────
-- El Email Worker de Cloudflare SOLO escribe acá. Nunca borra ni desactiva nada
-- por su cuenta: separar CAPTURA (evento) de ACCIÓN (mantenimiento diario) es lo
-- que impide que un correo anónimo dispare un borrado masivo.
create table if not exists optout_requests (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  from_email text not null,
  from_domain text not null,
  subject text,
  body_snippet text,                 -- primeros 2000 chars, para que el founder decida
  dkim_pass bool not null default false,
  spf_pass bool not null default false,
  matched_source_id uuid references import_sources(id) on delete set null,
  status text not null default 'needs_review',   -- needs_review | auto_eligible | processed | rejected
  processed_at timestamptz,
  processed_note text,
  message_id text unique,            -- idempotencia: el Worker puede reintentar
  created_at timestamptz not null default now()
);

create index if not exists optout_requests_pending_idx
  on optout_requests (received_at desc) where processed_at is null;

alter table optout_requests enable row level security;
-- Sin policies = nadie que no sea service_role lo ve. El buzón trae direcciones
-- de correo de terceros: no es dato público (#2).
revoke all on optout_requests from anon, authenticated;

-- ─── record_optout_request: lo llama el Email Worker ─────────────────────────
-- Clasifica pero NO actúa. Decide 'auto_eligible' solo con dominio coincidente
-- Y DKIM válido (decisión founder 29-jul).
create or replace function record_optout_request(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from     text := lower(trim(payload->>'from_email'));
  v_domain   text;
  v_msgid    text := nullif(payload->>'message_id', '');
  v_dkim     bool := coalesce((payload->>'dkim_pass')::bool, false);
  v_spf      bool := coalesce((payload->>'spf_pass')::bool, false);
  v_src      import_sources%rowtype;
  v_status   text;
  v_id       uuid;
begin
  if v_from is null or v_from = '' or position('@' in v_from) = 0 then
    raise exception 'from_email inválido';
  end if;
  v_domain := split_part(v_from, '@', 2);

  -- Idempotencia: el Worker puede reintentar la misma entrega.
  select id into v_id from optout_requests where message_id is not null and message_id = v_msgid;
  if found then
    return jsonb_build_object('ok', true, 'already', true, 'id', v_id);
  end if;

  -- ¿El remitente pertenece al dominio de alguna fuente? Se compara contra el
  -- host de base_url (contact_email está vacío en todas hoy) y se acepta el
  -- dominio exacto o un subdominio suyo.
  select * into v_src
    from import_sources s
   where s.base_url ~ '^https?://'
     and (
       v_domain = regexp_replace(regexp_replace(s.base_url, '^https?://', ''), '^www\.|/.*$', '', 'g')
       or v_domain like '%.' || regexp_replace(regexp_replace(s.base_url, '^https?://', ''), '^www\.|/.*$', '', 'g')
       or v_domain = split_part(coalesce(s.contact_email, ''), '@', 2)
     )
   limit 1;

  -- Auto-ejecutable SOLO con fuente identificada + DKIM válido. Todo lo demás
  -- espera al founder: un `From` sin DKIM se falsifica en 30 segundos.
  v_status := case when found and v_dkim then 'auto_eligible' else 'needs_review' end;

  insert into optout_requests (from_email, from_domain, subject, body_snippet,
                               dkim_pass, spf_pass, matched_source_id, status, message_id)
  values (v_from, v_domain,
          left(coalesce(payload->>'subject', ''), 500),
          left(coalesce(payload->>'body', ''), 2000),
          v_dkim, v_spf, v_src.id, v_status, v_msgid)
  returning id into v_id;

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason)
  values ('system', 'email-worker', 'opt_out', 'source',
          coalesce(v_src.slug, v_domain),
          format('petición recibida en opt-out@ de %s (dkim=%s) → %s', v_from, v_dkim, v_status));

  return jsonb_build_object('ok', true, 'already', false, 'id', v_id,
                            'status', v_status, 'source', v_src.slug);
end;
$$;

comment on function record_optout_request(jsonb) is
  '0033 (regla #10): registra en cuarentena un correo llegado a opt-out@. Clasifica (auto_eligible solo con dominio de fuente + DKIM ok) pero NO purga. Solo service_role.';

-- ─── process_optout_request: ejecuta la baja + purga (regla #10) ─────────────
-- Lo llama el mantenimiento diario para las 'auto_eligible', o el founder a mano
-- para una que haya revisado.
create or replace function process_optout_request(p_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r          optout_requests%rowtype;
  v_src      import_sources%rowtype;
  v_deleted  int := 0;
begin
  select * into r from optout_requests where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no existe');
  end if;
  if r.processed_at is not null then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if r.matched_source_id is null then
    return jsonb_build_object('ok', false, 'error', 'sin fuente identificada — resolver a mano');
  end if;

  select * into v_src from import_sources where id = r.matched_source_id;

  -- 1) Cortar la ingesta.
  update import_sources
     set enabled = false,
         contact_opt_out_received_at = coalesce(contact_opt_out_received_at, r.received_at),
         updated_at = now()
   where id = r.matched_source_id;

  -- 2) Purgar lo importado de esa fuente. Se respeta al pie la regla #10:
  --    DELETE WHERE source=X AND withdrawn_at IS NULL. Los ya retirados se dejan
  --    para que su purga de PII siga su propio calendario de 30d (#6).
  delete from persons
   where source = v_src.slug
     and withdrawn_at is null;
  get diagnostics v_deleted = row_count;

  update optout_requests
     set processed_at = now(),
         status = 'processed',
         processed_note = coalesce(p_note, format('fuente %s desactivada, %s registros purgados', v_src.slug, v_deleted))
   where id = p_id;

  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason)
  values ('cron', 'maintenance', 'opt_out', 'source', v_src.slug,
          format('OPT-OUT ejecutado por petición de %s: fuente desactivada + %s registros purgados', r.from_email, v_deleted));

  return jsonb_build_object('ok', true, 'source', v_src.slug, 'deleted', v_deleted);
end;
$$;

comment on function process_optout_request(uuid, text) is
  '0033 (regla #10): desactiva la fuente + purga sus registros no-retirados + audita. Solo service_role.';

-- ─── purge_withdrawn_pii: Habeas Data a los 30 días (regla #6) ───────────────
-- Idempotente: solo toca filas que TODAVÍA tienen PII, así correrlo a diario no
-- genera audit-ruido ni escrituras inútiles.
create or replace function purge_withdrawn_pii()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids  uuid[];
  v_n    int := 0;
begin
  select array_agg(id) into v_ids
    from persons
   where purge_pii_at is not null
     and purge_pii_at < now()
     and (reporter_email_encrypted is not null
       or reporter_phone_encrypted is not null
       or reporter_email_hash is not null
       or reporter_phone_hash is not null
       or reporter_name is not null);

  if v_ids is null or array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', true, 'purged', 0);
  end if;

  update persons
     set reporter_name = null,
         reporter_email_hash = null,
         reporter_email_encrypted = null,
         reporter_phone_hash = null,
         reporter_phone_encrypted = null,
         updated_at = now()
   where id = any(v_ids);
  get diagnostics v_n = row_count;

  -- Auditoría OBLIGATORIA (regla #6): queda constancia de qué se purgó y cuándo.
  -- Se registran los ids, NUNCA el dato purgado.
  insert into audit_log (actor_type, actor_id, action, entity_type, entity_id, reason)
  values ('cron', 'maintenance', 'purge', 'person', null,
          format('Habeas Data #6: PII de reportante purgada en %s reporte(s) retirado(s) hace +30d. ids=%s',
                 v_n, array_to_string(v_ids[1:50], ',')));

  return jsonb_build_object('ok', true, 'purged', v_n);
end;
$$;

comment on function purge_withdrawn_pii() is
  '0033 (regla #6 / Habeas Data Art. 28): purga la PII de reportante de los retiros con +30 días. Idempotente y auditada. Solo service_role.';

-- ─── Permisos: como el resto del sistema, SOLO service_role ─────────────────
revoke all on function record_optout_request(jsonb) from public, anon, authenticated;
revoke all on function process_optout_request(uuid, text) from public, anon, authenticated;
revoke all on function purge_withdrawn_pii() from public, anon, authenticated;
grant execute on function record_optout_request(jsonb) to service_role;
grant execute on function process_optout_request(uuid, text) to service_role;
grant execute on function purge_withdrawn_pii() to service_role;

insert into _faro_migrations (name) values ('0033_optout_inbox_and_pii_purge')
  on conflict do nothing;

notify pgrst, 'reload schema';
