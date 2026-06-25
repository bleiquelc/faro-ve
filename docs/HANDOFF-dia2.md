# HANDOFF — Faro VE · continuar sprint (Día 2 en curso)

> Pega este archivo (o el prompt corto que te dio el chat anterior) al iniciar el nuevo chat.
> Emergencia humanitaria: el sitio debe quedar **operativo lo antes posible**.

## Estado al handoff (2026-06-25)

**🟢 VIVO en producción:**
- `https://faro-ve.com` + `www` + `faro-ve.pages.dev` — HTTPS, HTTP 200, DNSSEC.
- Home con logo del faro animado + botón "Instalar app" minimalista.
- `/mapa` carga (mapa "Faro Dusk" + diseño de luces) — pero SIN datos aún (ver bug #1).
- Repo público: github.com/bleiquelc/faro-ve (AGPL-3.0, ~27 commits).

**🟢 Backend verificado:**
- Supabase `blmiebnnprwaupyatsyb`: 9 migraciones aplicadas, Gate D1 9/9 PASS.
- 30 reportes de prueba (`source='test'`) — `persons_public` los sirve ofuscados (verificado anon SELECT = 30 filas).
- Cloudflare: Pages `faro-ve`, KV `RATE_LIMIT` (c2a055ce...), secret `PUBLIC_SUPABASE_ANON_KEY` (¡inválida, ver #1!), `wrangler.toml` con vars + nodejs_compat.

**Secretos locales** (`~/.secrets/faro-ve/`, NUNCA en repo): `db-url.txt`, `anthropic-key.txt`, `APP_SALT.txt`.

## 🔴 BUG #1 — BLOQUEANTE INMEDIATO: anon key inválida

`/api/persons` devuelve 502 → error real de Supabase: **"Invalid API key"**. Se configuró la **publishable key** (`sb_publishable_...`) en vez de la **legacy anon** (`eyJ...`), que es la que espera supabase-js v2.

**Fix:** el founder re-setea el secret con la legacy anon key (eyJ...) desde
`https://supabase.com/dashboard/project/blmiebnnprwaupyatsyb/settings/api-keys/legacy` → copiar "anon public" (empieza con `eyJ`):
```
cd ~/Desktop/faro-ve && npx wrangler pages secret put PUBLIC_SUPABASE_ANON_KEY --project-name=faro-ve
```
Luego redeploy:
```
cd ~/Desktop/faro-ve && npm run build && npx wrangler pages deploy
```
Verificar: `curl -s https://faro-ve.com/api/persons | head -c 120` → debe mostrar `"ok":true,"count":30`. Entonces `/mapa` muestra las 30 luces.

## Cómo aplicar/verificar (comandos)
```
# Migraciones (idempotente):
DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/apply-migrations.mjs --salt
# Gate D1:
DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/verify-gate-d1.mjs
# Datos de prueba:
DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/seed-test-persons.mjs
```
Nota: si vuelves a aplicar DDL con el runner, manda `notify pgrst, 'reload schema'` (PostgREST cachea el schema).

## Próximo en Día 2 (orden sugerido)
1. **Arreglar bug #1** → mapa con datos live. (máxima prioridad)
2. POST `/api/persons`: reporte con Zod (`reportPersonSchema` ya existe) + strip EXIF (exifr) cliente + encripta PII server-side (service_role) + INSERT pending.
   - Necesita `SUPABASE_SERVICE_ROLE_KEY` como Pages secret (founder lo setea, NO por chat).
3. `routes/reportar/desaparecido/+page.svelte` — formulario (autocomplete `anchor_places`, geoloc opcional, Turnstile).
4. `routes/persona/[id]/+page.svelte` — detalle (lee persons_public + notas).
5. FilterChips URL-driven. Hacer `/mapa` la home cuando pase el Gate D2.
6. **Gate D2**: móvil ve los puntos clusterizados con colores correctos, menores+médicos respirando, reporte nuevo → `/moderar` pending, aprobar → aparece ofuscado.

## Directivas del founder (cumplir)
- **Emergencia**: sitio operativo ASAP, pero velocidad CON rigor (no shippear regresiones).
- **Revisar bugs en paralelo**: correr revisión adversarial (workflow multi-agente) sobre código nuevo ANTES de producción — ya atrapó 13 bugs. Repetir el patrón.
- **Comandos para el founder SIEMPRE en bloque de código** (copy en cuadro). Ver memoria `founder-copy-paste-in-code-blocks`.
- **Deploys a producción**: SOLO con OK explícito del founder (su regla de OPS + el classifier lo exige).
- **Acciones que el classifier bloquea (respetar, NO forzar)**: resetear DB password, volcar service_role al chat, deploy sin OK. El founder las hace.
- Reglas inmutables: `CLAUDE.md` (31 reglas) — privacidad diferenciada navegación, ofuscación, foto menores, opt-out 24h, budget IA $5/día.

## Docs de continuidad
- `docs/STATUS.md` — estado vivo (matriz 6 días).
- `docs/SESSIONS/2026-06-25-day1.md` — detalle Día 1.
- Memoria: `~/.claude/projects/.../memory/MEMORY.md`.
