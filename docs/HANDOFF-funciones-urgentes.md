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

## 6. Cuerpos no identificados (NN) 🟡
- **Qué es:** reportar y buscar cuerpos no identificados para que las familias los reconozcan.
- **Cómo se aplica:** formulario `/reportar/cuerpo-nn` (status `unidentified_body`, YA permitido en `create_person_report`). Cuidado con la foto (sensibilidad; foto de menor sigue oculta por el trigger). Filtro/categoría en el mapa.
- **Qué significa para los usuarios:** las familias identifican a sus fallecidos → cierre y entrega digna; reduce la angustia de la incertidumbre.

## 7. Destacar urgencia médica / menores en el mapa 🟡
- **Qué es:** resaltar visualmente los casos médicos urgentes y los menores.
- **Cómo se aplica:** ya hay `medical_urgent` e `is_minor` en `persons_public` y tokens de color (`lib/utils/colors`). Añadir filtros/realce en el mapa (combinar con `ai_priority` de la función 2).
- **Qué significa para los usuarios:** la atención y la búsqueda se concentran en los casos más delicados (niños solos, heridos).

---

## Pruebas de humo (smoke) tras cualquier deploy
```bash
curl -s "https://faro-ve.com/api/persons?count=exact"
curl -s -o /dev/null -w "%{http_code}\n" https://faro-ve.com/
```
- Verificar un envío real desde el navegador (Claude-in-Chrome): ficha del nuevo reporte → HTTP 200 (publicada al instante).
