# Sesión 2026-06-27 — Faro Auxilio: núcleo estático LIVE

## Qué se hizo (y quedó LIVE)
**Faro Auxilio — núcleo ESTÁTICO de primeros auxilios** (función 8, paso 1 del handoff). LIVE en `https://faro-ve.com/auxilio`. Commits `c3d66b5` (feature) + `f091ce8` (docs).

### Contenido (CERO invención, cita por procedimiento)
- 18 procedimientos en 2 categorías:
  - **Primeros auxilios (10):** sangrado, RCP adulto, atragantamiento adulto, atragantamiento bebé, quemaduras, fracturas, persona atrapada/aplastamiento, shock, desmayo/posición de recuperación, golpe de calor.
  - **Sismo y supervivencia (8):** durante el sismo (dentro / afuera), después del sismo, atrapado bajo escombros, agua segura (hervir / cloro), comida segura, kit de emergencia.
- Cada uno por PASOS: **qué hacer / qué NO hacer / cuándo llamar al 911** + **fuente oficial clickeable**.
- Fuentes: IFRC 2020/ILCOR, AHA (Hands-Only CPR), Cruz Roja Americana, St John Ambulance, Mayo Clinic, CDC, EPA, OMS, FoodSafety.gov, Ready.gov/FEMA, FUNVISIS/Protección Civil VE, Great ShakeOut.
- **Verificación:** 3 agentes de investigación recopilaron y confirmaron vía web cada protocolo + cifras críticas (RCP 100–120/min ≥5cm sin pasar 6cm; atragantamiento 5+5; bebé nunca Heimlich abdominal; hervir 1 min / 3 min en altura; cloro 2 gotas/L al 5–9%; comida 4h/4°C). Un agente adversarial de fidelidad reconfirmó independientemente.

### Contactos (un número errado cuesta vidas)
- **Verificados y marcables:** 911 (nacional), CICR personas-desaparecidas (0412-636.50.15 / 0424-172.13.64), Cruz Roja VE (0212-571.43.80), Bomberos Caracas (0212-545.45.45).
- **No verificados (NO marcables):** Protección Civil 0800, FUNVISIS, 7 hospitales de Caracas → muestran ubicación/dirección + "marca 911"; el teléfono de directorio se muestra apagado como "sin verificar".

### UX / marca / técnica
- Marca **FaroAuxilio** = faro con cruz blanca iluminada (compact para botón, completo para encabezado).
- **Botón flotante siempre visible** (mid-right) en toda la app, oculto en `/auxilio`. En layout global.
- Aviso visible "⚠️ En revisión · no reemplaza atención profesional" + botón rojo "Emergencia — Llamar al 911" arriba.
- Tabs (Guía / Contactos), buscador instantáneo, tarjetas `<details>` (accesibles, sin JS).
- **GLOBAL** (founder lo prueba desde Suiza). Estático → chunk de ruta aislado (44KB/12KB gzip), no infla el bundle inicial. Offline vía precache + navegación cliente.

## Rigor aplicado (regla del founder)
- **Revisión adversarial multi-agente antes de prod:** typescript-reviewer + security-reviewer + fidelidad-de-contenido. Hallazgos corregidos: `ContactType` no exportada (error de tipos), ARIA tabs (aria-controls/tabpanel), keys en `#each`, atribución EPA incorrecta en cloro (→ CDC+OMS), precisión de altitud de hervido, tecnicismo "Heimlich", Prettier.
- **Verificación EN VIVO** (navegador real, dev server): render, tabs, expand de RCP (cifras correctas), buscador, contactos (solo verificados marcables), FAB en home y mapa (sin colisiones). Cero errores de consola del código nuevo.
- **Prod verificado:** `/auxilio` 200 con contenido; smoke (home 200, persons 200); FAB presente en home, oculto en /auxilio.

## Pendiente
- **Founder:** validar contenido médico (idealmente profesional) antes de quitar "en revisión"; confirmar los 4 contactos "sin verificar".
- **Chat IA (paso 2) + geo-switch (paso 3):** diseño listo en `HANDOFF-funciones-urgentes.md` (función 8 → "PENDIENTE para el chat IA"), con SQL `app_config.ai_ve_only` listo-para-pegar. No construido aún porque el chat no se puede verificar en vivo sin `ANTHROPIC_API_KEY` + AI Gateway del founder. El núcleo estático ya es el fallback robusto.
- **Hardening opcional (no bloqueante):** la revisión de seguridad sugirió `static/_headers` (anti-clickjacking) y `sourcemap:false` en prod. El repo es público (AGPL) → los sourcemaps no filtran nada nuevo. Decidido NO tocar config global en este deploy; queda anotado.

## Archivos nuevos
- `src/lib/data/auxilio/{types,sources,first-aid,survival,contacts,index}.ts`
- `src/lib/components/{FaroAuxilio,FaroAuxilioButton}.svelte`
- `src/routes/auxilio/+page.svelte` · modificado `src/routes/+layout.svelte`

---

## Continuación (mismo día) — modo automático

El founder dejó en automático ("decide prioridades por lo que más ayuda, verifica y deploya si estás seguro") + regla nueva: **toda feature nueva lleva ícono estilo Faro, coherencia total**.

Decisión por confianza × impacto (las funciones de IA están bloqueadas por el secret del founder; tocar el service worker es riesgoso en vivo). Se entregaron dos features autónomas, verificadas y LIVE:

### A) Faro Auxilio deepening: 18 → 23 guías (commit `98df51a`)
+5 procedimientos críticos de sismo: torniquete, RCP niño/bebé, convulsiones, electrocución, apoyo psicológico. Investigados con un **workflow multi-agente** (1 investigador + 1 verificador adversarial por procedimiento). El stage adversarial **atrapó y se corrigió antes de prod**:
- electrocución: distancia de cable de alta tensión **15 m era INVENTADA** → 11 m (ESFI).
- RCP bebé: técnica **invertida** → dos pulgares rodeando es lo preferido (AHA 2025), no los 2 dedos.
- RCP niño: se quitó "2 dedos de profundidad" (confuso).
- apoyo psicológico: errata "de inicia" → "de inmediato".
Verificado en vivo (23 guías, "11 metros", "dos PULGARES", typo corregido) + prod 200.

### B) Cuerpos NN: formulario LIVE (commit `b44c006`)
`/reportar/cuerpo-nn` reusa el camino probado `POST /api/persons` (status `unidentified_body`). La vista (filtro + marcadores) ya existía → cierra la función 6. Revisión de regresión confirmó cero merma de privacidad. Ícono Faro nuevo `candle` (vela cuya llama es el punto de luz). Foto sin forzar cámara + advertencia de sensibilidad. Verificado: render + payload schema-válido en dev; prod 200 (no se inyecta data falsa al mapa por ética).

Hallazgo de scouting: el mapa YA colorea/pulsa por menor/urgencia médica y FilterChips YA filtra (función 7 esencialmente hecha). Forms aún vacías: avistamiento, condicion-medica, refugio.

---

## Continuación (tanda 3) — formularios de reporte completos (commit `897cc01`)

El founder pidió "deploya los formularios". Antes de construir, scouting de contratos (PLAN.md L232 + schemas): avistamiento="crea note" (necesita person_id), refugio=aid_point shelter, condicion-medica=persona medical_urgent. Todo por REUSE:
- **condicion-medica** → `/api/persons` (status=missing, medical_urgent=true forzado, medical_category requerido). Payload verificado en navegador.
- **refugio** → `/api/aid-points` (type shelter_temporary|permanent, capacidad, coords EXACTAS — lugar de servicio). Clon fiel de punto-ayuda.
- **avistamiento** → como las notas exigen person_id, reusa búsqueda `/api/persons?q=` + el **InfoForm** probado (POST /api/notes, sighting). Flujo búsqueda→selección→InfoForm verificado con fetch mock (DB local inalcanzable). person_id de resultado real, no inyectable.
- **Hub `/reportar`** lista las 7 formas (5 persona + 2 lugar), cada una con ícono Faro. Home enlaza al hub sin regresar las 4 acciones rápidas.
- **Íconos Faro nuevos:** sighting (ojo+luz), medical (latido ECG+luz), shelter (carpa con entrada+luz — corregido en vivo: la primera versión parecía señal de ⚠️).
- **Rigor:** svelte-check 0 errores; revisión adversarial (código + regresión de privacidad: clones fieles, 0 merma); prod 200 en las 4 rutas + hub lista las 7 + home enlaza.

**Cableado auditado este día:** persons_public incluye unidentified_body; create_person_report publica 'approved'; 0 citas de fuente colgadas; todos los href resuelven. Listas actualizadas (STATUS.md + memoria).

---

## Continuación (tanda 4) — íconos propios de Faro Auxilio (commit `790f7cb`)

El founder mostró las tarjetas con emoji y pidió "íconos propios de la app". Nuevo `AuxilioIcon.svelte`: 31 glifos de línea estilo Faro (viewBox 24, stroke currentColor 1.7, punto de luz #FFE39C) keyed por id. Reemplazados TODOS los emoji de `/auxilio`: 23 guías + 2 categorías + 6 contactos + 2 tabs + buscador. Eliminado TYPE_META (dead code). Verificación visual en navegador de los 31 íconos; refinados quemaduras (llama clara), shock/desmayo (figuras distintas), refugio (carpa, no ⚠️). Revisión de código: cross-check 31 ids ↔ 31 branches exacto, 0 fallbacks. Coherencia total: cero emoji de feature en Faro Auxilio. Prod 200.

---

## Continuación (tanda 5) — chat IA de Faro Auxilio LIVE (commit `de5564a`)

El founder pidió habilitar el chat IA (API key ya configurada). Faltaba: el endpoint, el helper de servidor y la UI (la infra ya estaba: rate-limit 10/día, budget tables, vars del modelo, KV).

Construido por reuse del patrón del worker ai-triage:
- `src/routes/api/ai/ask/+server.ts`: Haiku 4.5 vía AI Gateway (o directo a Anthropic), system prompt anclado SOLO en las guías verificadas (`auxilio-knowledge.ts`), budget guard $5/día, geo-switch (app_flag/app_config), fallback robusto.
- `AuxilioChat.svelte` + tab "Preguntar" en `/auxilio` (avatar FaroAuxilio, texto plano, sugerencias, 429/errores).
- hooks: `/api/ai/ask` exento de Turnstile (solo lectura; rate-limit + budget protegen).
- Migración 0023 (app_flag + ai_ve_only) lista para el geo-switch; default global.

Revisión de seguridad (security-reviewer): atrapó un ALTO — `cache_control` de Anthropic sin header beta → 400 → fallback silencioso (el chat parecería "no funcionar"). Fix: system como string, el caché lo da el AI Gateway. + guard anti-forja de history (MEDIUM).

Verificado en PROD (curl + navegador con mock del success-path): responde correcto y fiel a las guías (RCP, sangrado), texto plano, global (sin header de país), reorienta off-topic; UI renderiza la conversación. `ANTHROPIC_API_KEY` confirmada como Pages secret.
