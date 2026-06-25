# Faro VE — Sprint Kickoff (copy de inicio para chat nuevo)

> Cuando abras un chat fresco de Claude Code en `~/Desktop/faro-ve`, pega el bloque siguiente como primer mensaje. Está diseñado para que el chat arranque con disciplina humanitaria desde la primera acción, sin contexto previo de otros proyectos.

## Copy a pegar tal cual

```text
# FARO VE — INICIO DE SPRINT HUMANITARIO

Eres Claude Code operando en /Users/bleiquelcolina/Desktop/faro-ve.
Este es un proyecto NUEVO, SEPARADO de NEXVYVE iOS y KAEL by NEXVYVE.
NO traer código, reglas ni reflejos de esos repos. Cada uno opera en su cwd.

## QUÉ ESTAMOS CONSTRUYENDO Y POR QUÉ

Faro VE — Mapa de Esperanza Venezuela. PWA humanitaria instalable.
Contexto real: el 24-jun-2026 hubo terremoto M7.2+M7.5 en Venezuela:
164 muertos confirmados, 971+ heridos, miles desaparecidos. Familias
en shock buscando a sus seres queridos AHORA MISMO.

Cada hora que tardes en lanzar = familias sin herramienta para
reencontrarse. Cada bug que pase a producción = falsa esperanza o
peor: estafa, saqueo, persecución. Velocidad CON rigor, no en vez de.

Esto NO es un side project. Es infraestructura humanitaria.
Operas como tal.

## PRE-FLIGHT — LECTURA OBLIGATORIA EN ESTE ORDEN (no saltes)

1. PLAN.md   — el sprint completo de 6 días, schema, arquitectura, gates
2. CLAUDE.md — 31 reglas inmutables del proyecto + LEY DE SEPARACIÓN
3. PRIVACY.md — Habeas Data Venezuela, retención 60d, delete funcional
4. ATTRIBUTION.md — fuentes externas, opt-out 24h, federación PFIF

Tras leerlos, ANTES de tocar código, responde al founder en 6 bullets:
  - Qué entendiste del scope (1 línea)
  - Qué entendiste de la regla de privacidad diferenciada (navegación)
  - Qué entendiste del flujo opt-out fuentes (SLA 24h)
  - Qué entendiste del budget IA ($150/mes con kill-switch $5/día)
  - Qué entendiste de PFIF v1.4 como schema canónico
  - Qué dudas concretas tienes (si ninguna, dilo)

Espera OK explícito del founder antes de iniciar Día 1.

## WORKFLOW DISCIPLINADO POR FASE

Para CADA fase del día, activas el skill correspondiente vía la herramienta Skill:

- Antes de cualquier creative work nuevo:  superpowers:brainstorming
- Antes de escribir código nuevo:          superpowers:test-driven-development
- Cuando aparezca un bug/test rojo:        superpowers:systematic-debugging
- Antes de declarar "hecho":                superpowers:verification-before-completion
- Cuando ejecutes el plan diario:           superpowers:executing-plans
- Al terminar feature significativa:       superpowers:requesting-code-review
- Si necesitas worktree aislado:           superpowers:using-git-worktrees

No los saltes. Cada uno previene una clase distinta de error.

## CABLEADO CRÍTICO — sistemas que NO pueden fallar

Antes de cerrar cada día, verifica que estas cadenas estén COMPLETAS:

1. REPORTE → DB → MAPA
   Formulario → Zod → Turnstile → rate-limit KV → /api/persons POST
   → INSERT pending → trigger obfuscate_point → audit_log
   → moderador aprueba → persons_public view → mapa público con offset
   Verifica: ST_Distance(point, obfuscated) entre 0 y 500m.

2. RELAY DE MENSAJES → ANTI-PII
   /mensaje/[id] → Turnstile → /api/message → hash remitente
   → pgp_sym_encrypt → Resend SDK → email al reportante con reply token
   → respuesta del reportante NO expone email destinatario al remitente.
   Verifica: email recibido + headers limpios + DB row sin email plano.

3. SCRAPER ÉTICO → ATRIBUCIÓN → OPT-OUT
   CF Worker cron 0 */6 * * * → robots.txt check → UA identificada
   → cheerio parse → dedup (full_name_normalized + ±24h + ST_DWithin 5km)
   → upsert con source + source_id → badge UI atribución → /atribucion
   → opt-out@faro-ve.com inbound → cron diario lee → DELETE source=X
   → notifica founder + audit_log.
   Verifica: opt-out simulado purga data en <24h.

4. IA → AI GATEWAY → BUDGET GUARD → FALLBACK
   /api/ai/ask → budget_guard.check() lee ai_budget_daily
   → si excede $5/día → return 503 con "consulta FAQ" → FAQ estático activo
   → si OK → Anthropic SDK vía Cloudflare AI Gateway → Haiku 4.5
   → prompt caching → response → budget_guard.charge() escribe costo real.
   Verifica: forzar $5.01/día → siguiente query devuelve fallback,
   chat sigue navegable con FAQ.

5. PWA OFFLINE → BACKGROUND SYNC → IDEMPOTENCIA
   Reportar sin red → fetch falla → SW captura → Dexie pending_reports
   con client_uuid → online → sync event → /api/offline-sync POST array
   → busca client_uuid → INSERT solo si no existe → response mapping
   → SW borra entrada → toast "sincronizado".
   Verifica: modo avión + 3 reportes + online → 3 rows en DB, NO duplicados.

6. NAVEGACIÓN EXTERNA — REGLA DIFERENCIADA
   Refugio/aid_point → coords EXACTAS + NavigateButton (selector Apple/
   Google/Waze/OsmAnd + LS preferred_map_app) + address_text + landmark
   + entrance_notes + botón "Copiar dirección".
   Persona/NN/avistamiento → SIN botón navegación + texto
   "Ubicación aproximada (~300m por privacidad)".
   Auto-reporte "a salvo" → toggle opt-in del sujeto (default OFF).
   Verifica: DOM pin persona NO contiene coord exacta ni deep link maps.

7. TRIGGER → VIEW → RLS (cadena de privacidad)
   trg_obfuscate_persons BEFORE INSERT/UPDATE → recalcula obfuscated.
   trg_is_minor BEFORE INSERT → fuerza photo_visibility='admin_only'.
   trg_audit AFTER ANY → escribe audit_log con diff jsonb.
   View persons_public excluye: last_known_location_point exacto,
   reporter_email_*, reporter_phone_*, photo_url si admin_only.
   RLS público: SELECT solo moderation_status='approved' AND withdrawn_at IS NULL.
   Verifica: anon select con curl + service_role key NULL retorna sin coords
   exactas y sin reporter info, ni siquiera en respuesta de error.

8. MODERACIÓN → AI TRIAGE → ORDEN COLA
   Insert pending → ai-triage worker cron */15 lee 20 sin ai_priority
   → Haiku clasifica → escribe ai_priority + ai_reasoning
   → /moderar ordena por (ai_priority desc, medical_urgent desc, is_minor desc, created_at asc).
   Verifica: insertar reporte con "diálisis insulina embarazada" en notas
   → 15min después aparece arriba de la cola con razonamiento legible.

## BUG-PREVENTION — TRAMPAS CONOCIDAS

Esto NO es paranoia, son fallos reales en sistemas humanitarios previos:

- EXIF GPS de fotos: strip OBLIGATORIO en cliente con exifr ANTES de subir
  y validar server-side. Sino la coord exacta filtra por la foto.
- Mapbox/Google Maps API: NO usar (cuesta y rate-limit). Solo OSM con
  cache SW 7d y fallback MapTiler free 100k/mes. Atribución obligatoria.
- Service Worker fetch handler: si cachea TODO sin distinguir GET/POST,
  rompe inserts. Usar workbox routing con method matcher.
- pgp_sym_encrypt con clave en código: NO. Solo APP_SALT en env var,
  derivar clave server-side. Si APP_SALT cambia, datos viejos quedan
  irrecuperables — bloquear el deploy con migración guard.
- Turnstile bypass por API directa: middleware en hooks.server.ts DEBE
  validar token en TODO POST público, no solo formulario UI.
- Rate-limit KV: la clave debe ser hash de IP + salt, no IP plana,
  para no exponer IPs en logs Cloudflare.
- Dexie versionado: si cambias schema sin migración, browsers viejos
  bloquean offline queue. SIEMPRE bump version + onupgradeneeded.
- React/Svelte hydration mismatch en Leaflet: el mapa se monta SOLO
  client-side. Usar onMount + dynamic import.
- Adapters scraper: si HTML cambia, snapshot tests deben fallar ANTES
  que producción se corrompa. Fixture obligatorio en tests/fixtures/.
- Magic-link de moderadores: el token DEBE expirar en <15min y ser
  one-time-use. Sino email comprometido = panel comprometido.
- Auto-aprobar sources: solo Cruz Roja / ICRC / gobierno como
  auto_approved=true. Cualquier otra fuente nueva = pending por
  default + revisión humana primer batch.
- pgvector embedding face: NO instalar la extensión en v0.1. Si la
  pones "por si acaso", la próxima sesión cae en la tentación de
  activarla sin las 8 salvaguardas (revisar PLAN.md sección face).
- Lottie en pins lejanos: mata batería en celulares 2018-. Lazy-load
  con IntersectionObserver, solo si pin visible en viewport.
- Carrera condición match: dos moderadores aprueban mismo pending
  duplicado. Solución: UPDATE con WHERE moderation_status='pending'
  → revisar rowsAffected antes de commitear.
- Email Resend rebote: implementar webhook de bounce/complaint,
  marcar reporter_email_invalid=true, NO reintentar.

## STOP CONDITIONS — para INMEDIATO y consulta al founder si:

- Algún cambio expone coordenadas exactas de persona/NN/avistamiento.
- Test rojo y la tentación es modificar el test para que pase.
- Costo IA día actual ($USD) supera $4 antes del 80% del día.
- 3 strikes rule: misma operación falla 3 veces seguidas, ESCALA.
- Ambigüedad legal: consent menores, habeas data, jurisdicción.
- Migración Postgres requiere DROP de tabla con data — pide OK.
- A punto de skip/disable un test de privacidad o RLS — pide OK.
- A punto de comitear secretos (key, salt) por accidente.
- A punto de empujar a main sin haber pasado todos los gates del día.

## PROTOCOLO DE CIERRE DE DÍA

Al terminar las 8h del día:

1. Ejecutar el "Gate" del día tal como aparece en PLAN.md
   (con evidencia: paths verificados, queries SQL ejecutadas, screenshots)
2. Ejecutar Lighthouse mobile (al menos D2 en adelante)
3. npm test debe pasar al 100%
4. Bundle inicial <150KB verificado
5. Actualizar docs/STATUS.md (crear si no existe) con:
   - Fecha + día del sprint
   - Entregables del día con paths
   - Gate: PASS / FAIL con evidencia
   - Bloqueadores para el día siguiente
6. Crear docs/SESSIONS/YYYY-MM-DD-day{N}.md con detalle ejecutivo
7. Commits granulares por feature lógica (no bulk):
   git add archivos-específicos
   git commit -m "{tipo}: {descripción concisa} [día N]"
   Sin atribución (regla global founder).
8. Push a remoto SOLO con OK del founder explícito.
9. Reportar al founder: "Día N cerrado. Gate PASS. Avance Y/6.
   Próximo día: Z. Bloqueadores: ninguno / [lista]."

## COMMITS — REGLAS DURAS

- Granulares, por feature lógica. NUNCA bulk.
- "git add archivos-específicos" o "git add -p". NUNCA "git add ."
- Mensaje convencional: feat / fix / chore / docs / test / refactor / perf
- Sin emojis salvo que el founder pida.
- Sin "Co-Authored-By" (atribución globalmente desactivada).
- Pre-commit hook si existe — NO --no-verify nunca.
- amend SOLO si el founder pide explícito.

## OPS — SECRETOS Y RIESGOS

- ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
  APP_SALT viven SOLO en Cloudflare Pages env (encrypted) y en
  ~/.secrets/ local (no en repo). Verificar antes de cada deploy.
- Cualquier acción admin a DB de producción: backup snapshot
  Supabase ANTES + audit_log entry DESPUÉS.
- Cualquier ejecución de scripts/admin/*: dry-run primero, --apply
  solo con OK founder por acción.
- Deploys a producción: solo desde branch main tras Gate del día
  PASS y founder OK explícito.

## PRIMERA ACCIÓN INMEDIATA

1. Lee PLAN.md, CLAUDE.md, PRIVACY.md, ATTRIBUTION.md (en ese orden).
2. Reporta al founder los 6 bullets de comprensión.
3. Espera OK explícito.
4. Activa skill superpowers:executing-plans con PLAN.md como base.
5. Inicia Día 1 — Foundation. Sigue PLAN.md al pie de la letra.
6. Cierra día con el Gate documentado.

Estás listo. Empieza por leer PLAN.md ahora.
```

## Cómo usar este kickoff

1. Abre terminal:
   ```bash
   cd ~/Desktop/faro-ve && claude
   ```
2. Pega el bloque de arriba como primer mensaje en el chat fresco.
3. El chat va a leer los 4 archivos canónicos y te responderá con 6 bullets de comprensión. Lee con cuidado: si algo no encaja con tu expectativa, corrígelo ANTES de dar OK.
4. Cuando el chat te entregue los 6 bullets bien, responde con "OK, inicia Día 1" (o ajusta según necesites).
5. El chat va a invocar `superpowers:executing-plans` con `PLAN.md` como base y empezar el sprint.

## Si en algún momento el chat se desvía del rigor

Frases de redirección rápidas:
- "Pausa. Lee la regla N de CLAUDE.md. ¿Tu acción la viola?"
- "¿Cuál es el Gate del día? Demuéstralo con evidencia (paths, queries, screenshots)."
- "Antes de declarar 'hecho', activa `superpowers:verification-before-completion`."
- "Stop condition activada: [razón]. Necesito tu input antes de continuar."

## Versiones del kickoff

- **v1.0** (2026-06-25): plan aprobado de 6 días, 31 reglas inmutables, regla de navegación diferenciada, IA dentro de budget $150/mes. Cambios futuros se documentan aquí.
