# Faro VE — Status

> Documento vivo. Cierre del día actualiza este archivo + crea
> `docs/SESSIONS/YYYY-MM-DD-day{N}.md` con detalle.

## Sprint 25-jun-2026 → 1-jul-2026 (6 días)

| Día | Fecha | Foco | Gate | Estado |
|-----|-------|------|------|--------|
| D1  | 25-jun-2026 | Foundation: schema + scaffolding + tokens + navigation | DB Gate 9/9 ✓ + sitio live faro-ve.pages.dev HTTP 200 ✓ | 🟢 **GATE D1 COMPLETO** |
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

## Infra desplegada
- ✅ Cloudflare account `64a18868c428ecbfdaf67d69edffb888` (bybleiquel@gmail.com), wrangler login OK.
- ✅ Pages project `faro-ve` → **https://faro-ve.pages.dev** + **https://faro-ve.com** (HTTPS, HTTP 200) + www.
- ✅ Dominio `faro-ve.com` registrado (CF Registrar), DNSSEC, conectado a Pages, cert SSL emitido.
- ✅ KV namespace `RATE_LIMIT` id `c2a055cea3ca4dc098144ec69e948274` (en wrangler.toml).
- ✅ Botón "Instalar app" (InstallPrompt) live en home.

## Día 2 — EN PROGRESO (base del mapa lista)
- ✅ `lib/schemas/person.ts` — Zod (reportPersonSchema + personFiltersSchema + PersonPublic).
- ✅ `routes/api/persons/+server.ts` — GET desde persons_public (filtros status/is_minor/medical/sector/bbox), lee con cliente anon.
- ✅ `lib/components/Map.svelte` — Leaflet + MarkerCluster + DivIcon SVG color/pulso + popup SIN navegación + "ubicación aproximada". Ruta `/mapa`.
- ✅ `scripts/seed-test-persons.mjs` — 30 reportes test insertados (10 menores, 6 médicos). persons_public los sirve ofuscados (213m verificado).
- ⏳ **Falta para ver el mapa live**: setear `PUBLIC_SUPABASE_ANON_KEY` como Pages secret + redeploy. Luego `/mapa` muestra los 30 pines.
- ⏳ Pendiente D2: POST /api/persons (reporte + EXIF strip), form reportar/desaparecido, persona/[id], FilterChips, animaciones pulse en CSS global.

## Bloqueadores / pendientes founder

1. **Tarjeta en Cloudflare** → para registrar `faro-ve.com` (disponible ✓; yo no puedo meter datos de tarjeta). El PLAN agenda DNS final en D6, así que no bloquea — seguimos en pages.dev.
2. **Supabase service_role + anon keys** → para D2 (app runtime). El service_role NO pasa por chat (classifier lo bloquea, correcto): se setea directo con `wrangler pages secret put`. El anon (safe) se puede pegar.
3. **Secretos CF Pages** (D2): APP_SALT, ANTHROPIC_API_KEY, TURNSTILE_*, RESEND_API_KEY vía `wrangler pages secret put`.
4. **AI Gateway** CF (D5): crear gateway `faro-ve`.
5. **MCP Resend** sigue con key inválida (reconectar) — necesario D3 (relay) / D6 (federación).

## Próxima sesión (D2) arranca con
1. Confirmar `wrangler login` hecho → deploy preview pages.dev (cierra mitad deploy de Gate D1).
2. Obtener anon + service_role keys → `.env.local` (gitignored).
3. `npm run dev` smoke test local contra Supabase real.
4. Empezar D2: Map.svelte (Leaflet + clusters + DivIcon tokens), CRUD /api/persons, FilterChips.
