import { z } from 'zod';

/**
 * Schemas Zod — validación en el borde para personas (PFIF v1.4 + Faro VE).
 *
 * - reportPersonSchema: valida el POST público de un reporte nuevo.
 * - personFiltersSchema: valida los query params del GET del mapa.
 * - PersonPublic: forma de los datos que devuelve persons_public (mapa).
 */

export const PERSON_STATUS = [
  'missing',
  'found_alive',
  'found_deceased_morgue',
  'unidentified_body',
  'safe_self_report',
  'hospitalized',
  'sheltered',
  'withdrawn'
] as const;

export const SEX = ['male', 'female', 'other', 'unknown'] as const;

export const MEDICAL_CATEGORY = [
  'chronic_disease',
  'dialysis',
  'oxygen_dependent',
  'insulin_dependent',
  'pregnancy',
  'pediatric_critical',
  'mental_health',
  'mobility_impaired',
  'other'
] as const;

export const REPORTER_RELATION = [
  'self',
  'family',
  'friend',
  'witness',
  'authority',
  'volunteer',
  'media',
  'unknown'
] as const;

// Venezuela bounding box (aprox) — rechaza coords obviamente fuera del país.
const VE_LAT = { min: 0.6, max: 12.3 };
const VE_LNG = { min: -73.4, max: -59.8 };

const latitude = z.coerce.number().min(VE_LAT.min).max(VE_LAT.max);
const longitude = z.coerce.number().min(VE_LNG.min).max(VE_LNG.max);

/** POST /api/persons — reporte público nuevo. */
export const reportPersonSchema = z.object({
  given_name: z.string().trim().min(1, 'Falta el nombre').max(120),
  family_name: z.string().trim().max(120).optional().default(''),
  alternate_names: z.array(z.string().trim().max(120)).max(10).optional(),

  sex: z.enum(SEX).default('unknown'),
  age: z.coerce.number().int().min(0).max(130).optional(),

  status: z.enum(PERSON_STATUS).default('missing'),

  // Última ubicación conocida (opcional; si viene, se valida dentro de VE).
  last_known_location_text: z.string().trim().max(300).optional(),
  lat: latitude.optional(),
  lng: longitude.optional(),
  last_seen_at: z.string().datetime({ offset: true }).optional(),

  home_neighborhood: z.string().trim().max(120).optional(),
  home_city: z.string().trim().max(120).optional().default('Caracas'),
  home_state: z.string().trim().max(120).optional(),

  description: z.string().trim().max(2000).optional(),
  height_cm: z.coerce.number().int().min(30).max(260).optional(),
  clothing_top: z.string().trim().max(200).optional(),
  clothing_bottom: z.string().trim().max(200).optional(),
  clothing_shoes: z.string().trim().max(200).optional(),
  distinguishing_marks: z.string().trim().max(500).optional(),

  // Urgencia médica
  medical_urgent: z.coerce.boolean().optional().default(false),
  medical_category: z.enum(MEDICAL_CATEGORY).optional(),
  medical_notes: z.string().trim().max(1000).optional(),

  // Auto-reporte "a salvo" — opt-in para compartir coord exacta (default OFF).
  share_exact_location_with_searchers: z.coerce.boolean().optional().default(false),

  // Reportante (PII — se hashea/encripta server-side, NUNCA se expone).
  reporter_relation: z.enum(REPORTER_RELATION).default('unknown'),
  reporter_name: z.string().trim().max(120).optional(),
  reporter_email: z.string().trim().email('Email inválido').max(200).optional(),
  reporter_phone: z.string().trim().max(40).optional(),
  reporter_country: z.string().trim().max(80).optional(),
  reporter_consent_relay: z.coerce.boolean().optional().default(true),

  // Idempotencia offline.
  client_uuid: z.string().uuid().optional(),

  // Anti-bot (verificado en hooks; aquí solo se acepta el campo).
  'cf-turnstile-response': z.string().optional()
})
  .refine((d) => (d.lat == null) === (d.lng == null), {
    message: 'lat y lng deben venir juntos o ninguno',
    path: ['lat']
  })
  .refine((d) => !d.medical_category || d.medical_urgent, {
    message: 'medical_category requiere medical_urgent=true',
    path: ['medical_category']
  });

export type ReportPersonInput = z.infer<typeof reportPersonSchema>;

/** GET /api/persons — filtros del mapa (todos opcionales). */
export const personFiltersSchema = z.object({
  status: z.enum(PERSON_STATUS).optional(),
  is_minor: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  medical_urgent: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sector: z.string().trim().max(120).optional(),
  // Bounding box opcional para cargar solo lo visible: "minLng,minLat,maxLng,maxLat"
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(1000)
});

export type PersonFilters = z.infer<typeof personFiltersSchema>;

/** Forma pública (de persons_public) que consume el mapa. */
export interface PersonPublic {
  id: string;
  pfif_id: string;
  source: string;
  source_url: string | null;
  given_name: string | null;
  family_name: string | null;
  full_name: string;
  sex: (typeof SEX)[number];
  age: number | null;
  home_neighborhood: string | null;
  home_city: string | null;
  last_known_location_text: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  clothing_top: string | null;
  clothing_bottom: string | null;
  distinguishing_marks: string | null;
  photo_url: string | null;
  status: (typeof PERSON_STATUS)[number];
  is_minor: boolean;
  unaccompanied_minor: boolean;
  medical_urgent: boolean;
  medical_category: string | null;
  share_exact_location_with_searchers: boolean;
  lat_exact_optional: number | null;
  lng_exact_optional: number | null;
  created_at: string;
  last_seen_at: string | null;
}
