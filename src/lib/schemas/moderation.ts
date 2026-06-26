import { z } from 'zod';

/**
 * Schemas Zod — panel de moderación (D3). Validación en el borde de las
 * decisiones del moderador antes de tocar la RPC `moderate_person`.
 *
 * - moderationDecisionSchema: valida el form action de aprobar/rechazar/etc.
 * - loginRequestSchema: valida el correo del magic-link.
 * - ModerationQueueItem: forma de cada fila que devuelve la RPC moderation_queue.
 */

// Decisiones que un moderador puede aplicar a un reporte pending. Espeja la
// whitelist dura de la RPC moderate_person. 'approved' lo publica (entra a
// persons_public); el resto lo mantiene fuera del público con un motivo.
export const MODERATION_DECISION = ['approved', 'rejected', 'duplicate', 'needs_info'] as const;
export type ModerationDecision = (typeof MODERATION_DECISION)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Decisión de moderación. Rechazar / duplicado / falta-info EXIGEN una nota con
 * el motivo (rendición de cuentas + el reportante puede entender el porqué).
 * Aprobar no necesita nota.
 */
export const moderationDecisionSchema = z
  .object({
    id: z.string().regex(UUID_RE, 'id inválido'),
    decision: z.enum(MODERATION_DECISION),
    notes: z.string().trim().max(1000).optional()
  })
  .refine((d) => d.decision === 'approved' || !!(d.notes && d.notes.length > 0), {
    message: 'Rechazar, marcar duplicado o pedir más información requiere un motivo.',
    path: ['notes']
  });

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;

/** Correo para solicitar el magic-link. Normalizado a minúsculas. */
export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido').max(200)
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;

/**
 * Forma de cada item que devuelve la RPC `moderation_queue`. Incluye coords
 * EXACTAS (el moderador SÍ las ve, regla #1) y NUNCA PII de reportante
 * (email/phone quedan cifrados en DB, regla #2) — solo nombre/relación/país.
 */
export interface ModerationQueueItem {
  id: string;
  pfif_id: string;
  source: string;
  source_id: string | null;
  source_url: string | null;
  source_date: string | null;
  given_name: string | null;
  family_name: string | null;
  full_name: string;
  alternate_names: string[] | null;
  sex: string;
  age: number | null;
  is_minor: boolean;
  unaccompanied_minor: boolean;
  status: string;
  home_neighborhood: string | null;
  home_city: string | null;
  home_state: string | null;
  last_known_location_text: string | null;
  lat_exact: number | null;
  lng_exact: number | null;
  lat_obfuscated: number | null;
  lng_obfuscated: number | null;
  last_seen_at: string | null;
  description: string | null;
  height_cm: number | null;
  hair_color: string | null;
  eye_color: string | null;
  skin_tone: string | null;
  clothing_top: string | null;
  clothing_bottom: string | null;
  clothing_shoes: string | null;
  distinguishing_marks: string | null;
  photo_url: string | null;
  photo_visibility: string;
  medical_urgent: boolean;
  medical_category: string | null;
  medical_notes: string | null;
  reporter_relation: string | null;
  reporter_name: string | null;
  reporter_country: string | null;
  has_reporter_contact: boolean;
  ai_priority: number | null;
  ai_reasoning: string | null;
  ai_classified_at: string | null;
  created_at: string;
}

export interface ModerationQueue {
  total: number;
  items: ModerationQueueItem[];
}
