import { z } from 'zod';

/**
 * Relay de mensajes anti-estafa (0032, función 4).
 *
 * El remitente deja SU email solo para poder recibir la respuesta — viaja
 * cifrado a la DB y jamás se muestra al reportante (ni al revés). Límites de
 * tamaño espejo de la RPC create_relay_message (la DB es la verdad).
 */
export const relayMessageSchema = z.object({
  sender_name: z
    .string()
    .trim()
    .max(120, 'El nombre es muy largo (máx. 120).')
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  sender_email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Escribe un email válido para poder recibir la respuesta.')
    .max(254),
  subject: z
    .string()
    .trim()
    .max(200, 'El asunto es muy largo (máx. 200).')
    .optional()
    .transform((v) => (v === '' ? undefined : v)),
  body: z
    .string()
    .trim()
    .min(10, 'El mensaje es muy corto (mín. 10 caracteres).')
    .max(2000, 'El mensaje es muy largo (máx. 2000).')
});

export type RelayMessageInput = z.infer<typeof relayMessageSchema>;

export const relayReplySchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{48}$/i, 'Enlace de respuesta inválido.'),
  body: z
    .string()
    .trim()
    .min(5, 'La respuesta es muy corta (mín. 5 caracteres).')
    .max(2000, 'La respuesta es muy larga (máx. 2000).')
});

export type RelayReplyInput = z.infer<typeof relayReplySchema>;
