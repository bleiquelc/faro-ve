# Faro VE — Status

> Documento vivo. Cierre del día actualiza este archivo + crea
> `docs/SESSIONS/YYYY-MM-DD-day{N}.md` con detalle.

## Sprint 25-jun-2026 → 1-jul-2026 (6 días)

| Día | Fecha | Foco | Gate | Estado |
|-----|-------|------|------|--------|
| D1  | 25-jun-2026 | Foundation: schema + scaffolding + tokens + navigation | DB: obfuscate ✓, orgs ✓, persons_public sin leak ✓, RLS ✓ | 🟢 **DB GATE PASS** · deploy pendiente wrangler login |
| D2  | 26-jun-2026 | Mapa Leaflet + CRUD persons + clusters + filtros + animaciones | móvil ve 30 puntos clusterizados, menores+médicos pulsando, pending en /moderar | pendiente |
| D3  | 27-jun-2026 | Moderación + magic-link + relay + resto formularios | moderador aprueba 3, mensaje relay llega; punto-ayuda guardado | pendiente |
| D4  | 28-jun-2026 | PWA offline + sync + scrapers | PWA instalada, offline, sync OK; ≥2 fuentes activas | pendiente |
| D5  | 29-jun-2026 | Match + búsqueda + IA + i18n + PFIF export | chat IA OK, triage clasifica, budget <$1, PFIF valida XSD | pendiente |
| D6  | 30-jun→1-jul | Polish + onboarding + panel-org + deploy + difusión | Lighthouse perf≥85 a11y≥95 PWA, onboarding, 7 emails federación | pendiente |

## Día 1 — COMPLETADO (mitad DB) · 🟢 Gate DB PASS

### Entregables (todos pusheados a github.com/bleiquelc/faro-ve)

- **Stack**: SvelteKit 5 + Vite 7 + adapter-cloudflare 7 + Tailwind 3 + Wrangler 4 + Anthropic SDK + Dexie + Zod + Exifr + Leaflet. `npm install` limpio, `svelte-check` 0 errores.
- **Schema en producción**: 9 migraciones aplicadas a Supabase `blmiebnnprwaupyatsyb` (verificadas en `_faro_migrations`):
  - 0001 PFIF v1.4 (persons/notes/links/messages/searches_active) + vistas `persons_public`/`notes_public` (security_barrier).
  - 0002 índices (GIST, trigram, cola moderación).
  - 0003 RLS policies (anon sin SELECT directo a persons; solo vistas).
  - 0004 funciones privacidad (obfuscate_point, hash_*, encrypt_pii, decrypt_for_relay) + triggers.
  - 0005 tabla + seed `anchor_places` (80 lugares VE).
  - 0006 moderators + import_sources (7) + audit_log particionado.
  - 0007 organizations (8 verificadas) + aid_points + ai_conversations + ai_budget_daily.
  - 0008 app_config + get_app_salt (mecanismo salt compatible Supabase).
  - 0009 fix trigger foto de menor (generated column en BEFORE).
- **Utils/components**: colors.ts (tokens AAA), navigation.ts + NavigateButton.svelte (multi-app), obfuscate.ts.
- **hooks.server.ts**: Turnstile validado (getUser+moderators), rate-limit KV ventana fija, fail-closed prod, IP siempre hasheada, error genérico.
- **3 Workers** scaffold (cron-ingest, ai-health, ai-triage).
- **Tests**: 22/22 unit (vitest) + Gate D1 (9/9 contra DB real) + test SQL anti-promediado.

### Gate D1 (DB) — evidencia `node scripts/verify-gate-d1.mjs`
```
✅ orgs verificadas >= 5 — 8
✅ anchor_places > 50 — 80
✅ obfuscate_point ofusca 200-500m — dist=438m
✅ persons_public sin coord exacta ni PII — 46 cols, leak_point=false
✅ RLS en tablas sensibles
✅ APP_SALT configurado (len 64)
✅ menor → photo_visibility admin_only
✅ 9/9 migraciones
✅ estabilidad ofuscación (anti-promediado) — offset invariante 100 ediciones
🟢 GATE D1: PASS
```

### Revisión adversarial (workflow 8 agentes) — 11 bugs encontrados y arreglados
2 críticos de deploy (unaccent order, grant-before-view), 2 high (Turnstile bypass,
ataque promediado notas), 7 med/low. + 2 bugs más atrapados al aplicar (anchor_places
order, minor-photo generated-column). **Total: 13 bugs antes de producción.**

## Credenciales (en ~/.secrets/faro-ve/, NUNCA en repo)
- ✅ APP_SALT.txt (64 hex) — guardado en DB vía app_config.
- ✅ anthropic-key.txt — validada HTTP 200.
- ✅ db-url.txt — connection string directo (IPv6) funcionando.

## Bloqueadores / pendientes founder

1. **`npx wrangler login`** (founder, 1 comando + "Allow") → desbloquea: deploy pages.dev, KV namespace, AI Gateway, registrar dominio.
2. **Tarjeta en Cloudflare** → para registrar `faro-ve.com` (disponible ✓; yo no puedo meter datos de tarjeta).
3. **Supabase service_role key** → para D2. NO pasa por chat (classifier lo bloquea, correcto). Se setea directo como secreto CF + `.env.local` local. Anon/publishable key (safe) se puede pegar.
4. **MCP Resend** sigue con key inválida (reconectar) — necesario D3 (relay) / D6 (federación).

## Próxima sesión (D2) arranca con
1. Confirmar `wrangler login` hecho → deploy preview pages.dev (cierra mitad deploy de Gate D1).
2. Obtener anon + service_role keys → `.env.local` (gitignored).
3. `npm run dev` smoke test local contra Supabase real.
4. Empezar D2: Map.svelte (Leaflet + clusters + DivIcon tokens), CRUD /api/persons, FilterChips.
