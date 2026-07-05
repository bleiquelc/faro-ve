# Sesión 2026-07-05 — Revisión de sistema + semana IG pre-programada + fix "red al despertar"

> Pedido del founder: revisar el sistema, actualizar reportes y dejar programadas las
> publicaciones de Instagram de la próxima semana, para poder reiniciar el chat con el
> sistema actualizado y protegido.

## 1. Diagnóstico de la revisión

**Salud en vivo (verificada 19:07–19:20 CEST):**
- 6 endpoints públicos **200** (home, /reencuentros, /auxilio, /api/persons, /api/aid-points, /api/pfif).
- Total personas: **46.485** (+55 desde el 2-jul) → el worker cron-ingest sigue ingiriendo (enumeración por términos, cola dispersa = crecimiento lento esperado).
- Cron IG de fichas (`com.farove.ig`, 1/h): ACTIVO. 64 fichas posteadas en total, 4 reencuentros detectados. Las últimas corridas publican 0 — el filtro IA de fotos rechaza el tramo actual de candidatos (flyers/cédulas/grupos) → por diseño (solo foto limpia); reintenta cada 3 días.
- Monitoreo nube (scheduled tasks): `busqueda-familia-guerrero-horaria` (Peña + Yordy, cada hora) · `reporte-familia-guerrero-amanecer` (07:37) · `faro-soporte-correos` (06/13/19h). Los tres `enabled`. Guerrero sigue cerrado (2-jul), no se reactivó.
- 🔴 **La fuga de clave sigue**: `curl faro-ve.com | grep sb_` → `sb_secret`. El founder aún no rotó.

**Causa raíz encontrada — reels perdidos 3/4/5-jul:** launchd (`com.farove.reel`, 09:00) corre al DESPERTAR el Mac, antes de que la red esté lista. `fetch` a api.buffer.com (y Pexels) moría con `UND_ERR_CONNECT_TIMEOUT` y el script salía con error, sin reintento. Resultado: los mp4 se generaron y quedaron hospedados en `fichas-cdn`, pero `createPost` nunca se ejecutó → **@farovenmap sin reel del pipeline desde el 2-jul** (el reel "sent" de hoy 13:00Z salió re-programado a mano desde Buffer). La misma carrera de red produjo los **8 falsos "endpoint caído" (HTTP 0)** del mantenimiento de hoy 09:00.

## 2. Blindaje aplicado (Ley de Reuso: extender, no reconstruir)

| Archivo | Cambio |
|---|---|
| `scripts/reel/daily-reel.mjs` | Espera la red (10×30s contra api.buffer.com) · idempotencia por fecha vía `~/.faro-ig/reel-scheduled.json` · genera con `REEL_DATE` = día del dueAt (nombre/versículo correctos aunque corra tarde) |
| `scripts/buffer/reel-post.mjs` | Reintentos 6×45s · **exit 1** si Buffer no confirma `post.id` (antes salía 0 incluso con MutationError) · registra `{fecha: {id, dueAt, video}}` en el estado · etiqueta horaria Madrid real (antes "(18:00 Madrid)" hardcodeado) |
| `scripts/reel/make-reel.mjs` | `REEL_DATE=YYYY-MM-DD` para pre-generar reels de fechas futuras (rotación de versículo+footage por ese día) |
| `scripts/maintenance/daily.mjs` | Sonda a un tercero (`cloudflare.com/cdn-cgi/trace`) hasta 5 min; sin red → 1 alerta honesta "SIN RED LOCAL" + omite chequeos del sitio y reconcile (discrimina caída real de sitio vs. falta de red local) |

Sintaxis verificada (`node --check` ×4) + corrida real de mantenimiento → **"todo sano ✅"**.

## 3. Semana IG protegida (6→12 jul)

**7 reels pre-programados en Buffer con `dueAt` absoluto → publican server-side aunque el Mac esté dormido/apagado:**

| Fecha (16:00 Madrid) | Versículo | Footage (Pexels) | Buffer post id |
|---|---|---|---|
| 6-jul | Juan 1:5 | tropical coast aerial | `6a4a916ec109183ee85961d8` |
| 7-jul | Salmos 147:3 | mountains sunrise clouds | `6a4a9179dd9abec2b40b1361` |
| 8-jul | Josué 1:9 | calm ocean horizon | `6a4a918fc109183ee85962ab` |
| 9-jul | Salmos 91:1 | coast dawn | `6a4a91ab6917141d45484292` |
| 10-jul | Juan 14:1 | serene sea sky | `6a4a91bab3f33d21402f23fa` |
| 11-jul | Isaías 40:31 | **Caracas Venezuela** | `6a4a91c89dd66bf2fd58c316` |
| 12-jul | Salmos 121:7 | **La Guaira Venezuela** | `6a4a91d76917141d454843fd` |

- Verificado en Buffer: `posts(filter:{status:[scheduled]})` devuelve exactamente esos 7.
- Test de idempotencia REAL: `node scripts/reel/daily-reel.mjs` → "reel del 2026-07-06 ya programado (…) — nada que hacer". El launchd diario NO duplicará; desde el **13-jul** retoma la generación normal ya blindada.
- Los mp4/captions viven en `~/Desktop/faro-reels/` y en la rama `fichas-cdn/reels/`.
- El cron horario de fichas sigue publicando solo (no necesita programación; es event-driven por corrida).

## 4. Limpieza operativa

- `~/.faro-ig/cron.err.log` y `reel.err.log` archivados como `*.2026-07-05.bak` y truncados (eran los stack traces ya diagnosticados; así la alerta "errores nuevos" del mantenimiento vuelve a ser señal real).
- `~/.faro-ig/reel-scheduled.json` = nuevo estado de idempotencia (7 entradas).

## 5. Pendientes founder (sin cambios, re-verificados hoy)

1. 🔴 **Rotar la clave Supabase** (faro-ve.com sigue inyectando `sb_secret_`): rotar secret + `PUBLIC_SUPABASE_ANON_KEY`=publishable + `SUPABASE_SERVICE_ROLE_KEY`=nueva secret. Verificar: `curl -s https://faro-ve.com/ | grep -o 'sb_[a-z]*'` → debe decir `sb_publishable`.
2. Migración **0027** (idempotencia cola offline) — SQL Editor, 2 pasos.
3. Migración **0031** (borrado self-service) — hasta entonces `POST /api/persons/[id]/remove` da 502.
4. `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` → re-geocodifica los ~46k puntos viejos una sola vez.
5. Verificar **Cloudflare Email Routing** (opt-out@/contacto@/federacion@) — reglas #8/#10.

## Commits de esta sesión

- `fix(reel,maintenance): sobrevivir al Mac despertando sin red — espera de red + reintentos Buffer + fallo duro + idempotencia por fecha + REEL_DATE`
- `docs: estado 5-jul — revisión de sistema + semana IG pre-programada (6–12 jul)`

(Sin push — lo hace el founder. Archivos sueltos de sesiones previas — `faro-*.png`, `scripts/render-*.mjs`, handoffs — quedaron sin tocar.)
