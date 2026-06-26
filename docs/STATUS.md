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

## Día 2 — EN PROGRESO (mapa hallable + flujo de reporte listo)
- ✅ API live OK: `/api/persons` sirve las 30 (anon key corregida por founder).
- ✅ `lib/components/Map.svelte` — Leaflet + MarkerCluster + popup → ficha; prop `interactive` (modo fondo); a11y (sr-list, role=alert, tap 44px).
- ✅ **Home = mapa de fondo** + tarjeta de bienvenida; "Ver el mapa" abre `/mapa`. (Resuelve "no encuentro el mapa".)
- ✅ `routes/persona/[id]` — ficha SSR desde persons_public; display opt-in: coord exacta + NavigateButton para `safe_self_report` con opt-in.
- ✅ **POST `/api/persons`** — Zod + RPC `create_person_report` (cifra/hashea PII en DB) → `pending` → `{id, edit_token}`.
- ✅ **Migración 0010** — `contact_phone_public` (teléfono opt-in) + recreación `persons_public` (+`contact_phone_optional`) + RPC. *(falta aplicarla)*
- ✅ Formularios `reportar/a-salvo` (opt-in estricto ubicación/teléfono, default OFF) y `reportar/desaparecido` + `Turnstile.svelte`.
- ✅ Recon fuente ingesta `venezuela-te-busca` (22.096 registros, turbo-stream) → `docs/INGEST-venezuela-te-busca.md`.
- ✅ 2 revisiones adversariales multi-agente (Tier-1 UI + Tier-2 server/SQL): **0 bloqueantes**; hallazgos reales arreglados (gate teléfono, esc(), coords fuera-VE no tumban reporte, whitelist status, etc.).
- ⏳ **Para activar reportes en prod** (founder): aplicar 0010 + setear `SUPABASE_SERVICE_ROLE_KEY` + `TURNSTILE_*` + redeploy. Ver `docs/HANDOFF-dia2-deploy.md`.
- ⏳ Pendiente D2/D3: subida de foto con EXIF strip, FilterChips ya commiteado, moderación, relay /mensaje.

## 2026-06-26 — Capa de lugares de servicio + autorregulación + pulido UX
Detalle: `docs/SESSIONS/2026-06-26-aid-points-comunidad.md`.
- ✅ **Vertical aid_points** (Prioridad #2): alta pública (visible al instante, sin verificar, coords
  EXACTAS), votos confirmar/reportar (1/IP, net≥3 → auto-ocultar reversible + alerta founder),
  reactivación con WhatsApp cifrado (RPC admin auditado). Migración `0014` + 6 RPCs + vista pública +
  `founder_alerts`. Endpoints + formulario + ficha SSR (`/punto/[id]`) + capa de mapa (chip "Ayuda").
- ✅ **Pulido**: iconos web minimalistas estilo faro (regenerados); botón **Actualizar** PWA-aware;
  animaciones más suaves (haz del faro, bienvenida, taps); **filtros combinables** (estado + Menores/Urgencia).
- ✅ **2 revisiones adversariales multi-agente** antes de prod: 26 hallazgos → 15 confirmados arreglados
  (1 blocker de privacidad: `revoke select on aid_points from anon/authenticated`; 1 high: alta no se
  bloquea si el GPS falla → `LocationPicker` mini-mapa), 10 refutados.
- ✅ `svelte-check` 0 err · 36/36 tests (14 nuevos) · build limpio · preview verificado.
- ✅ **APLICADO + LIVE**: migración `0014` aplicada en prod (gate PASS) + deploy a faro-ve.com. Verificado
  end-to-end: `/api/aid-points` → ok, persons intacto (13.821), privacidad OK. Lectura de ayuda + filtros
  combinables + Actualizar + iconos + animaciones EN VIVO. Faltan los 3 secretos Level B para escrituras.
- ✅ **Ingesta desestancada + geocodificación nacional** (Prioridad #4a): la fuente cambió su paginación y
  el script estaba pegado en la página 1 (la fuente creció a 25.516; el mapa tenía solo 13.821). Arreglado
  (`page`/`hasMore`) + geocoder nacional testeado (cobertura 85% del total / 92% de los con-ubicación, antes
  ~24 entradas Vargas). ⏳ **Re-correr ingesta** = founder (escritura masiva prod, requiere OK explícito):
  `DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/ingest/venezuela-te-busca.mjs --apply`

## 2026-06-26 (tarde) — Burbujas por zona + pulido + diagnóstico de escrituras
- ✅ **Burbujas por zona con conteo REAL** (migración `0015` aplicada + deploy live): RPC `persons_clusters`
  (SECURITY DEFINER, solo agregados sobre coords ofuscadas, #1) → a zoom país una burbuja con el total real
  (13.357, NO el tope 1000); al acercar se separa en zonas/ciudades; a zoom≥13 pines individuales. El home
  mantiene las luces. Revisión adversarial (2 agentes): race de época + índice GIST duplicado + cast enum
  arreglados. Verificado en prod: `/api/persons/clusters` devuelve conteos reales.
- ✅ **Iconos**: el deploy ya tenía el icono nuevo; era caché del navegador → cache-bust `?v=3` en app.html.
- ✅ **Animación de la luz** más lenta (haz del faro 6s→12s; bienvenida glow 7s, haces 20s).
- ⚠️ **Escrituras (reportes) siguen en 503**: NO por los 3 secretos del founder (están OK) — **falta `APP_SALT`
  como secreto de Pages** (la lista muestra 4 secretos, sin APP_SALT; el config-guard lo exige). El founder
  debe setearlo (1 comando) + redeploy. RATE_LIMIT KV está bien en wrangler.toml.

## 2026-06-26 (noche) — Limpieza de datos de prueba en producción
- ✅ **30 perfiles `source='test'` ELIMINADOS** (eran los 30 seed de D2 para validar clusters; mostraban
  "Fuente: test" en popup/ficha → el founder los vio "como TEST"). Total bajó 13.821 → **13.791** (verificado live).
- ✅ **4 descripciones reales corregidas**: "test" era un typo de **"tez"** (complexión) en gente real de
  venezuela-te-busca ("delgada de test clara" → "tez clara"). Corregido `test`→`tez` (palabra suelta).
- ✅ Resultado: **0 perfiles dicen "test"** como palabra; los 30 con "testigo/contestura" (palabras españolas
  legítimas, substring) intactos — son personas reales. Solo quedan perfiles reales (venezuela-te-busca).
- ⚠️ NO re-correr `scripts/seed-test-persons.mjs` contra prod (re-inserta los 30 de prueba).

## 2026-06-26 (autónoma) — Panel /moderar (D3) + fix de ubicación
Detalle: `docs/SESSIONS/2026-06-26-moderar-y-ubicacion.md`.
- ✅ **Panel `/moderar`** (D3) LIVE: magic-link Supabase + cola pending ordenada (#20) + decisiones
  (aprobar/rechazar/duplicado/falta-info) con audit atómico (actor=moderador). Migración `0016` (RPCs
  SECURITY DEFINER, supresión de audit-fantasma, seed founder admin). Gate `verify-moderation.mjs` 15/15.
  Revisión adversarial (19 agentes): 3 confirmados + 1 crítico-completitud corregidos. ⚠️ Falta el paso
  de Supabase Auth (redirect-URL) para el login — ver `HANDOFF-continuar.md` #1.
- ✅ **Ofuscación consciente de la tierra** (founder: "personas sobre el mar"): migración `0017`
  (`ve_land` + `obfuscate_point_on_land`, preserva ≥200m, fail-safe). Backfill **1229→23** offshore
  (los 23 quedan en el mar a propósito: snap violaría los ≥200m → privacidad > cosmético). `Map.svelte`:
  pines de color más visibles. Revisión adversarial (12 agentes): 5 confirmados (1 high de privacidad)
  corregidos. Live: franja La Guaira 100→0, total intacto 13.791.
- ✅ Migraciones en prod: **0001–0017**. svelte-check 0 / 53 tests / build limpio. Commits `74b4e68`, `08370e6`.

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
