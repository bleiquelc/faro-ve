# HANDOFF — Tapar-cara de menores (Prioridad #4) — NO desplegado, requiere blur SERVER-SIDE

> Estado: **diseñado + verificado el blur, pero NO desplegado.** La revisión adversarial
> (security-reviewer) encontró un hueco real: el blur del-lado-cliente NO es verificable por el
> servidor → un reportante malicioso podría exponer la cara de un menor. Por la regla #3
> (INVIOLABLE), se revirtió. El estado actual SEGURO sigue: **foto de menor OCULTA** (placeholder).

## Objetivo
Mostrar la foto de un menor **difuminada** (cara irreconocible) en vez de ocultarla, para que
quienes buscan vean apariencia general (contextura, color de pelo/piel, ropa) sin revelar identidad.
Regla #3 sigue intacta: la cara de un menor NUNCA pública sin difuminar.

## Lo que SÍ quedó verificado (reusable)
- **Fuerza del blur**: downscale a **24px** de ancho + `ctx.filter='blur(11px)'` al ampliar.
  Verificado visualmente (preview): una cara realista queda irreconocible (sin rasgos), el texto
  "ROSTRO 7" queda ilegible, pero se preserva apariencia general. Caso peor (rasgos de alto
  contraste) también difuminado. El re-encode por canvas (`toBlob`) elimina EXIF.
- **Arquitectura correcta** (excepto el límite de confianza): columna `photo_url_blurred` (versión
  pública), `photo_url` original queda admin_only; la vista `persons_public` sirve la difuminada
  SOLO para fotos no-públicas (menor/edad-desconocida), o null (fail-safe). El detail page rotula
  "difuminada por ser menor".

## El HUECO que lo bloquea (security-reviewer, BLOCKER)
El blur ocurre en el navegador (`makeBlurredPhoto`). El cliente sube la difuminada y manda
`photo_url_blurred` en el POST. **El servidor confía en que ese path está difuminado.** Un reportante
malicioso puede subir la foto SIN difuminar como `photo_url_blurred` → la vista la sirve como
"difuminada" → cara de un menor expuesta. Es un **retroceso** vs. ocultar (que es seguro por
construcción). La moderación (todo reporte es pending) es una red, pero no es suficiente para una
regla INVIOLABLE: un moderador podría no notar que una "difuminada" es en realidad clara.

## Fix correcto: difuminar SERVER-SIDE (el original nunca llega al cliente público)
El cliente sube SOLO el original (admin_only). El servidor genera la versión difuminada. Opciones:
1. **Cloudflare Image Resizing** (`/cdn-cgi/image/blur=250,width=200/<src>`): el blur ocurre en el
   edge; el cliente recibe SOLO el resultado difuminado. Requiere habilitar Image Resizing (ver plan
   free/Pro) y que el source (bucket privado) sea accesible al transformador. Verificar fuerza del blur.
2. **WASM en una Pages Function / Worker** (p.ej. photon-rs): fetch del original → downscale+blur →
   guardar `photo_url_blurred`. Sin canvas en Workers; usar wasm. Verificar bundle + free tier.
3. **Supabase Edge Function** (Deno + canvas/wasm) disparada al subir, que produce la difuminada.
Cualquiera: el ORIGINAL nunca se expone; la difuminada se genera con la lógica ya verificada
(24px + blur11). Mantener el fail-safe: si la generación falla → la vista oculta (null).

## Otros hallazgos de la revisión (aplicar al reconstruir)
- **Migración**: `create or replace view` NO permite reordenar columnas existentes. La nueva columna
  `photo_is_blurred` debe ir **al FINAL** del SELECT (después de `contact_phone_optional`), no
  intercalada. (Mi 0016 fallaba por esto — corregir antes de aplicar.)
- **`is_minor` fail-open**: la columna generada (0001) es `false` cuando `age IS NULL`
  (`case when age is null then false else age<18`). El trigger 0012 SÍ trata edad-desconocida como
  menor (admin_only), pero la columna `is_minor` no. No filtra la foto (la vista usa `photo_visibility`),
  pero el flag es inconsistente. Considerar `age is null then true` (cambio de columna generada =
  drop/recreate, invasivo — la vista depende de ella).
- **GET /api/persons**: añadir `photo_is_blurred` al SELECT si algún consumidor del payload lo necesita.
- **`source_url`**: para menores (`photo_visibility != 'public'`), suprimir o advertir el link "ver
  original" (el sitio externo podría mostrar la cara). Fotos ingestadas de menores: siguen ocultas (ok).

## Decisión pendiente del founder
- (A) Difuminar server-side (seguro, más trabajo/infra) — **recomendado**.
- (B) Aceptar el blur cliente + confiar en moderación (más riesgo; no recomendado para regla INVIOLABLE).
- (C) Mantener oculto (estado actual seguro).
