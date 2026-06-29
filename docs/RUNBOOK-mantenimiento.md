# RUNBOOK — Mantenimiento diario automático de Faro VE

> Objetivo (Misión Art. 4): que Faro VE se cuide **solo**, alertando al founder **solo si algo está mal**,
> para liberar su tiempo hacia NEXVYVE y KAEL. Objetivo Art. 3: gastar lo mínimo de tokens/cómputo.

## Qué corre solo

| Pieza | Dónde | Cuándo | Qué hace |
|---|---|---|---|
| **`com.farove.maintenance`** | launchd (Mac) | **09:00 diario** (corre al despertar si el Mac dormía) | Orquestador: salud + reencuentros del día + reporte + alerta |
| `com.farove.ig` | launchd (Mac) | cada 1 h | Auto-publicador Instagram (2 fichas/corrida) |
| `faro-ve-cron-ingest` | Worker Cloudflare | `*/5` | Ingesta del conteo (la DB es IPv6, por eso vive en CF) |
| `faro-ve-ai-health` | Worker Cloudflare | 09:00 Caracas | Email "Faro Health" diario al founder |

## El orquestador diario — `scripts/maintenance/daily.mjs`

Cada día, en orden, y **escribe `~/.faro-ig/maintenance-FECHA.log`**:

1. **Salud del sitio** — 6 endpoints públicos deben dar 200 (home, /reencuentros, /auxilio, /api/persons, /api/aid-points, /api/pfif).
2. **Ingesta** — lee `/api/persons/stats`; alerta si el total **baja** respecto a ayer (guardado en `~/.faro-ig/maintenance-state.json`).
3. **Cron IG** — confirma que corrió hoy (`~/.faro-ig/cron.log`) y que `cron.err.log` está vacío.
4. **Buffer key** — presente y válida (si no, no se publica).
5. **Reencuentros del día** — corre `reconcile.mjs` (REUSO) + `seed-reencuentros.mjs` (con filtro de foto IA). Barato gracias al **cache de IA**.
6. **Cache IA** — reporta entradas (ahorro acumulado).
7. **Alerta SOLO si hay problemas** → notificación macOS + `exit 1` (queda en `maintenance.err.log`). Si todo OK: silencio.

### Operación
```bash
# Correr a mano (completo):
node scripts/maintenance/daily.mjs
# Solo salud (rápido, sin el cruce pesado):
MAINT_HEALTH_ONLY=1 node scripts/maintenance/daily.mjs
# Pausar TODO (IG + mantenimiento): kill-switch compartido
touch ~/.faro-ig/paused      # reanudar: rm ~/.faro-ig/paused
# Ver el reporte del día:
cat ~/.faro-ig/maintenance-$(date +%F).log
# Reinstalar el cron (si se editó el .plist):
cp scripts/maintenance/com.farove.maintenance.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.farove.maintenance.plist 2>/dev/null
launchctl load   ~/Library/LaunchAgents/com.farove.maintenance.plist
```

## Optimización de tokens (Misión Art. 3) — ya activa

- **Cache de IA compartido** `scripts/buffer/ai-cache.mjs` (`~/.faro-ig/ai-cache.json`):
  - `classifyPhoto` (visión, la llamada más cara) se cachea **por URL, para siempre** (incluye rechazos) → no se re-paga una foto ya clasificada. Lo comparten cron-ig, reconcile, seed y carousel.
  - `confirmReunification` se cachea **por par** (faro+found normalizado) → no se re-evalúa un par ya visto. **No** reemplaza a la IA en pares nuevos (ahí vive la seguridad anti-homónimo).
- `TRIES` del cron IG bajado 25 → 15 (con el cache, los re-intentos ya vistos cuestan 0).
- Costo IA estimado hoy: ~$15-50/mes, holgado bajo el tope `LLM_DAILY_BUDGET_USD`. Único costo real = Anthropic Haiku; el resto (Supabase/CF/Resend/Buffer) es free-tier.

## ⚠️ Follow-ups de compliance (server-side, requieren 1 paso del founder)

Estos **no** los puede hacer el Mac (la DB es IPv6 / requieren deploy). El reporte diario los recuerda.
Hay **tareas de fondo creadas** (chips) para ejecutarlos en una sesión enfocada:

1. **Purga PII Habeas Data (regla #6)** — la columna `persons.purge_pii_at` existe pero **nada la ejecuta**: la PII de reportes retirados nunca se borra. **Solución hands-off recomendada: `pg_cron` en Supabase** (un job diario que anula los campos PII donde `purge_pii_at <= now()`), aplicado una vez en el SQL Editor. (Confirmar columnas PII exactas en `supabase/migrations/0001_init.sql` antes de escribir el UPDATE.)
2. **Cron opt-out (reglas #8/#10)** — no existe el lector del inbox `opt-out@faro-ve.com`. Falta: (a) verificar Cloudflare Email Routing en el panel; (b) cron que, ante una baja, marque la source `disabled` + purgue + avise + audit (los campos `enabled/trust/contact_opt_out_received_at` y `audit_log` ya existen). SLA público 24h.
3. **Worker cron-ingest** — cuando el conteo se estabilice (~28-29k vs fuente), relajar `*/5` → `*/15` o `0 */6 * * *` y `wrangler deploy` (ahorra cuota CF).
4. **Formulario delete** `/privacidad/eliminar` (regla #6) — la ruta está vacía; falta el form + RPC de retiro autoservicio.
