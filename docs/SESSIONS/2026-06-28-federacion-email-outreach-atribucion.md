# Sesión 2026-06-28 — Email Routing, outreach ampliado, push, /atribucion

> Continúa de `docs/HANDOFF-federacion.md`. Leer: CLAUDE.md · docs/STATUS.md · este archivo.
> Sin tocar el core del mapa/schema/RLS. Sin deploys autónomos.

## Hecho

1. **git push — 78 commits** (no 9): origin/main estaba muy atrás (varias sesiones: /moderar,
   avistamientos, Faro Auxilio, ingesta, federación…). Empujado con OK del founder tras escaneo de
   secretos: **limpio** (0 valores de llave, 0 APP_SALT en código, 0 `.env`). `8a699cd → 601bad1`,
   repo **sincronizado** (`0 0`). El sitio ya estaba live por wrangler; el push pone GitHub al día.

2. **Smoke prod `faro-ve.com` — VERDE:** páginas 200 (/ /mapa /buscar /datos /auxilio /reportar);
   APIs 200; CORS `ACAO:*` en /api/pfif; PFIF XML válido; GeoJSON FeatureCollection ofuscado;
   **conteo 26.150** (la ingesta del worker sigue viva). `/api/persons/clusters` 400 sin params =
   **por diseño** (200 con `bbox`+`zoom`). `/atribucion` daba 404 → ver punto 3.

3. **`/atribucion` construida** (cerró el 404; la carpeta existía vacía). **Commit LOCAL `6ec25b1`
   — NO pusheado.** Reusa el patrón de `/datos` (prerender, tokens faro-*). Lista las fuentes REALES
   (Venezuela Te Busca → venezuelatebusca.com + reportes propios `faro-ve`), atribución por record
   (`source`/`source_url`, regla #9), opt-out canónico `opt-out@faro-ve.com` SLA 24h (regla #8).
   Link **"Atribución"** agregado al footer del inicio. **svelte-check 0 err**, **build prerenderiza
   OK**, render confirmado en preview del build. El `500` en `vite dev` es **limitación conocida de
   TODA ruta `prerender=true`** del repo (confirmado: `/datos` da el mismo 500 en dev; toca
   `platform.env`, prohibido en prerender) — **en prod funciona** igual que /datos.

4. **Outreach ampliado (separado por idioma):**
   - **EN inicial ENVIADO** por el founder (HOT/Ushahidi/MapAction/ICRC familylinks/HDX).
   - Investigación **4 agentes** — SOLO emails vistos textual en sitio oficial (descartó los de
     buscadores: ACNUR real `vencauip@unhcr.org`, Esri `disaster_help@esri.com`). ⚠️ Seguridad:
     `standbytaskforce.org` SECUESTRADO (casino) → usar `.com`.
   - **2 borradores NUEVOS creados (NO enviados, To: founder, CCO):** ES (13 VE/LATAM:
     Cruz Roja caracas/la.guaira/charallave/maracay/valencia, Caritas, ACNUR, UNICEF, Coord. ONU,
     Venezuela Reporta, Desaparecidos Terremoto VE, SOS La Guaira, HOT Hub LATAM) + EN (11 globales:
     ICMP, REFUNITE, ICMEC, Missing Children Europe, Hala, Sahana, Esri Disaster, GISCorps,
     CLEAR Global/TWB, ReliefWeb, Centre for Humanitarian Data).
   - **MEDIA (confirmar a mano):** OCHA VHF `ocha-vhf@un.org`, Americares `dporstner@americares.org`.
     **Form-only:** PDC (apoya el sismo con DisasterAWARE), GDACS, Twilio.org Impact (crédito a ONGs).
   - Lista verificada guardada en memoria `[[faro-ve-federacion]]`.
   - ⚠️ **3 borradores ES** con el mismo asunto → quedarse con el más nuevo (13 CCO), borrar 2 viejos
     (el de firma `federacion@` y el de Cruz Roja Caracas+HDX). No hay API de borrado de drafts.

5. **Copy social** para video de registro en refugios → `docs/social/2026-06-28-copy-registro-refugios.md`.

## Email Routing (PRIORIDAD 1) — estado

- **Hallazgo:** el DNS de faro-ve.com **ya tiene Email Routing habilitado** (MX
  `route1/2/3.mx.cloudflare.net` + SPF `_spf.mx.cloudflare.net`). Falta SOLO en el panel:
  (1) verificar destino `bleiquelc@gmail.com`, (2) crear reglas `opt-out@`/`contacto@`/`federacion@`
  (+ catch-all). Verificación de entrega + cron regla #10 (Gmail MCP, `to:opt-out@faro-ve.com`) como
  follow-up. Resuelve el opt-out SLA 24h (regla #8) y revive la firma `federacion@` del borrador ES.

## Pendiente del founder (terminal/panel)

1. **Email Routing**: reglas + verificación en el panel.
2. **Migraciones SQL Editor**: `0027` (2 pasos por CONCURRENTLY) + `0028` — listas para pegar.
3. **Worker**: `cd workers/cron-ingest && wrangler deploy`.
4. **Pushear `6ec25b1`** (/atribucion) + deploy.
5. **Outreach**: revisar/enviar borradores ES (13) + EN (11); borrar los 2 ES viejos.

## Notas / coordinación

- Búsquedas familia **Guerrero** + gemelos **Peña**: otra sesión (read-only + scheduled-tasks).
  NO tocar. Verificado que nada de esta sesión rozó persons API / persons_public / enum `status`.
- Quedaron 2 dev servers corriendo (faro-dev:5173, faro-preview:4173) — inofensivos.
- Para regla #7 al 100% (footer en TODAS las páginas) faltaría un componente Footer compartido
  (hoy inline por página) — ítem aparte.
