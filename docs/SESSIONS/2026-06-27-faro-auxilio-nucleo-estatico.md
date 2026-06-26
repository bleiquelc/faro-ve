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
