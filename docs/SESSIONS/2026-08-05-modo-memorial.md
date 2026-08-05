# Sesión 2026-08-05/06 (noche) — El home es un LUGAR DE MEMORIA

> Pedido del founder (antes de dormir, modo automático autorizado end-to-end,
> incluido deploy): "ya ha pasado tiempo desde el terremoto y personas vivas es
> posible no se consigan… debe ser un lugar de memoria, seguirá brindando sus
> funciones, pero la idea es que no se olviden las personas que nunca se
> encontraron; se debe sentir espiritual, suave, calmado y de respeto hacia los
> fallecidos; analiza ubicar el faro en un lugar del mapa, que no se vea tan
> plano, que desde allí ilumine."

## Lo que quedó LIVE (commit `9ae5a21`, deploy `8847685c`)

**Al entrar a faro-ve.com:** solo el mapa de luz —
- Las **velas** de los reportados reales respirando desincronizadas (ya existían, `faro-sos`).
- El **FARO alzado sobre la costa de Macuto** (torre silueta 72 px, lámpara #FFE39C que
  respira 7 s, **doble haz giratorio 26 s** + charco de luz cálida `mix-blend: screen`).
  Da la verticalidad pedida ("que no se vea tan plano").
- **Guacamayas** (4 en móvil / 6 en desktop) en colores venezolanos desaturados con halo
  cálido, aleteo con planeos, gravitando hacia las zonas más afectadas.
- Arriba, muy sutil: **"SEGUIMOS BUSCANDO A / {nombre}"** — cada nombre se enciende letra a
  letra (45 ms/letra), sostiene ~3.6 s y se apaga letra a letra (85 ms/letra). Cada 7
  nombres, una frase de tributo sin nominar ("En memoria de quienes ya no están", …).
- Abajo: **"TOCA PARA EXPLORAR"** respirando apenas.

**Cualquier gesto** (tocar, mover, tecla, foco) despierta la UI completa — título con el
nuevo copy "Un lugar de memoria y esperanza", contador, botones, footer con atribución —
y tras **10 s de calma** vuelve a desvanecerse (fundido 1.15 s). El nombre del memorial se
retira mientras la UI está despierta (no choca con el título) y regresa con la calma.

## Decisiones de privacidad/ética (founder, AskUserQuestion + análisis)

| Tema | Decisión | Por qué |
|---|---|---|
| Nombres | **Desaparecidos que buscamos** — jamás fallecidos nominados | No existe el dato (`found_deceased_morgue` nunca se escribe; `deceased:0` es exacto; cuerpos NN = anónimos). El único fallecimiento confirmado (familia Guerrero) la familia pidió RETIRARLO — el precedente manda. El nombre de un desaparecido ya es público e instrumental (alguien puede reconocerlo). |
| Zonas de las aves | Agregado **a nivel ciudad** (clusters zoom 9, ~4 km), de TODOS los reportes | Concentrar por celdas finas o por estado fallecido dibujaría un mapa de mortalidad por edificio (celda n=3 en Tanaguarena = Costamar II) — exactamente lo que la ofuscación #1 evita. |
| Estilo aves | Color venezolano **desaturado** + halo cálido | Elección founder (vs. siluetas). |
| Tributo a fallecidos | Frases SIN nominar, intercaladas | Honra sin exponer; consistente con `PULSE_CLASS.deceased = null` (dignidad ya codificada). |

## Archivos

- `src/lib/components/MemorialSky.svelte` — canvas guacamayas. **30 fps cap** (regla #23),
  pausa con pestaña oculta, apagado con `prefers-reduced-motion` y `html.low-power`.
  Proyección Web Mercator propia (mapa del home es fijo). Fallback de zonas si la API falla.
- `src/lib/components/MemorialNames.svelte` — ciclo de nombres. Lote rotativo de 60 entre
  los ~40k (`pickOffset` aleatorio); fallback CORS a la API pública. `aria-hidden` (decorativo)
  + párrafo `sr-only` estático. Reduced-motion → fundido simple sin stagger.
- `src/lib/utils/memorial.ts` — `cleanDisplayName` (title-case + rechazo de basura scrapeada,
  dígitos, frases "todos los de la imagen"), `pickOffset`, `shuffled`, tributos. **22 tests**
  en `tests/utils/memorial.test.ts`.
- `src/lib/client/idle-ui.ts` — visibilidad por actividad. SOLO opacity (nunca aria-hidden /
  display): lector de pantalla y teclado siempre la tienen; `focusin` despierta; con foco
  dentro de la UI no se esconde; sin JS queda visible (regla #7 footer).
- `src/lib/components/Map.svelte` — prop `memorial`: `addLighthouse()` en pane propio
  (z 320, bajo los markers), posición `[10.6035, -66.879]` (Macuto). CSS del faro al final.
- `src/routes/+page.svelte` — integración completa; imports dinámicos (chunks lazy, #21).

## Verificación

- `npm test` **166/166** (144 previos + 22 nuevos) · `npm run check` **0 errores** · build limpio.
- Chunks: MemorialSky y MemorialNames en chunks separados (bundle inicial intacto).
- Preview 390×844 (navegador real): entrada memorial ✓ · wake al toque con TODAS las
  funciones ✓ · auto-fade a los 10 s ✓ · haz del faro rotando ✓ · guacamaya girando ✓ ·
  `/mapa` intacto ✓ · consola sin errores ✓.
- **PROD** (faro-ve.com): smoke 8 rutas/APIs **200** · clave sigue `sb_publishable` ·
  screenshot con data real (velas + faro + 4 guacamayas + nombre + hint) ✓.

## Bono del deploy

Este deploy de Pages también **shipeó lo pendiente de main desde el 29-jul**, en particular
el fix de `offset` en `/api/persons` que el cron IG necesitaba (su ventana de candidatos
estaba congelada porque prod ignoraba `offset`). El pipeline de fichas puede volver a avanzar.

## Pendientes que NO cambian

Rotación de clave ✓ hecha (12-jul, re-verificada hoy). 0031/0033 aplicadas (hoy). Restan:
Email Worker de opt-out (desplegar `workers/email-optout` + regla en panel CF) y los
recordatorios de siempre en el reporte de mantenimiento.
