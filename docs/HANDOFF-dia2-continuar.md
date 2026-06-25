# HANDOFF — Faro VE · continuar (pegar esto en el próximo chat)

> Emergencia humanitaria. Sitio LIVE en https://faro-ve.com salvando vidas con data real.
> Founder: Bleiquel Colina (solo, en Suiza). Su aporte = esta plataforma + soporte (NO rescate directo).
> Lee primero: este archivo, luego `CLAUDE.md`, `PLAN.md`, `docs/STATUS.md`, `docs/SPEC-aid-points-comunidad.md`.

## 🟢 LIVE en producción (faro-ve.com) — verificado
- **Home = mapa vivo de fondo** (papel tapiz) + faro con halo + texto/botones flotando (sin tarjeta). "Ver el mapa" → `/mapa`.
- **`/mapa`**: mapa interactivo (CARTO Voyager, con vida), nav flotante **Inicio / Buscar / Estoy bien**, buscador por nombre.
- **`/persona/[id]`**: ficha SSR; muestra coord exacta + NavigateButton SOLO para `safe_self_report` con opt-in.
- **Data REAL cargada**: ~17.339 personas de venezuela-te-busca (16.382 desaparecidas + 957 a salvo), auto-aprobadas, con atribución. (Ver "Ingesta" abajo.)
- 2 correos en footer: **contacto@** (general) + **opt-out@** (cumplimiento). Aún NO reciben (falta Email Routing).

## 🗺️ bbox-loading (mostrar TODAS las personas) — ✅ DESPLEGADO + VERIFICADO
PostgREST topa en 1000 filas/request, así que el mapa carga por **viewport (bbox)** y acumula deduplicado
al mover/zoomear → se ven las 17k+ explorando. La **búsqueda por nombre** carga todas las coincidencias y
encuadra el mapa. Archivos: `src/lib/components/Map.svelte`, `src/routes/mapa/+page.svelte`, `api/persons` (bbox+order).
Revisión adversarial: 13 hallazgos reales, **0 bloqueantes**, todos los de correctitud/rendimiento aplicados:
clamp + `maxBounds` Venezuela (no world-wrap → no vistas en blanco), `.order('created_at')` (truncado
determinista), `addLayers` en bloque + `chunkedLoading`, aviso "Acércate para ver más" en zonas densas,
conteo honesto ("N en vista"), techo de 7000 marcadores con recarga, API valida/ignora bbox inválido.
Verificado en vivo: bbox La Guaira → 1000, mar → 0 (filtro espacial OK).
Mejora futura (no bloqueante): badge de total exacto (count head) y AbortController en panning.

## 🟡 LISTO pero requiere ACCIÓN del founder ("Level B")
Estos flujos están construidos + revisados, pero NO funcionan hasta setear secretos (el classifier exige
que TÚ corras lo de DB/secretos):

**Activar envío de reportes (formularios) + fotos:**
```bash
cd ~/Desktop/faro-ve && npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=faro-ve
```
```bash
cd ~/Desktop/faro-ve && npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=faro-ve
```
```bash
cd ~/Desktop/faro-ve && npx wrangler pages secret put PUBLIC_TURNSTILE_SITE_KEY --project-name=faro-ve
```
Luego: `cd ~/Desktop/faro-ve && npm run build && npm run deploy:pages`. (Claves Turnstile: Cloudflare → Turnstile, widget para faro-ve.com. service_role: Supabase → API.)

**Correos que RECIBAN (Email Routing, ~5 min, juntos cuando estés en casa):**
Cloudflare → faro-ve.com → Email → Email Routing → Enable → destino (tu bandeja o NEXVYVE, confírmalo) →
rutas `contacto@` y `opt-out@` → destino. Cloudflare agrega los MX.

## ⚙️ Migraciones aplicadas esta sesión (0010–0012, YA en prod DB)
- `0010` teléfono opt-in + RPC `create_person_report` (cifra PII en DB, + photo_url).
- `0011` bucket privado `report-photos`.
- `0012` **fail-safe foto de menor** (edad desconocida + foto → admin_only).

## 📥 Ingesta de data real (venezuela-te-busca)
- Fuente `venezuelatebusca.com` → redirige a `venezuela-te-busca-app.hellogafaro.workers.dev` (SPA React Router; datos en `/_root.data`, turbo-stream).
- **NO da coordenadas** (solo texto de lugar `lastSeen`) → se geocodifica (tabla Vargas/Caracas). Pins a nivel barrio/ciudad. Cobertura ~82% (17.339 de 21.176).
- **NO se republica PII del reportante** (la fuente la expone; nosotros no).
- Script: `scripts/ingest/venezuela-te-busca.mjs` (`--dry` / `--apply`, idempotente por source_id).
- **Re-correr / actualizar** (idempotente):
```bash
cd ~/Desktop/faro-ve && DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/ingest/venezuela-te-busca.mjs --apply
```
- **Mejora pendiente**: subir cobertura de geocodificación (ampliar tabla o fallback Nominatim) → más de las ~4k restantes al mapa.

## 📋 Backlog priorizado (decisiones del founder ya tomadas)
1. **Capa de lugares de servicio + autorregulación** — spec completo en `docs/SPEC-aid-points-comunidad.md`.
   Confirmado: registro abierto (verificación mínima, visible al instante con badge "sin verificar");
   votación confirmar/reportar (1/IP); **net ≥ 3 → auto-ocultar** (reversible) + alerta founder;
   **reactivación exige WhatsApp** del que reactiva → se envía al founder (cifrado, no público).
2. **Reporte de desaparecido exige WhatsApp** del reportante (verificar que es real) — YA en el form
   `reportar/desaparecido` (cifrado, no público). Falta lo análogo en otros forms si aplica.
3. **Tapar cara de menores** (en vez de ocultar la foto): detección de rostro en cliente (BlazeFace/MediaPipe
   lazy) + blur del recuadro; fail-safe → si no detecta cara, oculta. Aplica también a fotos ingestadas.
4. **Geocodificación** mejor (cobertura) para la ingesta.

## 🔒 Reglas duras vigentes (CLAUDE.md, 31 reglas)
Coords públicas ofuscadas (salvo opt-in safe_self_report); PII reportante nunca pública; foto de menor
nunca pública; navegación "Llegar aquí" SOLO lugares de servicio u opt-in; atribución + opt-out 24h;
deploys/DB **solo founder con OK**; revisión adversarial multi-agente sobre código nuevo ANTES de prod.

## Estado de procesos al cerrar la sesión
- Ingesta `--apply`: corriendo en background (inserción fila-por-fila, ~40 min; idempotente).
- Revisión adversarial bbox: corriendo. (Resultado + deploy quedan registrados en el commit/STATUS.)

## Verificación rápida (lectura pública, sin secretos)
```bash
curl -s https://faro-ve.com/api/persons | grep -oE '"count":[0-9]+'
```
```bash
curl -s "https://faro-ve.com/api/persons?bbox=-67.1,10.5,-66.7,10.7" | grep -oE '"count":[0-9]+'
```
(El segundo, una vez desplegado el bbox, devuelve las personas de la zona de La Guaira.)
