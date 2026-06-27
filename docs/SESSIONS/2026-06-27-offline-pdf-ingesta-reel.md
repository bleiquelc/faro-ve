# Sesión 2026-06-27 — Offline, guía PDF, chat sin IA, auto-ingesta, elementos de reel

Sesión larga y autónoma. Todo verificado en vivo antes de cerrar. Detalle por área
en `docs/STATUS.md` (tandas 5-8). Resumen para handoff:

## Lo que quedó LIVE / hecho
1. **Biblioteca Faro Auxilio 23→34 guías** + categoría "Salud y prevención" (verificado
   adversarialmente, cero invención; `expansion.ts` generado por `scripts/gen-expansion.mjs`).
2. **Offline real**: el service worker NUNCA se registraba → se cableó (`+layout.svelte`).
   `/auxilio` y `/offline` prerenderizadas + precacheadas → Faro Auxilio funciona SIN
   conexión. Navegación **fail-closed** (allowlist) para no cachear PII. Actualización
   controlada por el usuario (`registerType:'prompt'`, el RefreshButton es el único reload).
   2 críticos atrapados por revisión adversarial (auto-reload con pérdida de datos; caché
   de `/persona` con coords+teléfono). Botón **Actualizar** (símbolo) en el inicio.
3. **Guía PDF** descargable/distribuible (`scripts/gen-guide-pdf.ts`, desde los datos
   verificados): visual (mapa de pasos, color psicología, iconos de la app), fuente por
   guía + bibliografía. Botón usa **Web Share** (guardar/compartir sin atrapar la app) +
   URL **versionada `?v=`** (rompe caché → siempre la última) + SW NetworkFirst. Sin huecos
   de hojas en blanco (76→57 págs). Founder lo aprobó.
4. **Chat SIN IA** (decisión founder): solo guías locales, cero Anthropic. Reversible
   (`AI_ENABLED=true` en `AuxilioChat.svelte`).
5. **Auto-ingesta del conteo** (`venezuela-te-busca`) vía **Worker cron-ingest** —
   DESPLEGADO por el founder (migraciones 0025+0026, secret, deploy). El conteo sube solo
   sin duplicar (24.546→~28-29k). Núcleo compartido `scripts/ingest/venezuela-te-busca-core.mjs`.
   **Pendiente menor**: relajar cron `*/15`→`6h` cuando se estabilice.
6. **5 imágenes IG retrato** (entregadas) + **elementos para REEL** en
   `~/Desktop/faro-ve-reel-elementos/` (PNG transparentes + mapa VE animado con alfa;
   scripts en `scripts/reel-*.mjs`).

## Restricciones aprendidas (importantes)
- El **shell del agente (sandbox) NO tiene IPv6** → no alcanza la DB directa (`ENOTFOUND`).
  El Mac del founder SÍ. Por eso la ingesta corre en el Worker (Cloudflare) o en el Mac.
- No deployar a prod sin OK explícito (el classifier bloqueó `wrangler deploy` del worker,
  correcto → lo hizo el founder).
- service_role / llaves secretas: nunca por chat; el founder las pone con `wrangler secret put`.

## Próximas prioridades sugeridas (sin IA, por decisión founder)
- Relay de mensajes anti-estafa (necesita `RESEND_API_KEY`).
- Cola de reportes OFFLINE (BackgroundSync — enviar al volver la señal).
- WhatsApp opt-in del reportante (migración).
- Relajar el cron del worker a 6h tras el catch-up.
