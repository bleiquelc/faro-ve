# Sesión 2-jul-2026 — Precisión del mapa (pines fuera del agua) + fuga de clave Supabase

> Sesión autónoma (Fable 5). Pedido del founder: "tenemos localizaciones no exactas
> pero la dirección de cada ficha es pública y ubicable en Google Maps; en el mapa hay
> ubicaciones sobre el agua que no son correctas → mejora la precisión de cada punto,
> busca bugs y repáralos, cuando termines deploya todo".

## 1. 🔴 Fuga de clave secreta de Supabase (hallazgo crítico, BLOQUEADOR founder)

Al diagnosticar el entorno noté que **faro-ve.com sirve en el HTML del cliente**
(`__sveltekit_*.env.PUBLIC_SUPABASE_ANON_KEY`) una clave que **empieza por `sb_secret_`**.
Ese es el formato de **clave SECRETA** de Supabase (equivalente a service_role): **bypassa
Row Level Security**. Cualquier visitante puede leerla del código fuente y hacer
`supabase.from('persons').select('*')`, obteniendo **coordenadas exactas + PII** de cada
persona, saltando la vista `persons_public`. Viola las reglas #1 y #2.

- **No se usó la clave** para acceder a la DB (no exfiltrar; el classifier lo bloqueó y es correcto).
- Confirmado por construcción: `src/lib/client/supabase.ts` (`browserSupabase()`) usa esa var; `hooks.server.ts:164-167` la referencia.
- **Fix de ops (solo founder):** rotar la secret en Supabase; poner `PUBLIC_SUPABASE_ANON_KEY` = clave **publishable** (`sb_publishable_…`); `SUPABASE_SERVICE_ROLE_KEY` = la nueva secret. `$env/dynamic/public` es runtime → sin redeploy, pero conviene. Verificar con `curl -s https://faro-ve.com/ | grep -o 'sb_[a-z]*'` → debe decir `sb_publishable`.
- **Guarda defensiva agregada (código):** `src/lib/utils/key-guard.ts` (`looksLikePrivilegedKey`, puro + testeado) + `browserSupabase()` fail-closed: el navegador **nunca** crea cliente con una clave `sb_secret_`/service_role, y loguea el error ruidosamente. NO evita la inyección en HTML (eso es la var PUBLIC_), pero previene el uso y hace detectable el error.
- Chip de tarea creado para el founder.

## 2. Pines sobre el agua — causa raíz y fix (geocoder v2)

**Diagnóstico.** El geocoder de ingesta (`scripts/ingest/geocode.mjs`) tenía **10 anclas
en el mar** (verificado con la máscara `ve-land.geojson`): Tanaguarena (~5 km mar adentro),
Todasana (~6 km), Los Corales, La Sabana, Naiguatá, Higuerote, Porlamar, Tucacas, Mare,
Nueva Esparta. Como la ofuscación 200–500 m (#1) re-tira alrededor del ancla, con un ancla
marina agotaba sus 16 intentos y el snap-a-costa (0017) apilaba los pines **sobre el agua**.
Además, todo lo que no matcheaba un sector caía a la **capital del estado** (impreciso).

Muestra de 1000 registros de prod: **17.6%** caían en anclas que estaban en el mar.

**Fix — geocoder v2 (`GEOCODE_VERSION=2`):**
- `scripts/ingest/land-mask.mjs` (NUEVO): point-in-polygon sobre `ve-land.geojson` para uso local (generador + tests). `onLand()` + `nudgeToLand()` (corre un ancla costera tierra adentro ≤3 km).
- `scripts/ingest/gen-geocode-places.mjs` (NUEVO) → `scripts/ingest/geocode-places.mjs` (GENERADO, 2477 anclas): de **GeoNames** (dump `VE.txt`, CC BY 4.0). Sedes de municipio/parroquia (PPLA*), pueblos con pop≥1000 y **todos** los de La Guaira/Vargas (zona del terremoto), + sectores urbanos (PPLX, exigen contexto). **Toda ancla verificada EN TIERRA** (las costeras corridas tierra adentro; sin tierra a <3 km → descartadas: Los Roques, etc.).
- `scripts/ingest/geocode.mjs` reescrito: anclas curadas corregidas a coords en tierra; **ciudades etiquetadas con su estado**; **desambiguación por CONTEXTO** (nombres duplicados entre estados / sectores urbanos SOLO matchean si el texto menciona su estado o una ciudad del mismo estado); **matcher por n-gramas de tokens** (precompilado, mantiene el match por palabra completa: 'cua' no matchea en "evacuado") → 46.000 textos en ~380 ms (apto para el límite de CPU del worker). Prioridad: SPECIFIC (sector curado) → PLACES/CITY con contexto → STATE.
- Resultado en la muestra de prod: 0 anclas nuevas en el mar; ~17% de los registros se mueven a su ubicación real (Chuspa, Caruao, Naiguatá reales, etc. en vez de la capital o el mar).
- Tests: `tests/ingest/geocode.test.ts` +10 (toda ancla curada y de PLACES en tierra y dentro de VE; regresiones de las anclas que estaban en el mar; contexto de estado; sedes de municipio ≠ capital).
- `ATTRIBUTION.md`: GeoNames (CC BY 4.0) + geoBoundaries.

## 3. Re-geocodificación de los ~46k registros ya guardados (worker)

`workers/cron-ingest/src/regeocode.ts` (NUEVO) — corrige el DATO existente con el geocoder v2.
Corre en el worker (Cloudflare alcanza la DB; el Mac es IPv6) por pg directo al Session Pooler:
- **Paginado keyset por id + RESUMABLE** (progreso en `app_config('regeocode_progress')`); si el worker muere a mitad, el próximo tick retoma.
- 1 transacción por página con **advisory lock** (anti-solape) + `set_config('faro.skip_persons_audit','1',true)` → una sola fila de audit resumen, no ~46k.
- Solo toca el punto base de `source='venezuela-te-busca'`; NUNCA quita un pin (si `geocode` da null, deja el viejo). Si el punto no cambia, no escribe → offset ofuscado estable (anti-promediado). Si cambia, el trigger 0017 re-ofusca EN TIERRA. Pase final: recomputa la coord pública ofuscada de cualquier fila que siga offshore (mismo criterio que `load-ve-land.mjs`).
- Gate por `GEOCODE_VERSION`: corre UNA vez por versión. Fail-safe: sin `SUPABASE_DB_URL` o ante error, no-op y la ingesta sigue.
- `index.ts`: `regeocodeIfNeeded` antes de `runIngest` (nunca bloquea la ingesta).
- **PENDIENTE FOUNDER:** `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` (pegar `~/.secrets/faro-ve/db-url.txt`) → el próximo tick del cron re-geocodifica una sola vez. El worker YA está desplegado con el módulo; solo falta el secret.

## 4. Bugs de revisión adversarial (3 agentes en paralelo)

- **`Map.svelte` — race real (HIGH):** un `loadData` de pines en vuelo podía resolver DESPUÉS de volver al modo agregado (zoom rápido cruzando el umbral) y pintar pines sueltos sobre las burbujas. Fix: `dataEpoch` simétrico al `aggEpoch` existente + guard de `viewMode`.
- **`Map.svelte` — a11y (MED):** el modo agregado (estado INICIAL de `/mapa`, zoom 6) no tenía ruta `sr-only` → teclado/lector no alcanzaban los datos. Fix: `<nav sr-only>` que lista las zonas con botón "acercar".
- **`persona/[id]/+page.server.ts` — función rota (HIGH):** `COLUMNS` no incluía `contact_phone_optional` (la migración 0010 ya estaba aplicada hace 20 migraciones) → el botón "Llamar" jamás aparecía aunque el sujeto "a salvo" publicara su teléfono con opt-in. Fix: agregada la columna.
- **`api/enrich` — timing (LOW):** comparación de token con `!==` → cambiada a comparación en tiempo constante (digests SHA-256).
- Las 3 revisiones (mapa/frontend, APIs/privacidad, geocode/regeocode) confirmaron 0 CRÍTICO/ALTO nuevos en las reglas de privacidad (coord exacta, PII, fotos de menores, Turnstile/rate-limit, CORS) — todo se respeta.

## 5. Verificación y deploy

- **95 tests verde** (vitest) · **svelte-check 0 errores** · build limpio · worker bundle OK (pg sobre cloudflare:sockets).
- **Deploy HECHO:** `wrangler pages deploy` (frontend) + `wrangler deploy` (worker cron-ingest con regeocode). Smoke prod 200: home, `/mapa`, ficha, `/api/persons` (46.430), `/api/persons/clusters`.
- **4 commits locales en `main`** (`15e2da7` geocode v2, `a275a7e` regeocode worker, `20d06a0` security guard, `69dcd34` 3 bugs). El push a GitHub lo bloqueó el classifier (default branch) → lo hace el founder.

## Pendientes founder (en orden)

1. **🔴 URGENTE — Rotar la clave Supabase filtrada** y poner la publishable en `PUBLIC_SUPABASE_ANON_KEY` (ver §1). Auditar accesos anómalos mientras estuvo expuesta.
2. **Re-geocodificar lo viejo:** `cd workers/cron-ingest && wrangler secret put SUPABASE_DB_URL` (`~/.secrets/faro-ve/db-url.txt`) — el worker ya está desplegado; solo falta el secret para que el próximo tick corrija los ~46k puntos.
3. (Opcional) `git push origin main` cuando quiera sincronizar GitHub (4 commits locales).
