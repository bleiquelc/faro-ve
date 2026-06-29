# Faro VE — Instrucciones para cualquier Claude Code

> **Total de reglas inmutables: 31** (privacidad 1-6, atribución 7-10, datos/schema 11-13, IA 14-17, moderación 18-20, UX 21-25, navegación externa 26-28, kill switches 29-31).

> # 🔴 LEY DE SEPARACIÓN DE REPOS — léela SIEMPRE antes de tocar nada
> Estás trabajando en **Faro VE — Mapa de Esperanza Venezuela**: PWA humanitaria.
> Repo: `/Users/bleiquelcolina/Desktop/faro-ve`.
>
> - **NEXVYVE iOS** (app React + Capacitor → bundle iOS) es un proyecto **SEPARADO**: `/Users/bleiquelcolina/Desktop/nexvyve-app`. No tocar.
> - **KAEL by NEXVYVE** (web PREMIUM instalable / PWA Android) es un proyecto **SEPARADO**: `/Users/bleiquelcolina/Desktop/kael-by-nexvyve`. No tocar.
> - **El código NO se mezcla** entre los tres proyectos. Cada chat opera en su propio cwd. Puedes LEER los otros como referencia (read-only) pero **nunca modificarlos**; tampoco traigas código de ellos a Faro VE.
> - Antes de editar, ten 100% claro que estás dentro de `~/Desktop/faro-ve`.
> - Esta LEY debe ser leída por CADA chat de Claude Code que toque Faro VE.

---

## 🎯 Misión

Construir y operar una PWA instalable que ayude a localizar personas desaparecidas tras el terremoto del 24-jun-2026 en Venezuela (M7.2 + M7.5 · 164 muertos confirmados · 971+ heridos · miles desaparecidos). Mapa visual mobile-first con auto-reporte "estoy a salvo", relay de mensajes anti-estafa, cuerpos NN, refugios, puntos de ayuda, federación PFIF con Cruz Roja/ICRC/Google Person Finder.

**Sin ánimo de lucro. Free tier únicamente. Privacidad por diseño. Atribución obligatoria. Opt-out 24h.**

---

## 📚 Documentos críticos a leer al iniciar (en este orden)

0. **`docs/PROCESOS.md`** — 🗺️ **MAPA OPERATIVO: todos los subsistemas/procesos de Faro VE** (qué hace cada uno, archivos clave, cómo operarlo, gotchas, reglas que aplican, runbooks). **LEELO SIEMPRE PRIMERO** — agiliza cualquier trabajo y evita re-construir lo ya hecho (Ley de Reuso).
1. **`docs/STATUS.md`** — estado vivo (qué está LIVE, pendientes del founder, último avance).
2. **`PLAN.md`** — plan completo aprobado, 6 días a producción.
3. **`PRIVACY.md`** — política Habeas Data Venezuela, retención, delete.
4. **`ATTRIBUTION.md`** — fuentes de datos + opt-out + atribución obligatoria.
5. **`README.md`** — visión general pública.
6. **`docs/SESSIONS/YYYY-MM-DD-*.md`** (si existen) — sesiones previas.
7. **`docs/RUNBOOK-*.md`** — operación detallada de cada sistema (p. ej. `docs/RUNBOOK-instagram-reencuentros.md` = auto-publicador IG + reencuentros).

---

## 🚫 Reglas inmutables (NO violar nunca)

### Privacidad y seguridad
1. **Ubicación pública SIEMPRE ofuscada** (200–500m random offset). Backend almacena exacta, frontend público NUNCA expone exacta. Solo moderadores ven coords reales.
2. **PII reportante NUNCA expuesta**: email/phone hasheados (sha256+salt) + encriptados (pgp_sym_encrypt). Cualquier mensaje a un reportante pasa por relay server-side.
3. **Foto de menores NUNCA pública**: trigger DB fuerza `photo_visibility='admin_only'` si `is_minor=true`. UI muestra placeholder en lugar de foto.
4. **EXIF GPS strip obligatorio** en cliente antes de subir foto (con `exifr`). El servidor también valida.
5. **No autenticación obligatoria para reportar**. Solo email para verificar (NO cuenta). JWT `edit_token` TTL 7d permite editar/retirar sin login.
6. **Habeas Data Venezuela (Art. 28 Const.)**: retención 60d, formulario delete funcional, audit completo. Datos personales purgados a los 30d post-`withdrawn`.

### Atribución y opt-out
7. **Footer global con atribución visible en TODAS las páginas**. Lista las fuentes externas activas con conteos.
8. **Email canónico opt-out**: `opt-out@faro-ve.com` (Resend Inbound). SLA público 24h para detener ingesta y purgar data de cualquier fuente que lo pida. Visible en footer, `/atribucion`, emails de federación.
9. **Cada record importado** lleva `source` + `source_id` + `source_url` clickeable en UI (badge en `PersonCard`).
10. **Cron diario verifica inbox opt-out**. Si llega request → marca source `disabled` + purga (`DELETE WHERE source=X AND withdrawn_at IS NULL`) + notifica founder. Audit log obligatorio.

### Datos y schema
11. **PFIF v1.4 es el schema canónico** (`http://zesty.ca/pfif/1.4/`). NUNCA modificar fields PFIF estándar (`pfif_id, given_name, family_name, photo_url, last_known_location, source_*`). Solo agregar fields Faro VE extra.
12. **Scraper ético obligatorio**: robots.txt check, UA `FaroVE-IngestBot/1.0 (+contacto@faro-ve.com)`, throttle 1 req/2s. Si <50% records parsean → abort + alerta.
13. **No bulk commits** sin OK founder. Commits por archivo o por feature lógica.

### IA / costo
14. **Anthropic API budget máximo $150/mes**. `LLM_DAILY_BUDGET_USD=5` kill-switch enforced. Cloudflare AI Gateway entre Faro y Anthropic (cache 90%).
15. **Haiku 4.5 default** (`claude-haiku-4-5-20251001`). Sonnet 4.6 solo para match assistance.
16. **IA NUNCA recibe PII** (email/phone) ni coords exactas. Solo campos públicos.
17. **Rate-limit chat IA**: 10 msg/IP/día (KV).

### Moderación
18. **Reportes públicos siempre `pending` por defecto**. Solo moderadores (`moderators` tabla con magic-link auth) aprueban.
19. **Sources confiables pueden ser `auto_approved`** (Cruz Roja, ICRC, gobierno) — flag por fila en `import_sources`.
20. **Cola moderación ordenada por** `(ai_priority desc, medical_urgent desc, is_minor desc, created_at asc)`.

### UX/UI
21. **Mobile-first siempre**. Bundle <150KB JS inicial. Mapa lazy-load al entrar.
22. **Paleta accesible AAA**, daltonismo-friendly. Tokens en `lib/utils/colors.ts`.
23. **Animaciones cap 30fps mobile**. Respetar `prefers-reduced-motion`. Toggle "bajo consumo" en settings.
24. **Lenguaje claro, sin tecnicismos**. "Reportar a alguien que no encuentro" mejor que "Crear reporte persona desaparecida".
25. **Onboarding 3 pantallas ilustradas 1 vez** (LS flag `onboarding_seen`).

### Navegación externa — regla diferenciada (CRÍTICA)
26. **"🧭 Llegar aquí" SOLO en lugares de servicio**, NUNCA en personas:
   - ✅ Refugios · puntos de ayuda · hospitales · morgues → coords EXACTAS + botón navegación (Apple Maps / Google Maps / Waze / OsmAnd selector multi-app).
   - ❌ Personas desaparecidas · cuerpos NN · avistamientos → coords OFUSCADAS 300m + texto "Ubicación aproximada (~300m por privacidad)" + sin botón navegación.
   - ⚠️ Auto-reporte "estoy a salvo" → toggle opt-in del propio sujeto (`share_exact_location_with_searchers`); default OFF.
27. **Componente único** `lib/components/NavigateButton.svelte` + utilidad `lib/utils/navigation.ts`. Persiste `preferred_map_app` en LS. Cualquier integración nueva DEBE usar este componente — no construir botones de navegación a mano.
28. **Lugares de servicio guardan** `address_text` + `landmark` + `entrance_notes` además de coords, porque el GPS en VE falla en zonas mal geocodeadas. Botón "📋 Copiar dirección" además del navegacional.

### Kill switches
29. **`INSERTS_PAUSED=true`** env var: hooks.server.ts lee y pausa inserts públicos si troll-bombing.
30. **`FACE_MATCH_ENABLED=false`** env var: reconocimiento facial diferido v0.2, fuera de v0.1.
31. **`LLM_DAILY_BUDGET_USD=5`** env var: budget guard IA.

---

## 🛠 Stack técnico

- **Frontend**: SvelteKit 2 + Vite 5 + `@vite-pwa/sveltekit` + Tailwind 3 + Paraglide i18n.
- **Map**: Leaflet 1.9 + MarkerCluster + OpenStreetMap tiles (fallback MapTiler free).
- **Backend**: Supabase (Postgres + PostGIS + Auth + Realtime + Storage). Free tier.
- **Hosting**: Cloudflare Pages (frontend) + Cloudflare Workers (cron + AI Gateway). Free tier.
- **Email**: Resend free (3k/mes) + Inbound rule `opt-out@faro-ve.com`.
- **IA**: Anthropic API (Haiku 4.5 default, Sonnet 4.6 complex) vía Cloudflare AI Gateway.
- **Offline**: IndexedDB (Dexie) + Workbox BackgroundSync.
- **Auth moderadores**: Supabase magic-link.
- **Anti-spam**: Cloudflare Turnstile (gratis).

---

## 🤝 Roles y permisos

| Rol | Acceso |
|---|---|
| **Anónimo público** | Ver mapa con coords obfuscated, reportar (pending), enviar mensajes vía relay, solicitar delete, chatbot IA, instalar PWA |
| **Reportante** | Editar/retirar su propio reporte con `edit_token` JWT (sin login) |
| **Moderador** | Magic-link login. Ver cola pending, aprobar/rechazar/editar, ver coords exactas, ver matches sugeridos, gestionar avistamientos |
| **Org verificada** | Magic-link login. Gestionar SUS `aid_points` (refugios, distribuciones, etc.). Solo sus puntos. |
| **Admin** | Moderador + verificar orgs + gestionar `import_sources` + ver `audit_log` + kill switches |
| **Founder (superadmin)** | Todo. Recibe emails "Faro Health" diarios. |

---

## 📋 Flujo de trabajo recomendado

1. **Antes de cualquier feature**: lee `PLAN.md` para el día correspondiente. Identifica `Gate` del día.
2. **Codifica con TDD** donde aplique (especialmente schema, RLS, scrapers, relay).
3. **Verifica privacidad por diseño**: cada nuevo endpoint pasa por checklist (¿expone PII? ¿coords exactas? ¿bypass moderación?).
4. **Cierra día con Gate**: ejecuta los checks E2E del `PLAN.md` para ese día.
5. **Commit por feature lógica**, mensaje claro.
6. **Documenta sesión** en `docs/SESSIONS/YYYY-MM-DD-{topic}.md` al cerrar.

---

## 🆘 Contactos críticos / canales

- **Founder**: Bleiquel Colina · `bleiquelc@gmail.com` (Zúrich, Suiza · origen Caracas).
- **Email opt-out fuentes**: `opt-out@faro-ve.com` (Resend Inbound, SLA 24h).
- **Email contacto público**: `contacto@faro-ve.com`.
- **Email federación PFIF**: `federacion@faro-ve.com`.

---

## 🚨 Si te quedas sin contexto

1. Update `docs/STATUS.md` con estado actual.
2. Crear `docs/SESSIONS/YYYY-MM-DD-{topic}.md` con resumen.
3. Crear `docs/HANDOFF-{descripción}.md` para el chat siguiente.
4. Avisar al founder con: "Faro VE: se acaba el contexto, pegá `docs/HANDOFF-{nombre}.md` en chat nuevo".

---

## 📌 Slash commands disponibles

(A definir según necesidad. Por ahora sin custom commands.)
