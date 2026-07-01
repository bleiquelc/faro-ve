# Outreach — Venezuela Te Busca · solicitud de feed de datos (federación)

> **Estado:** BORRADOR listo para que el founder revise y envíe. **NO enviado.**
> Creado 2026-07-01 tras detectar que la fuente cerró el acceso masivo (pasó a
> modelo solo-búsqueda). Este es el camino LIMPIO/consentido para completar el
> espejo de su registro (los otros ~36k que no bajan por búsqueda).

## Contexto (por qué este email ahora)

- Faro VE ya federa la data **pública** de `venezuelatebusca.com` **con atribución
  por registro** (`source` + enlace) y **opt-out 24h** (`opt-out@faro-ve.com`).
- La fuente **cambió su web a un modelo solo-búsqueda** (la vista pública ya no
  navega el registro completo; solo devuelve 24 recientes + búsqueda paginada).
  Eso **limita el espejo humanitario** que ayuda a las familias a encontrar a los
  suyos en ambas plataformas.
- Pedimos un **feed directo consentido** (PFIF 1.4, CSV o un endpoint) para seguir
  reflejando su registro de forma completa, ética y con crédito.

## Destinatario

- **Buscar el contacto** en `venezuelatebusca.com` (footer / "contacto") o en el
  equipo que lo opera (el backend es `*.hellogafaro.workers.dev`).
- Enviar **desde `federacion@faro-ve.com`** (o `bleiquelc@gmail.com` si el routing
  aún no está activo). CCO: no aplica (es 1:1).

---

## Versión ES

**Asunto:** Faro VE · federación de datos para ayudar a localizar personas (con atribución + opt-out)

Hola equipo de Venezuela Te Busca,

Soy Bleiquel Colina, de **Faro VE — Mapa de Esperanza Venezuela**
(https://faro-ve.com), una PWA humanitaria sin ánimo de lucro que ayuda a
localizar personas desaparecidas tras el terremoto del 24 de junio. Antes que
nada: **gracias** por el trabajo enorme que hacen; su registro está ayudando a
muchísimas familias.

Faro VE ya refleja la información **pública** de su plataforma **dando crédito en
cada ficha** (enlace a `venezuelatebusca.com`) y con un canal de **retiro
inmediato** (`opt-out@faro-ve.com`, respondemos en 24h). Nuestro único objetivo es
que **más familias reencuentren a los suyos**, apareciendo en el mayor número de
lugares posible.

Notamos que su sitio pasó a un modelo de **búsqueda** (ya no navega el listado
completo). Para poder seguir reflejando su registro de forma **completa y
respetuosa**, les proponemos un **acuerdo de datos**:

- Un **feed directo** en el formato que les sea más cómodo: **PFIF 1.4** (estándar
  de Google Person Finder / ICRC), **CSV**, o un endpoint con paginación.
- Mantenemos **atribución visible** a Venezuela Te Busca en cada registro.
- Respetamos **opt-out** y **borrado** (retención 60 días, Habeas Data Venezuela).
- **Nunca** re-publicamos datos de contacto del reportante; ofuscamos ubicación y
  protegemos fotos de menores por diseño.

Si les parece bien, me encantaría coordinar una llamada corta o intercambiar los
detalles técnicos. Cualquier condición que quieran poner sobre uso y atribución, la
cumplimos.

Gracias por lo que hacen. Ojalá podamos sumar fuerzas.

Un abrazo,
**Bleiquel Colina** · Faro VE
federacion@faro-ve.com · https://faro-ve.com

---

## Versión EN

**Subject:** Faro VE · data federation to help locate people (with attribution + opt-out)

Hello Venezuela Te Busca team,

I'm Bleiquel Colina, from **Faro VE — Venezuela's Map of Hope**
(https://faro-ve.com), a non-profit humanitarian PWA helping locate people
missing after the June 24 earthquake. First of all: **thank you** for your
tremendous work — your registry is helping so many families.

Faro VE already mirrors your **public** information **crediting each record**
(a link back to `venezuelatebusca.com`) and with an **immediate opt-out** channel
(`opt-out@faro-ve.com`, 24h SLA). Our only goal is for **more families to find
their loved ones**, by appearing in as many places as possible.

We noticed your site moved to a **search-only** model (the full listing is no
longer browsable). To keep mirroring your registry **completely and respectfully**,
we'd like to propose a **data-sharing arrangement**:

- A **direct feed** in whatever format suits you best: **PFIF 1.4** (the Google
  Person Finder / ICRC standard), **CSV**, or a paginated endpoint.
- We keep **visible attribution** to Venezuela Te Busca on every record.
- We honor **opt-out** and **deletion** (60-day retention, Venezuela Habeas Data).
- We **never** re-publish a reporter's contact data; we obfuscate location and
  protect minors' photos by design.

If this sounds good, I'd love to set up a short call or exchange the technical
details. Any conditions you'd like on usage and attribution, we'll follow.

Thank you for what you do — I hope we can join forces.

Warm regards,
**Bleiquel Colina** · Faro VE
federacion@faro-ve.com · https://faro-ve.com
