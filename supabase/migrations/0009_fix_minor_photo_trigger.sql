-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_fix_minor_photo_trigger.sql
-- FIX CRÍTICO DE PRIVACIDAD: el trigger trg_persons_minor_photo se apoyaba en
-- new.is_minor, pero is_minor es una columna GENERATED ALWAYS y NO está
-- disponible dentro de un trigger BEFORE (Postgres computa las generated columns
-- DESPUÉS de los triggers BEFORE). Resultado: new.is_minor era NULL en el
-- trigger y la foto de un menor quedaba 'public'.
--
-- Fix: calcular la minoría de edad directamente desde age (misma definición que
-- la columna is_minor), sin depender de la columna generada.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function trg_persons_minor_photo()
returns trigger language plpgsql as $$
begin
  -- is_minor (generated) no existe aún en BEFORE INSERT/UPDATE → usar age.
  if new.age is not null and new.age < 18 and new.photo_visibility = 'public' then
    new.photo_visibility := 'admin_only';
  end if;
  -- Defensa extra: menor no acompañado también fuerza admin_only.
  if new.unaccompanied_minor and new.photo_visibility = 'public' then
    new.photo_visibility := 'admin_only';
  end if;
  return new;
end;
$$;
