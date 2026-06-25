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

// Subconjunto que un REPORTE PÚBLICO puede crear (espeja la whitelist dura de
// la RPC create_person_report). found_*/withdrawn son de ciclo de vida/moderación
// y NUNCA se crean desde el endpoint público → el borde Zod los rechaza con 400.
export const PUBLIC_REPORT_STATUS = [
  'missing',
  'safe_self_report',
  'unidentified_body',
  'sheltered',
  'hospitalized'
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

// Venezuela bounding box (aprox). Las coords fuera de VE NO fallan el reporte:
// se DESCARTAN (la ubicación es opcional). Así un GPS con deriva en la costa, un
// Wi-Fi de escritorio, o un familiar de la diáspora reportando desde el exterior
// no pierden un reporte crítico — solo no se guarda esa coordenada.
const VE_LAT = { min: 0.6, max: 12.3 };
const VE_LNG = { min: -73.4, max: -59.8 };

export function isInVenezuela(lat: number, lng: number): boolean {
  return lat >= VE_LAT.min && lat <= VE_LAT.max && lng >= VE_LNG.min && lng <= VE_LNG.max;
}

// Rango "tierra válida" (no el bbox de VE): rechaza basura real (NaN, 999) pero
// deja pasar cualquier coord terrestre; el transform de abajo descarta las que
// caen fuera de Venezuela.
const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/** POST /api/persons — reporte público nuevo. */
export const reportPersonSchema = z.object({
  given_name: z.string().trim().min(1, 'Falta el nombre').max(120),
  family_name: z.string().trim().max(120).optional().default(''),
  alternate_names: z.array(z.string().trim().max(120)).max(10).optional(),

  sex: z.enum(SEX).default('unknown'),
  age: z.coerce.number().int().min(0).max(130).optional(),

  status: z.enum(PUBLIC_REPORT_STATUS).default('missing'),

  // Última ubicación conocida (opcional). Coords fuera de VE se descartan abajo.
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

  // Foto: PATH en el bucket privado report-photos (UUID.jpg que produce
  // /api/upload-url). UUID estricto → cero inyección de paths arbitrarios.
  photo_url: z
    .string()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i, 'photo_url inválido')
    .optional(),

  // Urgencia médica
  medical_urgent: z.coerce.boolean().optional().default(false),
  medical_category: z.enum(MEDICAL_CATEGORY).optional(),
  medical_notes: z.string().trim().max(1000).optional(),

  // Auto-reporte "a salvo" — opt-in para compartir coord exacta (default OFF).
  share_exact_location_with_searchers: z.coerce.boolean().optional().default(false),

  // Auto-reporte "a salvo" — teléfono PÚBLICO opt-in del propio sujeto (default
  // vacío). La RPC lo ignora salvo status='safe_self_report'. NO es PII de
  // reportante de terceros: la persona elige publicarlo para que la contacten.
  contact_phone_public: z.string().trim().max(40).optional(),

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
  })
  // Coords fuera de Venezuela → se descartan (no fallan el reporte). La ubicación
  // es opcional; nunca queremos perder un reporte crítico por una coord imprecisa.
  .transform((d) => {
    if (d.lat != null && d.lng != null && !isInVenezuela(d.lat, d.lng)) {
      return { ...d, lat: undefined, lng: undefined };
    }
    return d;
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
  // Búsqueda por nombre (fuzzy ilike sobre full_name).
  q: z.string().trim().max(120).optional(),
  // Bounding box opcional para cargar solo lo visible: "minLng,minLat,maxLng,maxLat"
  bbox: z
    .string()
    .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional().default(1000)
});

export type PersonFilters = z.infer<typeof personFiltersSchema>;

/**
 * GET /api/persons/clusters — agregación por zona (burbujas con conteo real).
 * Soporta los filtros del mapa (status/is_minor/medical_urgent). NO incluye
 * `sector` ni `q` a propósito: el agregado es geográfico por bbox/zoom; la búsqueda
 * por nombre usa el modo de pines (no agrega).
 */
export const clusterFiltersSchema = z.object({
  bbox: z.string().regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/),
  zoom: z.coerce.number().min(0).max(22),
  status: z.enum(PERSON_STATUS).optional(),
  is_minor: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  medical_urgent: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
});

export type ClusterFilters = z.infer<typeof clusterFiltersSchema>;

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
  // Teléfono público OPT-IN del sujeto (solo safe_self_report que lo compartió
  // explícitamente). Lo expone persons_public a partir de la migración 0010;
  // opcional aquí para forward-compat antes de aplicarla.
  contact_phone_optional?: string | null;
  created_at: string;
  last_seen_at: string | null;
}
