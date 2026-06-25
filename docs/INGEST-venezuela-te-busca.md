# Ingesta — `venezuela-te-busca-app.hellogafaro.workers.dev`

> Reconocimiento de la fuente (prioridad #3 del founder). Estado: **inspección hecha + scaffold ético**. La ingesta real (cron + upsert + dedup) es trabajo del Día 4 sobre `workers/cron-ingest`.

## Qué es

Registro público de personas desaparecidas tras el terremoto. Es una **SPA** (React Router v7 / Remix, servida desde un Cloudflare Worker). Título: *"Venezuela te busca - Registro de desaparecidos"*.

## Qué expone (verificado 2026-06-25, UA `FaroVE-IngestBot/1.0`)

| Recurso | Resultado |
|---|---|
| `GET /` | HTML shell de la SPA — **los datos NO están en el HTML** (se cargan client-side). |
| `GET /robots.txt` | **Solo comentarios** explicando "content signals" (search / ai-input / ai-train). **Sin `User-agent`, sin `Disallow`, sin directiva `Content-Signal:` real** → no hay restricción de crawl. No declara `no` para ningún uso. |
| `GET /_root.data` | **200 `text/x-script`** — endpoint de datos de React Router v7 (formato **turbo-stream**). Contiene `persons` (50/página), `pagination`, `filters`, `stats`. |
| `/api/*`, `/sitemap.xml`, `/*.data` de rutas hijas | 404. El canal es `/_root.data`. |

### Volumen (de `stats` en `/_root.data`)
- `totalCount`: **22.096**
- `missing`: 21.258 · `found`: 838
- Página: 50 registros → ~442 páginas.

### Formato `/_root.data` (turbo-stream)
Codificación por referencias (estilo `devalue`): un array plano donde los objetos referencian índices (`{"_72":678,...}`). Para decodificarlo de forma robusta hay que usar el decoder **`turbo-stream`** (el mismo paquete que usa React Router), no parsear a mano. Cada `person` trae campos como nombre, edad, ubicación, estado (missing/found), foto — a mapear a PFIF.

## Cumplimiento ético (CLAUDE #12)

- [x] **robots.txt revisado** → sin `Disallow`. Crawl permitido.
- [x] **Content-signals**: la fuente NO marca `ai-train/ai-input/search = no`. Nuestro uso no es entrenamiento ni índice de búsqueda: es **federación humanitaria** (re-publicar reportes de personas con atribución, mismo fin que la fuente). Aun así respetamos opt-out.
- [x] **UA identificada**: `FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)`.
- [ ] **Throttle 1 req/2s** — implementar en el cron (D4).
- [ ] **Atribución**: cada registro lleva `source='venezuela-te-busca'` + `source_url` clickeable (la UI ya muestra el badge y sanitiza la URL).
- [ ] **Opt-out**: incluir la fuente en `/atribucion` + responder a `opt-out@faro-ve.com` (SLA 24h) → marcar `disabled` + purgar.
- [ ] **Aborto suave**: si <50% de registros parsean → abort + alerta (CLAUDE #12).
- [ ] **Dedup**: por `(full_name_normalized, last_seen ±24h, ST_DWithin 5km)` contra lo existente (faro-ve + esta fuente).

## Plan de implementación (D4)

1. Añadir dependencia `turbo-stream` (decoder oficial RRv7).
2. `workers/cron-ingest`: schedule `0 */6 * * *`. Por página: fetch `/_root.data?...` con UA + throttle 1 req/2s.
3. Decodificar → mapear cada persona a la forma de `create_person_report` (o un upsert directo con `source`/`source_id`).
4. Sources confiables → `auto_approved`; esta fuente entra como `pending` hasta validación, salvo que el founder la marque confiable en `import_sources`.
5. Snapshot tests en `tests/fixtures/` con una página real congelada.

## Preguntas abiertas para el founder

- ¿Esta fuente es **confiable** (auto-approve) o entra a la cola de moderación (`pending`)?
- ¿Contactamos al operador (developer@…) para federación PFIF formal antes de ingestar a escala? (El PLAN D6 contempla el email de federación.)
