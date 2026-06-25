# Atribución — Faro VE

> Faro VE integra data pública de otras iniciativas humanitarias con atribución obligatoria. Si tu organización no quiere ser incluida: **opt-out@faro-ve.com** (SLA 24h).

## Tiles del mapa

- **OpenStreetMap** — © OpenStreetMap contributors. Datos disponibles bajo [Open Database License](https://opendatacommons.org/licenses/odbl/). Contribuye a OSM en [openstreetmap.org](https://www.openstreetmap.org/).

## Fuentes de datos integradas (al lanzamiento)

| Fuente | URL original | Tipo | Estado |
|---|---|---|---|
| Desaparecidos Terremoto Venezuela | https://desaparecidosterremotovenezuela.com/ | Reportes desaparecidos | Pendiente confirmación robots.txt + outreach federación |
| SOS Venezuela 2026 | https://sosvenezuela2026.com/ | Reportes daños + refugios + recursos | Pendiente confirmación robots.txt + outreach federación |
| Cruz Roja Venezolana | (TBD) | RFL (Restoring Family Links) | Pendiente outreach federación |
| ICRC "Trace the Face" | https://familylinks.icrc.org/ | RFL | Pendiente outreach federación |
| CICPC | (TBD) | Reportes oficiales | Pendiente confirmación pública |
| Defensoría del Pueblo VE | (TBD) | Reportes oficiales | Pendiente confirmación pública |
| Medios principales (RunRun, Efecto Cocuyo, La Patilla, El Nacional) | RSS feeds | Mención #DesaparecidosVE | Pendiente RSS adapters |

> Cada record importado lleva campo `source` en su detalle público + badge clickeable al `source_url` original. Footer global muestra conteos por fuente.

## Estándar de interoperabilidad

Faro VE adopta **PFIF v1.4** (Person Finder Interchange Format) — el estándar abierto de Google Person Finder e ICRC.
- Spec: http://zesty.ca/pfif/1.4/
- Endpoint export: `/api/rss?format=pfif`

## Tecnología open source usada

- **SvelteKit** — MIT License
- **Leaflet** — BSD 2-Clause
- **Supabase** — Apache 2.0
- **Tailwind CSS** — MIT
- **Workbox** — MIT
- **Dexie** — Apache 2.0
- **Paraglide-SvelteKit** — Apache 2.0
- **Zod** — MIT

Lista completa en `package.json`.

## Opt-out — cómo pedir que retiremos tu data

Si tu organización, sitio web o iniciativa publica data sobre el terremoto y no quieres que Faro VE la incluya:

1. Escríbenos a **opt-out@faro-ve.com** desde un email de tu dominio (o adjunta evidencia de afiliación).
2. Indica el dominio/URL/identificador de la fuente.
3. SLA público: **24h** desde recepción.
4. Acciones:
   - Marcamos la fuente como `disabled` en `import_sources` → no se vuelve a ingestar.
   - Purgamos data ya importada con `source = X` (excepto records ya vinculados a un match confirmado, en cuyo caso te consultamos primero).
   - Confirmamos por email cuando esté completado.
   - Audit completo en `audit_log`.

Si necesitas urgencia mayor por motivo legal: copia legal@faro-ve.com.

## Crédito

- **Founder & operador**: Bleiquel Colina (Zúrich, Suiza · origen Caracas)
- **Voluntarios moderadores**: (lista en `/acerca` cuando tengamos consentimiento)
- **Contribuidores código**: ver historial Git público — repo bajo licencia AGPL-3.0
