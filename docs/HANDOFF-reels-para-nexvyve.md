# HANDOFF — Copiar y adaptar el sistema de Reels automáticos de Faro VE a NEXVYVE

> **Para:** chat de Claude Code encargado de Instagram NEXVYVE (cwd `~/Desktop/nexvyve-app`).
> **De:** equipo Faro VE. El founder autoriza copiar este sistema HACIA NEXVYVE.
> **Regla de repos:** puedes LEER `/Users/bleiquelcolina/Desktop/faro-ve` como referencia (read-only).
> **NUNCA modifiques nada dentro de faro-ve.** Copia los archivos a tu repo y adáptalos ahí.
> **Ley de Reuso:** este pipeline está perfeccionado y probado end-to-end en producción
> (@farovenmap publica 1 Reel/día desde el 1-jul-2026, $0 de costo, 0 tokens de IA).
> NO lo re-implementes distinto ni más lento: cópialo y adapta solo contenido + marca + destinos.

---

## 1. Qué hace el sistema (visión completa)

Un Reel de Instagram **por día, 100% automático, costo $0**:

1. **09:00 local** un launchd dispara `daily-reel.mjs`.
2. `make-reel.mjs` genera el video del día (15s, 1080×1920):
   - **Contenido rotativo**: elige el mensaje del día de `messages.json` por día-del-año (`doy % messages.length`) → nunca repite hasta agotar la lista, sin estado que mantener.
   - **Footage**: `footage.mjs` busca en **Pexels API** (gratis, libre de derechos, uso comercial OK) un video portrait, rotando la búsqueda por día entre una lista `QUERIES`. Descarga el mp4. Si no hay key o no hay resultados → fallback a una escena propia renderizada (`bg.html`) con efecto Ken Burns. **El pipeline nunca falla por falta de footage.**
   - **Overlay de marca**: Playwright abre `overlay.html` (1080×1920, fondo transparente), inyecta el texto del día por `page.evaluate`, ajusta el **font-size adaptativo según longitud** (para que nunca se corte), espera `document.fonts.ready` y saca screenshot PNG con `omitBackground: true`.
   - **Composición ffmpeg**: escala/crop del footage a 1080×1920, trim 15s, overlay del PNG, fade in 0.8s + fade out 1s, `libx264 -crf 22`, `+faststart`. **Conserva el audio natural del clip** (`-map 0:a?` → olas/ambiente; si no hay, va sin audio).
   - **Salidas** en `~/Desktop/faro-reels/`: full mp4 + preview 540×960 (para revisar en chat) + póster PNG + **`.caption.txt`** (mensaje + crédito Pexels + hashtags) + `.credit.txt`.
3. `daily-reel.mjs` calcula `dueAt` = hoy 16:00 hora local (si ya pasó → mañana) y llama a `reel-post.mjs`.
4. `reel-post.mjs` **hospeda el mp4 en una URL pública** (git worktree → rama `fichas-cdn` → `raw.githubusercontent.com/...`) y crea el post en **Buffer GraphQL** como Reel con hora absoluta.
5. **Buffer publica server-side a las 16:00 aunque el Mac esté dormido** — esa es la clave del diseño: generar temprano + programar con `dueAt` absoluto, en vez de un cron a la hora de publicar.

Guardrails: kill-switch (`touch ~/.faro-ig/paused` o `FARO_IG_PAUSED=1`), modo `DRY=1` (genera sin publicar), logs en `~/.faro-ig/reel.log` / `reel.err.log`.

---

## 2. Archivos a copiar (léelos de faro-ve, pégalos adaptados en tu repo)

| Archivo en `~/Desktop/faro-ve/` | Qué es |
|---|---|
| `scripts/reel/make-reel.mjs` | Generador del video (Playwright + ffmpeg). Corazón del sistema. |
| `scripts/reel/footage.mjs` | Cliente Pexels: búsqueda portrait rotativa + descarga + crédito. |
| `scripts/reel/messages.json` | Contenido rotativo (en Faro: 22 versículos; en NEXVYVE: tus mensajes). |
| `scripts/reel/overlay.html` | Overlay de marca 1080×1920 transparente (panel glass + logo + pie). |
| `scripts/reel/bg.html` | Escena fallback propia (si no hay footage). |
| `scripts/reel/daily-reel.mjs` | Orquestador diario: genera → calcula dueAt → publica. Kill-switch + DRY. |
| `scripts/reel/preview-next.mjs` | Preview de los próximos N días (mensaje + tema de fondo) sin generar nada. |
| `scripts/reel/com.farove.reel.plist` | launchd 09:00 diario. |
| `scripts/buffer/reel-post.mjs` | Publicador: hospeda mp4 en URL pública + Buffer `createPost` tipo reel. |
| `scripts/buffer/buffer-ids.mjs` | Resuelve `organizationId` y `channelId` de Buffer (correr 1 vez). |

Dependencias: **Node**, **`@playwright/test`** (chromium instalado), **ffmpeg** (busca `~/bin/ffmpeg`, si no usa el del PATH). Nada más. Sin tokens de IA.

---

## 3. Qué DEBES cambiar para NEXVYVE (no publiques a Faro por accidente)

1. **⚠️ `CHANNEL_ID` en `reel-post.mjs` está hardcodeado al IG de Faro** (`6a4190975ab6d2f106819d3d` = @farovenmap). Si no lo cambias, publicarías reels de NEXVYVE en la cuenta humanitaria de Faro. Corre `buffer-ids.mjs` con la key del founder para listar canales y toma el channelId del IG de NEXVYVE (el founder debe tener ese IG conectado como canal en Buffer, y la cuenta debe ser **Business/Creator** — si es personal, Buffer solo manda recordatorio, no auto-publica).
2. **Secretos**: la key de Buffer vive en `~/.secrets/faro-ve/buffer-key.txt` (es la key personal del founder, sirve para toda la org Buffer). Crea tu propia copia en `~/.secrets/nexvyve/buffer-key.txt` — no leas del directorio de faro-ve. Igual con Pexels: key gratis en https://www.pexels.com/api/ (25k req/mes) → `~/.secrets/nexvyve/pexels-key.txt`.
3. **Hosting del mp4**: Buffer SOLO acepta media por **URL pública** (él la descarga). Faro usa un git worktree → rama `fichas-cdn` de su repo → raw.githubusercontent. Para NEXVYVE usa una rama CDN de TU repo, o mejor **Firebase Storage** (ya lo tienen) con URL pública. No uses la rama de faro-ve.
4. **Paths y nombres**: `REPO` hardcodeado, dir de salida (`~/Desktop/faro-reels` → `~/Desktop/nexvyve-reels`), dir de estado (`~/.faro-ig/` → `~/.nexvyve-ig/`, para NO compartir kill-switch ni logs con Faro), label launchd (`com.farove.reel` → `com.nexvyve.reel`).
5. **Marca en `overlay.html`**: reemplaza logo/wordmark/colores por el canon NEXVYVE (lima `#A8E600`, Inter, "NEXT IS YOU."). Pasa el resultado por `nexvyve-brand-guardian` antes de mostrar al founder. Conserva el patrón técnico: fondo transparente, panel translúcido para legibilidad sobre cualquier video, font-size adaptativo por longitud, `omitBackground: true`.
6. **Contenido (`messages.json`)**: el founder te dará las ideas en este chat. Mantén el formato `[{text, ref}]` (o adapta campos) y la rotación por día-del-año — es lo que hace el sistema sin estado.
7. **`QUERIES` de footage**: cambia los temas (en Faro: Venezuela/mar/costa serena) por temas fitness/NEXVYVE (gym, running, sunrise workout, etc.). Regla que NO se negocia: **solo footage libre de derechos** (Pexels/Coverr/Pixabay). Nunca descargar/repostear videos ajenos de IG — copyright + ToS + riesgo de baneo. Crédito Pexels en el caption (no obligatorio por licencia, pero lo incluimos).
8. **Horario**: Faro publica 16:00 Madrid. Elige tu hora con el founder y ajusta el `d.setHours(...)` en `daily-reel.mjs`. El Mac está en Europe/Zurich (= Madrid, DST-safe).
9. **Política de publicación NEXVYVE**: las normas del equipo NEXVYVE dicen "nunca auto-publicar", pero el founder está pidiendo explícitamente reels automáticos. **Confirma con él el modo**: (a) auto-publicar y él revisa/borra (modelo Faro), o (b) generar a las 09:00 y programar en Buffer con varias horas de margen para que pueda borrar el post programado antes de que salga, o (c) `DRY=1` permanente y él aprueba cada día. La opción (b) es un buen término medio.

---

## 4. Detalles técnicos ganados con sangre (no re-aprender)

- **Buffer GraphQL** (beta 2026): endpoint `https://api.buffer.com`, `Authorization: Bearer <key>`. Mutation exacta en `reel-post.mjs`: `createPost(input:{ text, channelId, schedulingType: automatic, mode: customScheduled, dueAt, assets:[{video:{url}}], metadata:{instagram:{type: reel, shouldShareToFeed: true}} })` → `... on PostActionSuccess { post { id dueAt } } ... on MutationError { message }`.
- **El asset de video NO acepta `altText`** (eso es solo de imagen) → `video:{url}` a secas, o Buffer devuelve error.
- La key de Buffer se crea en `publish.buffer.com/settings/api` y se copia con el botón Copy (una key "vieja" de 147 bytes resultó inválida; la buena tiene ~43 bytes).
- **Rate limits**: Buffer Free ~100 req/24h; IG ~25–50 posts/día. Para 1 reel/día sobra.
- **Generar temprano + `dueAt` absoluto** > cron a la hora de publicar: el launchd de las 09:00 corre con el Mac despierto; Buffer publica a la hora exacta server-side aunque el Mac duerma.
- El `git push` desde launchd puede fallar por auth del keychain → si el log muestra error de push del CDN, migrar hosting a Storage. Por eso `reel-post.mjs` imprime la URL hospedada: verifícala con curl la primera vez.
- El plist usa `/usr/local/bin/node` — verifica con `which node` y ajusta (Homebrew ARM = `/opt/homebrew/bin/node`). Incluye `PATH` con `/opt/homebrew/bin` para que encuentre ffmpeg.
- ffmpeg: el filtro para footage real es `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,trim=0:15` + overlay + fades; el fallback usa `zoompan` (Ken Burns) sobre el PNG de `bg.html`. Copia los filtros tal cual de `make-reel.mjs`.
- Pexels: filtrar `orientation=portrait` Y re-filtrar `v.height > v.width` (la API a veces mete landscape); elegir el mp4 más chico con alto ≥1280 (calidad suficiente, descarga rápida).
- `preview-next.mjs` le muestra al founder los próximos N días (mensaje + tema) en segundos, sin generar nada — úsalo para que valide el calendario de contenido.

---

## 5. Checklist de instalación (en orden)

```bash
# 0. Leer los archivos fuente (read-only) desde faro-ve y copiarlos adaptados a tu repo
# 1. Dependencias
npm i -D @playwright/test && npx playwright install chromium
which ffmpeg   # si no está: brew install ffmpeg

# 2. Secretos
mkdir -p ~/.secrets/nexvyve
# pegar key de Buffer (publish.buffer.com/settings/api) → ~/.secrets/nexvyve/buffer-key.txt
# pegar key de Pexels (pexels.com/api) → ~/.secrets/nexvyve/pexels-key.txt

# 3. IDs de Buffer (canal IG de NEXVYVE, debe estar conectado en Buffer como Business/Creator)
node scripts/buffer/buffer-ids.mjs   # → anotar channelId del IG NEXVYVE

# 4. Probar generación SIN publicar
DRY=1 node scripts/reel/daily-reel.mjs   # revisa el preview 540×960 con el founder

# 5. Probar publicación real 1 vez (hora cercana) y verificar en IG
# 6. Instalar launchd (com.nexvyve.reel) y verificar log al día siguiente
# 7. Documentar kill-switch para el founder: touch ~/.nexvyve-ig/paused
```

**Costo total: $0/mes** (Pexels free, Buffer free, sin IA). Tiempo de generación: ~1 min/reel.
