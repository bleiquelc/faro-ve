# Faro VE — Status

> Documento vivo. Cierre del día actualiza este archivo + crea
> `docs/SESSIONS/YYYY-MM-DD-day{N}.md` con detalle.

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

## Lista de funciones (handoff) — estado
1. IA-moderadora (restaurar auto-ocultos) — ⏸ en pausa (founder: sin IA por ahora).
2. Triaje IA — ⏸ en pausa (founder: sin IA por ahora).
2b. Auto-ingesta del conteo (`venezuela-te-busca`) — ✅ **DESPLEGADO y funcionando** (worker cron-ingest, 27-jun). El conteo sube solo, sin duplicar. Pendiente menor: relajar cron `*/15`→`6h` cuando se estabilice (~28-29k).
3. WhatsApp opt-in reportante — ⏳ (migración).
4. Relay de mensajes — ⏳ requiere `RESEND_API_KEY`.
5. Offline PWA (función 5) — ✅ LIVE (commit `7c8f4fb`): SW registrado (antes no lo estaba), Faro Auxilio + guía PDF disponibles SIN conexión, página `/offline`, navegación fail-closed (sin caché de PII), actualización controlada por el usuario. Pendiente futuro: BackgroundSync de reportes offline (cola Dexie) — no incluido aún.
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
