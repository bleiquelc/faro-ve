import { z } from 'zod';
import { isInVenezuela } from '$schemas/person';

/**
 * Schemas Zod — notas públicas (avistamientos / "tengo información") sobre una
 * persona. Validación en el borde antes de la RPC create_note_report.
 */

// Tipos que el PÚBLICO puede crear (espeja la whitelist de create_note_report).
export const PUBLIC_NOTE_TYPE = ['sighting', 'info_update'] as const;
export type PublicNoteType = (typeof PUBLIC_NOTE_TYPE)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

/** POST /api/notes — nota pública nueva sobre una persona. */
export const reportNoteSchema = z
  .object({
    person_id: z.string().regex(UUID_RE, 'person_id inválido'),
    type: z.enum(PUBLIC_NOTE_TYPE).default('info_update'),
    text: z.string().trim().min(1, 'Escribe lo que sabes').max(2000),

    // ¿Dónde la viste? (opcional). Coords fuera de VE se descartan (no fallan).
    sighting_location_text: z.string().trim().max(300).optional(),
    lat: latitude.optional(),
    lng: longitude.optional(),
    sighting_date: z.string().datetime({ offset: true }).optional(),

    // Contacto del autor (opcional, PII — se hashea/encripta server-side).
    author_name: z.string().trim().max(120).optional(),
    author_email: z.string().trim().email('Email inválido').max(200).optional(),
    author_phone: z.string().trim().max(40).optional(),

    client_uuid: z.string().uuid().optional(),
    'cf-turnstile-response': z.string().optional()
  })
  .refine((d) => (d.lat == null) === (d.lng == null), {
    message: 'lat y lng deben venir juntos o ninguno',
    path: ['lat']
  })
  // Coords fuera de Venezuela → se descartan (la ubicación es opcional; nunca
  // queremos perder un avistamiento útil por una coord imprecisa).
  .transform((d) => {
    if (d.lat != null && d.lng != null && !isInVenezuela(d.lat, d.lng)) {
      return { ...d, lat: undefined, lng: undefined };
    }
    return d;
  });

export type ReportNoteInput = z.infer<typeof reportNoteSchema>;

/** Item de la cola de moderación de notas (notes_moderation_queue). Sin PII. */
export interface NotesModerationQueueItem {
  id: string;
  person_id: string;
  person_name: string | null;
  type: string;
  text: string;
  sighting_location_text: string | null;
  lat_exact: number | null;
  lng_exact: number | null;
  sighting_date: string | null;
  author_name: string | null;
  has_author_contact: boolean;
  created_at: string;
}

export interface NotesModerationQueue {
  total: number;
  items: NotesModerationQueueItem[];
}

/** Forma pública (de notes_public) que consume la ficha. */
export interface NotePublic {
  id: string;
  person_id: string;
  source: string;
  type: string;
  text: string;
  sighting_location_text: string | null;
  sighting_lat: number | null;
  sighting_lng: number | null;
  sighting_date: string | null;
  created_at: string;
}
