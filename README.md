# Faro VE — Mapa de Esperanza Venezuela

> **Faro** = luz que guía en la tormenta. Cada punto del mapa es una persona que alguien está buscando.

PWA humanitaria sin ánimo de lucro creada en respuesta al terremoto del **24-jun-2026** en Venezuela (M7.2 + M7.5 · 164 muertos confirmados · 971+ heridos · miles desaparecidos).

- 🌐 `https://faro-ve.com` (próximamente)
- 📍 Mapa instalable mobile-first
- 🔒 Privacidad por diseño: ubicación pública ofuscada 200-500m, PII reportante hasheada + encriptada, foto de menores nunca pública
- 🤝 Federación PFIF v1.4 (Person Finder Interchange Format) con Cruz Roja / ICRC / Google Person Finder
- ✉️ Relay de mensajes anti-estafa: nadie ve emails ajenos
- 📱 Funciona offline (PWA + IndexedDB + BackgroundSync)
- 🆓 Free tier puro (Supabase free + Cloudflare Pages + OSM)
- ⚖️ AGPL-3.0 · Habeas Data Venezuela Art. 28 · Opt-out 24h fuentes externas

## Qué puedes hacer

- **Reportar a alguien desaparecido** desde cualquier dispositivo conectado.
- **Reportarte a salvo** si perdiste tu celular y pediste prestado uno.
- **Buscar** por nombre, edad, sector, ropa o características.
- **Avisar de un cuerpo no identificado** (foto solo de ropa, nunca del cuerpo).
- **Compartir un avistamiento** ("yo vi a esta persona viva en X el día Z").
- **Marcar un refugio o punto de ayuda** (comida, agua, ropa, medicinas, carga, Wi-Fi).
- **Coordinar con organizaciones verificadas** (Cruz Roja, ICRC, ONGs).
- **Pedir información** vía relay de mensajes — sin exponer tu email ni el del otro.

## Capas en el mapa

| Capa | Color | Origen | Coords |
|------|-------|--------|--------|
| 🟣 Menor no acompañado | violeta — pulsa lento | reporte / scraper | ofuscadas |
| 🟠 Urgencia médica | naranja — pulsa rápido | reporte / scraper | ofuscadas |
| 🔴 Desaparecido | rojo | reporte / scraper | ofuscadas |
| 🟡 Avistamiento | amarillo | nota pública | ofuscadas |
| ⚫ Cuerpo NN | gris oscuro | morgue / scraper | ofuscadas |
| 🟢 A salvo | verde | auto-reporte | opcional opt-in |
| 🔵 Refugio | azul faro | org verificada | **exactas** |
| 🩵 Punto de ayuda | cian | org verificada | **exactas** |
| 🟤 Búsqueda activa | sepia | autoridad | polígono |

> **Regla diferenciada de navegación** (CLAUDE.md inmutable #26-28): solo lugares de servicio (refugios, ayuda, hospitales, morgues) tienen botón "🧭 Llegar aquí" con selector multi-app (Apple Maps / Google Maps / Waze / OsmAnd). Personas, NN y avistamientos NO son navegables — ofuscación 300m + texto "Ubicación aproximada por privacidad".

## Privacidad por diseño

- Ubicación pública ofuscada 200–500m. Coordenadas exactas solo para voluntarios verificados.
- Email/teléfono del reportante NUNCA expuestos. Sistema de mensajería relay anti-estafa.
- Foto de menores NUNCA pública. Solo descripción.
- Solicita borrar tu reporte en cualquier momento → 24h. Retención máxima 60 días (Habeas Data Venezuela Art. 28).
- Audit completo append-only de toda acción de staff.

## Fuentes externas y opt-out

Integramos data pública de otras iniciativas humanitarias con atribución obligatoria en cada record. Si tu organización publica data sobre el terremoto y no quieres que la incluyamos: escríbenos a **opt-out@faro-ve.com** y la retiramos en **24h**.

Ver [`ATTRIBUTION.md`](./ATTRIBUTION.md) para la lista completa.

## Federación abierta

Faro VE adopta el estándar **PFIF v1.4** (Person Finder Interchange Format) de Google Person Finder e ICRC desde el día 1. Exportamos PFIF en `/api/rss?format=pfif` para interop con Cruz Roja, Google Crisis Response y otras iniciativas internacionales.

## Stack

- **Frontend**: SvelteKit 2 + Vite 5 + `@vite-pwa/sveltekit` + Tailwind 3 + Paraglide i18n (ES/EN).
- **Map**: Leaflet 1.9 + MarkerCluster + OpenStreetMap.
- **Backend**: Supabase (PostgreSQL 15 + PostGIS + Auth + Realtime + Storage).
- **Hosting**: Cloudflare Pages + Workers (cron-ingest, ai-health, ai-triage).
- **Email**: Resend free + Inbound `opt-out@faro-ve.com`.
- **IA**: Anthropic (Haiku 4.5) vía Cloudflare AI Gateway. Budget guard `LLM_DAILY_BUDGET_USD=5`.
- **Offline**: IndexedDB (Dexie) + Workbox BackgroundSync.
- **Anti-spam**: Cloudflare Turnstile + KV rate-limit.

## Comandos

```bash
npm install
cp .env.example .env             # rellenar con credenciales reales
npm run db:migrate               # aplicar migraciones Supabase

npm run dev                      # http://localhost:5173
npm run test                     # vitest
npm run test:e2e                 # Playwright

npm run build
npm run deploy:pages             # Cloudflare Pages
npm run deploy:workers           # CF Workers (cron + ai-health + ai-triage)
```

## Reportar problema de seguridad / privacidad

NO abrir issue público. Escribir a **security@faro-ve.com** o **privacidad@faro-ve.com**.

## Contribuir

1. Lee `CLAUDE.md` — 31 reglas inmutables del proyecto.
2. Lee `PLAN.md` — plan aprobado de 6 días.
3. Lee `PRIVACY.md` y `ATTRIBUTION.md`.
4. PRs bienvenidos. CI corre lint + tests + a11y + bundle size budget.

## Contacto

- **General**: contacto@faro-ve.com
- **Privacidad / Habeas Data**: privacidad@faro-ve.com
- **Opt-out fuentes externas (SLA 24h)**: opt-out@faro-ve.com
- **Federación PFIF**: federacion@faro-ve.com
- **Founder**: Bleiquel Colina (Zúrich, Suiza · origen Caracas) · bleiquelc@gmail.com

## Licencia

[AGPL-3.0-or-later](./LICENSE). Cualquier deploy modificado debe publicar fuente.
