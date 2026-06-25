# SPEC — Capa de lugares de servicio + autorregulación comunitaria

> Confirmado por el founder (2026-06-25). Construir como bloque enfocado (con su propia revisión adversarial), después de que cierre la ingesta de data real.

## Qué es
Cualquiera puede registrar **puntos de servicio** con coords EXACTAS y navegación ("Llegar aquí"):
fundaciones, centros de acopio, refugios/cobijo, distribución de agua/comida, médico, voluntarios.
Fricción mínima; la comunidad autorregula; el founder (solo, en Suiza) interviene solo por excepción.

## Estado base (ya en DB desde Día 1)
- Tabla `aid_points` (0007): `type` (aid_type enum), `name`, `supplies_available jsonb`, `schedule`,
  `location_point` EXACTO, `address_text/landmark/entrance_notes`, `verified`, `active`, `expires_at +7d`.
- Vista pública (solo `active=true and expires_at>now()`), RLS, `organizations` verificadas.
- `NavigateButton` ("Llegar aquí") + tokens de color `aid`/`shelter` ya existen.

## Falta construir
1. **Formulario público** `routes/reportar/punto-ayuda` (+ refugio): selector de tipo, supplies (checkboxes),
   horario, dirección + landmark + entrance, coords (geoloc/mapa). Turnstile + rate-limit. Etiqueta clara
   "ESTOS DATOS SON PÚBLICOS, ayudan a la gente a llegar".
2. **Visible al instante** con badge "sin verificar" (NO espera moderación — distinto a personas). Orgs que
   el founder valida → badge "✓ verificada".
3. **Capa en el mapa**: pines cian (aid) / azul (refugio) con popup → coords exactas + NavigateButton +
   "Copiar dirección" + "Última actualización hace Xh". Filtro chip para activar/desactivar la capa.
4. **Autorregulación comunitaria** (lo nuevo):

### Votación (1 voto por IP hasheada, Turnstile)
- Popup del punto: **"✅ Sí, sigue aquí"** (+1 confirm) / **"⚠️ Ya no está"** (−1 report).
- Tabla `aid_point_votes (aid_point_id, ip_hashed, vote ∈ {confirm,report}, created_at)`, unique
  (aid_point_id, ip_hashed) → un voto por IP, cambiable.
- `net = reports − confirms`. **net ≥ 3 → auto-ocultar** (`active=false`) + **alerta al founder**.
- Trigger/endpoint recalcula net al votar.

### Salvaguardas anti-griefing
- Ocultar, NO borrar (reversible).
- Voto único/IP + Turnstile + rate-limit (infra ya existe en hooks).
- Confirmaciones de un punto real anulan reportes falsos.
- `expires_at +7d` sigue: lo abandonado se cae solo aunque nadie vote.

### Reactivación con responsable (confirmado founder)
- Un punto oculto puede **reactivarse**, pero quien reactiva **deja su WhatsApp** (obligatorio).
- Al reactivar: `active=true`, se resetea/contrapesa el net, y el **WhatsApp se ENVÍA al founder**
  (Telegram/email) para rendición de cuentas + verificación. El teléfono se guarda **cifrado**
  (`reactivated_by_phone_encrypted`), **nunca público** (regla #2). Queda registro de quién revivió el lugar.
- Esto desincentiva el ping-pong ocultar/reactivar: hay que poner tu número real.

## Migración nueva (a escribir)
- `aid_point_votes` (+ unique IP) + función `recompute_aid_point_status(id)`.
- `aid_points`: `+ hidden_at, reactivated_by_phone_encrypted, reactivated_at, reactivation_count`.
- Vista pública: exponer `net`/`confirms`/`reports` y `verified` para el badge; nunca el teléfono.
- Endpoints: `POST /api/aid-points` (registrar), `POST /api/aid-points/[id]/vote`, `POST /api/aid-points/[id]/reactivate`.

## Parámetros confirmados
- Umbral auto-ocultar: **net ≥ 3**.
- Acción: **auto-ocultar** (reversible), no borrar.
- Reactivación exige WhatsApp → enviado al founder, cifrado, no público.
