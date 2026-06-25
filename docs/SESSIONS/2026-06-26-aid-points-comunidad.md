# Sesión 2026-06-26 — Capa de lugares de servicio + autorregulación + pulido UX

> Continuación del sprint. Emergencia, velocidad CON rigor. Nada desplegado ni
> aplicado a DB sin OK del founder. Dos revisiones adversariales multi-agente
> corridas sobre el código nuevo ANTES de producción.

## 1) Prioridad #2 — Capa de lugares de servicio (aid_points) + autorregulación comunitaria

Vertical completo, reusando lo endurecido (no se reescribió nada): tabla `aid_points`/`organizations`
(0007), `encrypt_pii`/`obfuscate_point`/`get_app_salt` (0004), `audit_log` (0006), `NavigateButton` +
`navigation.ts`, `AID_META` + tokens `aid`/`shelter` (colors.ts), hooks Turnstile+rate-limit, patrón
popup→ficha SSR de personas, patrón RPC `create_person_report` (0010).

**Archivos nuevos/cambiados:**
- `supabase/migrations/0014_aid_points_community.sql` — votos, reactivación, RPCs (`register_aid_point`,
  `vote_aid_point`, `reactivate_aid_point`, `recompute_aid_point_status`, `get_aid_point`,
  `get_aid_point_reactivator_phone`), vista `aid_points_public`, cola `founder_alerts`.
- `src/lib/schemas/aid-point.ts` — Zod (alta/voto/reactivación/filtros) + tipos + insumos.
- `src/routes/api/aid-points/+server.ts` (GET mapa + POST alta).
- `src/routes/api/aid-points/[id]/vote/+server.ts` · `.../reactivate/+server.ts`.
- `src/hooks.server.ts` — match por patrón para sub-rutas [id] (Turnstile + rate-limit estable + config-guard).
- `src/lib/components/Turnstile.svelte` — `reset()` aditivo (token de un solo uso).
- `src/routes/reportar/punto-ayuda/+page.svelte` — alta (datos PÚBLICOS, coords EXACTAS).
- `src/routes/punto/[id]/+page.{server.ts,svelte}` — ficha: NavigateButton (#27) + votos + reactivación.
- `src/lib/client/aid-layer.ts` — capa de mapa autocontenida (cluster, bbox, popups, a11y, truncado).
- `src/lib/components/Map.svelte` — integra la capa (prop showAid, import diferido) + sr-only nav de ayuda.
- `src/routes/mapa/+page.svelte` + `FilterChips.svelte` — chip "Ayuda" + entrada "Registrar".
- Tests: `tests/schemas/aid-point.test.ts` (14) + `supabase/tests/aid_points_community.test.sql` +
  `scripts/verify-aid-points.mjs` (gate end-to-end).

**Decisiones de ingeniería (sobre el SPEC confirmado):**
- **net "desde la última reactivación"** vía `clock_timestamp()` (no `now()`, que se congela dentro de
  una transacción y rompería la semántica). `reactivated_at` resetea la ventana de conteo sin borrar historial.
- Alta comunitaria **siempre sin organización** (anti-suplantación de "Cruz Roja"); orgs enlazarán por panel.
- WhatsApp de reactivación **cifrado en DB, nunca público** (#2). Único canal de lectura: RPC admin
  **auditado** `get_aid_point_reactivator_phone` (exige `admin_id`). Cola `founder_alerts` para avisos.
- Voto/reactivación viven en la ficha SSR (Turnstile real), clonando el patrón persona→ficha (#27).

## 2) Pulido UX pedido por el founder — todo cableado

- **Iconos web** minimalistas estilo faro: `static/faro-icon.svg` rediseñado + `node scripts/generate-icons.mjs`
  regeneró 192/512/maskable/apple-touch/favicon (maskable-safe). Ya cableados en app.html + manifest.
- **Botón Actualizar** PWA-aware (`RefreshButton.svelte`): busca versión nueva del SW y recarga al tomar
  control el nuevo (controllerchange, con timeout de seguridad) → trae registros frescos + mejoras nuevas.
  En `/mapa` (barra superior). Accesible.
- **Animaciones más suaves**: haz del faro (loading) 3.2s→6s + tenue + `prefers-reduced-motion`; faro de
  bienvenida (FaroLogo) más lento; tap de botones superiores/nav con transición suave + scale gentil.
- **Filtros combinables** (`FilterChips.svelte`): estado single-select (una persona = un estado) +
  atributos toggles independientes (Menores/Urgencia) que combinan vía AND del API → "desaparecido menor",
  "emergencia menor", etc. URL-driven. Verificado en preview.

## 3) Rigor — dos revisiones adversariales multi-agente (antes de prod)

**Revisión 1** (vertical aid-points): 18 hallazgos → 8 confirmados, 9 refutados. Arreglados:
- 🔴 **Blocker privacidad**: `revoke select on aid_points from anon, authenticated` (las columnas
  sensibles vivían en la tabla base con grant anon de 0007; la anon key es pública). Patrón persons:
  anon lee solo la vista. Verificado contra el patrón ya probado en prod (persons no tiene grant base).
- 🟠 **High GPS**: el alta se bloqueaba si el GPS fallaba → `LocationPicker.svelte` (mini-mapa con pin
  central + coords editables; robusto en VE, #28).
- Turnstile reset en el form; guarda de caducidad en `recompute` (no alertar por puntos caducados);
  RPC admin auditado; sr-only nav de ayuda; doc de INSERTS_PAUSED.

**Revisión 2** (fixes + batch nuevo): 8 hallazgos → 7 confirmados (0 blocker/high), 1 refutado. Arreglados:
- RPC admin: guardia dura — sin `admin_id` no descifra (audit sin actor anularía la rendición de cuentas).
- RefreshButton: esperar `controllerchange` antes de recargar (la mejora llegaba una recarga tarde).
- Carrera en `syncAidFor`: re-chequeo de intención tras el `import()` (evita capa fantasma/duplicada).
- Truncado de la capa de ayuda (aviso "Acércate para ver más" honesto); docs (remount, panel orgs futuro).

## 4) Verificación
- ✅ `svelte-check` 0 errores · ✅ 36/36 vitest (14 nuevos) · ✅ build de producción limpio.
- ✅ Preview: LocationPicker monta, filtros combinan (`status=missing&is_minor=true&medical_urgent=true`),
  Actualizar presente, chip Ayuda + Registrar, 0 errores del código nuevo.
- ⏳ Gate SQL `scripts/verify-aid-points.mjs` corre tras aplicar 0014 (lo corre el founder).

## 5) Pendiente del founder (Level B — yo no toco DB/secretos/deploy)
1. Aplicar migración 0014 + correr el gate.
2. Setear secretos Level B (service_role + Turnstile) para activar reportes + aid-points (alta/voto/reactivación).
3. Email Routing (contacto@ / opt-out@).
Comandos exactos: ver respuesta del chat / `docs/HANDOFF-dia2-continuar.md`.
