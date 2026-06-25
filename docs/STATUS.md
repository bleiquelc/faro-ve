# Faro VE — Status

> Documento vivo. Cierre del día actualiza este archivo + crea
> `docs/SESSIONS/YYYY-MM-DD-day{N}.md` con detalle.

## Sprint 25-jun-2026 → 1-jul-2026 (6 días)

| Día | Fecha | Foco | Gate | Estado |
|-----|-------|------|------|--------|
| D1  | 25-jun-2026 | Foundation: schema + scaffolding + tokens + navigation | `faro-ve.com` (o .pages.dev) muestra placeholder · `curl /rest/v1/persons` → `[]` · `obfuscate_point()` retorna punto distinto · `count(*) verified orgs >= 5` | ▶ EN CURSO |
| D2  | 26-jun-2026 | Mapa Leaflet + CRUD persons + clusters + filtros + animaciones | móvil ve 30 puntos clusterizados con colores correctos, menores+médicos pulsando, pending aparece en /moderar | pendiente |
| D3  | 27-jun-2026 | Moderación + magic-link + relay + resto formularios | moderador entra magic-link, aprueba 3, mensaje relay llega; punto-ayuda guardado | pendiente |
| D4  | 28-jun-2026 | PWA offline + sync + scrapers (7 adapters) + atribución | PWA instalada, modo avión, reportar offline, sync OK; wrangler tail muestra ≥2 fuentes activas | pendiente |
| D5  | 29-jun-2026 | Match + búsqueda + IA (chat + triage + health) + i18n + PFIF export | chat IA responde correctamente, triage clasifica 5 pending, budget <$1, /api/rss?format=pfif valida XSD | pendiente |
| D6  | 30-jun-2026 - 1-jul-2026 | Polish + onboarding + panel-org + deploy + difusión federación PFIF | Lighthouse perf≥85 a11y≥95 PWA verde, onboarding 1ª visita, 3 mods externos, 1 org gestiona aid_points, email Health, 7 emails federación | pendiente |

## Día 1 — checklist en curso

- [x] Pre-flight: APP_SALT generado e `~/.secrets/faro-ve/APP_SALT.txt` chmod 600.
- [x] D1-Scaffold: estructura `src/` `workers/` `supabase/` `scripts/` creada.
- [x] D1-Scaffold: package.json AGPL-3.0 + stack completo (SvelteKit, Vite, Supabase, Leaflet, Tailwind, Paraglide, Dexie, Zod, Exifr, Anthropic SDK, Wrangler).
- [x] D1-Scaffold: svelte.config.js, vite.config.ts (con vite-plugin-pwa), tsconfig.json, tailwind.config.ts, postcss.config.js, app.html, app.d.ts, app.css.
- [x] D1-SQL: migración 0001 schema PFIF v1.4 (persons + notes + links + messages + searches_active + enums + unaccent helper).
- [x] D1-SQL: migración 0002 indexes (GIST, trigram, cola moderación).
- [x] D1-SQL: migración 0003 RLS policies + view `persons_public` + `notes_public`.
- [x] D1-SQL: migración 0004 funciones críticas (`obfuscate_point`, `hash_email`, `hash_phone`, `hash_ip`, `encrypt_pii`, `decrypt_for_relay`, `suggest_matches` stub) + triggers (obfuscate, minor_photo guard, match_notify).
- [x] D1-SQL: migración 0005 seed `anchor_places` (Caracas 23 parroquias + sectores + hospitales + morgue + 19 ciudades + landmarks).
- [x] D1-SQL: migración 0006 moderators + import_sources (seed 7 fuentes) + audit_log particionado por mes + anchor_places metadata.
- [x] D1-SQL: migración 0007 organizations (seed 8 verificadas) + aid_points + shelters_view + ai_conversations + ai_budget_daily + funciones budget.
- [x] D1-Utils: `lib/utils/colors.ts` (tokens AAA + LABEL_ES/EN + PULSE_CLASS + AID_META + categoryForPerson).
- [x] D1-Utils: `lib/utils/navigation.ts` (Apple/Google/Waze/OsmAnd + LS preferred_map_app + formatAddressForClipboard).
- [x] D1-Utils: `lib/components/NavigateButton.svelte` (selector multi-app + bottom sheet + copy).
- [x] D1-Utils: `lib/utils/obfuscate.ts` (espejo cliente helper testing).
- [x] D1-Hooks: `src/hooks.server.ts` (Supabase locals + IP hash + Turnstile + rate-limit KV + INSERTS_PAUSED kill switch).
- [x] D1-Hooks: `.env.example` completo.
- [x] D1-Hooks: `LICENSE` AGPL-3.0 oficial (FSF).
- [x] D1-Page: `+page.svelte` placeholder D1.
- [ ] **Pre-flight bloqueante**: `wrangler login` (founder en proceso).
- [ ] **Pre-flight bloqueante**: cuenta Supabase + 3 credenciales.
- [ ] **Pre-flight bloqueante**: clave Anthropic separada workspace Faro VE.
- [ ] **Pre-flight bloqueante**: reconnect MCP Resend.
- [ ] **Pre-flight bloqueante OK puntual**: registrar dominio `faro-ve.com` o usar `.pages.dev` provisional.
- [ ] **Pre-flight bloqueante OK puntual**: crear GitHub repo público AGPL-3.0.
- [ ] Aplicar migraciones 0001..0007 a Supabase (tras credenciales).
- [ ] Setup KV namespace `RATE_LIMIT` en Cloudflare (tras login).
- [ ] Configurar AI Gateway endpoint en Cloudflare (tras login).
- [ ] Setup `wrangler secret put` para todos los secrets en Cloudflare Pages (tras login).
- [ ] Deploy preview a `faro-ve.pages.dev` (tras login).
- [ ] **Gate D1**: ejecutar verificaciones del PLAN sección Día 1 Gate.

## Bloqueadores activos

1. Founder ejecutando `wrangler login` para Cloudflare.
2. Pendiente credenciales Supabase + Anthropic + reconnect MCP Resend.
3. OK explícito para `gh repo create --public` (bloqueado por classifier auto mode).
4. OK explícito para `wrangler registrar domain faro-ve.com` (cargo $10/año irreversible).

## Riesgos vivos del sprint

- Node 24 muy nuevo (jun-2025) — si SvelteKit 2.7 da edge case raro, downgrade a Node 22 LTS.
- Free tier Supabase 500MB — si scrapers ingestan 50k+ records, evaluar Plan Pro $25 con donaciones D2-D3.
- APP_SALT inmutable — migration guard pendiente de implementar en D2 (verificar hash al boot).

## Próxima sesión arranca con

1. Recibir credenciales pendientes del founder.
2. `wrangler whoami` para verificar login.
3. Aplicar migraciones SQL a Supabase remoto.
4. Setup KV namespace + secrets en CF Pages.
5. `npm run dev` local para smoke test.
6. Deploy `faro-ve.pages.dev` preview.
7. Cerrar Gate D1 con evidencia.
