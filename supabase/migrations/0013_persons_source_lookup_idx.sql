-- ─────────────────────────────────────────────────────────────────────────────
-- 0013_persons_source_lookup_idx.sql
--
-- La ingesta deduplica con `where not exists (select 1 from persons where
-- source=$ and source_id=$)`. Sin índice, cada chequeo es un scan O(n) → la
-- carga completa es O(n²) y se vuelve lentísima al crecer la tabla.
--
-- Índice de lookup (source, source_id) → el dedup pasa a O(log n). Acelera la
-- ingesta en curso y todos los re-runs idempotentes. Parcial: solo filas con
-- source_id (los reportes faro-ve propios no lo usan).
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists persons_source_lookup_idx
  on persons (source, source_id)
  where source_id is not null;
