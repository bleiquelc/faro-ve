/**
 * Geocodificación offline de textos de lugar venezolanos → [lat, lng].
 *
 * La fuente de ingesta NO da coordenadas (solo texto de "último lugar visto").
 * Geocodificamos a nivel ciudad/parroquia con tablas deterministas (sin red,
 * idempotente, testeable). El pin es APROXIMADO y además el trigger lo ofusca
 * 300m al insertar — para una persona buscada, estar EN el mapa (aunque sea a
 * nivel ciudad) y ser hallable por nombre vale más que quedar fuera.
 *
 * Selección por NIVEL de especificidad (no por longitud cruda, que haría ganar a
 * un estado de nombre largo sobre un pueblo de nombre corto):
 *   1) SPECIFIC (sectores/parroquias/pueblos)  → más específico
 *   2) CITY (capitales / ciudades mayores)
 *   3) STATE (estados, último recurso)
 * Dentro de cada nivel gana la aguja más larga. Así "Petare, Miranda" → Petare
 * (SPECIFIC) aunque "miranda" sea más largo; "estado Lara" → Barquisimeto (CITY/STATE).
 *
 * Match por PALABRA (límite \b) → 'cua' (Cúa) no matchea dentro de "evacuado".
 * Agujas normalizadas (minúscula, sin acentos). Se evitan tokens ambiguos como
 * 'bolivar' (Plaza/Av. Bolívar está en casi todo pueblo) — Bolívar se cubre por
 * Ciudad Bolívar / Puerto Ordaz en CITY.
 */

// ── 1) SPECIFIC: sectores, parroquias, pueblos (zona del terremoto al detalle) ──
const SPECIFIC = [
  // La Guaira (ex-Vargas)
  ['catia la mar', 10.5959, -67.0257],
  ['punta de mulato', 10.6133, -66.8333],
  ['los corales', 10.6121, -66.8607],
  ['tanaguarenas', 10.6178, -66.8222],
  ['tanaguarena', 10.6178, -66.8222],
  ['caraballeda', 10.6125, -66.8492],
  ['caraballera', 10.6125, -66.8492],
  ['naiguata', 10.6242, -66.7411],
  ['maiquetia', 10.6, -66.9814],
  ['la sabana', 10.6261, -66.385],
  ['carayaca', 10.5167, -67.1333],
  ['chichiriviche de la costa', 10.5333, -67.1667],
  ['todasana', 10.6333, -66.6],
  ['macuto', 10.6086, -66.8911],
  ['oricao', 10.5447, -67.0986],
  ['la guaira', 10.6, -66.9314],
  ['guaira', 10.6, -66.9314],
  ['guaria', 10.6, -66.9314], // typo muy frecuente de "Guaira" en los reportes
  ['guiara', 10.6, -66.9314], // typo de "Guaira"
  ['caribe', 10.61, -66.85], // zona costera Caraballeda/Caribe (muy frecuente)
  ['mare', 10.61, -66.83], // sector de La Guaira
  ['playa verde', 10.59, -66.97],
  // Caracas — parroquias / municipios / sectores
  ['propatria', 10.5167, -66.9333],
  ['catia', 10.5167, -66.9333],
  ['la pastora', 10.5089, -66.9216],
  ['veintitres de enero', 10.5111, -66.9272],
  ['23 de enero', 10.5111, -66.9272],
  ['san agustin', 10.4889, -66.8983],
  ['el valle', 10.45, -66.9],
  ['coche', 10.4567, -66.9333],
  ['antimano', 10.4667, -66.9667],
  ['caricuao', 10.4333, -66.9833],
  ['macarao', 10.4167, -67.0167],
  ['el junquito', 10.5333, -67.0667],
  ['la vega', 10.4667, -66.9333],
  ['el cementerio', 10.4639, -66.9075],
  ['el recreo', 10.4936, -66.8786],
  ['sabana grande', 10.4928, -66.8722],
  ['chacao', 10.4961, -66.8536],
  ['petare', 10.4773, -66.8186],
  ['el hatillo', 10.4256, -66.82],
  ['baruta', 10.4339, -66.875],
  ['altamira', 10.495, -66.845],
  ['los palos grandes', 10.503, -66.843],
  ['san bernardino', 10.506, -66.897],
  ['la castellana', 10.498, -66.852],
  ['los teques', 10.3417, -67.0417],
  // Miranda — pueblos
  ['guarenas', 10.4719, -66.6111],
  ['guatire', 10.4761, -66.5408],
  ['charallave', 10.2469, -66.8589],
  ['ocumare del tuy', 10.1136, -66.7806],
  ['santa teresa del tuy', 10.2389, -66.6644],
  ['san antonio de los altos', 10.3833, -66.9667],
  ['higuerote', 10.4833, -66.1],
  ['rio chico', 10.3167, -65.9667],
  ['caucagua', 10.2833, -66.3667],
  ['carrizal', 10.35, -67.0333],
  ['cua', 10.1606, -66.8881],
  // Hospitales / referencias frecuentes
  ['perez carreno', 10.4842, -66.9486],
  ['jose maria vargas', 10.5089, -66.9216],
  ['clinico universitario', 10.4861, -66.8911],
  ['domingo luciani', 10.4642, -66.8064]
];

// ── 2) CITY: capitales y ciudades mayores ──
const CITY = [
  ['puerto ordaz', 8.2967, -62.7167],
  ['ciudad guayana', 8.3533, -62.6517],
  ['ciudad bolivar', 8.1222, -63.5497],
  ['puerto la cruz', 10.2139, -64.6164],
  ['barcelona', 10.1333, -64.6833],
  ['san fernando de apure', 7.8939, -67.4736],
  ['san fernando', 7.8939, -67.4736],
  ['san cristobal', 7.7669, -72.225],
  ['san juan de los morros', 9.9097, -67.3539],
  ['san carlos', 9.6611, -68.5836],
  ['san felipe', 10.34, -68.7425],
  ['santa elena de uairen', 4.6028, -61.1133],
  ['puerto cabello', 10.4731, -68.0125],
  ['puerto ayacucho', 5.6639, -67.6236],
  ['ciudad ojeda', 10.2025, -71.3119],
  ['punto fijo', 11.7, -70.2],
  ['porlamar', 10.9577, -63.8483],
  ['la asuncion', 11.0333, -63.8628],
  ['pampatar', 10.9986, -63.7942],
  ['el tigre', 8.8889, -64.2569],
  ['carupano', 10.6667, -63.25],
  ['valera', 9.3178, -70.6036],
  ['acarigua', 9.5597, -69.2019],
  ['araure', 9.5667, -69.2333],
  ['guanare', 9.0417, -69.7497],
  ['cabimas', 10.4019, -71.4397],
  ['maturin', 9.7497, -63.1764],
  ['cumana', 10.4539, -64.1769],
  ['barinas', 8.6225, -70.2075],
  ['tucupita', 9.0606, -62.0517],
  ['trujillo', 9.3669, -70.4358],
  ['coro', 11.4044, -69.6736],
  ['valencia', 10.162, -67.9972],
  ['maracay', 10.2469, -67.5958],
  ['maracaibo', 10.6545, -71.6406],
  ['barquisimeto', 10.0647, -69.3475],
  ['merida', 8.5897, -71.1561],
  ['caracas', 10.4806, -66.9036],
  // Municipios poblados adicionales (cobertura nacional). Todos ≥4 chars,
  // inequívocos como lugar (se evitan 'rubio'/'el limon' por ambigüedad).
  ['la victoria', 10.227, -67.336],
  ['turmero', 10.228, -67.475],
  ['cagua', 10.186, -67.461],
  ['villa de cura', 10.039, -67.489],
  ['guacara', 10.231, -67.88],
  ['los guayos', 10.18, -67.92],
  ['naguanagua', 10.244, -68.013],
  ['tocuyito', 10.103, -68.099],
  ['mariara', 10.273, -67.703],
  ['san francisco', 10.611, -71.731],
  ['machiques', 10.067, -72.551],
  ['el vigia', 8.613, -71.654],
  ['ejido', 8.545, -71.239],
  ['carora', 10.173, -70.081],
  ['el tocuyo', 9.787, -69.797],
  ['cabudare', 10.034, -69.262],
  ['quibor', 9.928, -69.62],
  ['bocono', 9.249, -70.259],
  ['tucacas', 10.799, -68.319],
  ['anaco', 9.43, -64.463],
  ['cantaura', 9.308, -64.359],
  ['caripito', 10.11, -63.103],
  ['caripe', 10.193, -63.49],
  ['calabozo', 8.924, -67.429],
  ['valle de la pascua', 9.213, -66.003],
  ['zaraza', 9.35, -65.323],
  ['altagracia de orituco', 9.861, -66.38],
  ['guiria', 10.571, -62.301],
  ['tinaquillo', 9.918, -68.304],
  ['yaritagua', 10.082, -69.131],
  ['chivacoa', 10.158, -68.901],
  ['upata', 8.012, -62.399],
  ['tumeremo', 7.302, -61.503],
  ['san antonio del tachira', 7.814, -72.443],
  ['la fria', 8.213, -72.249],
  ['tariba', 7.817, -72.224]
];

// ── 3) STATE: estados (último recurso, a nivel capital). Sin tokens ambiguos. ──
const STATE = [
  ['amazonas', 5.6639, -67.6236],
  ['anzoategui', 10.1333, -64.6833],
  ['apure', 7.8939, -67.4736],
  ['aragua', 10.2469, -67.5958],
  ['carabobo', 10.162, -67.9972],
  ['cojedes', 9.6611, -68.5836],
  ['delta amacuro', 9.0606, -62.0517],
  ['falcon', 11.4044, -69.6736],
  ['guarico', 9.9097, -67.3539],
  ['lara', 10.0647, -69.3475],
  ['monagas', 9.7497, -63.1764],
  ['nueva esparta', 10.9577, -63.8483],
  ['portuguesa', 9.0417, -69.7497],
  ['tachira', 7.7669, -72.225],
  ['yaracuy', 10.34, -68.7425],
  ['zulia', 10.6545, -71.6406],
  ['miranda', 10.25, -66.6],
  ['vargas', 10.6, -66.9314],
  ['la guaira', 10.6, -66.9314]
];

/** Normaliza: minúsculas, sin acentos, espacios colapsados. */
export function normalizePlace(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita marcas diacríticas (acentos)
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Dentro de un nivel: gana la aguja más larga que aparezca como PALABRA (\b).
function matchIn(table, t) {
  let best = null;
  let bestLen = 0;
  for (const [needle, lat, lng] of table) {
    if (needle.length <= bestLen) continue;
    if (new RegExp('\\b' + escapeRegex(needle) + '\\b').test(t)) {
      best = [lat, lng];
      bestLen = needle.length;
    }
  }
  return best;
}

/**
 * Geocodifica un texto de lugar a [lat, lng] o null.
 * Prioriza por nivel: SPECIFIC → CITY → STATE (lo más específico que matchee).
 */
export function geocode(text) {
  if (!text) return null;
  const t = normalizePlace(text);
  if (!t) return null;
  return matchIn(SPECIFIC, t) ?? matchIn(CITY, t) ?? matchIn(STATE, t);
}
