# Sesión 12-jul-2026 — Revisión de sistema + fix de alertas por errores viejos

> Pedido del founder: "revisa funciones del sistema, actualiza datos, analiza que toda
> la plataforma esté trabajando bien, si encuentras mejoras las aplicas".

## Revisión (todo verificado en vivo)

| Área | Estado | Evidencia |
|---|---|---|
| Sitio + APIs | 🟢 | 9 rutas/APIs 200 (home 0.16s, mapa, auxilio, datos, atribución, privacidad, reencuentros, persons, aid-points, pfif) |
| Datos | 🟢 | 46.765 personas (+27 hoy, +59 ayer — la ingesta del mantenimiento suma sola; cursor término 432/465) |
| launchd | 🟢 | `com.farove.ig` 0 · `com.farove.reel` 0 · `com.farove.maintenance` 1 (por la alerta de errores viejos, ver fix) |
| Cron IG | 🟢 | Publicó a Elidivith 08:22 · 90 posteadas, 8 reencuentros · rechazos = filtro IA por diseño (flyers/homónimos) |
| Reel diario | 🟢 | Reel de hoy programado en Buffer (último de la semana blindada 6→12 jul); corridas recientes limpias ("ya programado, nada que hacer"); desde el 13-jul el launchd genera de nuevo a diario |
| Mantenimiento 09:00 | 🟢 | Corrió, endpoints 200, ingesta +27, reconcile+seed OK |
| err.logs | 🟢 | `reel.err.log` y `maintenance.err.log` en 0 bytes; `cron.err.log` tenía errores VIEJOS del 9-jul (ver fix) |
| 🔴 Fuga clave | **SIGUE** | `curl -s https://faro-ve.com/ \| grep -o 'sb_[a-z]*'` = `sb_secret` — pendiente founder desde 2-jul |

## Problema encontrado y arreglado

**La alerta "cron IG tiene errores" llevaba 3 días (10, 11 y 12-jul) disparándose por
errores del 9-jul ya resueltos** (4× `ENOTFOUND faro-ve.com` = DNS al despertar el Mac,
+ 1 `SocketError` transitorio contra la API de Anthropic). Causa: `daily.mjs:133` alertaba
si `cron.err.log` pesaba >0 bytes y **nadie lo archivaba nunca** (el 5-jul se archivó a
mano; el patrón no estaba automatizado).

**Fix (`b388f72`, Ley de Reuso — se extendió el orquestador existente):**
- `alertAndArchiveErrLog()`: err.log con contenido → alerta UNA vez + archiva a
  `<err.log>.<fecha>.bak` (**truncate, no rename**: launchd re-abre el path en cada corrida).
- Se vigila también `reel.err.log` (antes nadie lo miraba).
- Nueva verificación: el **reel de AYER** quedó programado en Buffer
  (`reel-scheduled.json`); se mira ayer y no hoy porque el job del reel corre a la
  misma hora que el mantenimiento (carrera).

**Verificación end-to-end:** 1.ª corrida (`MAINT_HEALTH_ONLY=1`) alertó y archivó
(2105 bytes → `cron.err.log.2026-07-12.bak`, live 0 bytes); 2.ª corrida **"todo sano ✅"
exit 0** (antes habría re-alertado). Reporte de la mañana preservado y restaurado.

## Git al día

El trabajo del 8-jul corría en producción sin versionar → commiteado:
- `08e7c59` feat(maintenance): ingesta incremental diaria integrada al mantenimiento.
- `0bf6364` docs: estado 8-jul + sesión 28-jun federación + handoffs.
- `b388f72` fix(maintenance): alertas una-vez + vigilancia reel (esta sesión).

Sin versionar a propósito: `scripts/render-{conexion,ig,story}.mjs` + PNGs de sesión
(assets efímeros, patrón de sesiones previas). **Sin push** (requiere OK founder).

## Pendientes founder (sin cambios, por prioridad)

1. 🔴 **ROTAR clave Supabase → publishable** — la fuga `sb_secret_` sigue viva en el HTML (desde 2-jul).
2. Migraciones **0027** (idempotencia offline) y **0031** (borrado self-service) en el SQL Editor.
3. `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` → re-geocodifica los ~46k viejos.
4. Verificar Cloudflare Email Routing (opt-out@/contacto@/federacion@ → bleiquelc@gmail.com).
5. Opcional 24/7: plan Workers en CF (el cron `*/5` del worker sigue sin disparar en cuenta free).
