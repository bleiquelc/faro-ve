-- 0026 — Asegura que el rol de servicio (Worker) pueda EJECUTAR la RPC de ingesta.
--
-- En 0025 se hizo `revoke all ... from public` (correcto: cerrar a anon/authenticated),
-- pero eso también quita el grant heredado vía PUBLIC. Para que el Worker (que usa la
-- llave secreta = rol service_role) pueda llamar la función, le damos EXECUTE explícito.
-- Idempotente y seguro de re-correr.

grant execute on function ingest_persons_batch(jsonb) to service_role;
