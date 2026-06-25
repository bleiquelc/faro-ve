# Faro VE — Mapa de Esperanza Venezuela

> Sprint humanitario de emergencia · PWA instalable · objetivo 5 días a producción.

## Contexto

**Por qué.** 24-jun-2026 ocurrió un terremoto M7.2 + M7.5 en Venezuela: 164 muertos confirmados, 971+ heridos, miles de desaparecidos. Hay 2 sitios paralelos respondiendo (`desaparecidosterremotovenezuela.com` con ~22k reportes y `sosvenezuela2026.com`) pero ninguno integra todas las capas humanitarias en un mapa instalable, mobile-first, con auto-reporte "estoy a salvo", relay de mensajes anti-estafa, y federación abierta. El founder quiere construir **Faro VE** como tercera pieza coordinada: agregador + canal de reporte directo + buscador visual.

**Qué prueba el éxito.** En 5 días: `https://faro-ve.com` LIVE, PWA instalable en iOS/Android, mapa con clusters mostrando reportes propios + ingestados (con atribución) + búsqueda multi-criterio + auto-reporte + relay de mensajes sin exponer PII + ES/EN + cola de moderación viva con voluntarios verificados desde D1.

**Restricciones duras.**
- Repo separado de NEXVYVE iOS y KAEL web (LEY DE SEPARACIÓN). Ruta nueva: `~/Desktop/faro-ve`.
- Free tier únicamente (Supabase free, Cloudflare Pages free, OSM tiles).
- Mobile-first, bundle inicial <200KB.
- Privacidad: ubicación pública ofuscada 200–500m, PII reportante NUNCA expuesta, foto de menores NUNCA pública.
- PFIF v1.4 desde el schema día 1 (interop futura con Google Person Finder + ICRC).
- Habeas Data Venezuela (Art. 28 Const.): retención 60d, delete funcional, audit completo.

## Decisiones tomadas

| Decisión | Valor | Confirmada por founder |
|---|---|---|
| Nombre | **Faro VE** | sí |
| Estrategia integración | Construir paralelo + ingestar lo público con atribución + invitar a federación PFIF después | sí |
| Scope v0.1 | Bundle 5 días COMPLETO + capas humanitarias extra (niños solos, vínculos, refugios, condición médica urgente, avistamientos, morgues, match auto, búsquedas activas) | sí |
| Stack | SvelteKit + Vite + `@vite-pwa/sveltekit` + Leaflet + Supabase (Postgres + PostGIS + Auth + Realtime + Storage) + Cloudflare Pages | recomendado |
| Standard datos | PFIF v1.4 (`http://zesty.ca/pfif/1.4/`) en schema día 1 | recomendado |
| Hosting | Cloudflare Pages (frontend, 330+ PoPs LATAM) + Supabase Cloud + Cloudflare Workers para cron de ingesta | recomendado |
| Map tiles | OpenStreetMap (gratis) con fallback MapTiler free + SW cache 7d | recomendado |
| Email relay | Resend free (3k/mes) — usar plugin Resend ya disponible | recomendado |
| Atribución | **Footer global visible en TODAS las páginas** con lista de fuentes externas ingestadas + link a `/atribucion`; badge por record en `PersonCard` cuando `source != 'faro-ve'`; link clickeable al `source_url` original | exigencia founder |
| Takedown / opt-out fuentes | **Canal formal** `opt-out@faro-ve.com` (alias Resend Inbound) con SLA público **24h** para detener ingesta y purgar data de cualquier fuente externa que lo pida — visible en footer + `/atribucion` + emails de federación enviados D-0 | exigencia founder |
| Agente IA (Anthropic API) | **SÍ acotado**: FAQ chatbot (Haiku 4.5 + prompt caching + rate-limit 10/IP/día), cron "Faro Health" diario, triage IA cola pending. Cloudflare AI Gateway entre Faro ↔ Anthropic. Budget guard env `LLM_DAILY_BUDGET_USD=5`. Estimado $55-90/mes (cabe en $150). Match assist + description normalizer diferidos a v0.1.5 (post-launch). | exigencia founder |
| Reconocimiento facial | **Diferido a v0.2** post-launch (2 sem). Si se incluye: client-side `face-api.js`, embedding 128-D nunca sale del dispositivo, pgvector + cosine > 0.85, doble verificación obligatoria, no menores, opt-out explícito. | founder confirmó diferir |
| Sistema visual | **Núcleo del producto**: paleta accesible AAA (10 colores por categoría), animaciones CSS suaves 30fps (pulso menores+médicos, ripple táctil, transiciones cluster), Lottie en refugios/aid points. Sin confeti/partículas. | exigencia founder |
| Bundle target | **<150KB JS inicial** (mapa lazy-load al entrar), <6MB modelo face si v0.2 lo activa | exigencia founder |
| Onboarding | **3 pantallas ilustradas 1 vez**: ¿Qué es Faro VE? · ¿Cómo se usa? · Privacidad simple. Lenguaje sin tecnicismos. | exigencia founder |
| Refugios + puntos de ayuda | Tabla dedicada `aid_points` (food/water/medical/clothing/charging/wifi) + tabla `organizations` verificadas (Cruz Roja, ONGs, iglesias) con panel propio para gestionar sus puntos | exigencia founder |
| Fuentes públicas adicionales VE | Adapters para Cruz Roja VE / IFRC "Trace the Face", CICPC, Defensoría VE, ONGs (Provea, Foro Penal), medios principales (RunRun, Efecto Cocuyo, La Patilla, El Nacional), hashtags #DesaparecidosVE | exigencia founder |

## Stack y estructura del repo

**Ruta**: `~/Desktop/faro-ve` · **Repo GitHub**: `faro-ve` (público, AGPL-3.0).

**Paquetes núcleo** (versiones pinneables a `latest` estable jun-2026):
- `svelte ^5 · @sveltejs/kit ^2.5 · @sveltejs/adapter-cloudflare ^4.7 · vite ^5.4`
- `@vite-pwa/sveltekit ^0.6 · workbox-window ^7.3`
- `leaflet ^1.9.4 · leaflet.markercluster ^1.5.3 · leaflet.heat ^0.2` (heatmap opcional)
- `@supabase/supabase-js ^2.45`
- `tailwindcss ^3.4 · @tailwindcss/forms`
- `@inlang/paraglide-sveltekit ^0.12` (i18n compile-time, 0 runtime overhead)
- `dexie ^4` (IndexedDB cola offline)
- `zod ^3.23 · nanoid ^5`
- `exifr ^7` (strip EXIF GPS de fotos client-side) · `browser-image-compression ^2`
- `@lottiefiles/dotlottie-web ^0.30` (animaciones refugios/aid)
- `@anthropic-ai/sdk ^0.27` (server-side en CF Workers via AI Gateway)
- Workers: `wrangler ^3.80 · cheerio ^1 · robots-parser ^3`
- Dev: `typescript ^5.5 · vitest · @playwright/test · prettier · prettier-plugin-svelte`

**Árbol resumido** (actualizado con extensiones aprobadas):
```
faro-ve/
  src/
    routes/
      +page.svelte                          # mapa home con onboarding 1ª visita
      onboarding/+page.svelte               # 3 pantallas ilustradas (skipeable)
      reportar/{desaparecido,cuerpo-nn,a-salvo,avistamiento,refugio,condicion-medica,punto-ayuda}/+page.svelte
      persona/[id]/+page.svelte
      punto/[id]/+page.svelte                # detalle refugio/aid_point
      buscar/+page.svelte
      mensaje/[id]/+page.svelte              # relay form
      organizacion/[slug]/+page.svelte       # ficha pública org verificada
      panel-org/{+layout.server.ts,+page.svelte,puntos/+page.svelte}   # panel orgs gestionan sus puntos
      moderar/{+layout.server.ts,+page.svelte,matches/+page.svelte,sources/+page.svelte,orgs/+page.svelte}
      api/{persons,persons/[id],notes,match/[id],message,offline-sync,rss,aid-points,organizations}/+server.ts
      api/ai/{ask,health,triage}/+server.ts  # chatbot + health cron + triage cola
      {acerca,privacidad,atribucion,como-usar}/+page.svelte
    lib/
      server/
        supabase.ts  relay.ts  moderation.ts  rate-limit.ts
        ingest/{base,desaparecidosterremoto,sosvenezuela,cruzroja-ve,cicpc,defensoria-ve,medios-ve,hashtags-x,pfif-export}.ts
        ai/{client.ts,prompts.ts,budget-guard.ts}    # Anthropic SDK + AI Gateway CF
      client/
        supabase.ts  map.ts  offline-queue.ts  i18n/
        ai-chat.ts   # widget chat cliente
      components/
        Map.svelte  ReportForm.svelte  PersonCard.svelte  AidPointCard.svelte
        FilterChips.svelte  InstallPrompt.svelte  ModeratorQueueItem.svelte  Turnstile.svelte
        AIChatWidget.svelte  OnboardingSlides.svelte  PinPulse.svelte  LottieIcon.svelte
        OrgBadge.svelte
      schemas/{person,note,message,aid_point,organization}.ts
      utils/{obfuscate,format,levenshtein,colors,animations}.ts
    service-worker.ts                        # workbox custom strategies
    hooks.server.ts                          # RLS context + rate-limit + Turnstile verify
  static/
    icons/ (192,512,maskable,apple)
    lottie/{water-drop,medical-cross,shelter-roof,help-hand}.json
    illustrations/{onboarding-1,onboarding-2,onboarding-3}.svg
    manifest.webmanifest  leaflet/
  supabase/migrations/0001_init.sql..0007_aid_orgs_ai.sql
  scripts/{ingest/run.ts,seed-anchor-places.ts,seed-organizations.ts,test-match.ts,test-ai-budget.ts}
  workers/
    cron-ingest/{wrangler.toml,src/index.ts}
    ai-health/{wrangler.toml,src/index.ts}   # cron diario "Faro Health"
    ai-triage/{wrangler.toml,src/index.ts}   # cron 15min triage cola pending
  svelte.config.js  vite.config.ts  tailwind.config.ts  paraglide.config.ts
  .env.example  README.md  ATTRIBUTION.md  PRIVACY.md
```

**`.env.example`** — variables clave: `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_SALT` (32 bytes random), `PUBLIC_TURNSTILE_SITE_KEY`, `RESEND_API_KEY`, `RESEND_INBOUND_OPTOUT=opt-out@faro-ve.com`, `INGEST_USER_AGENT="FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)"`, **`ANTHROPIC_API_KEY`** (CF env, nunca en código), **`ANTHROPIC_GATEWAY_URL`** (Cloudflare AI Gateway endpoint), **`LLM_DAILY_BUDGET_USD=5`** (kill-switch), **`LLM_MODEL_DEFAULT=claude-haiku-4-5-20251001`**, **`LLM_MODEL_COMPLEX=claude-sonnet-4-6`**, **`FACE_MATCH_ENABLED=false`** (flag v0.2).

## Schema PostgreSQL + PostGIS (PFIF v1.4)

**Extensiones**: `postgis · pg_trgm · fuzzystrmatch · pgcrypto`.

**Tablas núcleo**:
- `persons` — campos PFIF (`pfif_id, given_name, family_name, sex, age, last_known_location_*`) + FaroVE (status enum `missing|found_alive|found_deceased_morgue|unidentified_body|safe_self_report|hospitalized|sheltered|withdrawn`, `is_minor`, `unaccompanied_minor`, `medical_urgent`, `medical_category`, `clothing_*`, `distinguishing_marks`, `photo_visibility`, `reporter_*` encriptado/hasheado, `moderation_status`, `face_embedding vector(128)` nullable para v0.2 con flag).
- `notes` (PFIF note_record + avistamientos)
- `links` (vínculos `same_group|possible_match|confirmed_match|family|duplicate`)
- `shelters` (capacidad + necesidades jsonb + `address_text`, `landmark`, `entrance_notes` para máxima precisión navegacional) — refugios temporales
- **`aid_points`** ← **nueva**: `id, type ('food'|'water'|'medical'|'clothing'|'charging'|'wifi'|'shelter_temporary'|'distribution'), name, organization_id (fk), supplies_available jsonb, schedule jsonb, location_point geography(Point,4326) EXACTO (no obfuscated, la gente debe llegar), address_text` (calle + número + sector), `landmark` (referencia visible "frente a plaza Bolívar"), `entrance_notes` ("entrada lateral, pregunta por María"), `contact_relay_id, verified bool, last_updated_by, last_updated_at, expires_at` (default +7d, requiere refresh).
- **`organizations`** ← **nueva**: `id, slug unique, name, type ('red_cross'|'ngo'|'church'|'community_kitchen'|'government'|'volunteer_group'|'other'), verified bool, verified_by, verified_at, logo_url, description, contact_email_encrypted, contact_phone_encrypted, website, country default 'VE', created_at`. Login magic-link para gestionar sus `aid_points`.
- `searches_active` (polígonos PostGIS de búsquedas activas)
- `messages` (relay con email cifrado server-side)
- **`ai_conversations`** ← **nueva**: `id, session_id, ip_hashed, role ('user'|'assistant'|'system'), content, tokens_in, tokens_out, model, cost_usd, created_at` — log para budget tracking y debugging.
- **`ai_budget_daily`** ← **nueva**: `id, date date unique, spent_usd numeric(10,4), queries int, last_updated` — para enforcement del kill-switch.
- `moderators` · `audit_log` (append-only, particionado mensual) · `import_sources` · `anchor_places` (autocomplete)

**Triggers críticos**:
- `BEFORE INSERT/UPDATE ON persons` → si cambia `last_known_location_point`, recalcula `last_known_location_obfuscated` (`obfuscate_point(p, 300m random bearing + sqrt(random)*r)`).
- `BEFORE INSERT ON persons` → si `is_minor=true` fuerza `photo_visibility='admin_only'`.
- `AFTER INSERT/UPDATE ON persons` → `pg_notify('match_queue', NEW.id::text)` para procesar matches async.
- `AFTER ANY ON persons|notes|links|shelters` → escribe `audit_log` con diff jsonb.

**RLS**: `persons SELECT` público filtra `moderation_status='approved' AND withdrawn_at IS NULL` y devuelve solo vía `persons_public` (excluye coords exactas, email/phone, reporter info). INSERT público permitido con `moderation_status='pending'`. UPDATE/aprobar/rechazar solo `moderators`.

**Email hashing**: `sha256(lower(trim(email)) || APP_SALT)`. **Email/phone encrypted**: `pgp_sym_encrypt` con clave derivada de `APP_SALT`. Acceso vía `decrypt_for_relay(person_id, requester_role)` que loguea.

## Privacidad y moderación

| Flujo | Mecánica |
|---|---|
| **Reportar** | Form → strip EXIF cliente → Turnstile → POST `/api/persons` → rate-limit KV (5/h por IP) → encripta PII → INSERT `pending` → trigger obfuscate → respuesta `{id, edit_token JWT TTL 7d}` |
| **Moderar** | Magic-link auth (Supabase, email autorizado en `moderators`) → cola ordenada por `(medical_urgent desc, is_minor desc, created_at asc)` → aprobar/rechazar/editar/marcar duplicado |
| **"Tengo info"** | Visitante en `/persona/[id]` → `/mensaje/[id]` con Turnstile → relay envía email al reportante con reply token; remitente NUNCA ve email destinatario |
| **"Encontré viva"** | Reply token confirma `status_change=found_alive` → crea `note type='info_update'` → notifica suggest_matches inverso |
| **Delete (Habeas Data)** | Form en `/privacidad` con email + person_id + Turnstile → verifica hash email → `withdrawn_at=now()` → datos personales se purgan a los 30d manteniendo solo `id + withdrawn_at` para audit |
| **PII menores** | Trigger fuerza `photo_visibility='admin_only'`; view público no devuelve photo_url; UI muestra placeholder + "Foto solo a autoridades — contactar moderación" |
| **Anti-spam** | Turnstile free + IP rate-limit KV + blocklist palabras + mismo email >5/h auto-pending + mismo IP >20/h temp block 1h |
| **Kill switch** | Env flag `INSERTS_PAUSED=true` que `hooks.server.ts` lee — pausa inserts públicos si troll-bombing |

## Sistema visual — paleta + animaciones (núcleo del producto)

**Paleta accesible AAA daltonismo-friendly** (`lib/utils/colors.ts` exporta tokens):

| Token | Hex | Categoría | Animación |
|---|---|---|---|
| `color-minor` | `#7c3aed` | Menores no acompañados (prioridad máxima) | Pulso lento 2s |
| `color-medical` | `#ea580c` | Condición médica urgente | Pulso rápido 1.2s |
| `color-missing` | `#dc2626` | Desaparecidos normal | Sin pulso |
| `color-sighting` | `#eab308` | Avistamientos sin confirmar | Sin pulso |
| `color-deceased` | `#1f2937` | Cuerpos NN / morgues | Sin pulso |
| `color-safe` | `#16a34a` | "Estoy a salvo" | Fade-in suave |
| `color-shelter` | `#0B4F6C` | Refugios activos | Lottie roof |
| `color-aid` | `#06b6d4` | Puntos de ayuda | Lottie según tipo |
| `color-search` | `#92400e` | Búsquedas activas (polígono semi-transparente) | Sin animación |
| `color-closed` | `#9ca3af` | Cerrados (toggle off por defecto) | — |

**Pins**: `DivIcon` Leaflet con SVG inline + clase CSS para color + clase `pulse` opcional. Cap 30fps mobile. Lazy-load Lottie solo si pin visible en viewport.

**Onboarding** 3 SVGs en `static/illustrations/` cargados con `<img loading="lazy">`. Skipeable con LS flag `onboarding_seen=true`. Visible auto en 1ª visita.

## Navegación externa — "🧭 Llegar aquí" (precisión máxima donde aplica)

> Regla diferenciada por privacidad: **lugares de servicio (refugios, ayuda, hospitales, morgues)** = navegable con coords exactas para que la gente llegue. **Personas (desaparecidas, NN, avistamientos)** = NO navegable público — coords ofuscadas 300m por seguridad anti-saqueo/persecución.

**Componente `NavigateButton.svelte`** con selector multi-app:
- **Apple Maps** (iOS nativo): `maps://?daddr={lat},{lng}&dirflg=d`
- **Google Maps** (universal, abre Apple Maps en iOS si no hay app Google): `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}&travelmode=driving`
- **Waze**: `https://waze.com/ul?ll={lat},{lng}&navigate=yes`
- **OsmAnd** (offline, zonas sin red): `osmand.geo:{lat},{lng}?z=18`

Detección automática plataforma. Recuerda última elección en LS `preferred_map_app`. Si solo una app está instalada, abre directo; si hay varias, modal sheet con íconos.

**UI obligatoria en cada pin de servicio**:
- Botón primario "🧭 Llegar aquí" (azul faro, prominente)
- Botón secundario "📋 Copiar dirección" (copia `address_text` + landmark al portapapeles)
- Texto leíble: dirección completa + landmark + entrance_notes
- Si user dio permiso geoloc: distancia y tiempo estimado caminando/conduciendo
- "Última actualización: hace Xh" para validar frescura

**UI obligatoria en pin de persona/NN/avistamiento**:
- SIN botón de navegación
- Texto explícito: "Ubicación aproximada (~300m por privacidad) — última zona conocida: {sector}"
- Botón "Tengo información" → `/mensaje/[id]` (relay anti-PII)

**Auto-reporte "estoy a salvo"** — caso especial: el sujeto puede activar toggle `share_exact_location_with_searchers=true` en su propio reporte. Si lo activa, su pin verde MUESTRA "🧭 Llegar aquí" público. Default OFF.

**Utilidad `lib/utils/navigation.ts`** exporta:
- `buildMapsUrl(provider, lat, lng, label?)` → URL para cada app
- `detectPlatform()` → `'ios' | 'android' | 'desktop'`
- `getInstalledMapApps()` → heurística por UA
- `openNavigation(lat, lng, address?, label?)` → abre la app preferida o muestra selector

## Plan de 6 días

Cada día = entregable visible + gate de verificación al cerrar. (Pasó de 5 → 6 por extensiones aprobadas: IA, aid_points, organizations, polish visual, fuentes adicionales.)

### Día 1 — Foundation (8h)
- B1 (60m) Supabase proyecto free (`us-east-1`), repo GitHub `faro-ve`, `npm create svelte@latest` + paquetes núcleo.
- B2 (120m) Migraciones `0001..0004` (schema persons/notes/links/messages/moderators/audit_log + triggers + RLS + funciones `obfuscate_point`, `hash_email`, stub `suggest_matches`, vista `persons_public`).
- B3 (90m) `0005_anchor_places_seed.sql` con 100+ lugares (Caracas 23 parroquias + sectores, Vargas, Valencia, Maracay, Maracaibo, Barquisimeto, Mérida + hospitales y morgues conocidos via OSM Overpass).
- B4 (60m) `0007_aid_orgs_ai.sql`: tablas `aid_points`, `organizations`, `ai_conversations`, `ai_budget_daily`. Seed `organizations`: Cruz Roja Venezolana, Cáritas, Iglesias principales, Protección Civil, Bomberos como verified pre-aprobadas.
- B5 (60m) `adapter-cloudflare`, deploy a Cloudflare Pages preview, `app.html` con manifest mínimo + OG tags + favicon.
- B6 (60m) Comprar `faro-ve.com` (Cloudflare Registrar ~$10) o subdominio, DNS → Pages, HTTPS auto. Resend domain claim + inbound rule `opt-out@faro-ve.com`.
- B7 (60m) `hooks.server.ts` (Turnstile, salt, supabase locals), Tailwind base, tokens de color en `lib/utils/colors.ts`.
- **Gate**: `faro-ve.com` muestra placeholder, `curl /rest/v1/persons` → `[]`, `obfuscate_point(...)` devuelve punto distinto al input, `SELECT count(*) FROM organizations WHERE verified=true` ≥ 5.

### Día 2 — Mapa visual + CRUD persons (8h)
- B1 (120m) `lib/components/Map.svelte` con Leaflet + MarkerCluster + tile OSM + `DivIcon` SVG con tokens de color por categoría + bottom sheet mobile.
- B2 (90m) `routes/api/persons/+server.ts` GET con filtros (`status, is_minor, medical_urgent, sector`) + POST con Zod + EXIF strip + `moderation_status='pending'`.
- B3 (90m) `routes/reportar/desaparecido/+page.svelte` (campos núcleo + autocomplete `anchor_places` + geoloc opcional).
- B4 (60m) `routes/persona/[id]/+page.svelte` lee `persons_public` + notes ordenadas + botón "Tengo información".
- B5 (45m) Insertar 30 reportes test (`source='test'`, `approved`) para validar clusters + colores.
- B6 (60m) `FilterChips` URL-driven: missing/found_alive/unidentified/medical_urgent/minor/shelter/aid.
- B7 (45m) Animaciones CSS: `@keyframes pulse-minor`, `@keyframes pulse-medical`, ripple táctil al tap. Cap 30fps mobile.
- **Gate**: móvil real ve 30 puntos clusterizados con colores correctos por categoría; menores y médicos pulsando; reporte nuevo aparece en `/moderar` pending; aprobar SQL manual → aparece en mapa con offset (no en coord exacta).

### Día 3 — Formularios completos + moderación + relay (8h)
- B1 (90m) Magic-link auth Supabase para `moderators` + `routes/moderar/+layout.server.ts` guard.
- B2 (120m) Panel `/moderar` con cola pending + preview + acciones aprobar/rechazar/editar + bulk + conteos por categoría.
- B3 (75m) Resto formularios: `cuerpo-nn` (force `unidentified_body`, foto solo ropa con warning), `a-salvo` (geoloc + mensaje + toggle opcional `share_exact_location_with_searchers`), `avistamiento` (crea note), `refugio` (geoloc EXACTA + `address_text` + `landmark` + `entrance_notes`), `condicion-medica`, `punto-ayuda` (selector tipo chips + supplies_available checkboxes + horarios + `address_text` + `landmark` + `entrance_notes` — UI claramente etiquetada "ESTOS DATOS SON PÚBLICOS, ayudan a la gente a llegar").
- B4 (90m) Relay `/api/message`: Turnstile + hash remitente + `pgp_sym_encrypt` + Resend SDK con template "Alguien tiene información sobre [persona]". NUNCA expone email destinatario.
- B5 (60m) `lib/server/moderation.ts` auto-rules (blocklist, IP/email rate, foto sin dimensiones razonables).
- B6 (45m) Verificar `audit_log` recibe inserts en cada acción staff.
- **Gate**: moderador entra magic-link, aprueba 3; visitante envía mensaje → llega email real al reportante con reply link; rate-limit dispara tras 6º POST desde misma IP en 1m; formulario punto-ayuda guarda en `aid_points` con tipos y supplies correctos.

### Día 4 — PWA offline + sync + scrapers (8h)
- B1 (90m) `@vite-pwa/sveltekit` config: manifest (`name, short_name, theme_color #0B4F6C "azul faro", icons 192/512/maskable, display=standalone, categories: ["utilities","social","navigation"]`).
- B2 (120m) SW estrategias: tiles `CacheFirst` 7d, `/api/*` GET `NetworkFirst` timeout 3s, `/api/*` POST `NetworkOnly` + BackgroundSync con Dexie `pending_reports`. UI badge "1 reporte pendiente" + toast sync.
- B3 (45m) `/api/offline-sync` POST array idempotente (busca `client_uuid`, skip si existe).
- B4 (180m) Scrapers en `workers/cron-ingest` con schedule `0 */6 * * *`: robots.txt check, UA `FaroVE-IngestBot/1.0`, cheerio parse, mapeo a PFIF, dedup por `(full_name_normalized, last_seen_at ±24h, ST_DWithin 5km)`, upsert con `source` + `source_id`. **Adapters incluidos día 1**: `desaparecidosterremoto.ts`, `sosvenezuela.ts`, `cruzroja-ve.ts` (scaffold + manual), `cicpc.ts` (scaffold), `defensoria-ve.ts` (scaffold), `medios-ve.ts` (RSS Efecto Cocuyo + RunRun + La Patilla + El Nacional), `hashtags-x.ts` (API X public, opcional). Snapshot tests en `tests/fixtures/`.
- B5 (45m) UI atribución: badge en `PersonCard` cuando `source != 'faro-ve'`, página `/atribucion` con conteos por fuente + email opt-out visible.
- **Gate**: PWA instalada en iPhone real, modo avión, reportar, toast "guardado offline", online → "sincronizado", DB con timestamp correcto. `wrangler tail` muestra "Importados X, duplicados Y, errores 0" en al menos 2 fuentes activas.

### Día 5 — Match + búsqueda + IA + i18n (8h)
- B1 (75m) Paraglide ES+EN, extraer strings, selector idioma header, URL prefix `/en/*`.
- B2 (75m) `/buscar` multi-criterio (nombre fuzzy `pg_trgm`, edad rango, sector, ropa color, status) con highlight.
- B3 (90m) `suggest_matches()` real (ver sección Match) + listener `match_queue` (CF Worker cron 15m) + panel `/moderar/matches` lado-a-lado.
- B4 (120m) **Agente IA**:
  - `lib/server/ai/client.ts`: cliente Anthropic SDK vía Cloudflare AI Gateway (gratis, da cache + logs + métricas).
  - `lib/server/ai/budget-guard.ts`: middleware lee `ai_budget_daily` antes de cada query, bloquea si supera `LLM_DAILY_BUDGET_USD`. Post-query escribe costo real.
  - `lib/server/ai/prompts.ts`: system prompts versionados (FAQ, Health, Triage).
  - `routes/api/ai/ask/+server.ts`: POST `{question, session_id}` → Haiku 4.5 + caching + rate-limit 10 msg/IP/día. Devuelve respuesta + sources (links a /como-usar, /privacidad).
  - `lib/components/AIChatWidget.svelte`: botón flotante "?" → drawer chat. FAQ pre-cargado (top 10 preguntas) sin LLM. Si no resuelve → LLM.
  - `workers/ai-triage/`: cron `*/15 * * * *` lee 20 pending → IA clasifica `urgency: low|medium|high|critical` → escribe `persons.ai_priority` → cola moderación ordena por esto.
- B5 (45m) PFIF export `/api/rss?format=pfif` validable contra `pfif-1.4.xsd`.
- B6 (45m) Páginas legales `/privacidad` (Habeas Data, retención, delete form), `/acerca`, `/atribucion`, `/como-usar`, footer global con atribución + opt-out + lista fuentes.
- **Gate**: chat IA responde "¿cómo reporto?" con info correcta + link a `/como-usar`; rate-limit dispara al 11º msg desde misma IP; triage clasifica 5 reportes pending correctamente; `ai_budget_daily` muestra costo real <$1; `xmllint --schema pfif-1.4.xsd /api/rss?format=pfif` valida.

### Día 6 — Polish visual + onboarding + organizaciones + deploy + difusión (8h)
- B1 (75m) Onboarding 3 pantallas ilustradas (SVGs en `static/illustrations/`), skipeable, LS flag `onboarding_seen`. Lenguaje claro sin tecnicismos.
- B2 (60m) `routes/panel-org/`: login magic-link organizaciones verificadas, listar sus `aid_points`, editar `supplies_available`, refresh `expires_at`.
- B3 (45m) Página pública `/organizacion/[slug]`: ficha org + sus puntos en mini-mapa.
- B4 (60m) Lottie animado en pins `aid_points` (water-drop/medical-cross/help-hand) lazy-loaded solo si pin visible. **`NavigateButton.svelte`** + `lib/utils/navigation.ts` (Apple Maps/Google Maps/Waze/OsmAnd con selector multi-app, recuerda LS `preferred_map_app`). Integrar en popup de `AidPointCard`, `ShelterCard`, ficha hospital/morgue de `anchor_places`. NO integrar en `PersonCard` (personas ofuscadas).
- B5 (45m) Auditoría visual final: contraste AAA en todo (`pa11y` o Lighthouse), tamaño tap targets ≥44px, tamaño texto ajustable, screen reader test (VoiceOver iOS).
- B6 (60m) Cron diario "Faro Health" (`workers/ai-health/`): cada 9am Caracas, IA resume métricas (reportes nuevos, cola pending, errores scrapers, costo IA día previo, matches confirmados, anomalías) → email founder.
- B7 (45m) Lighthouse mobile (perf>85, a11y>95, PWA pass), bundle <150KB JS inicial. Sentry-free opcional.
- B8 (60m) DNS final dominio principal. Producción deploy desde branch `main`. Smoke test prod.
- B9 (60m) **Difusión simultánea D-0**: tweet pinneado @faro_ve con video 30s, emails federación PFIF a 7 fuentes (developer@theempire.tech, SOS-VE, Cruz Roja VE, CICR, CICPC, Defensoría VE, Google Crisis Response), post OSM-VE Telegram, post Reddit r/vzla, repo GitHub público AGPL-3.0.
- **Gate**: Lighthouse perf≥85 a11y≥95 PWA verde; onboarding visible 1ª visita; 3 moderadores externos pueden entrar; 1 organización verificada puede gestionar sus aid_points; email Health llega a inbox founder; tweet publicado; 7 emails federación enviados.

## Agente IA Anthropic — diseño económico

**Stack**: Anthropic SDK server-side (CF Workers + Pages Functions) vía **Cloudflare AI Gateway** (gratis, da cache + logs + métricas + observabilidad).

**Modelos**:
- **Default**: `claude-haiku-4-5-20251001` ($1/$5 per M tokens) — FAQ + triage + health.
- **Complex**: `claude-sonnet-4-6` ($3/$15) — match assistance (v0.1.5).
- **Prompt caching** activado (90% descuento en queries repetidas — system prompt es estable).

**Funciones v0.1**:

1. **FAQ chatbot** (`api/ai/ask`):
   - FAQ pre-cargado estático cubre 80% sin LLM ("¿cómo reporto?", "¿es seguro?", "¿cómo borro mi reporte?", etc.).
   - Si FAQ no resuelve, llama Haiku con system prompt (2k tokens, cacheado) + pregunta usuario (1k tokens max) + respuesta 500 tokens max.
   - Costo por query: ~$0.0035 sin cache hit, ~$0.0005 con cache hit.
   - Rate-limit: 10 msg/IP/día (KV). Session via `session_id` cookie.
   - Devuelve respuesta + sources (links a páginas oficiales Faro VE).
   - UI: `AIChatWidget` botón flotante, drawer expandible.

2. **Cron "Faro Health"** (`workers/ai-health/`, schedule diario 9am Caracas):
   - Lee últimas 24h métricas: reportes nuevos por categoría, cola pending, errores scrapers, costo IA día previo, matches confirmados, anomalías (picos IP, blocklist hits).
   - Haiku resume → email a founder vía Resend con summary + alertas.
   - Costo: ~$0.20/día = $6/mes.

3. **Cron Triage IA** (`workers/ai-triage/`, schedule `*/15 * * * *`):
   - Lee 20 reportes pending sin `ai_priority`.
   - Haiku clasifica `urgency: low|medium|high|critical` + `category: standard|medical|minor|deceased|suspicious` con justificación.
   - Escribe a `persons.ai_priority` + `persons.ai_reasoning`.
   - Cola moderación ordena por `(ai_priority desc, medical_urgent desc, is_minor desc, created_at asc)`.
   - Costo: ~$0.30/día = $9/mes.

**Funciones v0.1.5 (post-launch, semana 2)**:

4. **Match assistance** (`api/ai/match-review`):
   - Cuando hay match auto-sugerido score 70-85, IA Sonnet recibe los 2 records → opina `probable|improbable|incierto` + razones.
   - Moderador ve la opinión + score numérico antes de confirmar.
   - Costo: ~$0.05/query, ~$10/mes con 200 queries/mes.

5. **Description normalizer** (inline al crear reporte):
   - Usuario escribe "tenía franela roja y blue jean" → IA normaliza a campos estructurados `clothing_top="camiseta roja"`, `clothing_bottom="pantalón vaquero azul"`.
   - Mejora calidad fuzzy match futuro.
   - Costo: ~$0.001/reporte, ~$5/mes.

**Budget guard total proyectado**: $30-60/mes en LLM con tráfico normal, picos hasta $90/mes con eventos virales. `LLM_DAILY_BUDGET_USD=5` = $150/mes max protegido. Si supera, queries devuelven mensaje "El asistente está temporalmente fuera. Consulta el FAQ" + FAQ estático sigue funcionando.

**Privacidad IA**:
- IA NUNCA recibe PII reportante (email/phone). Solo lee campos públicos.
- IA NUNCA recibe coordenadas exactas, solo obfuscated.
- Logs de conversaciones en `ai_conversations` con `ip_hashed` no IP real.
- Política Cloudflare AI Gateway: no envía data a terceros más allá de Anthropic.
- Disclaimer claro en widget: "Asistente IA — sus respuestas pueden contener errores. Para casos urgentes contacta directamente".

## Match automático (Día 5)

Función `suggest_matches(p_id) returns (candidate_id, score, reasons jsonb)`:
- Filtro candidatos: `status` distinto del propio (missing busca unidentified/found_deceased, NN busca missing), `id != p.id`, `created_at > now()-30d`.
- Componentes ponderados (score 0–100):
  - `name_score`: `similarity()` pg_trgm × 100 (peso 0.30; sube a 0 si el NN no tiene nombre)
  - `geo_score`: `100 − min(ST_Distance/100, 100)` cap 10km (peso 0.25)
  - `age_score`: `100 − min(|Δedad|×10, 100)` (peso 0.10)
  - `sex_score`: 100 igual / 0 distinto / 50 null (peso 0.05)
  - `clothing_score`: jaccard tokens normalizados (peso 0.20)
  - `marks_score`: trgm `distinguishing_marks` (peso 0.10)
- Si missing↔unidentified, sube pesos clothing/marks/geo, baja name.
- Si score > 70 → INSERT `links (..., type='possible_match', confidence=score, auto_suggested=true)` + reasons jsonb para UI.
- Cola: trigger `pg_notify` → Worker cron 15m procesa.

## Scraper ético

- CF Worker `cron-ingest` schedule `0 */6 * * *`. Por cada `import_sources`:
  - Fetch `robots.txt`, parse, `disallow` → skip + audit log.
  - UA `FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)` + throttle 1 req/2s.
  - Módulo `scrape-{domain}.ts` con `extract(html): PersonPFIF[]`.
  - Validación: si <50% records parsean OK → abort + notifica `ADMIN_NOTIFY_EMAIL` con sample.
  - Dedup pre-insert SQL: `WHERE source IN ('faro-ve',$source) AND full_name_normalized=$1 AND ABS(EXTRACT(EPOCH FROM (last_seen_at-$2)))<86400 AND ST_DWithin(last_known_location_obfuscated,$3,5000)`. Match → UPDATE campos no vacíos. No match → INSERT `auto_approved` (sources confiables) o `pending` (nueva).
  - Atribución UI obligatoria: badge clickeable a `source_url` + página `/atribucion`.

## Seed obligatorio antes de deploy

- `anchor_places`: 100+ entradas (Caracas 23 parroquias + 30 sectores, Vargas costera, ciudades grandes, hospitales JM de los Ríos/Vargas/Universitario/Pérez Carreño, morgue Bello Monte, etc.). Fuente: OSM Overpass `[amenity=hospital]`, Wikipedia, manual.
- `import_sources`: 2 filas pre-cargadas (`desaparecidosterremotovenezuela.com` y `sosvenezuela2026.com`) con `robots_allowed=null` (revisa primera corrida).
- `moderators`: founder superadmin + voluntarios pre-aprobados verificados D1.
- Comando: `npm run seed` (idempotente).

## Difusión D-0

- **Email federación PFIF a 7 destinatarios** simultáneo (mismo template adaptado, **incluye email opt-out `opt-out@faro-ve.com` con SLA 24h** para detener ingesta si prohíben uso):
  1. `developer@theempire.tech` (desaparecidosterremotovenezuela.com)
  2. Contacto SOS-VE (sosvenezuela2026.com)
  3. Cruz Roja Venezolana (`info@cruzrojavenezolana.org` o similar)
  4. CICR (`ven_caracas@icrc.org`)
  5. CICPC info pública
  6. Defensoría del Pueblo VE
  7. Google Crisis Response (`crisisresponse@google.com`)
- **Twitter/X**: cuenta `@faro_ve` nueva, hilo + video 30s mostrando flujo, mencionar @cnnee @VenePress @ELUNIVERSAL @runrun_es @effectococuyo @ProteccionCivil_VE @CICR_ve @ONUVenezuela.
- **OSM Venezuela**: post talk-ve mailing list + Telegram OSM-VE pidiendo ayuda con anchor_places.
- **WhatsApp difusión**: QR del PWA + copy listo para que reportantes pasen.
- **Reddit r/vzla**: post comunitario respetuoso.
- **GitHub público**: README + AGPL-3.0 + llamado a contribuidores moderadores.

## Riesgos y mitigación

- **Supabase free saturada (500MB DB, 1GB storage)**: 50k records × 5KB = 250MB OK; fotos comprimidas 100KB × 5k = 500MB OK. Plan B fotos a Cloudflare R2 free 10GB (1h refactor) o Supabase Pro $25/mes con donaciones.
- **Troll bombing 1000 reportes/h**: Turnstile + KV rate-limit + auto-pending + bulk-reject por IP/email + kill switch env `INSERTS_PAUSED=true`.
- **Sitio fuente cambia HTML**: snapshot tests + falla suave + email admin + no rompe app.
- **Fuente prohíbe uso de su data**: email `opt-out@faro-ve.com` con SLA 24h documentado en footer + `/atribucion`. Cron diario verifica inbox vía Resend Inbound API → si llega request, marca source como `disabled` + corre purga (`DELETE FROM persons WHERE source=X AND withdrawn_at IS NULL`) + notifica founder. Auditado en `audit_log`.
- **OSM tile rate**: SW cache 7d agresivo + fallback MapTiler free 100k tiles/mes + atribución obligatoria.
- **Founder no monitorea 24/7**: 3+ moderadores voluntarios desde D1 + auto-approval sources confiables + cron "Faro Health" IA diario + alerta Discord/Telegram cuando cola > 50 pending.
- **Foto NN cuerpo indebida**: warning obligatorio en form + moderador entrenado + takedown rápido.
- **Habeas Data demanda**: política clara, retención 60d, delete funcional, audit completo, base legal humanitaria documentada.
- **IA budget overrun ($150/mes)**: `LLM_DAILY_BUDGET_USD=5` kill-switch + AI Gateway CF (cache 90%) + Haiku default + rate-limit 10 msg/IP/día + FAQ estático cubre 80% sin LLM. Si pasa: queries devuelven "asistente temporalmente fuera, consulta FAQ" + chat sigue con FAQ. Founder recibe alerta email + Telegram.
- **Aid points caducos** (refugio cerrado, distribución terminada): `expires_at` default +7d, UI muestra "Última actualización Xd ago" en rojo si > 3d. Orgs verificadas pueden refresh con 1 click. Cron diario marca expirados `verified=false`.
- **Organización falsa solicita verificación**: solo founder/admin verifica `organizations.verified=true` tras validación documental fuera de la app (sitio web, contacto telefónico). Sin verificación, aparecen en mapa sin badge "✓".
- **Animaciones queman batería en celulares antiguos**: `prefers-reduced-motion` respetado, cap 30fps, lazy-load Lottie solo si pin visible, toggle "Modo bajo consumo" en settings desactiva todas las animaciones.

## Archivos críticos a implementar

- `~/Desktop/faro-ve/supabase/migrations/0001_init.sql` — schema PFIF persons/notes/links/messages/moderators/audit_log + extensiones
- `~/Desktop/faro-ve/supabase/migrations/0003_rls_policies.sql` — privacidad por RLS + view público
- `~/Desktop/faro-ve/supabase/migrations/0004_triggers_functions.sql` — `obfuscate_point`, triggers, `suggest_matches`, `hash_email`, `decrypt_for_relay`
- `~/Desktop/faro-ve/supabase/migrations/0005_anchor_places_seed.sql` — 100+ lugares Venezuela
- `~/Desktop/faro-ve/supabase/migrations/0007_aid_orgs_ai.sql` — tablas `aid_points`, `organizations`, `ai_conversations`, `ai_budget_daily` + seed organizaciones verificadas
- `~/Desktop/faro-ve/src/lib/components/Map.svelte` — Leaflet + clusters + DivIcon SVG con tokens color + animaciones pulso
- `~/Desktop/faro-ve/src/lib/utils/colors.ts` — paleta accesible AAA + tokens por categoría
- `~/Desktop/faro-ve/src/lib/utils/navigation.ts` — buildMapsUrl (Apple/Google/Waze/OsmAnd) + detectPlatform + openNavigation
- `~/Desktop/faro-ve/src/lib/components/NavigateButton.svelte` — botón "🧭 Llegar aquí" con selector multi-app + persist LS
- `~/Desktop/faro-ve/src/routes/api/persons/+server.ts` — CRUD con Zod + Turnstile + rate-limit + EXIF strip
- `~/Desktop/faro-ve/src/routes/api/message/+server.ts` — relay anti-PII
- `~/Desktop/faro-ve/src/routes/api/offline-sync/+server.ts` — sync idempotente cola Dexie
- `~/Desktop/faro-ve/src/routes/api/aid-points/+server.ts` — CRUD puntos ayuda
- `~/Desktop/faro-ve/src/routes/api/ai/ask/+server.ts` — chatbot Haiku 4.5 + budget guard + rate-limit
- `~/Desktop/faro-ve/src/lib/server/ai/{client,prompts,budget-guard}.ts` — Anthropic SDK + AI Gateway CF
- `~/Desktop/faro-ve/src/lib/components/AIChatWidget.svelte` — botón flotante + drawer chat con FAQ pre-cargado
- `~/Desktop/faro-ve/src/lib/components/OnboardingSlides.svelte` — 3 pantallas ilustradas 1ª visita
- `~/Desktop/faro-ve/src/routes/moderar/+layout.server.ts` + `/+page.svelte` + `/matches/+page.svelte` + `/orgs/+page.svelte`
- `~/Desktop/faro-ve/src/routes/panel-org/+layout.server.ts` + `/puntos/+page.svelte` — panel orgs verificadas
- `~/Desktop/faro-ve/src/service-worker.ts` — workbox custom (tiles cache-first 7d, BackgroundSync POSTs)
- `~/Desktop/faro-ve/workers/cron-ingest/src/index.ts` — scraper ético `0 */6 * * *` con 7 adapters
- `~/Desktop/faro-ve/workers/ai-health/src/index.ts` — cron diario "Faro Health" → email founder
- `~/Desktop/faro-ve/workers/ai-triage/src/index.ts` — cron 15min triage cola pending
- `~/Desktop/faro-ve/src/hooks.server.ts` — Turnstile + rate-limit KV + salt + locals + kill-switch flags
- `~/Desktop/faro-ve/PRIVACY.md` + `ATTRIBUTION.md` — Habeas Data + atribución fuentes + opt-out

## Verificación E2E

| Feature | Cómo verificar |
|---|---|
| Mapa renderiza | Abrir `/`, ver tiles + clusters con colores correctos por categoría; menores y médicos pulsando; DevTools Network <150KB initial JS; Lighthouse PWA pass |
| Reportar desaparecido | Form + foto → submit → response `{id}`; `SELECT moderation_status=pending`; foto sin EXIF (`exiftool`); `ST_Distance(point, obfuscated)` retorna 0–500m |
| Reportar punto de ayuda | Form selector tipo + supplies chips + horarios + dirección + landmark + entrance_notes → POST `/api/aid-points` → row en `aid_points` con coords exactas (no obfuscated), `expires_at=+7d`; aparece en mapa cyan inmediatamente (no requiere moderación) |
| 🧭 Navegar a refugio/aid_point | Tap pin refugio o aid → popup muestra dirección + landmark + entrance + botón "🧭 Llegar aquí"; tap → modal con Apple Maps/Google Maps/Waze; tap Google Maps en iPhone → abre Apple Maps con coords exactas; LS guarda `preferred_map_app`; siguiente tap abre directo sin modal |
| 🚫 NO navegar a persona desaparecida | Tap pin persona desaparecida → popup NO tiene botón "🧭 Llegar aquí"; muestra texto "Ubicación aproximada (~300m por privacidad)"; coords obfuscated en DOM no exactas |
| Copiar dirección | Botón "📋 Copiar dirección" en aid_point copia al portapapeles `${name} — ${address_text} (${landmark})`; verificar con `navigator.clipboard.readText()` |
| Auto-reporte ubicación exacta opcional | Form `/reportar/a-salvo` con toggle OFF default; submit con toggle ON → pin verde muestra "🧭 Llegar aquí"; submit con toggle OFF → pin verde sin botón, coord obfuscated |
| Org gestiona puntos | Org verificada con login magic-link entra `/panel-org/puntos`; lista solo SUS puntos; refresh `supplies_available` → propaga al mapa en <5s vía Supabase Realtime |
| Onboarding | 1ª visita: 3 pantallas ilustradas aparecen antes del mapa; skipeable; LS flag `onboarding_seen=true`; 2ª visita: directo al mapa |
| Moderar | Magic-link login; cola ordenada por `(ai_priority desc, medical_urgent desc, is_minor desc)`; aprobar pending; refresh mapa público; punto aparece en posición obfuscated |
| Relay | Enviar mensaje vía `/mensaje/[id]`; row en `messages` con `delivered_at`; email recibido en inbox real con reply link; remitente NO ve email destinatario |
| PWA offline | Instalar; modo avión; reportar; Dexie inspect tiene `pending_reports`; online → SW sync borra entrada; row en DB con timestamp original |
| Scraper | `wrangler dev --test-scheduled`; logs fetch+parse+dedup; DB rows con `source` correcto en ≥2 fuentes; UI badge atribución clickeable; opt-out request a `opt-out@faro-ve.com` purga data en 24h |
| Match | Crear 2 personas similares; `SELECT * FROM suggest_matches('uuid')` retorna candidato score>70; `/moderar/matches` muestra par lado-a-lado |
| Chat IA | Botón flotante "?" abre drawer; preguntar "¿cómo reporto?" → respuesta correcta + link a `/como-usar`; 11º msg/IP/día devuelve 429; `ai_budget_daily.spent_usd` < $1 |
| Triage IA | Insertar 5 reportes pending; esperar 15min cron; `SELECT ai_priority FROM persons WHERE id IN (...)` retorna `critical/high/medium/low` no null; razonamiento en `ai_reasoning` |
| Health IA | Esperar 9am Caracas; email founder llega con summary 24h métricas; costo IA día previo aparece y es <$3 |
| Búsqueda | `/buscar?name=jose` retorna fuzzy matches con highlight; `/buscar?sector=petare` filtra geo |
| PFIF export | `curl /api/rss?format=pfif | xmllint --schema pfif-1.4.xsd -` valida |
| Habeas Data | Form delete con email + id correcto → `withdrawn`; ya no aparece en `/`; `audit_log` tiene entrada |
| Rate limit | `for i in {1..10}; do curl -X POST /api/persons; done` — del 6º en adelante recibe 429 |
| i18n | `/en/` UI inglés; strings sin traducir = error build (Paraglide compile-time) |
| A11y mobile | Lighthouse a11y > 95; navegación teclado; contraste WCAG AAA; `aria-label` en pins; VoiceOver iOS lee correctamente |
| Reduced motion | Activar `prefers-reduced-motion` en OS → pulsos cesan, Lottie congela en primer frame; toggle "bajo consumo" en settings desactiva todo movimiento |
| Footer atribución | Visible en TODAS las páginas; lista fuentes activas con conteos; email `opt-out@faro-ve.com` clickeable |

## Comando exacto para arrancar (próximo chat / próxima sesión)

```bash
mkdir -p ~/Desktop/faro-ve
cd ~/Desktop/faro-ve
git init
git checkout -b main
# luego: claude
```

En la sesión nueva de Claude Code (ya dentro de `~/Desktop/faro-ve`):
1. Pegar este plan como contexto inicial.
2. Crear `CLAUDE.md` propio del proyecto (humanitario, sin reglas NEXVYVE/KAEL, con la LEY DE SEPARACIÓN apuntando a este repo).
3. Empezar Día 1.
