# Faro VE — Status

> Documento vivo. Cierre del día actualiza este archivo + crea
> `docs/SESSIONS/YYYY-MM-DD-day{N}.md` con detalle.

## ⚡ ÚLTIMO AVANCE — 12-jul-2026 · REVISIÓN DE SISTEMA + FIX ALERTA DE ERRORES VIEJOS

> Detalle: `docs/SESSIONS/2026-07-12-revision-sistema-fix-alertas.md`.

**Revisión completa (todo verificado en vivo):** 9 rutas/APIs **200** (home, mapa, auxilio, datos, atribución, privacidad, reencuentros, persons, aid-points, pfif) · total **46.765** personas (la ingesta del mantenimiento suma sola: +27 hoy, +59 ayer; cursor en término 432 de 465) · cron IG sano (publicó a Elidivith hoy 08:22; 90 posteadas, 8 reencuentros; los "0 publicadas" de otras corridas son el filtro IA rechazando fotos sucias/homónimos, por diseño) · reel de hoy programado en Buffer — **último de la semana blindada 6→12 jul; desde mañana 13-jul el launchd retoma la generación diaria** (pipeline blindado el 5-jul, corridas recientes limpias) · mantenimiento de las 09:00 corrió OK.

**Fix aplicado (`b388f72`):** la alerta "cron IG tiene errores" llevaba 3 días disparándose por errores **viejos ya resueltos** (9-jul: 4× DNS-al-despertar + 1 socket Anthropic, todos transitorios) porque `daily.mjs` nunca archivaba el err.log. Ahora: **alerta UNA vez y archiva solo** a `<err.log>.<fecha>.bak` (truncate, no rename — launchd re-abre el path) · vigila también `reel.err.log` · verifica que el **reel de AYER** quedó programado en Buffer (el de hoy corre a la misma hora → carrera). Verificado en vivo: 1.ª corrida alerta+archiva (2105 bytes → `.bak`), 2.ª corrida "todo sano ✅" exit 0.

**Git al día:** el trabajo del 8-jul corría en prod **sin versionar** → commiteado (`08e7c59` ingesta-en-mantenimiento + `0bf6364` docs/handoffs). Sin versionar a propósito: `scripts/render-*.mjs` + PNGs de sesión.

**🟢 FUGA DE CLAVE RESUELTA (misma tarde, founder + agente en vivo):** cuenta Supabase identificada vía Gmail (`bleiquelc@gmail.com`) → `PUBLIC_SUPABASE_ANON_KEY` = **publishable** → secret nuevo `faro-server` en `SUPABASE_SERVICE_ROLE_KEY` → clave filtrada (`faro`, `sb_secret_dz…`) **REVOCADA** (hoy da `401 Unregistered API key`). **Gotcha:** una TERCERA var `SUPABASE_ANON_KEY` (del incidente 26-jun) también tenía la clave filtrada y `hooks.server.ts:172-175` la prefiere → al revocar, `persons/aid-points/pfif` cayeron 502 unos minutos hasta setearla = publishable + redeploy. **Al rotar: actualizar las TRES vars + redeploy.** Verificado final: 12 rutas/APIs 200 · HTML solo `sb_publishable` · gate escritura 403 · RPC servidor OK · conteo intacto 46.765. La `default` del worker no se tocó (no filtrada).

**🟢 MIGRACIONES AL DÍA (12-jul tarde, OK founder):** verificación real contra la DB reveló que el ledger `_faro_migrations` estaba vacío desde 0021 (el founder aplicaba por SQL Editor sin registrar) y que los pendientes documentados estaban VIEJOS: **0027 ya estaba aplicada** (índice + guarda `client_uuid` verificados) y **0028 NO** (bug real: la ingesta en prod aún descartaba a los sin-geocode, ~15% de la fuente, aunque el doc decía lo contrario). Aplicadas las 4 faltantes — **0023, 0024, 0028 (fix ingesta), 0031 (borrado self-service)** — cada una en su transacción + ledger sincronizado 0021→0031 + `notify pgrst`. Grants verificados (todas solo service_role, anon bloqueado). `/privacidad/eliminar` operativa (200; gate 403 sin Turnstile). **Desde mañana la ingesta diaria suma también a los sin-ubicación** (buscables por nombre, sin pin).

**🟢 EMAIL ROUTING COMPLETO (12-jul tarde):** verificado por API CF: enabled+ready+synced, destino `bleiquelc@gmail.com` verificado, reglas **opt-out@ ✅ · contacto@ ✅ · federacion@ ✅ (creada hoy — antes REBOTABA)** → todas al Gmail del founder. Regla #8 (SLA opt-out 24h) operativa a nivel infra; falta solo el cron lector del inbox (regla #10). **Barrido de seguridad de la ventana de exposición (2→12 jul) LIMPIO:** audit_log normal, 0 moderadores extraños, retiros = solo caso Guerrero, regla #3 intacta (0 fotos de menores expuestas en `persons_public`, verificado doble). Caveat honesto: logs de LECTURA del API en free tier retienen ~1 día → no auditables retroactivamente; la clave ya está muerta.

**Pendientes founder:** (A) ~~rotar clave~~ ✅ 12-jul. (B) ~~migraciones~~ ✅ 12-jul (0021→0031 completas). (C) `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` (re-geocodificar lo viejo). (D) ~~Email Routing~~ ✅ 12-jul (falta solo cron lector inbox opt-out, regla #10). (E) Opcional: ingesta 24/7 revisando el plan Workers en CF. (G) Reconectar la key del MCP Resend (inválida — bloquea relay y pruebas de email).

## ⚡ ÚLTIMO AVANCE — 8-jul-2026 · MANTENIMIENTO + CATCH-UP DE INGESTA + INGESTA AUTOMÁTICA MOVIDA AL MANTENIMIENTO

**Mantenimiento:** salud verde (6/6 endpoints 200), cron IG sano (66 posteadas, 6 reencuentros; 0 publicadas esta corrida = filtro IA rechazando flyers/homónimos, por diseño), 0 err logs, nada pausado. Reencuentros del día sembrados (5). Tabla base `persons` = 46.543 (la API pública muestra 46.517; la diferencia son withdrawn/pending que la vista pública oculta).

**🔴 Hallazgo — la ingesta automática llevaba 6 días CAÍDA:** el Worker `cron-ingest` de Cloudflare tiene el schedule `*/5` **REGISTRADO** (verificado vía API CF `.../schedules`) pero la **cuenta free NO lo ejecuta**: `import_sources.last_run_at=null`, `total_imported=0`, 0 corridas desde el 2-jul, `wrangler tail` sin eventos. Por eso el conteo llevaba días congelado en 46.517. Re-desplegué el worker (versión `9da95903`) — el deploy es limpio pero NO arregla el disparo (problema de plataforma/plan, no de código: el código de cursor ya estaba en prod desde el 2-jul).

**Catch-up manual (agregando personas):** el Mac **YA alcanza la DB directa** (la vieja restricción IPv6 no aplica en esta red) → corrí `venezuela-te-busca.mjs --apply` (pipeline perfeccionado, throttle ético 1 req/2s, idempotente). En curso en background (+57 nuevas y subiendo al momento de escribir; número final al cierre).

**Ingesta ahora AUTOMÁTICA vía el mantenimiento (decisión founder):** en vez de depender del cron CF roto, se integró la ingesta a `scripts/maintenance/daily.mjs` (**paso 2b**) — bloque ROTANTE de 155 términos/día (cubre los 465 en ~3 días), incremental, idempotente, cursor en `maintenance-state.json`. El script ganó el flag `--start-term N` (+ imprime `CURSOR_NEXT=`); default 0 preserva el barrido manual. **Verificado end-to-end** (escritura real + avance de cursor + parseo por regex). NO requiere recargar el launchd (el plist no cambió). Corre 09:00 (o al despertar el Mac). Sintaxis 0 errores en ambos archivos.

**Pendientes founder:** (A) 🔴 **ROTAR clave Supabase → publishable** — la fuga `sb_secret_` **sigue viva** en el HTML (verificado hoy: `curl -s https://faro-ve.com/ | grep -o 'sb_[a-z]*'` = `sb_secret`); es el pendiente de seguridad más urgente. (B) Ingesta 24/7 opcional: revisar plan Workers en el panel CF, o disparar el worker por HTTP. (C) Migraciones 0027 (idempotencia offline) y 0031 (borrado self-service) sin aplicar.

## ⚡ ÚLTIMO AVANCE — 5-jul-2026 · REVISIÓN DE SISTEMA + SEMANA IG PRE-PROGRAMADA + FIX "RED AL DESPERTAR"

> Detalle: `docs/SESSIONS/2026-07-05-revision-sistema-semana-ig.md`.

**Diagnóstico (revisión completa):** los reels del **3, 4 y 5-jul nunca llegaron a Buffer** — el Mac despierta a las 09:00 con launchd corriendo ANTES de que la red levante; el `fetch` a Buffer/Pexels moría con `ConnectTimeout` y el script salía sin reintento (último reel publicado por el pipeline: 2-jul; el de hoy salió 15:00 Madrid re-programado a mano). La misma carrera hizo que el mantenimiento de las 09:00 reportara **8 falsos "endpoint caído"** (HTTP 0 = sin red local, no el sitio).

**Fix (Ley de Reuso — se extendieron los scripts existentes, 4 archivos):**
- `scripts/reel/daily-reel.mjs`: **espera la red** (10×30s) + **idempotencia por fecha** (lee `~/.faro-ig/reel-scheduled.json`; si el día ya está programado, no duplica) + genera con `REEL_DATE` del día del dueAt.
- `scripts/buffer/reel-post.mjs`: **reintentos 6×45s** contra Buffer + **fallo DURO** (exit 1 si no hay `post.id`) + registra la fecha programada en el estado.
- `scripts/reel/make-reel.mjs`: acepta **`REEL_DATE=YYYY-MM-DD`** (pre-generar reels de días futuros; versículo+footage rotan por ese día).
- `scripts/maintenance/daily.mjs`: sonda a un **tercero** (Cloudflare) antes de chequear; sin red → 1 alerta honesta "SIN RED LOCAL" y omite los chequeos del sitio (no más falsos "caído").

**Semana protegida — 7 reels PRE-PROGRAMADOS en Buffer (6→12 jul, 16:00 Madrid, `dueAt` absoluto):** publican **server-side aunque el Mac duerma**. Versículos [11]–[17] (Juan 1:5, Salmos 147:3, Josué 1:9, Salmos 91:1, Juan 14:1, Isaías 40:31, Salmos 121:7), footage Pexels distinto por día (incl. Caracas y La Guaira). Verificado en Buffer: `posts(status:[scheduled])` = 7. Test real de idempotencia: corrida de `daily-reel` → "ya programado, nada que hacer" (0 duplicados). Desde el 13-jul el launchd diario retoma la generación normal (ya blindada).

**Salud verificada en vivo (5-jul 19:20):** 6 endpoints **200** · total **46.485** personas (+55 desde 2-jul; el worker ingiere) · cron IG de fichas ACTIVO (64 posteadas; últimas corridas publican 0 porque el filtro IA rechaza fotos del tramo actual — por diseño, reintenta en 3d) · monitoreo nube activo (Peña + Yordy cada hora, reporte 07:37, `faro-soporte-correos` 3×/día) · err-logs archivados (`~/.faro-ig/*.err.log.2026-07-05.bak`) → mantenimiento **"todo sano ✅"**.

**🔴 SIGUE LA FUGA DE CLAVE:** faro-ve.com aún inyecta `sb_secret_` en el HTML (verificado hoy). **Pendientes founder sin cambio:** (A) **rotar clave Supabase → publishable [URGENTE]**; (B) migraciones **0027** (idempotencia offline) y **0031** (borrado self-service); (C) `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` (re-geocodificar lo viejo); (D) verificar Email Routing (opt-out@, regla #8/#10).

## ⚡ ÚLTIMO AVANCE — 2-jul-2026 (tarde) · BORRADO SELF-SERVICE + PRIVACIDAD + FEDERACIÓN

> Detalle en la misma sesión: `docs/SESSIONS/2026-07-02-geocode-precision-y-fuga-clave.md`.

**Decisión founder sobre la clave:** la `sb_secret_` se había puesto pública creyendo que así "otras apps se conectan". Aclarado: la federación NO necesita la secret — otras apps se conectan por la **API pública** (`/api/pfif`, `/api/persons`, `/datos`) **sin clave**, o con la **publishable** (respeta RLS, solo ve la vista pública ofuscada). Founder eligió **cambiar a publishable + rotar** (pendiente de ejecutar en el panel). La guarda de código sigue puesta.

**Borrado self-service (LIVE, falta migración founder):** ahora una persona puede **salir del mapa** o una familia puede **retirar a su familiar fallecido**. Modelo elegido por el founder: **inmediato y reversible**. `/privacidad/eliminar` (buscar por nombre o llegar desde la ficha con "Solicitar retiro") → motivo (soy yo / mi familiar falleció / otro) + Turnstile → oculta del mapa al instante, reversible 30 días, purga PII a 30d, alerta al founder, audita. Migración **0031** (`request_person_removal` + `restore_withdrawn_person`, solo service_role) + endpoint `POST /api/persons/[id]/remove` (Turnstile + rate-limit 5/h) + enlace discreto en cada ficha. **PENDIENTE FOUNDER: aplicar 0031 en el SQL Editor** (hasta entonces el endpoint da 502; la UI degrada con aviso).

**Privacidad honesta (LIVE):** nueva página `/privacidad` (antes carpeta vacía / enlace roto) + `PRIVACY.md` actualizado: los datos del mapa **ya son públicos** (fuentes con atribución + opt-out), re-publicados con **ubicación ofuscada**; se mantiene protegido lo que NO es público (contacto de reportantes cifrado, fotos de menores). Dice explícito que la API de datos abiertos **no necesita clave**. Enlace "Privacidad" en el footer del home.

**Estado:** 100 tests verde · svelte-check 0 · build limpio · **deploy Pages HECHO** (smoke prod: `/privacidad` 200, `/privacidad/eliminar` 200, endpoint remove 403 sin Turnstile = gate OK). Commits locales en `main`. **Pendientes founder: (A) rotar clave Supabase → publishable [URGENTE]; (B) aplicar migración 0031 [borrado]; (C) `wrangler secret put SUPABASE_DB_URL` + deploy worker [re-geocodificar lo viejo].**

## ⚡ ÚLTIMO AVANCE — 2-jul-2026 · PRECISIÓN DEL MAPA (pines fuera del agua) + 🔴 FUGA DE CLAVE

> Sesión autónoma (Fable 5). Detalle: `docs/SESSIONS/2026-07-02-geocode-precision-y-fuga-clave.md`.

**🔴 BLOQUEADOR DE SEGURIDAD (founder, urgente):** la web pública **faro-ve.com inyecta en el HTML** una clave **`sb_secret_…`** como `PUBLIC_SUPABASE_ANON_KEY`. Esa es la clave SECRETA de Supabase (bypassa RLS): cualquiera podría leerla del código fuente y consultar la tabla base `persons` (coord EXACTA + PII), saltando `persons_public`. Viola #1/#2. **NO se usó la clave.** Fix (solo founder, chip creado): (1) ROTAR la secret en Supabase; (2) `PUBLIC_SUPABASE_ANON_KEY` = clave **publishable** (`sb_publishable_…`); (3) `SUPABASE_SERVICE_ROLE_KEY` = la nueva secret; (4) `$env/dynamic/public` es runtime → sin redeploy, pero conviene. Verificar: `curl -s https://faro-ve.com/ | grep -o 'sb_[a-z]*'` debe decir `sb_publishable`. Guarda defensiva ya en código (`src/lib/utils/key-guard.ts` + `browserSupabase()`): el navegador jamás usa una clave privilegiada, pero NO evita la inyección en HTML — el fix real es rotar.

**Pines sobre el agua — CAUSA RAÍZ Y FIX (geocoder v2, LIVE):** 10 anclas del geocoder caían EN EL MAR (Tanaguarena ~5 km mar adentro, Todasana ~6 km, Los Corales, La Sabana, Naiguatá, Porlamar, Tucacas, Higuerote…). La ofuscación obligatoria 200–500 m (#1) agotaba sus 16 intentos alrededor del ancla marina y el snap-a-costa apilaba miles de pines SOBRE el agua. **Geocoder v2** (`GEOCODE_VERSION=2`): anclas corregidas a coords en tierra + **2477 lugares de GeoNames** (CC BY 4.0, sedes de municipio/parroquia/pueblo/sector, TODAS verificadas en tierra) + desambiguación por CONTEXTO de estado + matcher por n-gramas (46k textos en ~380 ms). Ahora el pin cae en el **lugar real de la dirección pública**, no en la capital del estado. `scripts/ingest/{geocode,geocode-places,gen-geocode-places,land-mask}.mjs`. Tests +10 (toda ancla en tierra). **Deploy LIVE** (Pages + worker).

**Re-geocodificación de lo ya guardado (worker, listo; falta 1 secret founder):** `workers/cron-ingest/src/regeocode.ts` recalcula los ~46k puntos ingestados al lugar correcto — paginado keyset resumable, 1 transacción/página con advisory lock + `skip_persons_audit`, gate por `GEOCODE_VERSION`, fail-safe. **PENDIENTE FOUNDER: `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` (pegar `~/.secrets/faro-ve/db-url.txt`) → el próximo tick del cron re-geocodifica una sola vez.** Sin ese secret, los NUEVOS reportes ya entran con coords v2; los viejos se corrigen al setearlo.

**3 bugs de revisión adversarial arreglados (LIVE):** (1) `Map.svelte` race real con zoom rápido (pines stale sobre burbujas → `dataEpoch`); (2) `Map.svelte` a11y: el modo agregado (inicial de `/mapa`) sin ruta sr-only → nav accesible de zonas; (3) `persona/[id]` no seleccionaba `contact_phone_optional` → el botón "Llamar" nunca aparecía aunque el sujeto "a salvo" publicara su teléfono. + `api/enrich`: comparación de token en tiempo constante.

**Estado:** 95 tests verde · svelte-check 0 · build limpio · **deploy Pages + worker HECHO**; smoke prod 200 (home/mapa/ficha/persons=46.430/clusters). **4 commits locales en `main`** (push a GitHub bloqueado por el classifier — lo hace el founder). **Pendientes founder: (A) rotar la clave Supabase [URGENTE]; (B) `wrangler secret put SUPABASE_DB_URL` + deploy worker para re-geocodificar lo viejo.**

## ⚡ ÚLTIMO AVANCE — 1-jul-2026 · CONTEO DESCONGELADO (fuente pasó a solo-búsqueda)

> Detalle en memoria: `[[faro-ve-fuente-search-only]]`. Reparación de la ingesta.

**Diagnóstico:** el conteo estaba **congelado en ~26,961** aunque Venezuela Te Busca ya tenía **63,764+** registros (creció rápido). Causa raíz: **la fuente cambió su API** de paginación por `?page=N` a un modelo **SOLO-búsqueda con cursor**. El worker `*/5` (y el script) pedían `?page=N`, la fuente lo ignoraba y devolvía siempre los 24 recientes → todo caía en dedup → **el número no subía**. (Anula el pendiente viejo "relajar `*/5`→`*/15` al estabilizar ~28-29k": el problema no era estabilización, era la API rota. Y la línea "el worker ingiere 24/7" quedó **falsa** hasta el redeploy.)

**Reparado (Ley de Reuso — reusa el core, no reconstruye):**
- Core `scripts/ingest/venezuela-te-busca-core.mjs`: `fetchSearch`/`fetchSearchValid` (cursor).
- `scripts/ingest/search-terms.mjs` (NUEVO): 465 términos (nombres+apellidos+lugares+trigramas).
- `scripts/ingest/venezuela-te-busca.mjs`: enumeración por términos+cursor+dedup+corte temprano; `insertBatch` ahora por la RPC `ingest_persons_batch` (el INSERT inline estaba roto: "data type of parameter $12").
- `workers/cron-ingest/src/adapters/venezuela-te-busca.ts`: mismo modelo (`ingest_cursor`=índice de término, rota). **PENDIENTE FOUNDER: `npm run deploy:workers`** para reactivar la ingesta automática.

**Recuperación manual COMPLETADA** (idempotente, throttle 1 req/2s, auto-aprobado, atribución+opt-out intactos): `node scripts/ingest/venezuela-te-busca.mjs --apply --dup-pages 3`. **Conteo 26,961 → 46,393 (+19,432, +72%)** en una pasada (465/465 términos, 3,464 req, 17,102 nuevos, 45,604 personas únicas vistas ≈ 73% de los 63,764 de la fuente). El resto (cola dispersa + no-geocodificables) se completa por **federación** (borrador `docs/outreach/venezuela-te-busca-feed-request.md`), no por más scraping (regla #12 + eficiencia). Re-correr el comando es seguro (idempotente) para capturar nuevos.

**Pendientes founder de esto:** (1) `npm run deploy:workers`; (2) revisar/enviar el outreach de feed a Venezuela Te Busca.

## ⚡ ÚLTIMO AVANCE — 30-jun-2026 (noche) · TODO CORRIENDO SOLO

> Detalle completo en memoria: `[[faro-ve-reel-esperanza]]`, `[[faro-ve-mantenimiento]]`, `[[faro-ve-instagram-buffer]]`, `[[mision-3-proyectos]]`. Lee `docs/RUNBOOK-mantenimiento.md`.

**3 launchd activos en el Mac del founder** (`launchctl list | grep farove`):
- **`com.farove.ig`** (cada 1 h) — auto-publicador IG @farovenmap (2 fichas/corrida, SOLO foto limpia verificada por IA, anti-homónimo).
- **`com.farove.maintenance`** (09:00) — salud del sitio + ingesta + **reconcile incremental** (SINCE 3 días) + seed + alerta SOLO si algo falla (notificación macOS). `docs/RUNBOOK-mantenimiento.md`.
- **`com.farove.reel`** (09:00 → programa 16:00 Madrid) — **Reel diario de esperanza** (versículo RV + footage sereno de Venezuela vía Pexels, rotando). `scripts/reel/`. Buffer-video PROBADO (`reel-post.mjs`). Preview: `node scripts/reel/preview-next.mjs`.
- Worker Cloudflare **cron-ingest** (*/5) ingiere el conteo 24/7 (la DB es IPv6).

**LIVE:** `/reencuentros` con **288 familias** (de 413 detectadas; 100 media en `~/Desktop/faro-reencuentros/` para revisión). Reels: amanecer + mar turquesa publicados; Caracas programado 1-jul 18:00; diario automático desde 1-jul 16:00. **Optimización de tokens:** cache IA compartido (`scripts/buffer/ai-cache.mjs`).

**Pendientes del founder (chips de tarea creados):** purga PII Habeas Data (regla #6, `pg_cron`), cron opt-out + verificar Cloudflare Email Routing (reglas #8/#10), relajar worker cron-ingest `*/5`→`*/15` cuando el conteo se estabilice (~28-29k).

**Secretos en `~/.secrets/faro-ve/`:** `buffer-key.txt`, `anthropic-key.txt`, `enrich-token.txt`, `pexels-key.txt` (todos válidos). Kill-switch global IG+reel+mantenimiento: `touch ~/.faro-ig/paused`.

## Sprint 25-jun-2026 → 1-jul-2026 (6 días)

| Día | Fecha | Foco | Gate | Estado |
|-----|-------|------|------|--------|
| D1  | 25-jun-2026 | Foundation: schema + scaffolding + tokens + navigation | DB Gate 9/9 ✓ + sitio live faro-ve.pages.dev HTTP 200 ✓ | 🟢 **GATE D1 COMPLETO** |
| D2  | 26-jun-2026 | Mapa Leaflet + CRUD persons + clusters + filtros + animaciones | móvil ve 30 puntos clusterizados, menores+médicos pulsando, pending en /moderar | pendiente |
| D3  | 27-jun-2026 | Moderación + magic-link + relay + resto formularios | moderador aprueba 3, mensaje relay llega; punto-ayuda guardado | pendiente |
| D4  | 28-jun-2026 | PWA offline + sync + scrapers | PWA instalada, offline, sync OK; ≥2 fuentes activas | pendiente |
| D5  | 29-jun-2026 | Match + búsqueda + IA + i18n + PFIF export | chat IA OK, triage clasifica, budget <$1, PFIF valida XSD | pendiente |
| D6  | 30-jun→1-jul | Polish + onboarding + panel-org + deploy + difusión | Lighthouse perf≥85 a11y≥95 PWA, onboarding, 7 emails federación | pendiente |

## Día 1 — COMPLETADO (mitad DB) · 🟢 Gate DB PASS

### Entregables (todos pusheados a github.com/bleiquelc/faro-ve)

- **Stack**: SvelteKit 5 + Vite 7 + adapter-cloudflare 7 + Tailwind 3 + Wrangler 4 + Anthropic SDK + Dexie + Zod + Exifr + Leaflet. `npm install` limpio, `svelte-check` 0 errores.
- **Schema en producción**: 9 migraciones aplicadas a Supabase `blmiebnnprwaupyatsyb` (verificadas en `_faro_migrations`):
  - 0001 PFIF v1.4 (persons/notes/links/messages/searches_active) + vistas `persons_public`/`notes_public` (security_barrier).
  - 0002 índices (GIST, trigram, cola moderación).
  - 0003 RLS policies (anon sin SELECT directo a persons; solo vistas).
  - 0004 funciones privacidad (obfuscate_point, hash_*, encrypt_pii, decrypt_for_relay) + triggers.
  - 0005 tabla + seed `anchor_places` (80 lugares VE).
  - 0006 moderators + import_sources (7) + audit_log particionado.
  - 0007 organizations (8 verificadas) + aid_points + ai_conversations + ai_budget_daily.
  - 0008 app_config + get_app_salt (mecanismo salt compatible Supabase).
  - 0009 fix trigger foto de menor (generated column en BEFORE).
- **Utils/components**: colors.ts (tokens AAA), navigation.ts + NavigateButton.svelte (multi-app), obfuscate.ts.
- **hooks.server.ts**: Turnstile validado (getUser+moderators), rate-limit KV ventana fija, fail-closed prod, IP siempre hasheada, error genérico.
- **3 Workers** scaffold (cron-ingest, ai-health, ai-triage).
- **Tests**: 22/22 unit (vitest) + Gate D1 (9/9 contra DB real) + test SQL anti-promediado.

### Gate D1 (DB) — evidencia `node scripts/verify-gate-d1.mjs`
```
✅ orgs verificadas >= 5 — 8
✅ anchor_places > 50 — 80
✅ obfuscate_point ofusca 200-500m — dist=438m
✅ persons_public sin coord exacta ni PII — 46 cols, leak_point=false
✅ RLS en tablas sensibles
✅ APP_SALT configurado (len 64)
✅ menor → photo_visibility admin_only
✅ 9/9 migraciones
✅ estabilidad ofuscación (anti-promediado) — offset invariante 100 ediciones
🟢 GATE D1: PASS
```

### Revisión adversarial (workflow 8 agentes) — 11 bugs encontrados y arreglados
2 críticos de deploy (unaccent order, grant-before-view), 2 high (Turnstile bypass,
ataque promediado notas), 7 med/low. + 2 bugs más atrapados al aplicar (anchor_places
order, minor-photo generated-column). **Total: 13 bugs antes de producción.**

## Credenciales (en ~/.secrets/faro-ve/, NUNCA en repo)
- ✅ APP_SALT.txt (64 hex) — guardado en DB vía app_config.
- ✅ anthropic-key.txt — validada HTTP 200.
- ✅ db-url.txt — connection string directo (IPv6) funcionando.

## Infra desplegada
- ✅ Cloudflare account `64a18868c428ecbfdaf67d69edffb888` (bybleiquel@gmail.com), wrangler login OK.
- ✅ Pages project `faro-ve` → **https://faro-ve.pages.dev** + **https://faro-ve.com** (HTTPS, HTTP 200) + www.
- ✅ Dominio `faro-ve.com` registrado (CF Registrar), DNSSEC, conectado a Pages, cert SSL emitido.
- ✅ KV namespace `RATE_LIMIT` id `c2a055cea3ca4dc098144ec69e948274` (en wrangler.toml).
- ✅ Botón "Instalar app" (InstallPrompt) live en home.

## Día 2 — EN PROGRESO (mapa hallable + flujo de reporte listo)
- ✅ API live OK: `/api/persons` sirve las 30 (anon key corregida por founder).
- ✅ `lib/components/Map.svelte` — Leaflet + MarkerCluster + popup → ficha; prop `interactive` (modo fondo); a11y (sr-list, role=alert, tap 44px).
- ✅ **Home = mapa de fondo** + tarjeta de bienvenida; "Ver el mapa" abre `/mapa`. (Resuelve "no encuentro el mapa".)
- ✅ `routes/persona/[id]` — ficha SSR desde persons_public; display opt-in: coord exacta + NavigateButton para `safe_self_report` con opt-in.
- ✅ **POST `/api/persons`** — Zod + RPC `create_person_report` (cifra/hashea PII en DB) → `pending` → `{id, edit_token}`.
- ✅ **Migración 0010** — `contact_phone_public` (teléfono opt-in) + recreación `persons_public` (+`contact_phone_optional`) + RPC. *(falta aplicarla)*
- ✅ Formularios `reportar/a-salvo` (opt-in estricto ubicación/teléfono, default OFF) y `reportar/desaparecido` + `Turnstile.svelte`.
- ✅ Recon fuente ingesta `venezuela-te-busca` (22.096 registros, turbo-stream) → `docs/INGEST-venezuela-te-busca.md`.
- ✅ 2 revisiones adversariales multi-agente (Tier-1 UI + Tier-2 server/SQL): **0 bloqueantes**; hallazgos reales arreglados (gate teléfono, esc(), coords fuera-VE no tumban reporte, whitelist status, etc.).
- ⏳ **Para activar reportes en prod** (founder): aplicar 0010 + setear `SUPABASE_SERVICE_ROLE_KEY` + `TURNSTILE_*` + redeploy. Ver `docs/HANDOFF-dia2-deploy.md`.
- ⏳ Pendiente D2/D3: subida de foto con EXIF strip, FilterChips ya commiteado, moderación, relay /mensaje.

## 2026-06-26 — Capa de lugares de servicio + autorregulación + pulido UX
Detalle: `docs/SESSIONS/2026-06-26-aid-points-comunidad.md`.
- ✅ **Vertical aid_points** (Prioridad #2): alta pública (visible al instante, sin verificar, coords
  EXACTAS), votos confirmar/reportar (1/IP, net≥3 → auto-ocultar reversible + alerta founder),
  reactivación con WhatsApp cifrado (RPC admin auditado). Migración `0014` + 6 RPCs + vista pública +
  `founder_alerts`. Endpoints + formulario + ficha SSR (`/punto/[id]`) + capa de mapa (chip "Ayuda").
- ✅ **Pulido**: iconos web minimalistas estilo faro (regenerados); botón **Actualizar** PWA-aware;
  animaciones más suaves (haz del faro, bienvenida, taps); **filtros combinables** (estado + Menores/Urgencia).
- ✅ **2 revisiones adversariales multi-agente** antes de prod: 26 hallazgos → 15 confirmados arreglados
  (1 blocker de privacidad: `revoke select on aid_points from anon/authenticated`; 1 high: alta no se
  bloquea si el GPS falla → `LocationPicker` mini-mapa), 10 refutados.
- ✅ `svelte-check` 0 err · 36/36 tests (14 nuevos) · build limpio · preview verificado.
- ✅ **APLICADO + LIVE**: migración `0014` aplicada en prod (gate PASS) + deploy a faro-ve.com. Verificado
  end-to-end: `/api/aid-points` → ok, persons intacto (13.821), privacidad OK. Lectura de ayuda + filtros
  combinables + Actualizar + iconos + animaciones EN VIVO. Faltan los 3 secretos Level B para escrituras.
- ✅ **Ingesta desestancada + geocodificación nacional** (Prioridad #4a): la fuente cambió su paginación y
  el script estaba pegado en la página 1 (la fuente creció a 25.516; el mapa tenía solo 13.821). Arreglado
  (`page`/`hasMore`) + geocoder nacional testeado (cobertura 85% del total / 92% de los con-ubicación, antes
  ~24 entradas Vargas). ⏳ **Re-correr ingesta** = founder (escritura masiva prod, requiere OK explícito):
  `DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/ingest/venezuela-te-busca.mjs --apply`

## 2026-06-26 (tarde) — Burbujas por zona + pulido + diagnóstico de escrituras
- ✅ **Burbujas por zona con conteo REAL** (migración `0015` aplicada + deploy live): RPC `persons_clusters`
  (SECURITY DEFINER, solo agregados sobre coords ofuscadas, #1) → a zoom país una burbuja con el total real
  (13.357, NO el tope 1000); al acercar se separa en zonas/ciudades; a zoom≥13 pines individuales. El home
  mantiene las luces. Revisión adversarial (2 agentes): race de época + índice GIST duplicado + cast enum
  arreglados. Verificado en prod: `/api/persons/clusters` devuelve conteos reales.
- ✅ **Iconos**: el deploy ya tenía el icono nuevo; era caché del navegador → cache-bust `?v=3` en app.html.
- ✅ **Animación de la luz** más lenta (haz del faro 6s→12s; bienvenida glow 7s, haces 20s).
- ⚠️ **Escrituras (reportes) siguen en 503**: NO por los 3 secretos del founder (están OK) — **falta `APP_SALT`
  como secreto de Pages** (la lista muestra 4 secretos, sin APP_SALT; el config-guard lo exige). El founder
  debe setearlo (1 comando) + redeploy. RATE_LIMIT KV está bien en wrangler.toml.

## 2026-06-26 (noche) — Limpieza de datos de prueba en producción
- ✅ **30 perfiles `source='test'` ELIMINADOS** (eran los 30 seed de D2 para validar clusters; mostraban
  "Fuente: test" en popup/ficha → el founder los vio "como TEST"). Total bajó 13.821 → **13.791** (verificado live).
- ✅ **4 descripciones reales corregidas**: "test" era un typo de **"tez"** (complexión) en gente real de
  venezuela-te-busca ("delgada de test clara" → "tez clara"). Corregido `test`→`tez` (palabra suelta).
- ✅ Resultado: **0 perfiles dicen "test"** como palabra; los 30 con "testigo/contestura" (palabras españolas
  legítimas, substring) intactos — son personas reales. Solo quedan perfiles reales (venezuela-te-busca).
- ⚠️ NO re-correr `scripts/seed-test-persons.mjs` contra prod (re-inserta los 30 de prueba).

## 2026-06-26 (autónoma) — Panel /moderar (D3) + fix de ubicación
Detalle: `docs/SESSIONS/2026-06-26-moderar-y-ubicacion.md`.
- ✅ **Panel `/moderar`** (D3) LIVE: magic-link Supabase + cola pending ordenada (#20) + decisiones
  (aprobar/rechazar/duplicado/falta-info) con audit atómico (actor=moderador). Migración `0016` (RPCs
  SECURITY DEFINER, supresión de audit-fantasma, seed founder admin). Gate `verify-moderation.mjs` 15/15.
  Revisión adversarial (19 agentes): 3 confirmados + 1 crítico-completitud corregidos. ⚠️ Falta el paso
  de Supabase Auth (redirect-URL) para el login — ver `HANDOFF-continuar.md` #1.
- ✅ **Ofuscación consciente de la tierra** (founder: "personas sobre el mar"): migración `0017`
  (`ve_land` + `obfuscate_point_on_land`, preserva ≥200m, fail-safe). Backfill **1229→23** offshore
  (los 23 quedan en el mar a propósito: snap violaría los ≥200m → privacidad > cosmético). `Map.svelte`:
  pines de color más visibles. Revisión adversarial (12 agentes): 5 confirmados (1 high de privacidad)
  corregidos. Live: franja La Guaira 100→0, total intacto 13.791.
- ✅ Migraciones en prod: **0001–0017**. svelte-check 0 / 53 tests / build limpio. Commits `74b4e68`, `08370e6`.

## 2026-06-26 (autónoma, tanda 2) — Reconexión + alcance
Detalle: `docs/SESSIONS/2026-06-26-moderar-y-ubicacion.md` (sección "tanda 2").
- ✅ **Compartir** en cada ficha (Web Share + WhatsApp + copiar enlace) — más ojos = más hallazgos. `e330b19`.
- ✅ **Avistamientos / "Tengo información"** — doble vía: quien vio a alguien o tiene un dato lo aporta →
  moderación → aparece en la ficha. Migración `0018` (create_note_report, notes_moderation_queue,
  moderate_note), `/api/notes`, InfoForm en la ficha, sección de notas en `/moderar`. Gate `verify-notes.mjs`
  24/24. Revisión adversarial (15 agentes) → **CRÍTICO cerrado**: anon tenía INSERT directo a notes/persons
  por PostgREST (saltaba Turnstile/cifrado/whitelist); revocado. `5746129`.
- ✅ **Previews enriquecidos (Open Graph)** por persona + `og-image.png` branded que faltaba (referencia daba
  404). Al compartir una ficha: tarjeta con 'Ayúdame a encontrar a {nombre}'. `0201dbe`.
- ✅ Migraciones en prod: **0001–0018**. svelte-check 0 / 61 tests / builds limpios. Todo verificado live.

## 2026-06-27 (autónoma) — Faro Auxilio + Cuerpos NN LIVE
Detalle: `docs/SESSIONS/2026-06-27-faro-auxilio-nucleo-estatico.md`.
- ✅ **Faro Auxilio — núcleo estático** (`/auxilio`, `c3d66b5`): guía offline de primeros auxilios + supervivencia + contactos verificados, **23 procedimientos** (con `98df51a`: +torniquete, RCP niño/bebé, convulsiones, electrocución, apoyo psicológico). CERO invención, cita de fuente oficial por procedimiento. Aviso "en revisión". Botón flotante FaroAuxilio (faro con cruz blanca) en toda la app. Contactos por tier: solo verificados marcables (911, CICR, Cruz Roja VE, Bomberos Caracas).
- ✅ **Cuerpos NN — formulario** (`/reportar/cuerpo-nn`, `b44c006`): reusa `POST /api/persons` status `unidentified_body` (publish-first 0021 → aparece en el mapa al instante; persons_public 0022 lo incluye). Ícono Faro `candle`. Cierra la función 6.
- **Rigor:** revisión adversarial multi-agente antes de prod (código + seguridad + fidelidad médica + regresión de privacidad). El verify adversarial **atrapó una invención** (distancia de cable 15 m→11 m) y una **técnica de RCP de bebé invertida** (→dos pulgares, AHA 2025) antes de salir live.
- **Cableado verificado:** 0 dangling source-citations (38 fuentes, todas resuelven); todos los `href` internos resuelven; persons_public incluye `unidentified_body`; svelte-check 0 errores; builds limpios; prod 200 (`/auxilio`, `/reportar/cuerpo-nn`, smoke home/persons/desaparecido).

## 2026-06-27 (autónoma, tanda 2) — Formularios de reporte completos
- ✅ **Hub `/reportar`** + 3 formularios nuevos, todos por REUSE del camino probado y con su ícono Faro:
  - `condicion-medica` → `/api/persons` (status missing + medical_urgent forzado + categoría requerida) → resalta como urgencia médica en el mapa.
  - `refugio` → `/api/aid-points` (type shelter, capacidad, coords exactas + dirección/landmark/entrada — lugar de servicio).
  - `avistamiento` → busca persona (`/api/persons?q=`) y monta el InfoForm probado (nota type=sighting); person_id de resultado real, no inyectable.
- Íconos Faro nuevos: `sighting` (ojo+luz), `medical` (latido ECG+luz), `shelter` (carpa+luz). Home enlaza al hub sin regresar las 4 acciones rápidas.
- **Rigor:** payloads schema-válidos verificados en navegador; flujo avistamiento (búsqueda→selección→InfoForm) verificado con fetch mock; revisión adversarial de código + regresión de privacidad (clones fieles, 0 merma); prod 200 en las 4 rutas. Commit `897cc01`.

## 2026-06-27 (autónoma, tanda 3) — Íconos propios de Faro Auxilio
- ✅ **Componente `AuxilioIcon.svelte`** (commit `790f7cb`): 31 íconos de línea estilo Faro (viewBox 24, stroke currentColor, punto de luz #FFE39C) keyed por id — 23 guías + 2 categorías + 6 tipos de contacto. `/auxilio` reemplazó TODOS los emoji por íconos de marca (tarjetas, encabezados, contactos, tabs y buscador). Coherencia total: cero emoji en las tarjetas/contactos/tabs (solo queda el ⚠️ del banner "en revisión", marcador de texto universal).
- Verificado en navegador (los 31 renderizan; refinados quemaduras/shock/desmayo/refugio para claridad) + revisión de código (cross-check 31 ids ↔ 31 branches exacto, 0 fallbacks; sin imports muertos). Prod 200.

## 2026-06-27 (autónoma, tanda 4) — Chat IA de Faro Auxilio LIVE
- ✅ **Chat IA funcionando en prod** (commit `de5564a`): endpoint `/api/ai/ask` (Haiku 4.5 vía AI Gateway o directo a Anthropic), system prompt anclado SOLO en las guías verificadas (no improvisa, no recibe PII/DB). Tab "Preguntar" en `/auxilio` con UI de chat (avatar FaroAuxilio, texto plano, sugerencias). Protección: rate-limit 10/IP/día + budget guard $5/día + kill-switch; exento de Turnstile (solo lectura). Fallback robusto → el estático nunca se cae.
- **Geo-switch** global⇄solo-VE vía `app_config.ai_ve_only` + función `app_flag` (migración **0023**, lista para correr). Default GLOBAL: el chat ya funciona en todo el mundo (probado desde fuera de VE).
- **Verificado en prod** (curl): responde correcto y fiel a las guías (RCP, sangrado), texto plano sin markdown, global, reorienta off-topic; UI renderiza la conversación. La `ANTHROPIC_API_KEY` está como **Pages secret** (confirmado en vivo).
- Revisión de seguridad aplicada: quitado `cache_control` (causaba 400 → fallback silencioso; el caché lo da el AI Gateway) + guard anti-forja de history.

## 2026-06-27 (autónoma, tanda 5) — Biblioteca ampliada 23→34 + 5 imágenes IG
- ✅ **Faro Auxilio: +11 guías verificadas y nueva categoría "Salud y prevención"** (commit `6d1aead`, **34 guías**). Categoría nueva: suero oral (rehidratación), cuidado de heridas/tétanos, higiene en refugios, prevención de mosquitos (dengue). +7 en Primeros auxilios: anafilaxia, intoxicación, mordedura serpiente/alacrán, objeto clavado, golpe en la cabeza, sangrado de nariz, inhalación de humo.
  - Contenido investigado y **verificado adversarialmente** (workflow OMS/CDC/Cruz Roja/Mayo/OPS) + 2.º par de ojos independiente. **Cero invención.** Se descartó `agua-sodis` (invención: "el vidrio bloquea UV-A"). Fixes: RCP 100-120 en anafilaxia, advertencia de gas en intoxicación, cita Mayo "Poisoning" mal etiquetada quitada de inhalación de humo.
  - Generado de forma reproducible (`scripts/gen-expansion.mjs` → `expansion.ts`; no se edita a mano). **12 íconos Faro nuevos** (11 guías + categoría). Búsqueda local responde los nuevos temas **sin IA** (offline). Cableado: 0 fuentes colgantes, 0 ids duplicados, typecheck 0 errores. **Prod 200** (faro-ve.com/auxilio = "34 guías").
- ✅ **5 imágenes Instagram retrato (1080×1350)** entregadas al founder: portada "Servicios gratuitos" · botones que funcionan · Faro Auxilio (×2) · web faro-ve.com + cómo instalar iOS/Android. Renderizadas con Playwright desde HTML de marca (`scripts/render-ig.mjs`, no versionado).

## 2026-06-27 (autónoma, tanda 6) — Offline REAL + Guía PDF descargable
- ✅ **Offline de verdad** (commit `7c8f4fb`). Hallazgo clave: el service worker **nunca se registraba** en prod (faltaba el código) → la PWA no tenía offline. Ahora: registro en `+layout.svelte` (a prueba de fallos); `/auxilio` y `/offline` prerenderizadas y **precacheadas** → **Faro Auxilio (34 guías + contactos) funciona SIN conexión**; página `/offline` de respaldo (marca Faro). Teselas del mapa cacheadas (Carto con `crossOrigin`).
  - **Revisión adversarial multi-agente (4 lentes) ANTES de prod corrigió 2 CRÍTICOS:** (1) `autoUpdate` recargaba sola la página en cada deploy → habría borrado un reporte a medio llenar → cambiado a `registerType:'prompt'` (el RefreshButton es el único disparador de recarga); (2) `NetworkFirst` cacheaba el HTML de `/persona/[id]` con **coords exactas + teléfono** → fuga de PII en dispositivo compartido → **navegación fail-closed (allowlist)**: solo páginas estáticas se cachean; mapa/persona/punto/reportar/moderación/api NUNCA. Teselas con `crossOrigin:'anonymous'` (evita cuota por respuestas opacas).
  - **Verificado DOBLE** (Playwright; vite preview + faro-ve.com en vivo): offline `/auxilio` completo; offline `/persona` → `/offline` y `faro-paginas` SIN `/persona`/`/punto`/`/`; mapa online 28/28 teselas, 0 CORS; online sin regresión. Test reproducible en `scripts/verify-offline.mjs`.
- ✅ **Guía PDF descargable, distribuible y VISUAL** (commits `934595d` → `3c7ee9b`): botón "Descargar o compartir la guía (PDF)" en `/auxilio`. Generada (`scripts/gen-guide-pdf.ts`) desde los **mismos datos verificados** → idéntica al contenido validado, **cero invención**; cada guía cita su FUENTE oficial + bibliografía (95 fuentes). El SW la cachea (StaleWhileRevalidate) → disponible **sin conexión** para compartir.
  - **Feedback founder aplicado:** (1) el botón abre la **hoja nativa de compartir/guardar** (Web Share API: Guardar en Archivos / WhatsApp) — antes el `<a download>` atrapaba la PWA sin guardar ni volver; ahora la app no se mueve (verificado en vivo). (2) Rediseño **fácil de entender**: letras grandes, **iconos de la app en cada título** (parseados de `AuxilioIcon.svelte`), **pasos como mapa visual** (círculos numerados unidos por una guía), **psicología del color** consistente (azul=pasos · rojo=NO hacer · naranja=911, con símbolos también para daltónicos), identidad por categoría con degradado + **leyenda del código en la portada**. Sin fotos externas (solo nuestros iconos, sin riesgo de derechos). ~1.7 MB. **Prod 200** (`application/pdf`).

## 2026-06-27 (autónoma, tanda 7) — Chat sin IA + Worker auto-ingesta del conteo
- ✅ **Chat de Faro Auxilio SIN IA** (commit `7d0ec12`, decisión founder): responde solo con las guías locales (offline, cero llamadas a Anthropic). Reversible con `AI_ENABLED=true` en `AuxilioChat.svelte`. Verificado en vivo: 0 llamadas a `/api/ai/ask`; pregunta cubierta → responde local; no cubierta → aviso "…llama al 911".
- ⏳ **Worker auto-ingesta `venezuela-te-busca`** (commit `7107929`, **listo, falta deploy del founder**): la fuente creció a **35.189** (vs 24.546) → ~10.6k nuevas. La DB directa es IPv6 (no se alcanza desde local), así que la ingesta corre en el **Worker cron-ingest** (Cloudflare sí alcanza la DB). Núcleo compartido (`venezuela-te-busca-core.mjs`) reusado por script y worker. Migración **0025** (RPC `ingest_persons_batch` idempotente + cursor + fila de fuente). Adapter incremental, throttle 1 req/2s, cron */15 catch-up. **Privacidad verificada** (revisión adversarial: triggers de ofuscación 300m + foto-menores disparan en el RPC). Verificado sin DB: `--dry`, bundle del worker, test del adapter con DB simulada. **Pasos founder abajo.**

## 2026-06-27 (autónoma, tanda 8) — Worker desplegado + PDF sin huecos + elementos de reel
- ✅ **Worker de auto-ingesta DESPLEGADO por el founder** (migración 0025+0026 corridas, secret `SUPABASE_SERVICE_ROLE_KEY` puesto, `wrangler deploy` hecho). Verificado en vivo: el conteo **sube solo** (24.546 → 24.9k+ y subiendo) sin duplicar. `wrangler.toml`: `workers_dev=false`, `account_id`, `PUBLIC_SUPABASE_URL` como var, cron `*/15` (relajar a 6h cuando se estabilice). Fix de permisos: `grant execute ... to service_role` (0026).
- ✅ **Guía PDF sin saltos de hojas en blanco** (commit `a2ea0d7`, **76→57 págs**): categorías fluyen (sin `page-break-before`), tarjetas/cajas se parten entre páginas; solo pasos/ítems no se cortan. Verificado renderizando el PDF a imágenes (`pdf-to-png-converter`). El founder lo aprobó ("la dejamos así").
- ✅ **Elementos para REEL** (carpeta `~/Desktop/faro-ve-reel-elementos/`, NO en el repo; scripts en `scripts/reel-*.mjs` + `scripts/venezuela.geo.json`): PNG transparentes de los botones (ver-mapa, actualizar símbolo/texto, auxilio, descargar-guía, contactos), logo+título (claro/oscuro), "Nueva actualización" (claro/pill), **menú-inicio-completo**, **fuentes-oficiales**, **cierre 1080×1920**, y el **mapa de Venezuela ANIMADO con alfa** (`.mov` ProRes 4444 + `.webm` VP9 + `.png`): silueta + mar + puntos de luz concentrados en la zona afectada. Marca real de la app. Para que el founder edite el reel en CapCut.

## 2026-06-27 (autónoma, tanda 9) — Cola de reportes OFFLINE (BackgroundSync de página)
Detalle: `docs/SESSIONS/2026-06-27-cola-reportes-offline.md`.
- ✅ **Cola de reportes offline (función 3 de prioridades / "BackgroundSync")** — los 4 forms de
  persona (desaparecido, a-salvo, condición-médica, cuerpo-NN) ahora **guardan el reporte sin señal**
  y lo **reenvían al volver la conexión REUSANDO `/api/persons`** con un Turnstile FRESCO por entrada
  (cadena dura intacta: config-guard → Turnstile → rate-limit → kill-switch → RPC que cifra la PII).
  **Cero camino paralelo débil** (Ley de Reuso): no se usó el `/api/offline-sync` reservado (exigiría
  exentar Turnstile = debilitar). Replay en contexto de página (no SW: el SW no tiene DOM → no puede
  correr Turnstile).
- ✅ **Migración `0027`** (idempotencia ACK-perdido, **falta aplicarla** el founder por SQL Editor en 2
  pasos por el `CREATE UNIQUE INDEX CONCURRENTLY`): índice único parcial sobre `client_uuid` + guard
  de idempotencia antepuesto a `create_person_report` (SELECT previo + SELECT de respaldo para la
  carrera; `ON CONFLICT DO NOTHING` NO retorna fila en Postgres). **INSERT byte-idéntico a 0021**
  (aditivo, no reescribe el cifrado de PII). Devuelve `{id, edit_token, duplicate}`. Sin esto, un
  doble-envío por ack-perdido duplicaría una persona publicada en el mapa.
- ✅ **Privacidad (adversario = dispositivo compartido)**: payload **cifrado at-rest** (AES-GCM, clave
  no-extraíble en IndexedDB); la UI muestra **solo metadatos** (conteo/hora/estado), NUNCA
  nombre/teléfono/email; **lista blanca** de campos encolables (no token, no `reporter_ip_hashed`, no
  coord exacta de a-salvo sin opt-in); purga al enviar / al volver la señal / al abrir / **TTL 48h** /
  tope FIFO; botón **"Borrar mis datos de este teléfono"** (borra entradas + la clave). Foto: **online
  only** en v1 (sin señal se deshabilita el botón con aviso; nunca pérdida silenciosa). Decisiones del
  founder: TTL 48h, tope `/api/persons` 5→**10/h**, foto online-only.
- ✅ **Robustez**: replay secuencial + `navigator.locks` (sin duplicados entre pestañas) + token fresco
  por entrada; **auto-reprogramación por backoff** (429 respeta retry_after y detiene el lote; 503/
  INSERTS_PAUSED → espera larga, nunca descarta; el backoff se consume SOLO sin depender de eventos del
  navegador); "Enviar ahora" revive entradas atascadas. Copy honesto (#24): "reabre con señal", no "se
  envía solo". Bundle #21 intacto (**Dexie en chunk lazy**, no en el inicial).
- **Rigor:** pre-mortem adversarial (5 lentes → 5 bloqueantes corregidos ANTES de codificar, incl. que
  `ON CONFLICT DO NOTHING` no retorna fila) + revisión adversarial de código (4 lentes → 2 ALTO + varios
  arreglados). **81 tests** (20 nuevos, lógica pura), svelte-check 0, build limpio. **Verificado en vivo**
  (navegador real, preview): offline→encola cifrado (0 PII en claro)→online→replay token fresco→1 sola
  llamada→cola vacía; ack-perdido (`duplicate`)→éxito; **self-rescheduling del backoff sin eventos**
  (n=1 @53ms→500, n=2 @2s→500, n=3 @5.8s→201, cola vacía, 0 eventos disparados); **offline-fresh**
  (los 4 forms precacheados, cargan sin señal). Commit local (sin push). PRIVACY.md + SW documentados.
- ⏳ **Pasos founder**: (1) aplicar `0027` (SQL Editor, 2 pasos); (2) revisar + push/deploy. Fast-follows
  documentados: foto-en-cola offline, notes/aid-points, SW BackgroundSync (enviar con app cerrada),
  envío self-service por WhatsApp/SMS (cuando aterrice el relay).

## 2026-06-28 — Federación: Email Routing, outreach ampliado, push, /atribucion
Detalle: `docs/SESSIONS/2026-06-28-federacion-email-outreach-atribucion.md`.
- ✅ **git push — 78 commits** (origin/main estaba muy atrás, no 9): empujado con OK del founder tras
  escaneo de secretos limpio. `8a699cd → 601bad1`, repo sincronizado. El sitio ya estaba live por
  wrangler; el push pone GitHub al día.
- ✅ **Smoke prod VERDE:** páginas + APIs 200; CORS/PFIF/GeoJSON OK; conteo **26.150** (ingesta viva).
  `clusters` 400 sin params = por diseño.
- ✅ **`/atribucion` construida** (cerró 404; carpeta vacía). **Commit LOCAL `6ec25b1`, NO pusheado.**
  Reusa /datos (prerender), lista fuentes reales (Venezuela Te Busca + faro-ve), opt-out 24h, link en
  footer. svelte-check 0 err, build prerenderiza OK. El 500 en `vite dev` es limitación conocida de
  toda ruta prerender (igual que /datos); en prod funciona.
- ✅ **Outreach ampliado:** EN inicial ENVIADO; investigación 4 agentes (emails verificados en sitio
  oficial); 2 borradores nuevos (ES 13 VE/LATAM + EN 11 globales) creados, NO enviados. Lista
  MEDIA/form-only documentada. ⚠️ borrar 2 borradores ES viejos. Copy social de refugios en
  `docs/social/2026-06-28-copy-registro-refugios.md`.
- 🔴 **Email Routing (PRIORIDAD 1):** el DNS **ya tiene Email Routing habilitado** (MX
  route1/2/3.mx.cloudflare.net + SPF). Falta solo en el panel: verificar destino bleiquelc@gmail.com +
  reglas opt-out@/contacto@/federacion@ (+catch-all). Follow-up: cron regla #10 (Gmail MCP).

## 2026-06-29 — Auto-publicador Instagram (@farovenmap) + Reencuentros 🟢 LIVE
Runbook completo: `docs/RUNBOOK-instagram-reencuentros.md`. Mapa operativo: `docs/PROCESOS.md`.
- ✅ **Cron horario LIVE** (launchd `com.farove.ig`, 1/hora): publica 1 ficha retrato verificada en @farovenmap. Reusa `persons_public`. Vía Buffer GraphQL (key del founder, IG channelId `6a4190975ab6d2f106819d3d`). Kill-switch `~/.faro-ig/paused`; logs `~/.faro-ig/cron.log`; estado `~/.faro-ig/state.json`. Publicó a Luduin + Miguel (verificados).
- ✅ **Filtro IA de fotos (Haiku visión)** ENDURECIDO: rechaza flyers/cédulas/teléfonos/screenshots/grupos/menores → **solo publica con foto limpia**. + **anti-homónimo** (IA confirma misma-persona antes de usar foto/datos de otra plataforma). 2 errores graves reales frenados antes de publicar (homónimo + flyer con cédula/teléfono).
- ✅ **Reencuentros**: detecta buscadas en Faro que figuran A SALVO en Venezuela Reporta → documento del día (`~/Desktop/faro-reencuentros/`) para avisar a familias + **carrusel IG foto-dominante** (publicado) + página pública **`/reencuentros`**. Validado: ~15-18% de los cruzados son reencuentros reales (cientos a escala).
- ✅ **"Un solo trabajo"**: el cruce enriquece la **DB de Faro** (`/api/enrich` + RPC `enrich_person`, migración **0029**) sin pisar lo bueno ni tocar PII. ⏳ founder: aplicar 0029 + `wrangler pages secret put ENRICH_TOKEN` + push/deploy.
- ✅ Commits locales (sin pushear): `6ec25b1` (atribución), `a235940` (sistema IG completo). svelte-check 0 / build OK.
- ⚠️ Hosting de imágenes: git worktree rama `fichas-cdn` → raw.githubusercontent. Si el push desde launchd falla por auth → migrar a Supabase Storage/R2 (roadmap).

## Lista de funciones (handoff) — estado
1. IA-moderadora (restaurar auto-ocultos) — ⏸ en pausa (founder: sin IA por ahora).
2. Triaje IA — ⏸ en pausa (founder: sin IA por ahora).
2b. Auto-ingesta del conteo (`venezuela-te-busca`) — ✅ **DESPLEGADO y funcionando** (worker cron-ingest, 27-jun). El conteo sube solo, sin duplicar. Pendiente menor: relajar cron `*/15`→`6h` cuando se estabilice (~28-29k).
3. WhatsApp opt-in reportante — ⏳ (migración).
4. Relay de mensajes — ⏳ requiere `RESEND_API_KEY`.
5. Offline PWA (función 5) — ✅ LIVE (commit `7c8f4fb`): SW registrado (antes no lo estaba), Faro Auxilio + guía PDF disponibles SIN conexión, página `/offline`, navegación fail-closed (sin caché de PII), actualización controlada por el usuario. ✅ **Cola de reportes offline AÑADIDA (tanda 9)**: los 4 forms de persona guardan el reporte sin señal (cifrado) y lo reenvían al reconectar reusando `/api/persons` + Turnstile fresco; migración `0027` de idempotencia (**falta aplicarla**). Fast-follow: SW BackgroundSync (enviar con la app cerrada).
6. Cuerpos NN — ✅ LIVE (`/reportar/cuerpo-nn`).
7. Resaltar urgencia médica/menores en mapa — ✅ ya hecho (marcadores + FilterChips).
8. Faro Auxilio — ✅ LIVE completo: núcleo estático (**34 guías** en 3 categorías + contactos) **funcionando SIN conexión** (precache) + **guía PDF descargable/distribuible con fuentes** (57 págs, sin huecos) + **chat SIN IA** (decisión founder 27-jun: solo guías locales, cero Anthropic; reversible `AI_ENABLED=true`). El endpoint `/api/ai/ask` + geo-switch (0023) siguen listos por si se reactiva.
- ✅ **Formularios de reporte COMPLETOS** (commit `897cc01`): hub `/reportar` + `avistamiento` + `condicion-medica` + `refugio` (todos LIVE). Ya no quedan rutas de reporte vacías.

## Bloqueadores / pendientes founder

1. **Tarjeta en Cloudflare** → para registrar `faro-ve.com` (disponible ✓; yo no puedo meter datos de tarjeta). El PLAN agenda DNS final en D6, así que no bloquea — seguimos en pages.dev.
2. **Supabase service_role + anon keys** → para D2 (app runtime). El service_role NO pasa por chat (classifier lo bloquea, correcto): se setea directo con `wrangler pages secret put`. El anon (safe) se puede pegar.
3. **Secretos CF Pages** (D2): APP_SALT, ANTHROPIC_API_KEY, TURNSTILE_*, RESEND_API_KEY vía `wrangler pages secret put`.
4. **AI Gateway** CF (D5): crear gateway `faro-ve`.
5. **MCP Resend** sigue con key inválida (reconectar) — necesario D3 (relay) / D6 (federación).

## Próxima sesión arranca con (al 27-jun)
1. **Founder valida** el contenido médico de `/auxilio` (ideal un profesional) antes de quitar "en revisión"; confirma los 4 contactos "sin verificar" (Protección Civil 0800, FUNVISIS, hospitales).
2. **(Opcional) Founder corre la migración 0023** para poder gatear el chat a solo-VE (ya funciona global). Y opcional: setear `ANTHROPIC_GATEWAY_URL` como Pages secret/var para activar el caché del AI Gateway (ahora llama a Anthropic directo; funciona, sin caché).
3. **Triaje IA (función 2) e IA-moderadora (función 1):** el worker `ai-triage` necesita su propio secret + deploy: `cd workers/ai-triage && wrangler secret put ANTHROPIC_API_KEY && wrangler deploy`. (La key de Pages que ya está NO la ve el worker — es otro scope.)
4. **Relay de mensajes** (función 4) en cuanto el founder setee `RESEND_API_KEY`.
- Chat IA de Faro Auxilio: ✅ LIVE (global). Formularios de reporte: ✅ completos.
