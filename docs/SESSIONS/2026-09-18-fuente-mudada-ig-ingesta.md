# 2026-09-18 — La fuente se mudó de dominio: IG en 0, ingesta en ETIMEDOUT

## Síntomas
1. `com.farove.ig` exit 0 pero `Publicadas=0` desde el 6-sep; todo «Sin foto limpia» en ~50 ms/ficha; caché de fotos sin entradas nuevas.
2. `daily.mjs`: ingesta `spawnSync node ETIMEDOUT` + `HTTP 404` en todos los términos.
3. Reels del 17 y 18-sep sin programar (ffmpeg `errno -86`, binario de otra arquitectura — ya resuelto con ffmpeg arm64; no es de esta sesión).

## Causa raíz (una sola para 1 y 2)
Entre el **5-sep 18:14 UTC** (última foto de workers.dev clasificada) y el **6-sep 07:00 UTC**
(primera ingesta fallida) la app de Venezuela Te Busca dejó de servirse en
`venezuela-te-busca-app.hellogafaro.workers.dev` y pasó a **`app.venezuelateayuda.com`**
(`venezuelatebusca.com` → 308 → `venezuelateayuda.com`, que es OTRA web, de donaciones).

| Prueba | Respuesta |
|---|---|
| Host viejo: `/`, `/_root.data?query=…`, 6 fotos | `404 text/plain` · `error code: 1042` |
| Control: Worker inventado en la misma cuenta | idéntico → el Worker viejo ya no está publicado |
| `app.venezuelateayuda.com/_root.data?query=…` | `202` + `SingleFetchRedirect` 308 a `/finder?query=…` |
| `app.venezuelateayuda.com/finder.data?query=…` | `200`, clave `routes/finder`, misma forma; `mapRecord()` 24/24 |
| 9 fotos antiguas, mismo path, host nuevo | 9/9 `200` |

- **IG:** el 100 % de `photo_url` era hotlink al host muerto (20.392 fichas + 62 señales). `fetch` → 404 →
  `kind:'unreachable'` (no se cachea) → «Sin foto limpia». El log no decía el motivo, por eso tardó 12 días en verse.
- **Venezuela Reporta cerró su API:** `401`, exige `x-api-key` (se pide a `ayuda@venezuelareporta.org`).
  Desde el 8-sep ~13:00 UTC `vrMatch` devuelve null EN SILENCIO → el guardarraíl «no publicar si figura a
  salvo en VR» está apagado. **Pendiente del founder.**
- **Daño real:** 2 fichas publicadas SIN foto el 10-sep (Eleany Solís, Jainileth Contreras): caché «usable»
  de una URL muerta + `render-ficha` tapando la imagen rota con el placeholder. El founder las borra de IG.
- **ETIMEDOUT:** cada término fallido costaba ~20,5 s (4 intentos con 4+6+8 s + 2 s) × 155 ≈ 53 min > 15 min.
  484 líneas de 404 ÷ 11 días = 44 términos/día = lo que cabe en 15 min. El reporte leía solo stdout; el 404 iba por stderr.
- Clave Anthropic OK (200). No era créditos ni modelo.

## Arreglos (TDD: 198/198 tests)
| Qué | Dónde |
|---|---|
| `BASE`/`DATA_PATH`/`ROUTE_KEY` nuevos; error claro si cambia la estructura; lo permanente (4xx≠429) NO se reintenta | `scripts/ingest/venezuela-te-busca-core.mjs` |
| Corte tras 5 términos seguidos fallidos → `exit 2`, cursor sin avanzar (regla #12) | `scripts/ingest/venezuela-te-busca.mjs` |
| El reporte diario incluye la cola de stderr | `scripts/lib/err-log.mjs` (`execFailureSummary`) · `daily.mjs` |
| Migración `0034`: host de `photo_url` (persons + person_found_signals), 1 fila de auditoría resumen | `supabase/migrations/0034_photo_host_move.sql` — **APLICADA** con OK founder |
| 1.853 veredictos de visión conservados (claves del caché re-alojadas; backup `ai-cache.json.bak-2026-09-18`) | `scripts/lib/photo-cache-rehost.mjs` · `scripts/buffer/migrate-photo-cache-host.mjs` |
| Guardia: si `PHOTO_URL` no cargó → `exit 1` antes del screenshot | `scripts/buffer/render-ficha.mjs` |
| Barrido salta desiertos de fotos; los intentos van primero a fichas con foto; el log dice el motivo real | `scripts/buffer/cron-ig.mjs` · `scripts/lib/ig-candidates.mjs` |
| Alerta nueva: «las fotos de la fuente no responden» (≥10 `unreachable` en 24 h) | `scripts/lib/ig-watchdog.mjs` |
| `ROBOTS_URL` sigue a `BASE` | `workers/cron-ingest/src/adapters/venezuela-te-busca.ts` (sin desplegar) |

## Verificación
- DB: 20.392 + 62 filas en el host nuevo, 0 en el viejo; 0 filas de auditoría por-ficha; 0 menores con foto pública.
- API pública: la 1ª página ya sirve `app.venezuelateayuda.com` (187/187).
- Ingesta `--dry` contra la fuente real: 8 requests, 192 personas, paginación por cursor OK.
- `render-ficha`: foto muerta → `exit 1` sin JPG; foto viva → ficha con foto. Caché: acierto sin llamada a IA.

## Pendiente del founder
- **VR:** pedir la llave de API (o aceptar publicar sin ese cruce).
- **Atribución:** `SOURCE_URL` sigue en `venezuelatebusca.com` (redirige a la web de donaciones). Decidir texto/enlace en footer y `/atribucion`; el host nuevo no tiene `robots.txt`; contacto `info@venezuelateayuda.com`.
- **Reel del 18-sep:** generado, sin programar (`reel-post.mjs` acepta `DUE_AT`).
- **Espejo de fotos:** un hotlink externo es un punto único de fallo; evaluar copiar a Storage/R2 las fotos publicables.

## Lección (para el hub)
Loguear SIEMPRE el motivo del descarte y cortar por fallos consecutivos en scrapers: un «exit 0 con 0 resultados»
y un «timeout» escondieron 12 días una causa que una línea de log habría nombrado el primer día.
