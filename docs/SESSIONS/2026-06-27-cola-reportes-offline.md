# Sesión 2026-06-27 — Cola de reportes OFFLINE (BackgroundSync de página)

Prioridad #3 del founder. Autónoma, con rigor adversarial + verificación en navegador real
ANTES de cualquier deploy. **Commit local, SIN push** (el push podría auto-deployar).

## Qué se construyó (función 3 — "cola de reportes offline / enviar al volver la señal")

Los 4 formularios de persona (`desaparecido`, `a-salvo`, `condicion-medica`, `cuerpo-nn`) ahora:
1. **Guardan el reporte sin señal** en una cola cifrada en el dispositivo, y
2. **Lo reenvían solos al volver la conexión**, REUSANDO `POST /api/persons` con un token Turnstile
   FRESCO por entrada → toda la cadena dura intacta (config-guard → Turnstile → rate-limit → kill-switch
   → RPC `create_person_report` que cifra/hashea la PII en la DB).

**Ley de Reuso (Art. 1-6):** se descartó el `/api/offline-sync` reservado (exigiría exentarlo de
Turnstile = debilitar la cadena) y el SW BackgroundSync (el SW no tiene DOM → no puede correr el widget
Turnstile remoto). El replay corre en **contexto de página** y reusa el endpoint endurecido. El schema
ya traía `client_uuid` ("Idempotencia offline") y `dexie`/`workbox-background-sync` ya estaban instalados.

## Archivos

**Nuevos:**
- `supabase/migrations/0027_offline_idempotency.sql` — idempotencia (ver abajo). **Falta aplicarla.**
- `src/lib/utils/offline-policy.ts` — lógica PURA (clasificación de respuestas, backoff con jitter+techo,
  `minimizeEnqueuablePayload` con **lista blanca**, TTL/expiración). Testeada (node).
- `src/lib/client/outbox.ts` — Dexie + AES-GCM (clave no-extraíble) + CRUD + purga + `wipeAll` + `reviveStuck`.
- `src/lib/client/outbox-summary.ts` — resumen ligero en localStorage (sin Dexie, no-PII) → el banner no
  arrastra Dexie al bundle inicial (#21).
- `src/lib/client/outbox-store.ts` — store reactivo del resumen.
- `src/lib/client/report-submit.ts` — wrapper único submit-or-queue (genera `client_uuid` antes del 1er
  intento, también online → cubre el ack-perdido online).
- `src/lib/client/replay.ts` — motor de replay (secuencial, `navigator.locks`, token fresco por entrada,
  auto-reprogramación por backoff, clasificación 429/503/etc.).
- `src/lib/client/turnstile-token.ts` — token Turnstile programático (invisible + fallback interactivo).
- `src/lib/client/online.ts` — store de conectividad (para deshabilitar la foto sin señal).
- `src/lib/components/OutboxBanner.svelte` — banner (solo metadatos, aria-live, "Enviar ahora" / "Borrar
  mis datos de este teléfono").
- `src/lib/components/QueuedReportCard.svelte` — confirmación "guardado offline".
- `src/routes/reportar/{4 forms,hub}/+page.ts` — `prerender = true` (precache offline-fresh).
- `tests/offline/offline-policy.test.ts` — 20 tests.

**Modificados:** los 4 `+page.svelte` (enrolados por `submitReport` + foto offline + pantalla queued),
`+layout.svelte` (monta el banner), `api/persons/+server.ts` (propaga `duplicate`), `hooks.server.ts`
(rate-limit `/api/persons` 5→**10/h** + gobernanza de `/api/offline-sync`), `service-worker.ts`
(comentario de la excepción acotada de la outbox), `PRIVACY.md` (sección cola offline).

## Migración 0027 (idempotencia ACK-perdido) — la aplica el founder

El ACK-perdido: el POST insertó la fila pero el 200 no llegó (red intermitente) → el cliente reintenta el
mismo `client_uuid`. Sin idempotencia se duplica una persona PUBLICADA (0021 auto-aprueba). 0027:
- `CREATE UNIQUE INDEX CONCURRENTLY persons_client_uuid_uniq ... WHERE client_uuid IS NOT NULL` (la única
  barrera dura; excluye las miles de filas de ingesta con `client_uuid` NULL).
- Guard antepuesto a `create_person_report`: SELECT previo por `client_uuid` (devuelve el existente si ya
  está) + `ON CONFLICT DO NOTHING` + SELECT de respaldo para la carrera (`DO NOTHING` **no** retorna fila
  en Postgres → por eso el SELECT). **INSERT byte-idéntico a 0021** (aditivo, no reescribe el cifrado de PII).
- Devuelve `{id, edit_token, duplicate}`. En el camino duplicado `edit_token` es null (decisión founder;
  los forms ya ignoran ese campo).
- **Aplicar en 2 pasos** en el SQL Editor (el `CONCURRENTLY` no puede ir en transacción): primero el índice,
  luego la función + grants.

## Decisiones del founder (registradas)
- Foto offline: **online-only** (sin señal se deshabilita con aviso; nunca pérdida silenciosa).
- Retención de la cola: **48h**.
- Tope `/api/persons`: **5 → 10/h** (refugio con conexión compartida reportando varios desaparecidos).
- Dispositivo compartido: NO desactivar la cola (perdería el reporte); en su lugar **entrega siempre +
  cero render de PII + purga agresiva + botón "Borrar mis datos de este teléfono"**. Fast-follow: envío
  self-service por WhatsApp/SMS cuando aterrice el relay (saca la PII del equipo prestado).

## Rigor (lo que atrapó cada revisión)
- **Pre-mortem (5 lentes, antes de codificar):** 5 bloqueantes — incl. que `ON CONFLICT DO NOTHING` **no**
  retorna fila (mi diseño habría entrado en loop infinito en el ack-perdido), form NetworkOnly no carga
  offline-fresh, foto descartada en silencio, AES-GCM es "teatro" contra el dispositivo compartido.
- **Revisión de código (4 lentes):** privacidad LIMPIA; **2 ALTO** — el backoff no se auto-disparaba
  (solo avanzaba por eventos del navegador) y `withLock` con lock ocupado se trataba como éxito
  (le mentía al usuario). Ambos arreglados + allowlist real + copy por conectividad + `reviveStuck`.

## Verificado EN VIVO (navegador real, vite preview)
- Offline → encola **cifrado** (0 PII en claro en IndexedDB ni en el resumen), **0 fetch**, banner con
  copy honesto y solo metadatos, clave AES no-extraíble.
- Online → replay con token fresco → **1 sola llamada** → éxito → cola vacía → banner desaparece; PII
  preservada y enviada.
- ACK-perdido (`duplicate:true`) → tratado como éxito (cubierto por unit test + Test B).
- **Self-rescheduling del backoff SIN eventos**: n=1 @53ms→500, n=2 @2s→500, n=3 @5.8s→**201**, cola
  vacía @6s; no se disparó ningún `online`/`visibility`.
- **Offline-fresh**: SW controla, los **4 forms precacheados**, el form carga sin señal.
- 81 tests, svelte-check 0, build limpio, Dexie en chunk lazy (no en el bundle inicial).

## Pendiente founder
1. **Aplicar `0027`** (SQL Editor, 2 pasos).
2. Revisar el commit local + push/deploy cuando quieras (no lo hice yo; el push puede auto-deployar).
3. Tras deploy: verificar live en faro-ve.com el ciclo completo con la DB real (el sandbox no alcanza la
   DB directa por IPv6; el replay reusa el endpoint, que sí funciona en prod).

## Fast-follows documentados
- Foto-en-cola offline (guardar el blob cifrado + subir con EXIF-strip en el replay; ojo regla #3 menores).
- Notes (`/api/notes`) y aid-points (`/api/aid-points`) por la misma cola.
- SW BackgroundSync (enviar con la app cerrada) — requiere un anti-abuso alternativo a Turnstile.
- Envío self-service por WhatsApp/SMS (deep link) para sacar la PII del dispositivo compartido.
