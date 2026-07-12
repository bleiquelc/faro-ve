# HANDOFF — Federación / Datos abiertos + Outreach (28-jun-2026)

> Pegá este archivo (o la línea de abajo) en el chat nuevo para continuar.
> **Lee primero:** `CLAUDE.md` · `docs/STATUS.md` · este archivo.

---

## ✅ Lo que quedó LIVE en producción (faro-ve.com) esta sesión

**Federación v1 — la red de datos abiertos está ABIERTA y verificada en vivo:**

| Pieza | Detalle | Commit |
|---|---|---|
| **CORS** | `handleCors` en `src/hooks.server.ts` (primero en el `sequence`, allowlist `PUBLIC_GET_CORS`). Los 5 GET públicos (`/api/pfif`, `/persons`, `/persons/clusters`, `/persons/stats`, `/aid-points`) → `ACAO:*` + OPTIONS 204. Mutadores y `/api/ai/ask` CERRADOS. **NO** en `_headers` (Pages no cubre Functions). | `b979357` |
| **PFIF completo** | `src/routes/api/pfif/+server.ts`: quitado filtro lat-not-null (federa a los sin-GPS) + `expiry_date`=entrada+60d (propaga opt-out aguas abajo). | `b979357` |
| **GeoJSON** | `?format=geojson` en `/api/persons` (coords OFUSCADAS ~300m, nunca la exacta; foto-menor null; sin-coords como geometry null) y `/api/aid-points` (coords EXACTAS). `application/geo+json`. | `da31305` |
| **Página `/datos`** | `src/routes/datos/` — contrato público: endpoints, ejemplos, privacidad, atribución, opt-out, **licencia CC BY 4.0 + cláusula humanitaria de no-reidentificación** (decisión del founder). Prerenderizada. | `601bad1` |

Verificado en vivo: ACAO en los GET, OPTIONS 204, mutadores sin ACAO, `expiry_date` presente, GeoJSON FeatureCollection válido con coords ofuscadas (sin `lat_exact`).

**Otras features de esta sesión (también LIVE):** cola de reportes offline (`fc0f290`), arreglo de chips/filtros del mapa con conteo exacto + estado vacío + ocultar chips en 0 (`cc79de6`, `46071cf`, `3ee01a7`), ingesta worker cron `*/5` (`ba59481`), personas sin ubicación geocodificable ingeridas y buscables en `/buscar` (`502f032`).

---

## 🔴 PENDIENTE CRÍTICO — el email @faro-ve.com NO recibe

**El founder confirmó (28-jun): "Resend no se usa / no lo tenemos configurado".**

- `opt-out@`, `contacto@` y `federacion@faro-ve.com` están **documentados** (CLAUDE.md 130-132, README, footer, `/datos`, `/atribucion`, feed PFIF) **pero no hay inbound configurado → NO reciben mail.**
- **Impacto grave:** rompe el canal **opt-out SLA 24h** (regla #8 — compliance Habeas Data) y deja sin salida a partners que escriban desde `/datos`.
- **Mitigación parcial:** los borradores de outreach salen del **Gmail del founder** → las respuestas caen en `bleiquelc@gmail.com` igual (no rebotan).
- **DECISIÓN PENDIENTE (founder):**
  - (a) Configurar inbound/forward a Gmail (Resend Inbound, o Cloudflare Email Routing — gratis: MX → forward a bleiquelc@gmail.com) y mantener las direcciones con marca, **o**
  - (b) Cambiar todas las menciones (`/datos`, footer, `/atribucion`, feed PFIF, drafts) a un correo que sí reciba.
  - **Recomendación:** Cloudflare Email Routing (el dominio ya está en Cloudflare) → `opt-out@`, `contacto@`, `federacion@` forward a Gmail. 10 min, gratis, resuelve compliance + branding.

---

## 📧 Outreach — borradores creados en el Gmail del founder (NO enviados)

> Salen del Gmail del founder → las respuestas llegan a `bleiquelc@gmail.com`. Revisar y enviar él.
> La firma NO debe usar `federacion@` (muerto). Para Cruz Roja/ICRC conviene además un correo individual personalizado.

**Borrador ES** — Asunto: *"Faro VE — datos abiertos para conectar nuestras búsquedas (terremoto Venezuela)"*
CCO verificados: `caracas@cruzroja.ve`, `hdx@un.org`.

**Borrador EN** — Asunto: *"Faro VE — open data to connect our searches (Venezuela earthquake)"*
CCO verificados (alta confianza, vistos en sitio oficial): `hdx@un.org`, `info@hotosm.org`, `data@ushahidi.com`, `info@mapaction.org`, `familylinks@icrc.org`.
> ⚠️ Si el clasificador estaba caído al cierre, este borrador EN puede no haberse creado — **reintentar `create_draft`** con esos datos. Cuerpo en inglés guardado abajo.

**Contactos solo formulario/redes (contacto manual):**
- ICRC RFL: familylinks.icrc.org · Venezuela Te Busca: IG @juliaamariano · Desaparecidos Terremoto VE: desaparecidosterremotovenezuela.com · SOS Venezuela 2026: sosvenezuela2026.com · ACNUR/OCHA VE: unocha.org/venezuela
- ReliefWeb `submit@reliefweb.int` (confianza MEDIA — confirmar visual en reliefweb.int/contact antes de usar).
- Google Crisis Response: solo formulario (crisisresilience.google/partnerships); Person Finder archivado/read-only desde 17-sep-2025.
- HDX: además del email, **registrar el dataset** en data.humdata.org.

---

## 🟡 Pendientes del founder

1. **Worker:** `cd ~/Desktop/faro-ve/workers/cron-ingest && wrangler deploy` (cron `*/5` + ingesta no-drop).
2. **Migraciones SQL Editor (Supabase):** `0027` (2 pasos por CONCURRENTLY) y `0028` — listas para pegar.
3. **Email Routing** (panel CF): el DNS YA tiene Email Routing habilitado (MX `route1/2/3.mx.cloudflare.net`
   + SPF). Falta SOLO: verificar destino `bleiquelc@gmail.com` + crear reglas `opt-out@`/`contacto@`/
   `federacion@` (+ catch-all). Follow-up: cron regla #10 (Gmail MCP, `to:opt-out@faro-ve.com`).
4. **Pushear `6ec25b1`** (página `/atribucion`, commit local sin pushear) + deploy.
5. **Outreach:** revisar/enviar borradores ES (13 CCO) + EN nuevo (11 CCO); borrar 2 borradores ES viejos.

### ✅ Cerrado el 28-jun (esta sesión)
- **`git push` HECHO:** 78 commits (no 9 — origin/main estaba muy atrás), escaneo de secretos limpio.
  `8a699cd → 601bad1`, repo sincronizado. Smoke prod verde (conteo 26.150).
- **EN inicial ENVIADO** por el founder. ES ampliado + EN nuevo creados (no enviados).
- **`/atribucion` construida** (commit local `6ec25b1`, falta push/deploy).

---

## 🗺️ Roadmap de federación (lo que Claude puede seguir)

- **Cloudflare Email Routing** para los @faro-ve.com (resuelve el crítico).
- Feeds CSV-HXL (para OCHA/HDX). · Sync incremental `?updated_since` en `/api/pfif`. · Múltiples `<note>` por avistamiento en PFIF.
- `/.well-known` + DCAT `data.json` (catálogo de datos). · Validar contra el repo de prueba de Google Person Finder.
- Endpoint de **import entrante** PFIF (bidireccional; token por fuente, NUNCA service_role).
- Versión en inglés del email ✅ (hecha). Registro de dataset en HDX (founder + Claude).

---

## 🔒 Restricciones que siguen vigentes (no violar)

- No deploy a prod ni acciones irreversibles sin OK explícito. Secretos (service_role, Anthropic, anon) NUNCA por chat — el founder los pone con wrangler.
- El sandbox no llega a la DB (sin IPv6); migraciones por SQL Editor; worker deploy lo corre el founder (clasificador lo bloquea).
- Chat de Auxilio SIN IA (flag `AI_ENABLED` — no reactivar). Coords públicas ofuscadas; PII reportante nunca expuesta; foto de menores nunca; atribución + opt-out obligatorios; PFIF 1.4 canónico (no tocar campos estándar). Solo info PÚBLICA en federación.
