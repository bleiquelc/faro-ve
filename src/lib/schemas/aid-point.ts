import { z } from 'zod';
import { isInVenezuela } from '$schemas/person';

/**
 * Schemas Zod — lugares de servicio (aid_points) + autorregulación comunitaria.
 *
 * - registerAidPointSchema: POST público de alta (visible al instante, sin verificar).
 * - voteAidPointSchema:      voto confirmar/reportar (1 por IP, vía Turnstile).
 * - reactivateAidPointSchema: reactivar un punto auto-ocultado (exige WhatsApp).
 * - aidPointFiltersSchema:   query params del GET del mapa.
 * - AidPointPublic:          forma de los datos que devuelve aid_points_public.
 *
 * Regla #26: estos son LUGARES (no personas) → coords EXACTAS y OBLIGATORIAS.
 */

// Espeja el enum aid_type de la migración 0007. No incluir valores que el enum
// de la DB no tenga (un cast inválido lanza en la RPC).
export const AID_TYPE = [
  'food',
  'water',
  'medical',
  'clothing',
  'charging',
  'wifi',
  'shelter_temporary',
  'shelter_permanent',
  'distribution',
  'mental_health',
  'translation',
  'transport',
  'document_help',
  'other'
] as const;

export type AidType = (typeof AID_TYPE)[number];

// Coords terrestres válidas (rechaza NaN/999); el refine de abajo exige Venezuela.
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/**
 * POST /api/aid-points — alta pública de un lugar de servicio.
 * Coords EXACTAS obligatorias y dentro de Venezuela (a diferencia de personas,
 * donde la ubicación es opcional y se ofusca). Aquí la gente DEBE poder llegar.
 */
export const registerAidPointSchema = z
  .object({
    type: z.enum(AID_TYPE),
    name: z.string().trim().min(2, 'Falta el nombre del lugar').max(160),

    // Etiquetas de insumos (checkboxes) — lista corta y acotada.
    supplies: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),

    // Horario libre (texto) → se guarda como { text }. Estructurado puede venir luego.
    schedule_text: z.string().trim().max(280).optional(),

    capacity_current: z.coerce.number().int().min(0).max(100000).optional(),
    capacity_max: z.coerce.number().int().min(0).max(100000).optional(),

    // Coords EXACTAS obligatorias.
    lat: latitude,
    lng: longitude,

    address_text: z.string().trim().min(4, 'Falta la dirección').max(300),
    landmark: z.string().trim().max(200).optional(),
    entrance_notes: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(500).optional(),

    // Anti-bot (verificado en hooks; aquí solo se acepta el campo).
    'cf-turnstile-response': z.string().optional()
  })
  .refine((d) => isInVenezuela(d.lat, d.lng), {
    message: 'La ubicación debe estar dentro de Venezuela',
    path: ['lat']
  })
  .refine((d) => d.capacity_max == null || d.capacity_current == null || d.capacity_current <= d.capacity_max, {
    message: 'La ocupación actual no puede superar la capacidad máxima',
    path: ['capacity_current']
  });

export type RegisterAidPointInput = z.infer<typeof registerAidPointSchema>;

/** POST /api/aid-points/[id]/vote — confirmar/reportar (1 voto por IP). */
export const voteAidPointSchema = z.object({
  vote: z.enum(['confirm', 'report']),
  'cf-turnstile-response': z.string().optional()
});

export type VoteAidPointInput = z.infer<typeof voteAidPointSchema>;

/** POST /api/aid-points/[id]/reactivate — reactivar punto auto-ocultado. */
export const reactivateAidPointSchema = z.object({
  // WhatsApp del responsable. Se cifra server-side; NUNCA público (#2).
  phone: z.string().trim().min(7, 'Escribe un WhatsApp válido').max(40),
  'cf-turnstile-response': z.string().optional()
});

export type ReactivateAidPointInput = z.infer<typeof reactivateAidPointSchema>;

/** GET /api/aid-points — filtros del mapa (todos opcionales). */
export const aidPointFiltersSchema = z.object({
  type: z.enum(AID_TYPE).optional(),
  q: z.string().trim().max(160).optional(),
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(1000)
});

export type AidPointFilters = z.infer<typeof aidPointFiltersSchema>;

/** Forma pública (de aid_points_public / get_aid_point) que consume la UI. */
export interface AidPointPublic {
  id: string;
  type: AidType;
  name: string;
  organization_name: string | null;
  organization_slug: string | null;
  org_verified: boolean;
  supplies_available: { tags?: string[] } | Record<string, unknown> | null;
  schedule: { text?: string } | Record<string, unknown> | null;
  capacity_current: number | null;
  capacity_max: number | null;
  lat: number;
  lng: number;
  address_text: string;
  landmark: string | null;
  entrance_notes: string | null;
  verified: boolean;
  confirm_count: number;
  report_count: number;
  net_score: number;
  reactivation_count: number;
  last_updated_at: string;
  expires_at: string;
  created_at: string;
}

/** Detalle (get_aid_point) — incluye estado para la página /punto/[id]. */
export interface AidPointDetail extends AidPointPublic {
  active: boolean;
  auto_hidden: boolean;
  is_expired: boolean;
}

/** Etiquetas de insumos seleccionables (checkboxes del formulario). */
export const SUPPLY_OPTIONS: { value: string; label: string }[] = [
  { value: 'agua', label: 'Agua' },
  { value: 'comida', label: 'Comida' },
  { value: 'medicinas', label: 'Medicinas' },
  { value: 'pañales', label: 'Pañales' },
  { value: 'ropa', label: 'Ropa' },
  { value: 'abrigo', label: 'Abrigo / cobijas' },
  { value: 'higiene', label: 'Higiene' },
  { value: 'carga_electrica', label: 'Carga eléctrica' },
  { value: 'wifi', label: 'Wi-Fi / internet' },
  { value: 'atencion_medica', label: 'Atención médica' },
  { value: 'apoyo_psicologico', label: 'Apoyo psicológico' },
  { value: 'informacion', label: 'Información / orientación' }
];

/** Subconjunto de tags válidos (defensa en profundidad: el borde restringe). */
const SUPPLY_VALUES = new Set(SUPPLY_OPTIONS.map((s) => s.value));
export function isKnownSupply(tag: string): boolean {
  return SUPPLY_VALUES.has(tag);
}
