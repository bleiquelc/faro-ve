# HANDOFF — Faro VE · continuar (pegar/leer esto en el chat nuevo)

> Emergencia humanitaria. **faro-ve.com LIVE** salvando vidas con data real.
> Founder: Bleiquel Colina (solo, en Suiza). Modo automático, **velocidad CON rigor**:
> revisión adversarial multi-agente sobre código nuevo ANTES de prod; **deploys / DB /
> secretos solo con OK explícito del founder**; comandos para el founder SIEMPRE en bloque de código.
> Lee primero: este archivo, luego `CLAUDE.md`, `docs/STATUS.md`, `docs/SPEC-aid-points-comunidad.md`.

## 🟢 LIVE en producción (faro-ve.com) — verificado
- **Mapa**: 13.791 personas REALES (fuente venezuela-te-busca). **Datos de prueba eliminados** (ver abajo).
- **Burbujas por ZONA con conteo REAL** (no el tope de 1000): RPC `persons_clusters` (migración 0015,
  SECURITY DEFINER, solo agregados sobre coords ofuscadas, #1). A zoom país una burbuja con el total real
  (~13.357 La Guaira/Caracas); al acercar se separa en zonas/ciudades; a zoom≥13 pines individuales.
- **Persistencia de zona**: al volver de ver una persona, el mapa restaura centro+zoom (sessionStorage) →
  el usuario sigue buscando donde estaba.
- **Capa de lugares de servicio + autorregulación comunitaria** (migración 0014): alta pública (visible al
  instante, sin verificar, coords EXACTAS), votos confirmar/reportar (1/IP, net≥3 → auto-ocultar reversible
  + alerta founder en `founder_alerts`), reactivación con WhatsApp cifrado (RPC admin auditado
  `get_aid_point_reactivator_phone`). Endpoints + form `/reportar/punto-ayuda` + ficha `/punto/[id]` + capa
  en el mapa (chip "Ayuda" → `?aid=1`).
- **Mobile**: zoom +/- 44px elevado sobre la nav, popups con auto-pan, filtros COMBINABLES (estado
  single-select + Menores/Urgencia toggles), botón **Actualizar** PWA-aware, iconos faro minimalistas
  (cache-bust `?v=3`), animaciones de la luz más lentas/suaves.
- **Migraciones aplicadas en prod: 0001–0015** (verificadas en `_faro_migrations`). 0014 con gate PASS
  (`scripts/verify-aid-points.mjs`).
- **Privacidad verificada**: patrón vista-como-owner (anon NO lee tablas base `persons`/`aid_points`, solo
  las vistas `persons_public`/`aid_points_public`). `revoke select on aid_points from anon, authenticated` (0014).

## 🔑 Secretos / escrituras (estado actual)
- ✅ **APP_SALT** seteado en Pages (faltaba; el config-guard ya pasa). Es el del Día 1
  (`~/.secrets/faro-ve/APP_SALT.txt`), NO se generó uno nuevo.
- ⏳ **SUPABASE_SERVICE_ROLE_KEY**: el founder lo re-seteó con la key correcta (verificada:
  `rol: service_role · proyecto blmiebnnprwaupyatsyb · 219 chars`), subida con `pbpaste` (sin truncar).
  **Falta confirmar el 200** — ambas IPs quedaron rate-limited (8/h) de tanto probar `/api/upload-url`.
  Confirmación directa (salta el rate-limit), el founder corre con la key en el portapapeles:
  ```bash
  KEY=$(pbpaste | tr -d '\n '); curl -s -X POST "https://blmiebnnprwaupyatsyb.supabase.co/storage/v1/object/upload/sign/report-photos/test.jpg" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" | head -c 200; echo
  ```
  `{"url":...,"token":...}` = ✅ escrituras 100% activas. (O en ~1h: `curl -s -X POST https://faro-ve.com/api/upload-url` → 200.)
- Histórico del bug: la service_role daba `Invalid Compact JWS` (truncada al pegar a mano). Fix = `pbpaste | tr -d '\n ' | npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=faro-ve` + redeploy.

## 🧹 Limpieza de datos hecha (prod)
- **30 perfiles `source='test'` ELIMINADOS** (seed de D2; mostraban "Fuente: test"). Total 13.821 → 13.791.
- **4 descripciones reales corregidas**: "test" era typo de **"tez"** (complexión). 0 perfiles dicen "test".
- ⚠️ NO re-correr `scripts/seed-test-persons.mjs` contra prod (re-mete los 30 de prueba).

## 📋 Pendientes priorizados
1. **Confirmar escrituras** (comando service_role arriba) → reportes + fotos + alta/voto/reactivación de puntos.
2. **#4 Tapar-cara de menores — NO desplegado, requiere blur SERVER-SIDE.** La revisión adversarial halló que
   el blur del-lado-cliente NO es verificable por el servidor (un reportante malicioso podría subir la cara sin
   difuminar como `photo_url_blurred` → exponer un menor = retroceso vs. ocultar). Por regla #3 (INVIOLABLE) se
   REVIRTIÓ. Estado actual SEGURO: foto de menor OCULTA. Diseño + blur verificado (24px+blur11) + plan
   server-side (Cloudflare Image Resizing / WASM / Edge Function) en **`docs/HANDOFF-tapar-cara-menores.md`**.
   Decisión del founder pendiente: (A) server-side [recomendado], (B) cliente+moderación, (C) seguir oculto.
3. **Geocodificación / re-ingesta**: el script `scripts/ingest/venezuela-te-busca.mjs` está ARREGLADO
   (la fuente cambió paginación → estaba estancado en pág 1; ahora `page`/`hasMore`) + geocoder nacional
   testeado (`scripts/ingest/geocode.mjs`, 85% cobertura vs ~24 entradas Vargas antes). **Re-correr la ingesta
   traería ~8-9k personas más al mapa** (la fuente tiene 25.516; el mapa tiene 13.791). Founder OK + ~40 min:
   ```bash
   cd ~/Desktop/faro-ve && DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/ingest/venezuela-te-busca.mjs --apply
   ```
4. **Email Routing** (Cloudflare → faro-ve.com → Email): `contacto@` y `opt-out@` aún no reciben.
5. **Del plan (D3+)**: panel `/moderar` (magic-link) + aprobar/rechazar, relay `/mensaje/[id]` anti-PII, resto
   de formularios (cuerpo-nn, avistamiento, refugio, condición-médica), PWA offline/sync, IA (chat/triage/health), i18n, PFIF export.

## 🛠 Operación
- Aplicar migraciones: `DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/apply-migrations.mjs`.
- Deploy: `cd ~/Desktop/faro-ve && npm run build && npm run deploy:pages`.
- Verificar: `npm run check` (svelte-check) · `npm run test` (vitest) · `npm run build`.
- Diagnóstico de errores en prod: `npx wrangler pages deployment tail <DEPLOY_ID> --project-name=faro-ve`
  (el `<DEPLOY_ID>` sale de `npx wrangler pages deployment list --project-name=faro-ve`).
- ~/.secrets/faro-ve/: `APP_SALT.txt`, `db-url.txt`, `anthropic-key.txt` (NO hay service_role file — está solo en Pages).

## 🔒 Reglas duras (CLAUDE.md, 31 reglas)
Coords de personas ofuscadas (salvo opt-in safe_self_report); PII reportante nunca pública; **foto de menor
NUNCA pública sin difuminar**; navegación "Llegar aquí" SOLO lugares de servicio (componente NavigateButton);
atribución + opt-out 24h; reportes públicos pending por defecto (aid_points visibles al instante, por diseño);
**deploys/DB/secretos solo founder con OK**; **revisión adversarial multi-agente sobre código nuevo ANTES de prod**.

## Verificación rápida (lectura pública, sin secretos)
```bash
curl -s "https://faro-ve.com/api/persons?count=exact"
```
```bash
curl -s "https://faro-ve.com/api/persons/clusters?bbox=-73.4,0.6,-59.8,12.3&zoom=6"
```
