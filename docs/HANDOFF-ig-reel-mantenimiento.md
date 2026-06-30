# HANDOFF — IG + Reel diario + Mantenimiento + Reencuentros (30-jun-2026)

> Para el próximo chat de Claude Code en Faro VE. Lee primero `docs/PROCESOS.md`, `docs/STATUS.md`
> (sección "ÚLTIMO AVANCE 30-jun") y la memoria del proyecto. Esto es el resumen ejecutivo.

## Qué quedó corriendo SOLO (3 launchd + 1 worker)
- **`com.farove.ig`** (1 h) — auto-publica fichas SE BUSCA en @farovenmap (solo foto limpia, anti-homónimo).
- **`com.farove.maintenance`** (09:00) — salud + reconcile incremental + seed + alerta solo si falla. Runbook: `docs/RUNBOOK-mantenimiento.md`.
- **`com.farove.reel`** (09:00 → 16:00 Madrid) — Reel diario de esperanza (versículo RV + footage Pexels de Venezuela rotando). `scripts/reel/`.
- Worker CF **cron-ingest** (*/5) — ingesta del conteo (DB es IPv6, por eso vive en Cloudflare).
- Kill-switch de los tres locales: `touch ~/.faro-ig/paused`.

## Estado
- `/reencuentros` LIVE: **288 familias** (de 413 detectadas; 100 media en `~/Desktop/faro-reencuentros/`).
- Reels: amanecer + mar turquesa publicados; **Caracas programado 1-jul 18:00**; diario automático desde **1-jul 16:00**.
- Tokens optimizados: cache IA compartido `scripts/buffer/ai-cache.mjs`.
- Misión-ley global (los 3 proyectos): `~/.claude/rules/common/mission.md`.

## Pendientes del founder (no urgentes; hay chips de tarea)
1. **Purga PII Habeas Data** (regla #6) — `pg_cron` en Supabase (confirmar columnas en `0001_init.sql`).
2. **Cron opt-out + Cloudflare Email Routing** (reglas #8/#10) — verificar destino + reglas en panel CF.
3. **Relajar worker `cron-ingest`** `*/5`→`*/15` cuando el conteo se estabilice (~28-29k).
4. Migraciones previas mencionadas: 0027/0028 (cola offline). Migración **0030 ya aplicada** (foto reencuentros).

## Comandos útiles
```bash
node scripts/reel/preview-next.mjs            # próximos reels (versículo + fondo)
MAINT_HEALTH_ONLY=1 node scripts/maintenance/daily.mjs   # chequeo de salud rápido
cat ~/.faro-ig/maintenance-$(date +%F).log    # reporte de mantenimiento del día
launchctl list | grep farove                  # crons activos
```

## Secretos (en `~/.secrets/faro-ve/`, válidos)
`buffer-key.txt`, `anthropic-key.txt`, `enrich-token.txt`, `pexels-key.txt`.
