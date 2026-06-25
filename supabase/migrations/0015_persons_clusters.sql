-- ─────────────────────────────────────────────────────────────────────────────
-- 0015_persons_clusters.sql
--
-- Agregación espacial server-side para el mapa: burbujas por ZONA con conteos
-- REALES (no la muestra topada a 1000 que el cluster del cliente mostraba).
--
-- persons_clusters(bbox, cell, filtros) agrupa TODOS los aprobados por celda de
-- grilla (ST_SnapToGrid sobre la coord YA OFUSCADA) y devuelve, por celda, el
-- centroide + el conteo. El cliente pinta una burbuja por celda con su número; al
-- acercar, el cliente pide celdas más finas → las zonas se separan en burbujas
-- más pequeñas (y a zoom alto cambia a pines individuales).
--
-- Privacidad (#1): NO devuelve datos individuales — solo centroides agregados (de
-- puntos ya ofuscados 300m) y conteos. El centroide de una celda con muchas
-- personas ≈ el ancla pública de la ciudad (no la ubicación de nadie). A zoom alto,
-- las celdas con pocas personas no aportan más info que los pines ofuscados que el
-- mapa ya muestra públicamente. Solo lectura agregada.
--
-- Idempotente.  Tras aplicar:  notify pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────

-- El filtro espacial && usa el índice GIST sobre last_known_location_obfuscated
-- que YA existe desde 0002 (persons_loc_obfuscated_gist). No se recrea aquí
-- (un segundo índice con otro nombre duplicaría el overhead de escritura).

create or replace function persons_clusters(
  p_min_lng  float8,
  p_min_lat  float8,
  p_max_lng  float8,
  p_max_lat  float8,
  p_cell     float8,
  p_status   text default null,
  p_is_minor boolean default null,
  p_medical  boolean default null
)
returns table (lat float8, lng float8, n int)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    -- Centroide de los puntos (ya ofuscados) de la celda. Para una celda con
    -- muchas personas tiende al ancla de la ciudad; nunca a un individuo.
    ST_Y(ST_Centroid(ST_Collect(g)))::float8 as lat,
    ST_X(ST_Centroid(ST_Collect(g)))::float8 as lng,
    count(*)::int as n
  from (
    select
      last_known_location_obfuscated::geometry as g,
      ST_SnapToGrid(
        last_known_location_obfuscated::geometry,
        greatest(p_cell, 0.0005)  -- piso de celda ~55m (no por debajo del offset de ofuscación)
      ) as cell
    from persons
    where moderation_status = 'approved'
      and withdrawn_at is null
      and last_known_location_obfuscated is not null
      and last_known_location_obfuscated
          && ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)::geography
      -- status::text = p_status (no p_status::person_status): comparar texto evita
      -- que un status inválido lance un error de enum crudo al cliente (defensa en
      -- profundidad; el borde Zod ya valida contra el enum).
      and (p_status   is null or status::text = p_status)
      and (p_is_minor is null or is_minor = p_is_minor)
      and (p_medical  is null or medical_urgent = p_medical)
  ) s
  group by cell
  order by count(*) desc
  limit 2000;
$$;

comment on function persons_clusters(float8, float8, float8, float8, float8, text, boolean, boolean) is
  'Agregación espacial para el mapa: cuenta aprobados por celda de grilla (sobre la coord OFUSCADA) dentro del bbox. Devuelve SOLO centroide agregado + conteo (sin datos individuales, #1). Lectura pública.';

-- Solo lectura agregada → seguro para anon (el cuerpo es fijo; nunca expone PII
-- ni coords exactas, solo centroides de puntos ya ofuscados + conteos).
revoke all on function persons_clusters(float8, float8, float8, float8, float8, text, boolean, boolean)
  from public;
grant execute on function persons_clusters(float8, float8, float8, float8, float8, text, boolean, boolean)
  to anon, authenticated;

notify pgrst, 'reload schema';
