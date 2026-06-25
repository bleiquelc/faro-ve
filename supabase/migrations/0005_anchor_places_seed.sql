-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_anchor_places_seed.sql
-- Tabla anchor_places (autocomplete de lugares VE) + seed Venezuela:
-- ciudades + 23 parroquias Caracas + sectores + hospitales + morgue.
-- La tabla se define AQUÍ (no en 0006) porque el seed corre en este mismo
-- archivo y necesita que exista antes del INSERT.
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type anchor_kind as enum (
    'city', 'parish', 'neighborhood', 'sector', 'hospital', 'morgue',
    'shelter_known', 'landmark', 'church', 'school', 'plaza', 'station'
  );
exception when duplicate_object then null; end $$;

create table if not exists anchor_places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alt_names text[],
  kind anchor_kind not null,
  parent_city text,
  state text,
  country text default 'VE',
  point geography(Point, 4326),
  osm_id text,
  notes text,
  popularity int default 0,
  active bool default true,
  created_at timestamptz not null default now()
);

create index if not exists anchor_places_name_trgm
  on anchor_places using gin (name gin_trgm_ops);
create index if not exists anchor_places_kind_idx
  on anchor_places (kind, parent_city) where active = true;
create index if not exists anchor_places_point_gist
  on anchor_places using gist (point);

grant select on anchor_places to anon;

insert into anchor_places (name, alt_names, kind, parent_city, state, point) values
  -- Caracas - ciudad
  ('Caracas', ARRAY['Santiago de León de Caracas'], 'city', null, 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9036 10.4806)')),

  -- Caracas - 22 parroquias del Distrito Capital + 1 Libertador
  ('Altagracia', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9085 10.5034)')),
  ('Antímano', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9799 10.4639)')),
  ('Candelaria', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9013 10.5044)')),
  ('Caricuao', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9572 10.4329)')),
  ('Catedral', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9152 10.5044)')),
  ('Coche', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9418 10.4574)')),
  ('El Junquito', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-67.0826 10.4825)')),
  ('El Paraíso', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9420 10.4823)')),
  ('El Recreo', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8838 10.4980)')),
  ('El Valle', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9300 10.4569)')),
  ('La Pastora', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9183 10.5118)')),
  ('La Vega', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9527 10.4691)')),
  ('Macarao', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-67.0070 10.4288)')),
  ('San Agustín', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8945 10.4960)')),
  ('San Bernardino', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8957 10.5108)')),
  ('San José', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9072 10.5119)')),
  ('San Juan', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9269 10.5034)')),
  ('San Pedro', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8723 10.4866)')),
  ('Santa Rosalía', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9100 10.4868)')),
  ('Santa Teresa', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9092 10.5012)')),
  ('Sucre', ARRAY['Catia'], 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9569 10.5126)')),
  ('23 de Enero', null, 'parish', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9407 10.5050)')),
  -- Petare (parroquia de Sucre, Miranda)
  ('Petare', ARRAY['Petare-Sucre'], 'parish', 'Caracas', 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8186 10.4773)')),

  -- Sectores y barrios populares Caracas
  ('Chacao', null, 'neighborhood', 'Caracas', 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8537 10.4933)')),
  ('Las Mercedes', null, 'neighborhood', 'Caracas', 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8606 10.4775)')),
  ('Los Palos Grandes', null, 'neighborhood', 'Caracas', 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8516 10.4998)')),
  ('Altamira', null, 'neighborhood', 'Caracas', 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8568 10.4974)')),
  ('Sabana Grande', null, 'neighborhood', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8753 10.4944)')),
  ('Bello Monte', null, 'neighborhood', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8702 10.4870)')),
  ('Plaza Venezuela', null, 'plaza', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8929 10.5005)')),
  ('Bellas Artes', null, 'neighborhood', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8946 10.5040)')),
  ('La Candelaria', null, 'neighborhood', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9013 10.5044)')),
  ('El Cementerio', null, 'neighborhood', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9099 10.4779)')),
  ('Las Acacias', null, 'neighborhood', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9197 10.4861)')),

  -- Hospitales principales Caracas
  ('Hospital JM de los Ríos', ARRAY['JM de los Ríos','Hospital de Niños'], 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8819 10.4988)')),
  ('Hospital Universitario de Caracas', ARRAY['Clínico Universitario','HUC'], 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8920 10.4906)')),
  ('Hospital Vargas de Caracas', ARRAY['Vargas','HVC'], 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9050 10.5070)')),
  ('Hospital Pérez Carreño', null, 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9457 10.4920)')),
  ('Hospital Militar Carlos Arvelo', ARRAY['Hospital Militar'], 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9263 10.4853)')),
  ('Hospital Domingo Luciani', null, 'hospital', 'Caracas', 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8198 10.4823)')),
  ('Hospital Pediátrico Elías Toro', null, 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9590 10.5103)')),
  ('Maternidad Concepción Palacios', null, 'hospital', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9277 10.4861)')),

  -- Morgue principal
  ('Morgue de Bello Monte', ARRAY['Morgue Bello Monte','Medicatura Forense'], 'morgue', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8732 10.4831)')),

  -- Otras ciudades grandes
  ('La Guaira', ARRAY['Vargas','Maiquetía'], 'city', null, 'La Guaira',
   ST_GeogFromText('SRID=4326;POINT(-66.9354 10.6004)')),
  ('Catia La Mar', null, 'neighborhood', 'La Guaira', 'La Guaira',
   ST_GeogFromText('SRID=4326;POINT(-66.9986 10.6053)')),
  ('Macuto', null, 'neighborhood', 'La Guaira', 'La Guaira',
   ST_GeogFromText('SRID=4326;POINT(-66.8884 10.6038)')),
  ('Naiguatá', null, 'neighborhood', 'La Guaira', 'La Guaira',
   ST_GeogFromText('SRID=4326;POINT(-66.7382 10.6256)')),
  ('Carmen de Uria', null, 'neighborhood', 'La Guaira', 'La Guaira',
   ST_GeogFromText('SRID=4326;POINT(-66.8104 10.6178)')),

  ('Valencia', null, 'city', null, 'Carabobo',
   ST_GeogFromText('SRID=4326;POINT(-67.9972 10.1620)')),
  ('Hospital Central de Valencia', ARRAY['Enrique Tejera'], 'hospital', 'Valencia', 'Carabobo',
   ST_GeogFromText('SRID=4326;POINT(-67.9886 10.1751)')),

  ('Maracay', null, 'city', null, 'Aragua',
   ST_GeogFromText('SRID=4326;POINT(-67.5958 10.2469)')),
  ('Hospital Central de Maracay', null, 'hospital', 'Maracay', 'Aragua',
   ST_GeogFromText('SRID=4326;POINT(-67.5957 10.2606)')),

  ('Maracaibo', null, 'city', null, 'Zulia',
   ST_GeogFromText('SRID=4326;POINT(-71.6125 10.6427)')),
  ('Hospital Universitario de Maracaibo', ARRAY['SAHUM'], 'hospital', 'Maracaibo', 'Zulia',
   ST_GeogFromText('SRID=4326;POINT(-71.6291 10.6786)')),
  ('Hospital Coromoto', null, 'hospital', 'Maracaibo', 'Zulia',
   ST_GeogFromText('SRID=4326;POINT(-71.6332 10.6555)')),

  ('Barquisimeto', null, 'city', null, 'Lara',
   ST_GeogFromText('SRID=4326;POINT(-69.3467 10.0647)')),
  ('Hospital Central Antonio María Pineda', null, 'hospital', 'Barquisimeto', 'Lara',
   ST_GeogFromText('SRID=4326;POINT(-69.3375 10.0654)')),

  ('Mérida', null, 'city', null, 'Mérida',
   ST_GeogFromText('SRID=4326;POINT(-71.1448 8.5901)')),
  ('Instituto Autónomo Hospital Universitario de Los Andes', ARRAY['IAHULA'], 'hospital', 'Mérida', 'Mérida',
   ST_GeogFromText('SRID=4326;POINT(-71.1480 8.5862)')),

  ('San Cristóbal', null, 'city', null, 'Táchira',
   ST_GeogFromText('SRID=4326;POINT(-72.2243 7.7669)')),
  ('Ciudad Guayana', ARRAY['Puerto Ordaz','San Félix'], 'city', null, 'Bolívar',
   ST_GeogFromText('SRID=4326;POINT(-62.7264 8.3534)')),
  ('Puerto La Cruz', null, 'city', null, 'Anzoátegui',
   ST_GeogFromText('SRID=4326;POINT(-64.6952 10.2199)')),
  ('Barcelona', null, 'city', null, 'Anzoátegui',
   ST_GeogFromText('SRID=4326;POINT(-64.6979 10.1297)')),
  ('Cumaná', null, 'city', null, 'Sucre',
   ST_GeogFromText('SRID=4326;POINT(-64.1675 10.4548)')),
  ('Maturín', null, 'city', null, 'Monagas',
   ST_GeogFromText('SRID=4326;POINT(-63.1832 9.7468)')),
  ('Punto Fijo', null, 'city', null, 'Falcón',
   ST_GeogFromText('SRID=4326;POINT(-70.2076 11.6849)')),
  ('Coro', null, 'city', null, 'Falcón',
   ST_GeogFromText('SRID=4326;POINT(-69.6800 11.4108)')),
  ('Acarigua', null, 'city', null, 'Portuguesa',
   ST_GeogFromText('SRID=4326;POINT(-69.2117 9.5546)')),
  ('Guarenas', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.6112 10.4756)')),
  ('Guatire', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.5380 10.4729)')),
  ('Los Teques', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-67.0397 10.3437)')),
  ('Charallave', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8480 10.2417)')),
  ('Cúa', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.8893 10.1659)')),
  ('Higuerote', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-66.0964 10.4823)')),
  ('Río Chico', null, 'city', null, 'Miranda',
   ST_GeogFromText('SRID=4326;POINT(-65.9676 10.3211)')),

  -- Aeropuertos / hubs logísticos
  ('Aeropuerto Internacional de Maiquetía Simón Bolívar', ARRAY['Maiquetía','SVMI'], 'station', 'La Guaira', 'La Guaira',
   ST_GeogFromText('SRID=4326;POINT(-66.9931 10.6019)')),
  ('Terminal La Bandera', null, 'station', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9202 10.4781)')),

  -- Plazas y landmarks
  ('Plaza Bolívar', null, 'plaza', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.9148 10.5061)')),
  ('Parque Central', null, 'landmark', 'Caracas', 'Distrito Capital',
   ST_GeogFromText('SRID=4326;POINT(-66.8997 10.4995)'))
on conflict do nothing;
