# HANDOFF — Faro VE · funciones urgentes para el siguiente chat

> Pegá este archivo en el chat nuevo de Claude Code. Emergencia humanitaria: 48h+
> tras el terremoto de Venezuela, miles de personas atrapadas. Founder: Bleiquel
> Colina (solo). Modo: velocidad CON rigor. Ejecutá en orden de prioridad.

## ✅ Estado actual (lo que YA está LIVE — no rehacer)
- **faro-ve.com LIVE**, 24.546 personas en el mapa. home/mapa 200.
- **Publicación INSTANTÁNEA** (publish-first): los reportes públicos salen al mapa al instante, sin esperar moderación (migración 0021: `create_person_report` inserta `'approved'`). Protecciones automáticas intactas (ofuscación coords, foto-menor admin_only, PII cifrada — son triggers DB independientes de la moderación).
- **Autolimpieza comunitaria** (migración 0022): botón "Reportar perfil falso" en cada ficha → `vote_person` → net (reports−confirms) ≥ 3 → `auto_hidden=true` (reversible) + `founder_alerts` + audit. `persons_public` filtra `not auto_hidden`. Reusa el patrón de aid_points (0014).
- **Turnstile arreglado** (era el bug que bloqueaba los formularios): `PUBLIC_TURNSTILE_SITE_KEY` = sitekey real `0x4AAAAAADrgU4bxPZz44lTt`. Todos los formularios funcionan.
- **Federación PFIF** activa (`/api/pfif`). **Fotos** limpiadas (rotas /migrated/ → null). **Incidente de seguridad cerrado** (keys rotadas/revocadas).
- **🆕 CUERPOS NN — formulario LIVE** (`/reportar/cuerpo-nn`, commit `b44c006`, 27-jun): reportar a una persona fallecida sin identificar para que su familia la halle. Reusa el camino probado `POST /api/persons` (status `unidentified_body`, ya whitelisteado); revisión de regresión confirmó cero merma de privacidad (mismo Turnstile/EXIF-strip/PII cifrada/coords ofuscadas). Ícono propio estilo Faro (`candle`). Link digno desde el form de desaparecido. La vista (filtro "Cuerpos NN" + marcadores) ya existía; esto cierra el loop de la función 6. **Foto sin verificar end-to-end en prod (no se inyecta data falsa al mapa)** — verificado por payload + equivalencia con el form probado.
- **🆕 FARO AUXILIO — núcleo ESTÁTICO LIVE** (`/auxilio`, commit `c3d66b5` + `98df51a`, 27-jun): guía offline de primeros auxilios + supervivencia + contactos verificados. **23 procedimientos** (2 categorías; +torniquete, RCP niño/bebé, convulsiones, electrocución, apoyo psicológico — investigados y **verificados adversarialmente**: la verificación corrigió antes de prod una distancia de cable inventada y la técnica de RCP de bebé), por pasos (qué hacer / qué NO hacer / cuándo llamar 911) **con cita de fuente oficial por cada uno** (IFRC 2020/ILCOR, AHA, Cruz Roja Americana, CDC, EPA, OMS, FoodSafety.gov, FUNVISIS/Protección Civil VE). **Cero invención**; cifras críticas verificadas vía web por agentes (RCP 100-120/min ≥5cm, atragantamiento 5+5, agua hervir/cloro, comida 4h/4°C). Contactos por **tier de verificación**: SOLO los verificados son marcables (911, CICR personas-desaparecidas, Cruz Roja VE, Bomberos Caracas); los NO verificados (Protección Civil 0800, FUNVISIS, hospitales) muestran ubicación y remiten al 911 (un número errado cuesta vidas). Aviso visible "en revisión · no reemplaza atención profesional". Marca FaroAuxilio (faro con cruz blanca) + **botón flotante siempre visible** en toda la app. Es **GLOBAL** (el founder lo prueba desde Suiza). Contenido aislado en el chunk de la ruta (44KB/12KB gzip), no infla el bundle inicial. Revisión adversarial (código + seguridad + fidelidad médica) aplicada antes de prod.

## ⚠️ Restricciones operativas (LEER ANTES DE EJECUTAR)
- **La DB directa NO es alcanzable desde la máquina local** (`db.blmiebnnprwaupyatsyb.supabase.co` es IPv6, la red local es IPv4 → `ENOTFOUND`). El pooler tampoco resolvió. → **Las migraciones SQL se aplican en el SQL Editor de Supabase** (el founder pega y corre). No uses `apply-migrations.mjs` (falla la conexión).
  - SQL Editor: `https://supabase.com/dashboard/project/blmiebnnprwaupyatsyb/sql/new`
- **El código (frontend/endpoints/hooks) SÍ se despliega** con `npm run build && npm run deploy:pages` (es HTTP a Cloudflare, no toca la DB directa).
- **Al founder los comandos/SQL van en bloque de código con SOLO el texto a pegar** — sin explicaciones dentro del cuadro.
- **Revisión adversarial multi-agente del código nuevo ANTES de prod** (regla del founder). Para cambios de SQL: diff contra el original para confirmar mínimo.
- Verificar end-to-end con Claude-in-Chrome (navegador real) — los formularios tienen un quirk: setear inputs con el setter nativo + evento `input` (el `type` simple no gatilla Svelte), y el token Turnstile tarda ~6s en estar listo antes del submit.

## 🔑 Pendientes del founder (dashboard/secretos — sin esto, varias funciones no andan)
1. **Activar login `/moderar`**: en Supabase → Authentication → URL Configuration → Redirect URLs, agregar `https://faro-ve.com/moderar/auth/callback` y `https://www.faro-ve.com/moderar/auth/callback`. (Founder ya es admin seedeado.)
2. **`RESEND_API_KEY`** (Cloudflare Pages secret) → desbloquea el relay de mensajes y el notificador de alertas.
3. **`ANTHROPIC_API_KEY`** ya válida; para el worker de IA hay que setearla como secret del Worker `ai-triage`.

---

# FUNCIONES PRIORITARIAS (orden de urgencia)

## 1. IA-moderadora: restaurar reportes reales auto-ocultados SIN founder 🔴 LA MÁS URGENTE
- **Qué es:** que la IA (no el founder) decida sobre los perfiles auto-ocultados por la comunidad. El founder NO modera nada.
- **Cómo se aplica:** extender el worker `workers/ai-triage/` (ya construido, Haiku 4.5, `stripPii`, budget guard) para que, además del triaje, procese los `persons where auto_hidden = true`: la IA juzga real-vs-falso con SOLO campos públicos y **sesgo fuerte a RESTAURAR** (prompt tipo: "si PODRÍA ser un desaparecido real, restaurar; ocultar solo si es spam/gibberish/troll evidente"). Si decide restaurar → llama una RPC nueva `restore_person(p_id)` (pone `auto_hidden=false, hidden_at=null`; reusar patrón de `reactivate_aid_point` 0014; migración vía SQL Editor). Si confirma falso → lo deja oculto. Requiere `ANTHROPIC_API_KEY` como secret del Worker (`cd workers/ai-triage && wrangler secret put ANTHROPIC_API_KEY && wrangler deploy`) y bajar el cron a ~2-5 min para restaurar rápido. Si la IA falla/no está disponible → default = NO ocultar / restaurar (proteger al real). Founder solo recibe el aviso en `founder_alerts` (opcional).
  - **Variante AÚN más simple (sin IA):** cambiar la Fase 2 para que en vez de ocultar (`auto_hidden`), MARQUE el perfil con un flag `community_flagged` que muestre "⚠ varios lo reportaron como dudoso" pero lo deje VISIBLE. Nunca se pierde un reporte real; los falsos quedan con advertencia. Cero IA, cero moderación. (Trade-off: los falsos no se quitan, solo se marcan.)
- **Qué significa para los usuarios:** si trolls intentan ocultar el reporte verdadero de alguien atrapado, la IA lo detecta y lo restaura solo en minutos → no se pierde ningún caso real, y el founder no tiene que moderar nada.

## 2. Triaje IA — priorizar a quien MÁS urge (heridos, niños, médico) 🔴 YA CONSTRUIDO, SOLO DESPLEGAR
- **Qué es:** clasifica automáticamente cada reporte por urgencia (médico/menor/crítico) y los ordena.
- **Cómo se aplica:** el worker `workers/ai-triage/` YA existe (Haiku 4.5, sin PII vía `stripPii`, budget $5/día, escribe `ai_priority`/`ai_reasoning`/`ai_classified_at` en persons). Pasos: `cd workers/ai-triage` → `wrangler secret put ANTHROPIC_API_KEY` → `wrangler deploy`. Luego en el frontend del mapa/búsqueda, ordenar/destacar por `ai_priority` (el índice `persons_moderation_queue_idx` de 0016 ya existe). Revisar el budget guard antes (regla #14, máx $150/mes).
- **Qué significa para los usuarios:** los rescatistas ven PRIMERO los casos críticos (heridos graves, niños solos, emergencias médicas) → la ayuda llega antes a quien más la necesita.

## 3. WhatsApp de contacto con opt-in del reportante (Fase 3 del plan) 🟠
- **Qué es:** quien reporta a un desaparecido puede ELEGIR mostrar su WhatsApp para que rescatistas/familias lo contacten directo.
- **Cómo se aplica:** migración (SQL Editor): columna `contact_phone_public_reporter` en persons + exponerla en `persons_public` SOLO bajo opt-in (reusar el patrón gated del safe_self_report, `0010_...:74-92`). Frontend: checkbox en `src/routes/reportar/desaparecido/+page.svelte` (default OFF + advertencia "será público") y el RPC `create_person_report` acepta el campo solo si status≠safe_self_report. Botón "Contactar" en la ficha si está el opt-in.
- **Qué significa para los usuarios:** contacto directo e instantáneo entre quien busca y quien reporta → coordinación de rescates mucho más rápida, sin esperar intermediarios.

## 4. Relay de mensajes anti-estafa (`/api/message` + `/mensaje/[id]`) 🟠
- **Qué es:** un buscador le escribe al reportante SIN ver su dato; el mensaje llega por un canal seguro.
- **Cómo se aplica:** la tabla `messages` ya existe (0001, con sender cifrado + reply_token). Construir `POST /api/message` (valida Zod + Turnstile + rate-limit; cifra sender; envía al reportante vía Resend usando `decrypt_for_relay`) y la página `/mensaje/[id]`. Necesita `RESEND_API_KEY` (pendiente founder #2).
- **Qué significa para los usuarios:** cualquiera aporta información de forma segura sin exponer su teléfono/email → protege a las familias desesperadas de estafadores que piden dinero.

## 5. Reportar SIN internet + sincronizar al reconectar (PWA offline) 🟠
- **Qué es:** poder reportar aunque no haya señal; el reporte se sube solo cuando vuelve la conexión.
- **Cómo se aplica:** IndexedDB (Dexie) + Workbox BackgroundSync (ya en el stack `@vite-pwa/sveltekit`). El endpoint `/api/offline-sync` ya está en hooks (rate-limit 20/min). Encolar el POST del formulario si `!navigator.onLine`, registrar un sync y reintentar al volver señal. UI que avise "se enviará al recuperar conexión".
- **Qué significa para los usuarios:** en zonas con red colapsada (lo normal tras un terremoto), la gente igual reporta; no se pierde ningún reporte por falta de señal.

## 6. Cuerpos no identificados (NN) ✅ HECHO/LIVE (`/reportar/cuerpo-nn`, commit `b44c006`)
> Formulario LIVE. Pendiente opcional: que el founder decida la política de FOTOS de cuerpos (hoy: opcional, con advertencia "no gráficas" + nota de que moderación puede ocultar; foto de menor oculta por trigger). Y mejorar discoverability si se desea (hoy: link desde el form de desaparecido; el mapa ya tiene el filtro "Cuerpos NN" para verlos).
- **Qué es:** reportar y buscar cuerpos no identificados para que las familias los reconozcan.
- **Cómo se aplica:** formulario `/reportar/cuerpo-nn` (status `unidentified_body`, YA permitido en `create_person_report`). Cuidado con la foto (sensibilidad; foto de menor sigue oculta por el trigger). Filtro/categoría en el mapa.
- **Qué significa para los usuarios:** las familias identifican a sus fallecidos → cierre y entrega digna; reduce la angustia de la incertidumbre.

## 7. Destacar urgencia médica / menores en el mapa 🟡
- **Qué es:** resaltar visualmente los casos médicos urgentes y los menores.
- **Cómo se aplica:** ya hay `medical_urgent` e `is_minor` en `persons_public` y tokens de color (`lib/utils/colors`). Añadir filtros/realce en el mapa (combinar con `ai_priority` de la función 2).
- **Qué significa para los usuarios:** la atención y la búsqueda se concentran en los casos más delicados (niños solos, heridos).

## 8. "Faro Auxilio" — asistente de primeros auxilios + supervivencia + contactos 🟠 ALTO IMPACTO

> **ESTADO 27-jun:** ✅ **Paso 1 (núcleo ESTÁTICO) HECHO y LIVE** en `/auxilio` (commit `c3d66b5`). Falta: paso 2 (chat IA encima) y paso 3 (geo-interruptor global⇄solo-VE) — ver "PENDIENTE para el chat IA" al final de esta función.
>
> **🔴 Pendiente del founder (antes de "quitar el aviso en revisión"):** validar el contenido médico (idealmente un profesional de salud) y confirmar 4 datos marcados "sin verificar" en `src/lib/data/auxilio/contacts.ts`: el **0800 de Protección Civil**, el teléfono de **FUNVISIS**, y los teléfonos de **hospitales** (hoy solo se muestran dirección + "marca 911", no son marcables a propósito). El 911, CICR (0412-636.50.15 / 0424-172.13.64), Cruz Roja VE (0212-571.43.80) y Bomberos Caracas (0212-545.45.45) sí están verificados y son marcables.
- **Qué es:** un chat/asistente simple, accesible en toda la app, con primeros auxilios, qué hacer en sismo, herramientas caseras, y **contactos de emergencia verificados** (bomberos/Protección Civil/Cruz Roja/hospitales de Caracas). Ayuda a mantener la calma e instruye en lo básico que salva vidas.
- **Cómo se aplica (DISEÑO HÍBRIDO — clave para costo y fiabilidad):**
  1. **Núcleo ESTÁTICO (gratis, offline, SIEMPRE disponible) — el "corazón", con reglas de contenido ESTRICTAS:**
     - **SOLO información verificada, científica, de manuales reales probados en emergencias. CERO invención.** La IA NO genera este contenido — se **cura fielmente de fuentes oficiales con cita por cada procedimiento**. Fuentes-patrón (basadas en evidencia, con versión en español):
       - **IFRC — Guías Internacionales de Primeros Auxilios, Reanimación y Educación 2020** (Cruz Roja / Media Luna Roja) — el estándar global.
       - **AHA** (American Heart Association) — guías de RCP/ECC.
       - **ERC** (European Resuscitation Council) — guías de reanimación.
       - **OMS/WHO** — triaje, agua segura, salud en desastres.
       - **Cruz Roja Venezolana · Protección Civil Venezuela · FUNVISIS** — protocolos locales + contactos + guía sísmica.
     - **Contactos de emergencia VERIFICADOS** (bomberos, Protección Civil, Cruz Roja, hospitales de Caracas) = lista estática curada de fuentes oficiales. NUNCA inventados/scrapeados por IA (un número errado cuesta vidas).
     - **Clasificado por categoría + por PASOS numerados** que cualquier persona entienda: hemorragia, RCP, atragantamiento, quemaduras, fracturas, persona atrapada, shock, sismo (durante/después), agua/comida segura, herramientas caseras. Cada uno: **qué hacer / qué NO hacer / cuándo llamar a emergencias**.
     - **Lenguaje simple, preciso, NO técnico, español LATINO** (ej. "presiona fuerte sobre la herida con un trapo limpio", no "aplique presión hemostática"). Aviso visible: "no reemplaza atención médica profesional".
     - **Antes de salir LIVE:** revisión del contenido (idealmente por un profesional de salud o verbatim de las guías oficiales) — por responsabilidad y porque son vidas. Cada ficha cita su fuente.
     - Funciona SIN internet (parte del PWA/offline, función 5).
  2. **Chat IA encima (acotado):** endpoint `/api/ai/ask` (stub ya existe) + rate-limit 10/día por IP (ya en hooks) + **Haiku 4.5** (regla #15) + **Cloudflare AI Gateway** (caché ~90%, las preguntas se repiten) + **kill-switch `LLM_DAILY_BUDGET_USD=$5/día`** (ya existe). La IA se apoya en la info verificada, NO improvisa. Sistema-prompt con contexto VE/Caracas/terremoto. Si el budget se topa o no hay red → el núcleo estático sigue funcionando.
  3. **GEO-FILTRO con INTERRUPTOR (global ⇄ solo-VE, sin redeploy) — requisito del founder:**
     - **Estado inicial = GLOBAL.** El founder lo prueba COMPLETAMENTE desde Suiza antes de restringir.
     - **Interruptor para apagar global / encender solo-Venezuela** sin tocar código ni redeploy: una fila en `app_config` (`ai_ve_only` boolean, leída en runtime con caché corto) que el founder cambia con 1 SQL en el SQL Editor, o un botón en `/moderar` (cuando el login esté activo). Por defecto `false` (global).
     - Cuando esté en solo-VE: gatear por país con `CF-IPCountry` (o `event.platform.cf.country`), bloqueo en el ENDPOINT (servidor, no esquivable) + ocultar el botón en la UI fuera de VE.
     - **ROBUSTEZ — que NO falle (crítico):** (a) el **núcleo ESTÁTICO de primeros auxilios + contactos funciona SIEMPRE** (sin IA, offline) → el usuario nunca se queda sin la info que salva vidas aunque el chat IA esté apagado, bloqueado o sin red. (b) Si no se puede leer el config → default seguro = **IA apagada, solo estático** (no dispara gasto). (c) En modo solo-VE, si falta la cabecera de país → tratar como fuera de VE (no consume IA) y mostrar el estático. (d) Probar en GLOBAL desde Suiza, confirmar end-to-end (Claude-in-Chrome), y SOLO ENTONCES encender solo-VE.
     - **El mapa/búsqueda/reportes siguen GLOBALES siempre** (no consumen IA; un familiar en el exterior debe poder buscar/reportar).
  4. **Marca:** "Faro Auxilio" / "Faro Vida" — el faro con una **cruz blanca iluminada** en el centro. Botón flotante siempre visible. PWA → web/Android/iOS automático, responsive.
- **Qué significa para los usuarios:** en la hora dorada tras el sismo, cualquiera —sin entrenamiento médico— recibe instrucciones claras para controlar hemorragias, RCP, atragantamiento, qué hacer si está atrapado, purificar agua, improvisar herramientas, y a quién llamar. Mantiene la calma y **salva vidas directamente**. Costo controlado y enfocado solo en quienes están en la zona.

### ✅ CHAT IA (paso 2) — LIVE (27-jun, commit `de5564a`)
Endpoint `/api/ai/ask` + tab "Preguntar" en `/auxilio`, Haiku 4.5 vía AI Gateway (o directo a Anthropic), anclado SOLO en las guías verificadas, rate-limit 10/IP/día + budget $5/día + fallback a estático. La `ANTHROPIC_API_KEY` está como **Pages secret** (confirmado: el chat responde en prod). **Geo-switch (paso 3) cableado y default GLOBAL** (funciona en todo el mundo); para gatear a solo-VE el founder corre la migración 0023 y luego `update app_config set value='true' where key='ai_ve_only'`. Opcional: setear `ANTHROPIC_GATEWAY_URL` (Pages) para el caché del gateway. El diseño original (debajo) quedó como referencia histórica.

### PENDIENTE para el chat IA (pasos 2 y 3) — el núcleo estático ya es el fallback
- **Robustez ya garantizada:** el núcleo estático funciona SIEMPRE (sin IA, offline). Cualquier chat IA va ENCIMA; si está apagado, bloqueado o sin red → el usuario igual tiene la guía completa. El interruptor por defecto debe ser **IA apagada / solo estático** (default seguro).
- **Geo-interruptor (global⇄solo-VE sin redeploy)** = una fila en `app_config`. Migración lista-para-pegar en el SQL Editor de Supabase (la DB no se alcanza desde local):
```sql
insert into app_config (key, value) values ('ai_ve_only', 'false')
on conflict (key) do nothing;
```
- Para encender solo-VE más tarde (1 SQL, sin redeploy):
```sql
update app_config set value = 'true', updated_at = now() where key = 'ai_ve_only';
```
- **Endpoint `/api/ai/ask` a construir:** Zod + Turnstile + rate-limit 10/IP/día (ya en hooks) → Haiku 4.5 (`claude-haiku-4-5-20251001`) vía **Cloudflare AI Gateway** (caché ~90%) → budget guard `LLM_DAILY_BUDGET_USD=5` (ya existe). Lee `app_config.ai_ve_only` con caché corto; si `true`, gatea por país con `event.platform.cf.country === 'VE'` (server-side, no esquivable) y oculta el botón fuera de VE. **Si no hay `ANTHROPIC_API_KEY`, falla la lectura del config, o falta la cabecera de país → IA apagada + responde "usá la guía" (nunca gasta).** El sistema-prompt debe apoyarse SOLO en el contenido verificado de `src/lib/data/auxilio/` (no improvisar) y NUNCA recibir PII ni coords exactas (regla #16).
- **Founder debe setear** (cuando se construya): `ANTHROPIC_API_KEY` como secret del Worker / Pages, y configurar el AI Gateway. `cd workers/ai-triage` ya tiene el patrón de budget/stripPii a reusar.
- **No desplegar el chat hasta verificarlo en vivo** (regla del founder): probar en GLOBAL desde Suiza, confirmar fallback cuando la IA está apagada, y SOLO ENTONCES considerar encender solo-VE.

---

## Pruebas de humo (smoke) tras cualquier deploy
```bash
curl -s "https://faro-ve.com/api/persons?count=exact"
curl -s -o /dev/null -w "%{http_code}\n" https://faro-ve.com/
```
- Verificar un envío real desde el navegador (Claude-in-Chrome): ficha del nuevo reporte → HTTP 200 (publicada al instante).
