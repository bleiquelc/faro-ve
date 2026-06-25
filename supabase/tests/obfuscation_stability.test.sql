-- ─────────────────────────────────────────────────────────────────────────────
-- Test de regresión: estabilidad de la ofuscación frente a ediciones repetidas.
--
-- Verifica el fix del "ataque de promediado": editar una nota/persona N veces
-- NO debe regenerar el offset ofuscado, porque promediar N muestras del mismo
-- centro recuperaría la coordenada exacta (~r/√N).
--
-- Correr con: psql "$DATABASE_URL" -f supabase/tests/obfuscation_stability.test.sql
-- (idempotente: limpia sus propias filas al final).
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  pid uuid;
  nid uuid;
  p_obf0 geography(Point, 4326);
  p_obfN geography(Point, 4326);
  n_obf0 geography(Point, 4326);
  n_obfN geography(Point, 4326);
  i int;
begin
  -- ── persons: insertar con punto exacto, capturar offset inicial ──
  insert into persons (given_name, family_name, status, last_known_location_point, source, source_id)
  values ('TEST', 'Obfusc', 'missing',
          ST_GeogFromText('SRID=4326;POINT(-66.9036 10.4806)'),
          'test-obfusc', 'stability-1')
  returning id, last_known_location_obfuscated into pid, p_obf0;

  -- 100 updates que NO cambian el punto (editar descripción, aprobar, etc.)
  for i in 1..100 loop
    update persons set description = 'edit ' || i where id = pid;
  end loop;
  select last_known_location_obfuscated into p_obfN from persons where id = pid;

  if not ST_Equals(p_obf0::geometry, p_obfN::geometry) then
    raise exception 'FALLO persons: offset cambió tras 100 updates (ataque de promediado posible). antes=% despues=%', ST_AsText(p_obf0), ST_AsText(p_obfN);
  end if;

  -- El offset debe estar entre 200 y 500m del punto exacto.
  if ST_Distance(p_obf0, ST_GeogFromText('SRID=4326;POINT(-66.9036 10.4806)')) not between 200 and 500 then
    raise exception 'FALLO persons: offset fuera del anillo 200-500m: %m', ST_Distance(p_obf0, ST_GeogFromText('SRID=4326;POINT(-66.9036 10.4806)'));
  end if;

  -- ── notes: mismo test (este era el trigger sin change-guard) ──
  insert into notes (person_id, type, text, sighting_location_point, source)
  values (pid, 'sighting', 'avistamiento test',
          ST_GeogFromText('SRID=4326;POINT(-66.8186 10.4773)'), 'test-obfusc')
  returning id, sighting_location_obfuscated into nid, n_obf0;

  for i in 1..100 loop
    update notes set text = 'edit ' || i where id = nid;
  end loop;
  select sighting_location_obfuscated into n_obfN from notes where id = nid;

  if not ST_Equals(n_obf0::geometry, n_obfN::geometry) then
    raise exception 'FALLO notes: offset de avistamiento cambió tras 100 updates (FUGA por promediado). antes=% despues=%', ST_AsText(n_obf0), ST_AsText(n_obfN);
  end if;

  -- ── Cambiar el punto SÍ debe regenerar el offset ──
  update persons set last_known_location_point = ST_GeogFromText('SRID=4326;POINT(-66.8537 10.4933)') where id = pid;
  select last_known_location_obfuscated into p_obfN from persons where id = pid;
  if ST_Equals(p_obf0::geometry, p_obfN::geometry) then
    raise exception 'FALLO persons: el offset NO se regeneró al cambiar el punto exacto.';
  end if;

  -- Limpieza
  delete from notes where id = nid;
  delete from persons where id = pid;

  raise notice 'OK obfuscation_stability: offset estable en 100 ediciones, dentro del anillo, y regenerado al cambiar el punto.';
end $$;
