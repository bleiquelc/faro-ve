-- ─────────────────────────────────────────────────────────────────────────────
-- 0012_minor_photo_failsafe.sql
--
-- FIX CRÍTICO (regla #3 "foto de MENOR nunca pública"): hasta 0009 la protección
-- dependía SOLO de age<18. Pero age es OPCIONAL: si reportan a un menor SIN edad
-- (campo en blanco — muy común, y también en las fuentes ingestadas), age=NULL →
-- el trigger no disparaba → la foto quedaba 'public'. Hueco fail-OPEN.
--
-- Fail-SAFE: una foto solo es pública si sabemos que el sujeto es ADULTO
-- (age conocida y >= 18). Edad desconocida + foto → admin_only (podría ser menor).
-- Esto puede ocultar la foto de algún adulto reportado sin edad; es el costo
-- correcto para una regla ABSOLUTA. Un moderador podrá promover a 'public' tras
-- verificar que es adulto (flujo de moderación, D3).
--
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_persons_minor_photo()
returns trigger language plpgsql as $$
begin
  -- Una foto pública requiere ADULTO confirmado. Edad NULL o <18 + foto → ocultar.
  if new.photo_url is not null
     and new.photo_visibility = 'public'
     and (new.age is null or new.age < 18) then
    new.photo_visibility := 'admin_only';
  end if;

  -- Menor no acompañado también fuerza admin_only.
  if new.unaccompanied_minor and new.photo_visibility = 'public' then
    new.photo_visibility := 'admin_only';
  end if;

  return new;
end;
$$;

-- Re-asegura los registros existentes que pudieran haber quedado fail-open.
update persons
set photo_visibility = 'admin_only'
where photo_url is not null
  and photo_visibility = 'public'
  and (age is null or age < 18);
