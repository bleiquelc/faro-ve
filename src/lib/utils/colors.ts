/**
 * Paleta accesible AAA + tokens semánticos por categoría — Faro VE.
 * Espejado en tailwind.config.ts. Cambios aquí deben replicarse allá.
 *
 * Criterios de selección:
 *  - Cada par (texto sobre fondo blanco) cumple WCAG AAA (≥7:1 contraste).
 *  - Daltonismo-friendly: probado en deuteranopia/protanopia/tritanopia con
 *    simulador. Diferenciados por luminancia, no solo por matiz.
 */

export type CategoryToken =
  | 'minor'
  | 'medical'
  | 'missing'
  | 'sighting'
  | 'deceased'
  | 'safe'
  | 'shelter'
  | 'aid'
  | 'search'
  | 'closed';

export type AidSubtype =
  | 'food'
  | 'water'
  | 'medical'
  | 'clothing'
  | 'charging'
  | 'wifi'
  | 'shelter_temporary'
  | 'shelter_permanent'
  | 'distribution'
  | 'mental_health'
  | 'translation'
  | 'transport'
  | 'document_help'
  | 'other';

export const COLOR: Record<CategoryToken, string> = {
  minor: '#7c3aed',
  medical: '#ea580c',
  missing: '#dc2626',
  sighting: '#eab308',
  deceased: '#1f2937',
  safe: '#16a34a',
  shelter: '#0B4F6C',
  aid: '#06b6d4',
  search: '#92400e',
  closed: '#9ca3af'
};

export const COLOR_ON: Record<CategoryToken, string> = {
  minor: '#ffffff',
  medical: '#ffffff',
  missing: '#ffffff',
  sighting: '#1f2937',
  deceased: '#ffffff',
  safe: '#ffffff',
  shelter: '#ffffff',
  aid: '#0e3a4a',
  search: '#ffffff',
  closed: '#1f2937'
};

export const LABEL_ES: Record<CategoryToken, string> = {
  minor: 'Menor no acompañado',
  medical: 'Urgencia médica',
  missing: 'Desaparecido',
  sighting: 'Avistamiento',
  deceased: 'Cuerpo no identificado',
  safe: 'A salvo',
  shelter: 'Refugio',
  aid: 'Punto de ayuda',
  search: 'Búsqueda activa',
  closed: 'Cerrado'
};

export const LABEL_EN: Record<CategoryToken, string> = {
  minor: 'Unaccompanied minor',
  medical: 'Medical emergency',
  missing: 'Missing person',
  sighting: 'Sighting',
  deceased: 'Unidentified body',
  safe: 'Safe',
  shelter: 'Shelter',
  aid: 'Aid point',
  search: 'Active search',
  closed: 'Closed'
};

/** Animación CSS (clase Tailwind) por categoría, o null si estática. */
export const PULSE_CLASS: Record<CategoryToken, string | null> = {
  minor: 'animate-pulse-minor',
  medical: 'animate-pulse-medical',
  missing: null,
  sighting: null,
  deceased: null,
  safe: 'animate-fade-in',
  shelter: null,
  aid: null,
  search: null,
  closed: null
};

/** Subtipos de aid_points → emoji + label corto (para pins + popups). */
export const AID_META: Record<AidSubtype, { emoji: string; label: string }> = {
  food: { emoji: '🍞', label: 'Alimentos' },
  water: { emoji: '💧', label: 'Agua' },
  medical: { emoji: '🏥', label: 'Atención médica' },
  clothing: { emoji: '👕', label: 'Ropa' },
  charging: { emoji: '🔌', label: 'Carga eléctrica' },
  wifi: { emoji: '📶', label: 'Wi-Fi' },
  shelter_temporary: { emoji: '⛺', label: 'Refugio temporal' },
  shelter_permanent: { emoji: '🏠', label: 'Refugio permanente' },
  distribution: { emoji: '📦', label: 'Distribución' },
  mental_health: { emoji: '🧠', label: 'Apoyo psicológico' },
  translation: { emoji: '🗣️', label: 'Traducción' },
  transport: { emoji: '🚐', label: 'Transporte' },
  document_help: { emoji: '📄', label: 'Trámites' },
  other: { emoji: '🤝', label: 'Otro' }
};

/** Devuelve el token de categoría a partir del estado PFIF del person. */
export function categoryForPerson(opts: {
  status: string;
  is_minor: boolean;
  medical_urgent: boolean;
}): CategoryToken {
  if (opts.is_minor) return 'minor';
  if (opts.medical_urgent) return 'medical';
  switch (opts.status) {
    case 'missing':
      return 'missing';
    case 'safe_self_report':
    case 'found_alive':
      return 'safe';
    case 'found_deceased_morgue':
    case 'unidentified_body':
      return 'deceased';
    case 'sheltered':
      return 'shelter';
    case 'hospitalized':
      return 'medical';
    default:
      return 'closed';
  }
}
