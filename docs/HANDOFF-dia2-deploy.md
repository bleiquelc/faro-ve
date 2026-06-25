# HANDOFF — Faro VE · Día 2 (mapa en home + opt-in + reportes) · acciones founder

> Sesión 2026-06-25 (cont.). Todo commiteado **localmente** (2 commits, sin push aún).
> Deploys a producción = **solo con tu OK**. Comandos abajo, listos para copiar.

## Qué se hizo (revisado, 0 bloqueantes en 2 revisiones adversariales)

1. **El mapa ahora ES el fondo de la home** + tarjeta de bienvenida; el botón "Ver el mapa" abre `/mapa`. (Tu pedido: ya no "se pierde" el mapa.)
2. **Ficha `persona/[id]`** con display **opt-in** de ubicación exacta + NavigateButton (solo `safe_self_report` que activó el toggle).
3. **Flujo de reporte**: `POST /api/persons` (Zod + RPC que cifra la PII dentro de la DB) + formularios **`/reportar/a-salvo`** (opt-in estricto de ubicación/teléfono, default OFF) y **`/reportar/desaparecido`** + `Turnstile`.
4. **Migración 0010**: teléfono público opt-in + RPC `create_person_report`.
5. **Recon fuente** `venezuela-te-busca` (22.096 registros) → `docs/INGEST-venezuela-te-busca.md`.

## Estado de despliegue: 2 niveles

### A) ✅ DESPLEGADO (2026-06-25) — arregla "no encuentro el mapa"
Home-mapa (mapa vivo de fondo + faro con halo + botones flotantes), `/mapa`, `/persona/[id]` y los formularios YA están live en https://faro-ve.com (verificado: rutas 200, API 30). Los formularios se ven, pero **no envían** hasta el nivel B.

Redeploy si hace falta:
```bash
cd ~/Desktop/faro-ve && npm run build && npm run deploy:pages
```

### B) Activar el envío de reportes — necesita migración + 2 secretos (los seteas tú)

**1) Aplicar la migración 0010** (idempotente; la clave de cifrado nunca sale de Postgres):
```bash
cd ~/Desktop/faro-ve && DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/apply-migrations.mjs
```
Luego recargar el cache de PostgREST (psql o el SQL editor de Supabase):
```sql
notify pgrst, 'reload schema';
```

**2) Setear los secretos en Cloudflare Pages** (no van por chat — los pegas tú en el prompt de wrangler):
```bash
cd ~/Desktop/faro-ve && npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=faro-ve
```
```bash
cd ~/Desktop/faro-ve && npx wrangler pages secret put TURNSTILE_SECRET_KEY --project-name=faro-ve
```
```bash
cd ~/Desktop/faro-ve && npx wrangler pages secret put PUBLIC_TURNSTILE_SITE_KEY --project-name=faro-ve
```
> Las dos claves de Turnstile salen de https://dash.cloudflare.com → Turnstile → crear widget para `faro-ve.com` (site key = pública, secret key = privada). `SUPABASE_SERVICE_ROLE_KEY` está en Supabase → Project Settings → API → service_role.

**3) Redeploy:**
```bash
cd ~/Desktop/faro-ve && npm run build && npm run deploy:pages
```
Verificar envío (debe devolver `{"ok":true,"id":...}`):
```bash
curl -s -X POST https://faro-ve.com/api/persons -H 'content-type: application/json' -d '{"given_name":"Prueba","status":"safe_self_report","cf-turnstile-response":"x"}' | head -c 200
```
(Sin un token Turnstile válido dará 403 — es lo correcto; el envío real pasa por el widget en el formulario.)

## Push a GitHub (opcional, cuando quieras)
```bash
cd ~/Desktop/faro-ve && git push
```

## Decisiones que necesito de ti
- **Fuente `venezuela-te-busca`**: ¿la tratamos como confiable (auto-approve) o entra a moderación (`pending`)? ¿Contactamos al operador para federación antes de ingestar a escala? (La ingesta real es D4.)
- **Subida de foto** (con EXIF strip + Storage) quedó fuera de esta tanda — ¿prioridad alta para D2/D3?

## Hallazgos no-bloqueantes documentados (polish, no urgen)
- `reporter_consent_relay` default `true` (consentimiento presumido) — heredado de 0001; revisar contra PRIVACY.md.
- Mensajes de error Zod parcialmente en inglés en algunos campos — cosmético.
- Warning a11y pre-existente en `InstallPrompt.svelte` (dialog sin tabindex).
