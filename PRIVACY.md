# Política de Privacidad — Faro VE

> **Última actualización**: 2026-06-25 (skeleton inicial — refinar antes de lanzar producción).

## Quiénes somos

Faro VE es una iniciativa humanitaria sin ánimo de lucro creada en respuesta al terremoto del 24-jun-2026 en Venezuela. Operada por voluntarios.

- **Contacto general**: contacto@faro-ve.com
- **Opt-out fuentes externas**: opt-out@faro-ve.com (SLA 24h)
- **Solicitudes Habeas Data**: privacidad@faro-ve.com

## Qué datos recogemos y por qué

### De personas reportadas como desaparecidas
- Nombre, edad aproximada, sexo
- Última ubicación conocida (texto + coordenadas si las da)
- Descripción física (ropa, marcas, cicatrices)
- Foto (opcional)
- Estado del reporte (desaparecido / a salvo / encontrado fallecido / cuerpo no identificado)

**Base legal**: interés vital (GDPR Art. 6.1.d aplicado por analogía) — proteger vidas en emergencia humanitaria. Habeas Data Venezuela (Art. 28 Constitución).

### Del reportante (quien sube la información)
- Email (para verificar el reporte y recibir mensajes vía relay)
- Relación con la persona (familia / amigo / testigo / diáspora)
- País desde donde reporta
- IP (hasheada, no en claro)

**Base legal**: consentimiento del reportante al subir el formulario + interés vital.

## Cómo protegemos los datos

1. **Ubicación pública ofuscada 200–500m**. Las coordenadas exactas SOLO las ven moderadores verificados, NUNCA público. El desplazamiento se calcula una sola vez por ubicación y es **estable** (no se regenera en cada edición) para impedir que se promedien múltiples muestras y se recupere el punto exacto. **Limitación conocida**: en zonas rurales de muy baja densidad, un radio de 300m puede seguir señalando una única vivienda. Estamos trabajando en un radio adaptativo a densidad poblacional para esos casos; mientras tanto, si reportas desde una zona aislada y te preocupa, contáctanos a privacidad@faro-ve.com para ampliar el radio de tu reporte.
2. **Email/teléfono del reportante NUNCA expuestos**. Hasheamos con SHA-256+salt. Encriptamos con PGP_sym_encrypt. Mensajes a reportantes pasan por relay server-side.
3. **Foto de menores NUNCA pública**. Solo descripción de ropa y características. Foto accesible únicamente a moderadores y autoridades verificadas.
4. **EXIF GPS strip obligatorio** en fotos antes de subir.
5. **Audit log append-only** de toda acción de staff.
6. **Cloudflare Turnstile** anti-bot. Rate-limit anti-spam.
7. **Cola de reportes sin conexión (offline)**. Si reportas sin señal, tu reporte se guarda **cifrado (AES-GCM, clave no extraíble)** únicamente en **tu propio dispositivo** (IndexedDB del navegador) — nunca se sube a un servidor hasta que reabras Faro VE con conexión. Mientras espera: en pantalla **no se muestra** tu nombre, teléfono ni email (solo un conteo de reportes pendientes); la copia local se **borra en cuanto se envía**; se **purga automáticamente a las 48 horas**; y puedes borrarla al instante con el botón **"Borrar mis datos de este teléfono"** (pensado para un equipo prestado o de cibercafé). Es el **único** lugar donde datos personales se guardan en tu dispositivo; el resto de la app nunca cachea datos personales localmente.

## Tus derechos (Habeas Data Venezuela Art. 28)

Puedes pedir en cualquier momento:

- **Acceso**: ver qué datos tenemos sobre ti o sobre el reporte que hiciste.
- **Rectificación**: corregir errores en un reporte.
- **Cancelación/borrado**: eliminar un reporte.

### Cómo solicitarlo
Formulario en `/privacidad/eliminar` con tu email y el ID del reporte. Verificamos hash email → marcamos como `withdrawn` en 24h → desaparece del mapa público inmediatamente. Datos personales se purgan completamente a los 30 días manteniendo solo `id + withdrawn_at` para integridad del audit.

También puedes escribir a **privacidad@faro-ve.com**.

## Retención de datos

- Reportes activos: **60 días** desde el último update.
- Reportes `withdrawn`: datos personales purgados a los **30 días** post-withdrawal.
- Audit log: **3 años** (integridad legal).
- Logs IA (`ai_conversations`): IP hasheada, contenido borrado a los **30 días**.
- **Cola offline (en tu dispositivo)**: cifrada; se borra al enviarse o se purga a las **48 horas**; el usuario puede borrarla al instante.

## Fuentes externas e integración

Integramos data pública de otras iniciativas humanitarias (ver `ATTRIBUTION.md`). Cada record importado lleva atribución a la fuente original.

**Si tu organización publica data sobre el terremoto y no quieres que la incluyamos**: escríbenos a **opt-out@faro-ve.com**. SLA 24h para detener ingesta y purgar la data ya importada.

## Compartir datos con terceros

- **Federación PFIF**: exportamos PFIF v1.4 a Cruz Roja Venezolana, ICRC, Google Person Finder y organizaciones humanitarias acreditadas que lo soliciten. Solo data ya pública en nuestro mapa, NUNCA PII del reportante.
- **No vendemos data. Jamás.**
- **No marketing, no ads, no analytics third-party** que tracken usuarios.

## IA (Anthropic Claude)

Usamos Claude (Anthropic) para:
- Responder preguntas frecuentes en el chat de ayuda.
- Triage de la cola de moderación (clasificar urgencia).
- Resumen diario al equipo operativo.

**La IA NUNCA recibe**: email/teléfono del reportante, coordenadas exactas, fotos.
**La IA SOLO recibe**: campos públicos del reporte tras pasar moderación, queries del chat.

Usamos Cloudflare AI Gateway entre Faro VE y Anthropic API. No enviamos data a terceros más allá de Anthropic.

## Menores de edad

Reportes de menores tienen tratamiento especial:
- Foto NUNCA pública. Solo descripción.
- Tag `unaccompanied_minor` activa prioridad máxima en moderación.
- Notificamos a UNICEF/CICR/Defensoría Niños y Adolescentes si el reporte cae en su jurisdicción.

## Cambios a esta política

Cualquier cambio sustantivo se anuncia en el footer del sitio con 7 días de antelación.

## Contacto

- **Privacidad**: privacidad@faro-ve.com
- **Opt-out fuentes**: opt-out@faro-ve.com
- **General**: contacto@faro-ve.com
