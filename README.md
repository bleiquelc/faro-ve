# Faro VE — Mapa de Esperanza Venezuela

> **Faro** = luz que guía en la tormenta. Cada punto del mapa es una persona que alguien está buscando.

PWA humanitaria de emergencia tras el terremoto del 24-jun-2026 en Venezuela (M7.2 + M7.5 · 164 muertos confirmados · 971+ heridos · miles desaparecidos). Instalable en iOS y Android, funciona offline.

## Qué puedes hacer

- **Reportar a alguien desaparecido** desde cualquier dispositivo conectado.
- **Reportarte a salvo** si perdiste tu celular y pediste prestado uno.
- **Buscar** por nombre, edad, sector, ropa o características.
- **Avisar de un cuerpo no identificado** con ropa/marcas/cicatrices (foto solo de ropa, nunca del cuerpo).
- **Compartir un avistamiento** ("yo vi a esta persona viva en X el día Z").
- **Marcar un refugio o punto de ayuda** (comida, agua, ropa, medicinas, carga, WiFi).
- **Coordinar con organizaciones verificadas** (Cruz Roja, ICRC, ONGs).
- **Pedir información** vía relay de mensajes — sin exponer tu email ni el del otro.

## Privacidad por diseño

- Ubicación pública ofuscada 200–500m. Coordenadas exactas solo para voluntarios verificados.
- Email/teléfono del reportante NUNCA expuestos. Sistema de mensajería relay.
- Foto de menores NUNCA pública. Solo descripción.
- Solicita borrar tu reporte en cualquier momento → se borra a las 24h. Retención máxima 60 días (Habeas Data Venezuela).
- Audit completo de toda acción de staff.

## Fuentes de datos y atribución

Integramos data pública de otras iniciativas humanitarias (con atribución obligatoria en cada record). Si tu organización publica data sobre el terremoto y no quieres que la incluyamos: escríbenos a **opt-out@faro-ve.com** y la retiramos en 24h.

Ver [`ATTRIBUTION.md`](./ATTRIBUTION.md) para la lista completa de fuentes.

## Federación abierta

Faro VE adopta el estándar **PFIF v1.4** (Person Finder Interchange Format) de Google Person Finder e ICRC desde el día 1. Exportamos PFIF en `/api/rss?format=pfif` para interoperabilidad con Cruz Roja, Google Crisis Response y otras iniciativas internacionales.

## Stack

- **Frontend**: SvelteKit + Vite + PWA (Workbox) + Tailwind + Leaflet
- **Backend**: Supabase (Postgres + PostGIS + Auth + Realtime + Storage)
- **Hosting**: Cloudflare Pages + Workers
- **Tiles**: OpenStreetMap (© OpenStreetMap contributors)
- **IA**: Anthropic API (Haiku 4.5) vía Cloudflare AI Gateway

100% open source. Licencia AGPL-3.0.

## Contribuir

¿Quieres ser voluntario moderador? ¿Tu organización quiere federarse? Escríbenos a **contacto@faro-ve.com**.

## Licencia

[AGPL-3.0](./LICENSE)
