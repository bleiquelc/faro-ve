-- ─────────────────────────────────────────────────────────────────────────────
-- 0017_obfuscation_on_land.sql
--
-- Arregla "personas reportadas sobre el mar" en la costa (founder, 2026-06-26).
-- Causa: pueblos costeros reales (Tanaguarena, Caraballeda, Macuto, La Guaira…)
-- pegados al agua; la ofuscación OBLIGATORIA de 200-500m (#1) empuja una fracción
-- de los puntos al mar. No es ancla mala ni ofuscación rota — es geografía.
--
-- Fix: ofuscación CONSCIENTE DE LA TIERRA. Se re-tira el offset (mismo radio
-- 200-500m, misma distribución uniforme en anillo) hasta que el punto caiga en
-- tierra. Se computa UNA sola vez por centro (el change-guard de 0004 lo mantiene
-- estable → no se puede promediar para recuperar la coord exacta, ver 0004:17-19).
--
--  (1) ve_land — máscara de tierra de Venezuela (polígono público, sin PII). La
--      pobla scripts/load-ve-land.mjs (geoBoundaries ADM0). Vacía = fail-safe.
--  (2) is_on_land(geog) — ¿el punto cae en tierra? (true si la máscara está vacía).
--  (3) obfuscate_point_on_land(geog) — re-tira hasta tierra; último recurso: snap
--      al borde de tierra más cercano. Si no hay máscara → ofuscación original.
--  (4) Triggers persons/notes → usan la versión land-aware (mismo change-guard).
--
-- Reusa: obfuscate_point (0004). Idempotente. Tras aplicar:
--   node scripts/load-ve-land.mjs   (pobla ve_land + backfillea los offshore)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── (1) ve_land — máscara de tierra ─────────────────────────────────────────
create table if not exists ve_land (
  id   int primary key default 1,
  geom geometry(MultiPolygon, 4326) not null,
  constraint ve_land_singleton check (id = 1)
);

comment on table ve_land is
  'Máscara de tierra de Venezuela (polígono público geoBoundaries ADM0). Solo para que la ofuscación mantenga los puntos en tierra. Sin PII. La pobla scripts/load-ve-land.mjs.';

create index if not exists ve_land_gix on ve_land using gist (geom);

-- Datos públicos de frontera; nadie necesita leerla directo (solo las funciones).
revoke all on table ve_land from anon, authenticated;

-- ─── (2) is_on_land ──────────────────────────────────────────────────────────
-- Fail-safe: si la máscara aún no está cargada (0 filas), devuelve true → la
-- ofuscación no cambia su comportamiento hasta que el polígono exista.
create or replace function is_on_land(p geography)
returns boolean
language sql
stable
parallel safe
as $$
  select case
    when not exists (select 1 from ve_land) then true
    else exists (
      select 1 from ve_land where ST_Covers(geom, p::geometry)
    )
  end;
$$;

comment on function is_on_land(geography) is
  '¿El punto cae en tierra venezolana? true si la máscara ve_land está vacía (fail-safe).';

-- ─── (3) obfuscate_point_on_land ─────────────────────────────────────────────
-- Re-tira el offset (200-500m, anillo uniforme) hasta TIERRA, máx 16 intentos.
-- Si tras 16 sigue en agua (centro en una lengua de tierra muy fina / islote),
-- snap al punto de COSTA más cercano al último candidato (raro). Sin máscara
-- cargada → ofuscación original (fail-safe, nunca peor que hoy).
create or replace function obfuscate_point_on_land(
  p    geography(Point, 4326),
  rmin numeric default 200,
  rmax numeric default 500
)
returns geography(Point, 4326)
language plpgsql
volatile
as $$
declare
  cand geography(Point, 4326);
  snap geography(Point, 4326);
  i    int;
begin
  if p is null then
    return null;
  end if;

  -- Sin máscara → comportamiento original (no romper si el polígono no se cargó).
  if not exists (select 1 from ve_land) then
    return obfuscate_point(p, rmin, rmax);
  end if;

  for i in 1..16 loop
    cand := obfuscate_point(p, rmin, rmax);
    if exists (select 1 from ve_land where ST_Covers(geom, cand::geometry)) then
      return cand;  -- en tierra y a ≥rmin del exacto → resultado ideal
    end if;
  end loop;

  -- Último recurso (centro en una espiga/cabo fino, todos los tiros al agua): el
  -- punto de COSTA más cercano al último candidato.
  snap := (
    select ST_ClosestPoint(ST_Boundary(geom), cand::geometry)::geography(Point, 4326)
    from ve_land
    order by geom <-> cand::geometry
    limit 1
  );

  -- ⚠ Regla #1 (≥rmin del punto exacto) es INVIOLABLE y GANA sobre lo cosmético.
  -- En features costeros finos el snap podría caer a <rmin del exacto (revisión
  -- adversarial: privacy-001/database-001). En ese caso devolvemos el candidato
  -- (offshore, pero GARANTIZADO ≥rmin porque salió de obfuscate_point a 200-500m):
  -- preferimos un punto en el mar a filtrar la ubicación real.
  if snap is not null and ST_Distance(p, snap) >= rmin then
    return snap;
  end if;
  return cand;
end;
$$;

comment on function obfuscate_point_on_land(geography, numeric, numeric) is
  'Ofusca 200-500m re-tirando hasta caer en tierra (preserva ≥rmin del centro). Último recurso: snap a la costa más cercana. Sin ve_land cargada → obfuscate_point original.';

-- ─── (4) Triggers persons/notes → versión land-aware ─────────────────────────
-- Mismo change-guard que 0004 (re-ofuscar SOLO en INSERT, cuando el punto exacto
-- cambia, o cuando obfuscated está vacío) → el offset sigue siendo estable por
-- centro (anti-promediado). Solo cambia la función de offset por la land-aware.
create or replace function trg_persons_obfuscate()
returns trigger language plpgsql as $$
begin
  if new.last_known_location_point is not null then
    if tg_op = 'INSERT'
       or new.last_known_location_point is distinct from old.last_known_location_point
       or new.last_known_location_obfuscated is null then
      new.last_known_location_obfuscated := obfuscate_point_on_land(new.last_known_location_point);
    end if;
  else
    new.last_known_location_obfuscated := null;
  end if;
  return new;
end;
$$;

create or replace function trg_notes_obfuscate()
returns trigger language plpgsql as $$
begin
  if new.sighting_location_point is not null then
    if tg_op = 'INSERT'
       or new.sighting_location_point is distinct from old.sighting_location_point
       or new.sighting_location_obfuscated is null then
      new.sighting_location_obfuscated := obfuscate_point_on_land(new.sighting_location_point);
    end if;
  else
    new.sighting_location_obfuscated := null;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
