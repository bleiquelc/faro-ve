# 2026-07-29 — Operación desatendida: publicación parada, alertas ruidosas, promesas legales sin mecanismo

> Sesión de reparación. El sitio funcionaba; lo que fallaba era **operar solo**.
> 5 commits: `9ca4935`, `76e11f6`, `04201e4`, `90165d4`, `8b047f3`.

## Resumen

| # | Problema | Estado |
|---|---|---|
| 1 | IG llevaba ~24h sin publicar y nadie se enteró | 🟢 causa raíz arreglada (**falta deploy**) |
| 2 | Falso positivo diario que enmascaraba errores reales | 🟢 arreglado y verificado en vivo |
| 3 | Crash del cron por HTML tratado como JSON | 🟢 arreglado + helper reusable |
| 4 | Reglas #10 y #6 sin software que las cumpliera | 🟢 implementado (**faltan 3 pasos founder**) |
| 5 | ~46k pines viejos mal ubicados | 🔴 sigue esperando 1 secret del founder |

Gates: **144/144 tests** (de 100 al empezar), **svelte-check 0**, build limpio.

---

## 1 · El auto-publicador: la ventana nunca avanzaba

**Síntoma.** Desde el 28-jul 11:56Z, cada hora: `Fin. Publicadas=0. Intentos=0.`
Congelado en `Posteadas total=174`.

**Causa raíz.** [cron-ig.mjs](../../scripts/buffer/cron-ig.mjs) hacía
`fetch(`${FARO}?status=missing&limit=400`)` **sin offset**, y `/api/persons`
ordena por `created_at DESC` → el cron veía **siempre las mismas 400 filas más
nuevas de 47.820**.

Mientras la ingesta traía cientos por día la ventana se movía sola. Al bajar a
~5-7/día se congeló: todas posteadas o skipeadas → 0 candidatos. El 28-jul a las
11:56Z se re-skipearon las últimas 11 → **todos los TTL de 3 días quedaron
sincronizados al 31-jul**, de ahí el silencio total.

**Lo que nadie había medido.** Muestreando `/api/pfif?offset=` a distintas
profundidades, la cobertura de foto del corpus es 7% en lo más nuevo y ~30% en lo
viejo (34,1% en la franja verificada). O sea: **~8.800 personas con foto
publicable nunca entraron al pipeline.** El cron había considerado 400 de 47.820.

**Fix.** `offset` en `personFiltersSchema` + `.range()` en el endpoint + **desempate
por `id`** en el `ORDER BY`, y cursor persistido en `state.json` (mismo patrón que
el `ingestCursor` del mantenimiento). El cursor siempre avanza → no se atasca.

El desempate no es cosmético: la ingesta inserta lotes con `created_at`
**idéntico**. Verificado contra la DB real paginando 2.000 filas:
**0 duplicadas con desempate, 2 duplicadas sin él.**

> ⚠️ **Requiere deploy de Pages.** Hasta entonces prod ignora `offset`, el cron
> pagina sobre las mismas filas y no publica — igual que hoy, nunca peor.

**Vacío conocido (no resuelto):** `/api/persons` sin `q` filtra `lat is not null`,
así que las personas ingestadas sin geocodificar (desde 0028) siguen fuera del
alcance del publicador. Son reportes válidos que merecen difundirse.

## 2 · La alerta que gritaba todos los días

`daily.mjs:136` alertaba si el err.log tenía **cualquier byte**. Pero ffmpeg
escribe **toda su salida normal a stderr** (banner, flags de `configure`,
streams, progreso `frame= fps=`) → `reel.err.log` pesaba 13-16 KB a diario y
disparaba "el reel diario registró errores" desde el 13-jul, **en el mismo
reporte que decía "reel de ayer: programado ✅"**.

El mantenimiento salía `exit 1` con "2 PROBLEMA(S)" todos los días. Una alerta
que grita siempre es una alerta apagada.

**Fix en dos capas:**
1. **En el origen** — las 3 llamadas a ffmpeg en `make-reel.mjs` pasan de
   `stdio:'inherit'` a captura; la salida solo se imprime si ffmpeg **falla**.
2. **Defensa en profundidad** — `scripts/lib/err-log.mjs`: `looksLikeRealError()`
   reconoce *firmas de fallo* en vez de intentar enumerar el ruido (infinito).
   Se sigue **archivando siempre** a `.bak`; solo cambia si alerta.

Validado contra **17 días de logs reales**: 0 señales en todo el ruido de ffmpeg,
5 en el crash del 29-jul, 33 en la caída de red del 5-jul. Verificado end-to-end
contra el mantenimiento vivo: solo ruido → **"✅ Todo sano", exit 0**; error real
→ alerta nombrando la línea exacta, exit 1; error **enterrado** en el ruido →
alerta igual (no queda enmascarado).

## 3 · El crash: `<anonymous_script>` era `cron-ig.mjs:85`

Reproduje la firma con Node v24: `<anonymous_script>:1` es exactamente lo que
imprime un **top-level await** con `.json()` fallido dentro de un `.mjs`. Era la
línea 85 — la única `.json()` sin guarda que corre **antes del primer `log()`**,
por eso el crash no dejaba rastro en `cron.log`.

Crucé los `.bak` con las horas faltantes en `cron.log`: 437 bytes = 1 crash = 1
hora de publicación perdida. **26-jul: 3 · 27-jul: 4 · 28-jul: 1.**

**Fix.** `scripts/lib/fetch-json.mjs` — valida `res.ok` + `content-type` antes de
parsear, reintenta lo transitorio, falla rápido ante 4xx, y lanza siempre
`FetchJsonError` con URL + status + fragmento acotado. `fetchJson.safe()` degrada
sin lanzar. Migrados **los 13 sitios de llamada**.

`found-detector.mjs` tenía el **mismo vector**: se llama desde el bucle de
`cron-ig` sin try/catch → un HTML de Anthropic también mataba el proceso.

## 4 · Reglas #10 y #6: de promesa a mecanismo

**Corrección a los datos de partida:** no hay retiros vencidos. Son 22 retirados;
el **primer vencimiento es el 31-jul** (21 personas) y otro el 10-ago. Ninguno
lleva PII de reportante (son ingestados) — pero el mecanismo debe existir antes
de que se retire un reporte hecho en Faro con email.

**Arquitectura** (decisión founder): **captura por evento, acción en el
mantenimiento del Mac**. El cron de Workers no dispara en cuenta free (verificado
el 8-jul), pero un **Email Worker no es un cron**: se dispara al recibir.

- **Migración 0033** — `optout_requests` (cuarentena, solo service_role) +
  `record_optout_request` (clasifica, **no actúa**) + `process_optout_request`
  (desactiva fuente + `DELETE WHERE source=X AND withdrawn_at IS NULL` + audita)
  + `purge_withdrawn_pii` (regla #6, idempotente, auditada).
- **workers/email-optout** — registra en cuarentena y **reenvía al Gmail del
  founder igual que hoy**. Nunca borra.
- **daily.mjs** — purga lo vencido y resuelve las pendientes.

**Seguridad.** El founder eligió "auto-purga solo si el dominio coincide". Sin
DKIM eso no vale nada: el `From` se falsifica en 30 segundos y el DELETE en juego
son **47.800 personas**. Por eso se exige **dominio de la fuente Y `dkim=pass`**
(Cloudflare lo valida antes de entregar y lo deja en `Authentication-Results`,
la única parte que el remitente no puede falsificar). Sin las dos → `needs_review`
+ alerta al founder (el SLA de 24h se cumple por la alerta).

**Verificado en una transacción REVERTIDA** contra el schema real (DB intacta):

| Caso | Resultado |
|---|---|
| `legal@venezuelatebusca.com` + DKIM | `auto_eligible` (fuente identificada) |
| `atacante@gmail.com` + DKIM | `needs_review` ✅ bloqueado |
| dominio correcto **sin** DKIM | `needs_review` ✅ spoofing bloqueado |
| reintento mismo `message_id` | idempotente |
| `purge_withdrawn_pii()` | 0 (nada vencido aún) |

## Nota honesta

En una corrida intermedia la suite dio 1 fallo que **no se pudo reproducir** en
9 corridas limpias posteriores. No quedó capturado cuál era. Si reaparece, hay
que identificarlo antes de darle crédito a la suite.

## Pasos del founder que esto deja

1. **Deploy de Pages** → activa el barrido con cursor (sin esto el #1 sigue igual).
2. **Aplicar 0033** en el SQL Editor → activa reglas #10 y #6.
3. **Desplegar el Email Worker** + apuntar `opt-out@` a él en el panel CF.
4. **`wrangler secret put SUPABASE_DB_URL`** (pendiente desde el 2-jul) → re-geocodifica
   los ~46k pines viejos. **Verificado hoy: el secret NO está puesto** (el worker
   solo tiene `SUPABASE_SERVICE_ROLE_KEY`).
