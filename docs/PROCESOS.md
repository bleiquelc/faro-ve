# Faro VE — PROCESOS (Mapa operativo)

> **Lectura #0 de toda sesión** (lo manda `CLAUDE.md`). Este es el mapa de qué hay
> construido, dónde vive y cómo se opera. Captarlo en ~2 min y arrancar sin re-descubrir.
>
> **Orden de lectura:** este doc → `docs/STATUS.md` (estado vivo, lo último) →
> `docs/RUNBOOK-*.md` (detalle por subsistema cuando lo toques).

## ⚡ Ley de Reuso (antes de construir, buscá)

Antes de escribir cualquier cosa que se parezca a algo existente: **buscá acá y en el
código** (`grep`) si ya existe. Si existe, solo hay dos salidas válidas: **reusarlo** o
**mejorarlo** (más rápido/robusto). Nunca re-implementar lo hecho en una versión más
lenta o paralela. Casos concretos que ya tienen camino probado: reportar persona →
`report-submit.ts` (submit-or-queue); navegar a un lugar → `NavigateButton.svelte`; CORS
de un GET nuevo → set `PUBLIC_GET_CORS` en `hooks.server.ts`; escribir a la DB con
service_role → RPC `SECURITY DEFINER`, nunca el service_role por chat.

---

## Tabla resumen

| # | Subsistema | Estado | Dónde (ruta principal) | Doc/Runbook |
|---|---|---|---|---|
| 1 | Privacidad y ofuscación (core) | 🟢 LIVE | `supabase/migrations/` + `src/lib/utils/obfuscate.ts` + `hooks.server.ts` | este doc |
| 2 | Ingesta del conteo (venezuela-te-busca) | 🟢 LIVE | `workers/cron-ingest/` + `scripts/ingest/venezuela-te-busca-core.mjs` | este doc |
| 3 | Moderación + auth moderadores | 🟢 LIVE (1 paso founder) | `src/routes/moderar/` | este doc |
| 4 | Federación / datos abiertos | 🟢 LIVE | `src/routes/api/{pfif,persons,aid-points}/` + `/datos` + `/atribucion` | `docs/HANDOFF-federacion.md` |
| 5 | Faro Auxilio | 🟢 LIVE | `src/routes/auxilio/` + `src/lib/data/auxilio/` | mem `faro-auxilio-estado` |
| 6 | PWA offline + cola de reportes | 🟡 código LIVE, 0027 pendiente | `src/service-worker.ts` + `src/lib/client/{outbox,replay}.ts` | mem `faro-ve-cola-offline` |
| 7 | Reportes públicos + puntos de ayuda | 🟢 LIVE | `src/routes/reportar/` + `src/routes/api/{persons,aid-points}/` | este doc |
| 8 | Auto-publicador IG + Reencuentros | 🟢 LIVE (3 pasos founder) | `scripts/buffer/` + `/reencuentros` | `docs/RUNBOOK-instagram-reencuentros.md` |

---

## 1. Privacidad y ofuscación (core)

**Qué hace.** Privacidad por diseño enforced en la DB: ubicación pública SIEMPRE ofuscada
200–500 m (la exacta solo la ven moderadores), PII del reportante hasheada+cifrada dentro
de Postgres, foto de menores forzada a `admin_only` por trigger, y el público lee solo de
vistas `security_barrier` (`persons_public`/`notes_public`), nunca de las tablas base.

**Archivos clave.** `supabase/migrations/0001,0003,0004,0008,0009,0012,0017,0019_*.sql` ·
`src/lib/utils/obfuscate.ts` (espejo cliente, NO sustituye al SQL) · `src/lib/client/photo.ts` ·
`src/hooks.server.ts` · `tests/utils/obfuscate.test.ts` · `scripts/load-ve-land.mjs`.

**Cómo operar.**
```bash
npm test                                  # incluye obfuscate.test.ts (anillo, anti-promediado)
node scripts/apply-migrations.mjs --dry   # ver migraciones pendientes (no escribe)
# Migraciones reales: SQL Editor de Supabase (founder) — la DB directa es IPv6, ver Restricciones
```

**Gotchas.**
- La verdad de la ofuscación es el SQL (triggers `obfuscate_point_on_land`), no el cliente. El offset se computa UNA vez por centro (anti-promediado): re-ofuscar en cada edición permitiría recuperar la coord exacta.
- `is_minor` es `GENERATED` → NO disponible en triggers BEFORE; la foto de menor se calcula desde `age` y es fail-SAFE (age NULL o <18 → `admin_only`).
- Regla ≥200 m GANA sobre lo cosmético: en cabos finos un punto queda en el mar antes que acercarse a <200 m de la coord real.
- Al editar `persons_public` reproducir EXACTAMENTE las columnas existentes + las nuevas al final; nunca añadir `last_known_location_point` (solo `_obfuscated`).
- Las funciones del salt (`hash_*`, `encrypt_pii`, `create_person_report`…) tienen EXECUTE solo para `service_role`; ejecutarlas desde anon falla a propósito.

**Reglas.** #1 (ofuscación) · #2 (PII cifrada) · #3 (foto menores) · #4 (EXIF strip) · #5 (edit_token sin login) · #6 (Habeas Data 60d/purga 30d) · #11 (PFIF v1.4) · #16 (IA sin PII).

**Estado.** 🟢 LIVE. Migraciones 0001–0017 aplicadas y verificadas; gate verde (dist≈438 m, `persons_public` sin leak, menor→admin_only, offset invariante en 100 ediciones). `ve_land` poblado. Pendiente tangencial: 0023/0027 sin aplicar por founder.

---

## 2. Ingesta del conteo (venezuela-te-busca)

**Qué hace.** Ingiere el conteo público de venezuelatebusca.com hacia `persons` como filas
auto-aprobadas (`source='venezuela-te-busca'` + `source_id` + `source_url`). Idempotente por
`(source, source_id)`, incremental por cursor. NUNCA descarta una persona: si no geocodifica,
entra con lat/lng null (buscable por nombre, sin pin). Núcleo compartido por script y Worker.

**Archivos clave.** `scripts/ingest/venezuela-te-busca-core.mjs` (núcleo) ·
`scripts/ingest/venezuela-te-busca.mjs` (script local) · `workers/cron-ingest/src/index.ts`
(prod) · `workers/cron-ingest/wrangler.toml` · `supabase/migrations/0025,0026,0028_*.sql`.

**Cómo operar.**
```bash
node scripts/ingest/venezuela-te-busca.mjs --dry --pages 3   # ensayo local, no escribe, no necesita DB
npm run deploy:workers                                       # despliega cron-ingest, ai-health, ai-triage
cd workers/cron-ingest && wrangler deploy                    # solo este worker
wrangler secret put SUPABASE_SERVICE_ROLE_KEY                # secret del worker (una vez)
# Escritura masiva desde el Mac (solo con OK founder; usa cadena del POOLER, no el host directo):
DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/ingest/venezuela-te-busca.mjs --apply
```
Producción = Worker cron-ingest en Cloudflare (corre solo `*/5`, ~90 págs/corrida).

**Gotchas.**
- Prod corre en el Worker porque la DB directa es IPv6 (el Mac/sandbox no la alcanza). Local solo `--dry`.
- Los scripts npm `ingest:dry`/`ingest:apply` apuntan a un `run.ts` INEXISTENTE → invocar el `.mjs` con `node` directamente.
- La fuente glitchea (página vacía espuria); `fetchPageValid` reintenta hasta 4×.
- Aplicar **0028** (no quedarse en 0025): 0025 excluía a quienes no geocodifican (~15%); 0028 los acepta con punto null. Si la RPC da "permission denied", falta 0026/0028.
- BASE de fetch = espejo `venezuela-te-busca-app.hellogafaro.workers.dev`; SOURCE_URL de atribución = `https://venezuelatebusca.com` (no confundir).

**Reglas.** #1 · #3 · #9 (source/source_id/source_url) · #11 · #12 (scraper ético: robots.txt, UA `FaroVE-IngestBot/1.0`, throttle 1 req/2 s) · #13 (escritura masiva solo con OK founder) · #18/#19 (auto_approved por `import_sources.trust`).

**Estado.** 🟢 LIVE. Worker desplegado (0025+0026+0028 aplicadas). El conteo sube solo sin duplicar (~26.150). Pendiente menor: relajar cron `*/5`→`*/15` o `6h` cuando se estabilice (~28-29k).

---

## 3. Moderación + auth moderadores (`/moderar`)

**Qué hace.** Panel server-side donde moderadores revisan la cola `pending` de personas y
notas (avistamientos) y aprueban/rechazan/marcan duplicado/piden info. Auth magic-link de
Supabase (solo correos en `moderators` activos); la sesión se valida con `getUser()` en cada
request, nunca con la cookie cruda. El moderador ve coords exactas pero NUNCA email/phone.

**Archivos clave.** `src/routes/moderar/**` · `src/lib/server/auth.ts` · `src/hooks.server.ts` ·
`src/lib/schemas/moderation.ts` · `supabase/migrations/0006,0016,0018,0021_*.sql` ·
`scripts/verify-moderation.mjs` · `scripts/verify-notes.mjs`.

**Cómo operar.**
```bash
node scripts/verify-moderation.mjs   # gate 15/15 contra DB real
node scripts/verify-notes.mjs        # gate 24/24
npm run deploy:pages                 # el panel va dentro del deploy de Pages
# Tras aplicar RPCs (SQL Editor): notify pgrst, 'reload schema';
```

**Gotchas.**
- La autorización la imponen hooks + `requireModerator` + la RPC (defensa triple); NO la RLS (el panel corre con `service_role` que IGNORA RLS).
- `moderate_note` solo acepta approved/rejected (duplicate/needs_info dejarían la nota irrecuperable). Nota rechazada → `hidden=true`.
- **EMERGENCIA (0021):** `create_person_report` inserta personas como `approved` (publish-first), NO `pending` — la regla #18 está SUSPENDIDA para personas; las notas siguen `pending`.
- Subrutas `matches`/`orgs`/`sources` son placeholders VACÍOS.
- Login no cierra el flujo hasta que el founder agregue las redirect-URLs en Supabase Auth.

**Reglas.** #1 (moderador ve exactas) · #2 · #3 · #5 · #6 (audit atómico) · #18 (vigente notas / suspendida personas) · #19 · #20 (orden de cola) · #29 (INSERTS_PAUSED).

**Estado.** 🟢 LIVE y seguro (gates 15/15 y 24/24 PASS). PENDIENTE (1 paso founder, no código): agregar redirect-URLs `/moderar/auth/callback` en Supabase Auth para cerrar el magic-link.

---

## 4. Federación / Datos abiertos (PFIF / JSON / GeoJSON)

**Qué hace.** Expone la info PÚBLICA como red de datos humanitarios solo-lectura, sin claves,
para agregadores (Google Person Finder, ICRC, HDX). 5 endpoints GET: `/api/pfif` (PFIF 1.4 XML,
ubicación en TEXTO + `expiry_date`=entrada+60d), `/api/persons` (JSON + `?format=geojson` coords
OFUSCADAS), `/api/aid-points` (JSON + GeoJSON coords EXACTAS por ser lugares de servicio),
`/api/persons/clusters` y `/stats`. Páginas humanas `/datos` y `/atribucion`. Licencia CC BY 4.0
+ cláusula de no-reidentificación.

**Archivos clave.** `src/routes/api/pfif/+server.ts` · `src/routes/api/persons/+server.ts` ·
`src/routes/api/aid-points/+server.ts` · `src/hooks.server.ts` (CORS) · `src/routes/{datos,atribucion}/` ·
`docs/HANDOFF-federacion.md`.

**Cómo operar.**
```bash
curl -s 'https://faro-ve.com/api/pfif?limit=5&offset=0'
curl -s 'https://faro-ve.com/api/persons?format=geojson&bbox=-73.4,0.6,-59.8,12.3'
curl -sI -X OPTIONS 'https://faro-ve.com/api/persons'   # ver header CORS (preflight 204)
```
Para agregar un endpoint a la federación: sumar su pathname al set `PUBLIC_GET_CORS` en
`hooks.server.ts` Y leer SIEMPRE de una vista `*_public`.

**Gotchas.**
- CORS va en `hooks.server.ts` (`handleCors`), NUNCA en `_headers` (no cubre las Functions de SvelteKit en Pages).
- Solo GET/HEAD/OPTIONS reciben CORS; mutaciones y `/api/ai/ask` quedan CERRADAS a propósito. No agregar mutadores a la allowlist.
- El feed PFIF lleva ubicación en TEXTO, JAMÁS lat/lng (filtrar por coords dejaría fuera a quien reportó sin GPS). GeoJSON de personas usa coords OFUSCADAS, nunca la exacta.
- `/datos` y `/atribucion` dan 500 en `vite dev` (limitación de toda ruta prerender); en build/prod funcionan. No es bug.
- Inbound de Email Routing (opt-out@/contacto@/federacion@) PENDIENTE de verificar en panel CF; hasta entonces el SLA 24 h de la regla #8 no está garantizado.

**Reglas.** #1 · #2 · #3 (doble candado en PFIF) · #6 (expiry_date propaga la purga) · #7 (footer) · #8 (opt-out@) · #9 · #11 · #26 (aid-points exactas / persons ofuscadas).

**Estado.** 🟢 LIVE (5 endpoints 200, CORS/PFIF/GeoJSON verificados). `/datos` y `/atribucion` LIVE. PENDIENTE: verificar Email Routing en panel CF + cron diario del inbox opt-out (regla #10). Roadmap: HXL/CSV (HDX), `?updated_since`, endpoint de IMPORT entrante.

---

## 5. Faro Auxilio (`/auxilio`)

**Qué hace.** Guía de primeros auxilios + salud/prevención + sismo-supervivencia (**34**
procedimientos en 3 categorías) + contactos de emergencia + chat. 100% estático (sin red ni
DB), CERO invención (cada procedimiento cita su fuente oficial), funciona SIN conexión. El chat
responde con búsqueda LOCAL sobre las guías; **la IA del chat está APAGADA** (`AI_ENABLED=false`,
decisión founder). PDF descargable generado desde los mismos datos.

**Archivos clave.** `src/routes/auxilio/+page.svelte` · `src/lib/data/auxilio/{index,first-aid,survival,expansion,sources,contacts}.ts` ·
`src/lib/components/{AuxilioChat,AuxilioIcon}.svelte` · `src/routes/api/ai/ask/+server.ts` ·
`scripts/gen-guide-pdf.ts` · `static/guia-primeros-auxilios-faro-ve.pdf`.

**Cómo operar.**
```bash
npx tsx -e "import {PROCEDURE_COUNT} from './src/lib/data/auxilio/index.ts'; console.log(PROCEDURE_COUNT)"  # → 34
npx tsx scripts/gen-guide-pdf.ts   # regenera el PDF (Playwright) — hacerlo si cambian las guías
```

**Gotchas.**
- Chat con IA APAGADO: `const AI_ENABLED = false` en `AuxilioChat.svelte`. Reactivar = `true`. El endpoint `/api/ai/ask` sigue vivo.
- `expansion.ts` es GENERADO (`gen-expansion.mjs`), NO se edita a mano; además el script lee un OUT hardcodeado en `/private/tmp/.../tasks/*.output` (reproducible-en-su-momento, no idempotente hoy).
- Contactos: NUNCA poner un teléfono no verificado como enlace `tel:`. Tier `unverified` solo muestra texto + remite al 911. Verificados: 911, CICR, Cruz Roja VE, Bomberos Caracas.
- Banner "⚠️ En revisión" (`DISCLAIMER`) es OBLIGATORIO hasta que un profesional valide; no quitarlo sin OK founder.
- El PDF en `static/` es artefacto generado: si cambian las guías, regenerar o quedará desincronizado.

**Reglas.** #14 (budget IA) · #15 (Haiku 4.5) · #16 (IA sin PII) · #17 (rate-limit 10/IP/día) · #22 (AAA) · #23 (reduced-motion) · #24 (lenguaje claro) + regla transversal: cero invención + cita de fuente.

**Estado.** 🟢 LIVE. 34 guías offline + PDF + chat sin IA. LISTO PERO INACTIVO: chat con IA. PENDIENTE: validación médica profesional (retirar banner) + confirmar 4 contactos "sin verificar".

---

## 6. PWA offline + cola de reportes (outbox cifrada)

**Qué hace.** Service worker (Workbox, `registerType:'prompt'`) que precachea app-shell +
páginas estáticas (`/auxilio`, `/offline`) y aplica navegación **fail-closed**: solo rutas
estáticas se cachean; mapa/`persona`/`punto`/`reportar`/`api` van NetworkOnly y caen a `/offline`
sin persistir HTML con PII. Encima, una cola guarda los 4 forms de persona sin señal en IndexedDB
cifrados (AES-GCM) y los reenvía solos al reconectar REUSANDO `POST /api/persons` con Turnstile
FRESCO por entrada. La migración 0027 da idempotencia por `client_uuid` (cierra el ACK-perdido).

**Archivos clave.** `src/service-worker.ts` · `vite.config.ts` · `src/routes/+layout.svelte` (registro) ·
`src/lib/utils/offline-policy.ts` · `src/lib/client/{outbox,replay,report-submit,outbox-summary}.ts` ·
`supabase/migrations/0027_offline_idempotency.sql` · `scripts/verify-offline.mjs`.

**Cómo operar.**
```bash
npm run build && npm run preview        # el offline real SOLO se ve con build+preview (no en vite dev)
node scripts/verify-offline.mjs         # Playwright: /auxilio offline, /persona→/offline, sin PII
npm test                                # incluye offline-policy.test.ts (20 tests)
# Migración 0027: SQL Editor en 2 PASOS (CREATE UNIQUE INDEX CONCURRENTLY fuera de transacción)
```

**Gotchas.**
- El SW NO se registra en dev (`devOptions.enabled:false`); no depurar offline en `vite dev`.
- `registerType:'prompt'`, NO autoUpdate (autoUpdate recargaría la página y perdería un reporte a medio llenar). La única recarga la dispara el `RefreshButton`.
- La cola NO usa `/api/offline-sync` (reservado, hoy 404): reusa `POST /api/persons` con Turnstile fresco. NO crear un camino paralelo exento de Turnstile/rate-limit (eludiría el 10/h) — Ley de Reuso.
- El cifrado AES-GCM es defensa-en-profundidad, NO protege contra el propio dispositivo (la app descifra para reenviar). La protección real: cero render de PII + purga + `wipeAll`. La PII canónica se cifra server-side en la RPC.
- `minimizeEnqueuablePayload` usa LISTA BLANCA: un campo nuevo en un form NO se guarda offline si no se agrega a `ENQUEUABLE_FIELDS`. Auto-reporte "a salvo" sin opt-in → borra lat/lng antes de cifrar (#26). Foto offline = online-only en v1.

**Reglas.** #1 · #2 · #4 · #5 · #6 (TTL 48 h + wipeAll) · #21 (Dexie/replay lazy) · #23 · #24 (copy honesto) · #26 · #29 · #17.

**Estado.** 🟡 Código LIVE (shipped `fc0f290`); SW/offline base LIVE desde `7c8f4fb`. Verificado en navegador real. **PENDIENTE FOUNDER: aplicar 0027** (SQL Editor, 2 pasos) — única barrera dura anti-duplicado en un ACK-perdido. Fast-follows no implementados: foto en cola, cola para notes/aid-points, SW BackgroundSync.

---

## 7. Reportes públicos + puntos de ayuda

**Qué hace.** Hub `/reportar`: cualquier anónimo reporta personas desaparecidas, "a salvo",
condición médica, cuerpos NN, avistamientos (todos vía `POST /api/persons` → RPC
`create_person_report` que cifra/hashea la PII en Postgres), y lugares de servicio (puntos de
ayuda/refugios vía `POST /api/aid-points`, visibles al instante, coords EXACTAS). Lecturas
siempre de `persons_public`/`aid_points_public`. Autorregulación por voto (1/IP; net≥3 →
auto-ocultar reversible + alerta founder). NavigateButton solo en lugares de servicio.

**Archivos clave.** `src/routes/reportar/**` · `src/routes/api/persons/+server.ts` ·
`src/routes/api/aid-points/+server.ts` (+ `[id]/vote`, `[id]/reactivate`) ·
`src/lib/components/{NavigateButton,Turnstile}.svelte` · `src/lib/client/{report-submit,photo}.ts` ·
`src/lib/schemas/{person,aid-point}.ts` · `supabase/migrations/0010,0014,0021,0022_*.sql`.

**Cómo operar.**
```bash
npm run check                                       # svelte-check (gate: 0 errores)
npm run build                                       # build limpio antes de deploy
curl -s https://faro-ve.com/api/persons | head      # smoke lectura (200)
curl -s https://faro-ve.com/api/aid-points | head   # smoke lectura (200)
```
Cadena de cada mutación (en `hooks.server.ts`, EN ORDEN): handleContext (hashea IP) →
config-guard (503 si faltan controles) → Turnstile (403 fail-closed) → rate-limit KV (429) →
INSERTS_PAUSED (503) → recién entonces el `+server.ts` valida con Zod y llama la RPC.

**Gotchas.**
- CORS de GET en `hooks.server.ts`, no en `_headers`.
- `/api/offline-sync` reservado sin handler (404); la cola offline NO lo usa (ver subsistema 6).
- Sin `SUPABASE_SERVICE_ROLE_KEY`, `locals.supabaseAdmin` cae a anon y la RPC falla con 502 — síntoma de secret faltante, no bug.
- lat/lng vienen juntos o ninguno (la RPC lanza si solo viene uno). La coord exacta opt-in (a-salvo) se expone solo in-app; el GeoJSON de federación SIEMPRE usa la ofuscada.
- Status público limitado por la RPC a missing/safe_self_report/unidentified_body/sheltered/hospitalized; no se puede crear withdrawn ni found_* desde el endpoint público.
- Rate limits reales: `/api/persons` 10/h · `/api/aid-points` 10/h · vote 30/10min · reactivate 3/h.

**Reglas.** #1 · #2 · #3 · #4 · #5 · #24 · #26 · #27 (NavigateButton único) · #28 (address_text/landmark/entrance_notes + copiar dirección) · #29.

**Estado.** 🟢 LIVE (lectura 200 verificada, 7 formularios, fichas SSR, vertical aid_points completa, auto-publish 0021, autorregulación 0022). PENDIENTE/condicional: inserts de persona en prod exigen `SUPABASE_SERVICE_ROLE_KEY` + `TURNSTILE_*`; verificar que 0023–0029 estén aplicadas. NO re-correr `scripts/seed-test-persons.mjs` contra prod.

---

## 8. Auto-publicador Instagram (@farovenmap) + Reencuentros

**Qué hace.** Cron horario (launchd) que publica 1 ficha retrato verificada/hora en @farovenmap
(vía Buffer GraphQL), con filtro IA de fotos (Haiku visión: rechaza flyers/cédulas/teléfonos/
screenshots/grupos/menores → solo foto limpia) + anti-homónimo. Además detecta **reencuentros**
(buscados en Faro que figuran A SALVO en otra fuente) → documento del día + carrusel IG + página
pública `/reencuentros`. El cruce también enriquece la DB de Faro (`/api/enrich`, sin tocar PII).

**Archivos clave.** `scripts/buffer/{cron-ig,photo-filter,found-detector,render-ficha,reconcile,render-reencuentros-carousel,post}.mjs` ·
`src/routes/api/enrich/+server.ts` · `src/routes/reencuentros/` ·
`supabase/migrations/0029_enrich_and_reencuentros.sql`.

**Cómo operar.**
```bash
touch ~/.faro-ig/paused        # ⛔ pausa el cron (kill-switch suave)
rm ~/.faro-ig/paused           # ▶️ reanuda
DRY=1 node scripts/buffer/cron-ig.mjs                 # ensayo sin publicar (ver a quién elegiría)
WHEN_MIN=4 node scripts/buffer/cron-ig.mjs            # corrida manual (publica 1, +4 min)
LIMIT=50 node scripts/buffer/reconcile.mjs            # genera documento de reencuentros del día
tail -f ~/.faro-ig/cron.log                           # log en vivo
```

**Gotchas.**
- Solo se publica CON foto limpia (decisión founder); sin foto limpia → se salta (reintenta 3d). El cron publica pocas a propósito.
- Hosting de imágenes: git worktree rama `fichas-cdn` → raw.githubusercontent. Si el push desde launchd falla por auth (keychain) → migrar a Supabase Storage/R2 (roadmap).
- `post.mjs` exit 1 = falta `BUFFER_API_KEY` (el cron lo lee de `~/.secrets/faro-ve/buffer-key.txt`). "Access token is not valid" = key mal copiada → regenerar en publish.buffer.com/settings/api.
- IDs Buffer: org `6a418e4ed0bf4334f8959146` · IG channel `6a4190975ab6d2f106819d3d`.

**Reglas.** #3 (nunca foto de menores) · #1 (ubicación ofuscada) · #9 (atribución a Venezuela Reporta) + lenguaje "posiblemente / verificá en la fuente" (no falsa esperanza).

**Estado.** 🟢 LIVE (cron `com.farove.ig` 1/hora; publicó a Luduin + Miguel; 2 catches reales del filtro: homónimo + flyer con cédula). PENDIENTE FOUNDER (3 pasos, no bloquean publicación): aplicar 0029 + `wrangler pages secret put ENRICH_TOKEN` + push/deploy → activa `/reencuentros` y `/api/enrich`. **Detalle completo en `docs/RUNBOOK-instagram-reencuentros.md`.**

---

## Restricciones globales (leer antes de tocar infra)

- **El sandbox/Mac NO alcanza la DB directa** (`db.blmiebnnprwaupyatsyb.supabase.co` es IPv6; la red local es IPv4 → `ENOTFOUND`). Consecuencias:
  - **Migraciones** → se aplican pegándolas en el **SQL Editor de Supabase** (founder), no con `apply-migrations.mjs` desde local. Tras RPCs: `notify pgrst, 'reload schema';`.
  - **El Worker de Cloudflare SÍ alcanza la DB** → toda ingesta/escritura masiva de prod corre en el Worker, no localmente.
  - **Escritura masiva local** (solo con OK founder) exige la cadena del **Session pooler** en `DATABASE_URL`, no el host directo.
- **No deploy/push a prod sin OK del founder.** Commits **por feature lógica, NUNCA bulk** (regla #13).
- **Secretos** en `~/.secrets/faro-ve/` (chmod 600), **NUNCA en repo ni en chat**.
- **`service_role` jamás por chat** (el classifier lo bloquea, correcto): se setea con `wrangler pages secret put` / `wrangler secret put`.
- **CORS** va en `hooks.server.ts` (`PUBLIC_GET_CORS`), **NUNCA en `_headers`** (no cubre las Functions de SvelteKit en Pages).
- **Kill switches** (env vars, regla #29-31): `INSERTS_PAUSED` (congela mutaciones públicas) · `FACE_MATCH_ENABLED=false` · `LLM_DAILY_BUDGET_USD=5`.

## Dónde viven las cosas

| Cosa | Dónde |
|---|---|
| Repo | `github.com/bleiquelc/faro-ve` (rama `main`) |
| Supabase | ref **`blmiebnnprwaupyatsyb`** (Postgres + PostGIS + Auth + Storage, free tier) |
| Hosting | Cloudflare **Pages `faro-ve`** → faro-ve.com / faro-ve.pages.dev · Workers (cron-ingest, ai-health, ai-triage) |
| Secretos | `~/.secrets/faro-ve/` (chmod 600): `APP_SALT.txt`, `anthropic-key.txt`, `db-url.txt`, `buffer-key.txt`, `enrich-token.txt` |
| Estado/logs cron IG | `~/.faro-ig/` (`state.json`, `cron.log`, `paused`, `cdn/`) |
| Documentos + carrusel reencuentros | `~/Desktop/faro-reencuentros/` |
