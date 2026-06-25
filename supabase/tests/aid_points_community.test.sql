-- ─────────────────────────────────────────────────────────────────────────────
-- aid_points_community.test.sql
-- Verifica la lógica de autorregulación de 0014 end-to-end. Pensado para correr
-- dentro de una transacción que el runner hace ROLLBACK (no deja datos).
-- Requiere APP_SALT configurado (encrypt_pii) y search_path con extensions.
-- Lanza excepción en la primera aserción que falle; si llega al final, PASA.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_id        uuid;
  v_id2       uuid;
  v_res       jsonb;
  v_active    bool;
  v_auto      bool;
  v_conf      int;
  v_rep       int;
  v_phone_enc bytea;
  v_react     int;
  v_alerts    int;
  v_n         int;
begin
  -- 1) Alta pública → visible al instante, sin verificar, sin organización.
  v_res := register_aid_point(jsonb_build_object(
    'type', 'water', 'name', 'TEST acopio', 'address_text', 'calle test 1',
    'lat', 10.5, 'lng', -66.9, 'supplies', jsonb_build_array('agua', 'comida')
  ));
  v_id := (v_res->>'id')::uuid;
  if v_id is null then raise exception 'register_aid_point no devolvió id'; end if;

  select verified, organization_id is null into v_active, v_auto from aid_points where id = v_id;
  if v_active then raise exception 'alta pública no debe quedar verificada'; end if;
  if not v_auto then raise exception 'alta pública NO debe tener organización (anti-suplantación)'; end if;

  select count(*) into v_n from aid_points_public where id = v_id;
  if v_n <> 1 then raise exception 'punto nuevo no visible en aid_points_public'; end if;

  -- 2) 3 reportes de 3 IPs → auto-ocultar al 3.º (net = 3).
  perform vote_aid_point(v_id, 'report', 'ip_1');
  perform vote_aid_point(v_id, 'report', 'ip_2');
  v_res := vote_aid_point(v_id, 'report', 'ip_3');
  if (v_res->>'auto_hidden')::bool is not true then
    raise exception 'no se auto-ocultó con net=3: %', v_res;
  end if;

  select active, auto_hidden into v_active, v_auto from aid_points where id = v_id;
  if v_active or not v_auto then raise exception 'estado tras auto-ocultar incorrecto'; end if;

  select count(*) into v_n from aid_points_public where id = v_id;
  if v_n <> 0 then raise exception 'punto oculto sigue en aid_points_public'; end if;

  -- get_aid_point lo alcanza (para reactivar) y NO filtra el teléfono.
  v_res := get_aid_point(v_id);
  if v_res is null then raise exception 'get_aid_point no devolvió el punto oculto'; end if;
  if v_res ? 'reactivated_by_phone_encrypted' then raise exception 'get_aid_point filtró el teléfono'; end if;
  if (v_res->>'auto_hidden')::bool is not true then raise exception 'get_aid_point no refleja oculto'; end if;

  select count(*) into v_alerts from founder_alerts where aid_point_id = v_id and kind = 'aid_auto_hidden';
  if v_alerts <> 1 then raise exception 'falta founder_alert aid_auto_hidden (n=%)', v_alerts; end if;

  -- 3) Reactivar con WhatsApp → activo, net reseteado, teléfono cifrado, alerta.
  v_res := reactivate_aid_point(v_id, '+58 412 1234567', 'ip_react');
  select active, auto_hidden, reactivation_count, reactivated_by_phone_encrypted, confirm_count, report_count
    into v_active, v_auto, v_react, v_phone_enc, v_conf, v_rep
    from aid_points where id = v_id;
  if not v_active or v_auto then raise exception 'reactivación no dejó el punto activo'; end if;
  if v_react <> 1 then raise exception 'reactivation_count != 1 (%)', v_react; end if;
  if v_phone_enc is null then raise exception 'el teléfono no se cifró'; end if;
  if v_conf <> 0 or v_rep <> 0 then raise exception 'net no se reseteó (c=% r=%)', v_conf, v_rep; end if;
  if pgp_sym_decrypt(v_phone_enc, get_app_salt()) <> '+58 412 1234567' then
    raise exception 'el teléfono cifrado no descifra al original';
  end if;

  select count(*) into v_alerts from founder_alerts where aid_point_id = v_id and kind = 'aid_reactivated';
  if v_alerts <> 1 then raise exception 'falta founder_alert aid_reactivated'; end if;

  -- 4) Votos PREVIOS a la reactivación no cuentan (net = 0).
  v_res := recompute_aid_point_status(v_id);
  if (v_res->>'net')::int <> 0 then
    raise exception 'votos previos a la reactivación todavía cuentan: %', v_res;
  end if;

  -- 5) 3 reportes NUEVOS (mismas IPs, upsert refresca created_at) → re-oculta.
  perform vote_aid_point(v_id, 'report', 'ip_1');
  perform vote_aid_point(v_id, 'report', 'ip_2');
  v_res := vote_aid_point(v_id, 'report', 'ip_3');
  if (v_res->>'auto_hidden')::bool is not true then
    raise exception 'no se re-ocultó con 3 reportes nuevos tras reactivar: %', v_res;
  end if;

  -- 6) recompute SOLO oculta, nunca des-oculta (eso es exclusivo de reactivar).
  perform vote_aid_point(v_id, 'confirm', 'ip_1');  -- ip_1: report → confirm (net baja)
  select active, auto_hidden into v_active, v_auto from aid_points where id = v_id;
  if v_active or not v_auto then raise exception 'recompute no debe des-ocultar'; end if;

  -- 7) reactivar exige un WhatsApp válido (rechaza basura).
  begin
    perform reactivate_aid_point(v_id, '12', 'ip_x');
    raise exception 'reactivate_aid_point aceptó un teléfono inválido';
  exception when others then
    if sqlerrm not like '%WhatsApp%' then raise; end if;
  end;

  -- 8) La superficie pública NUNCA expone el teléfono cifrado ni la IP de origen.
  if exists (
    select 1 from information_schema.columns
    where table_name = 'aid_points_public'
      and column_name in ('reactivated_by_phone_encrypted', 'submitted_ip_hashed')
  ) then
    raise exception 'aid_points_public expone columnas sensibles';
  end if;

  -- 9) 1 voto por IP: la misma IP no crea filas duplicadas (unique + upsert).
  select count(*) into v_n from aid_point_votes where aid_point_id = v_id and ip_hashed = 'ip_1';
  if v_n <> 1 then raise exception 'la misma IP creó % filas de voto (debe ser 1)', v_n; end if;

  -- 10) PRIVACIDAD: anon/authenticated NO leen la tabla base; sí la vista pública.
  if has_table_privilege('anon', 'aid_points', 'SELECT') then
    raise exception 'anon todavía tiene SELECT sobre la tabla base aid_points';
  end if;
  if has_table_privilege('authenticated', 'aid_points', 'SELECT') then
    raise exception 'authenticated todavía tiene SELECT sobre la tabla base aid_points';
  end if;
  if not has_table_privilege('anon', 'aid_points_public', 'SELECT') then
    raise exception 'anon no puede leer la vista pública aid_points_public';
  end if;

  -- 11) Canal admin auditado para descifrar el WhatsApp del reactivador (#2/#8).
  --     (v_id se reactivó con '+58 412 1234567' en el paso 3.)
  if get_aid_point_reactivator_phone(v_id, 'admin-test') <> '+58 412 1234567' then
    raise exception 'get_aid_point_reactivator_phone no devolvió el teléfono';
  end if;
  select count(*) into v_n from audit_log where entity_id = v_id::text and action = 'decrypt';
  if v_n < 1 then raise exception 'la lectura admin del teléfono no se auditó'; end if;
  -- admin_id vacío → rechaza (no descifrar PII sin actor identificable).
  begin
    perform get_aid_point_reactivator_phone(v_id, '');
    raise exception 'get_aid_point_reactivator_phone aceptó admin_id vacío';
  exception when others then
    if sqlerrm not like '%admin_id%' then raise; end if;
  end;

  -- 12) Guarda de caducidad: un punto caducado NO se auto-oculta ni alerta (#4).
  v_res := register_aid_point(jsonb_build_object(
    'type', 'food', 'name', 'TEST caducado', 'address_text', 'calle x', 'lat', 10.5, 'lng', -66.9
  ));
  v_id2 := (v_res->>'id')::uuid;
  update aid_points set expires_at = now() - interval '1 day' where id = v_id2;
  perform vote_aid_point(v_id2, 'report', 'e1');
  perform vote_aid_point(v_id2, 'report', 'e2');
  v_res := vote_aid_point(v_id2, 'report', 'e3');
  if (v_res->>'auto_hidden')::bool is true then
    raise exception 'un punto caducado no debe auto-ocultarse ni alertar al founder';
  end if;

  raise notice 'aid_points_community.test.sql OK';
end $$;
