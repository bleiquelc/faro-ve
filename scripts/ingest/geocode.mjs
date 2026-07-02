/**
 * Geocodificación offline de textos de lugar venezolanos → [lat, lng].
 *
 * La fuente de ingesta NO da coordenadas (solo texto de "último lugar visto").
 * Geocodificamos a nivel sector/parroquia/ciudad con tablas deterministas (sin
 * red, idempotente, testeable). El pin es APROXIMADO y además el trigger lo
 * ofusca 200–500 m al insertar — para una persona buscada, estar EN el mapa
 * (aunque sea a nivel ciudad) y ser hallable por nombre vale más que quedar
 * fuera.
 *
 * v2 (2-jul-2026) — precisión + anclas en tierra:
 *  - TODA ancla curada está verificada EN TIERRA contra la máscara ve-land
 *    (tests/ingest/geocode.test.ts lo garantiza). Un ancla en el mar hacía que
 *    la ofuscación agotara sus 16 intentos y el snap-a-costa apilara miles de
 *    pines sobre el agua (bug reportado por el founder, 2-jul).
 *  - Tabla PLACES generada de GeoNames (CC BY 4.0): sedes de municipio y
 *    parroquia + pueblos + sectores urbanos → el pin cae en el lugar real de la
 *    dirección pública, no en la capital del estado.
 *  - Desambiguación por CONTEXTO: nombres duplicados entre estados (o sectores
 *    urbanos) solo matchean si el texto también menciona su estado o una ciudad
 *    del mismo estado.
 *
 * Selección por NIVEL de especificidad:
 *   1) SPECIFIC (sectores/parroquias curados, zona del terremoto al detalle)
 *   2) PLACES (GeoNames) vs CITY (curadas) — gana el lugar fino si su estado es
 *      coherente con la ciudad/estado del texto; si chocan, gana la ciudad.
 *   3) STATE (estados, último recurso)
 * Dentro de cada nivel gana la aguja más larga, con match por PALABRA (\b).
 *
 * IMPORTANTE: al cambiar tablas o lógica, subir GEOCODE_VERSION — el worker
 * cron-ingest re-geocodifica los registros existentes cuando ve una versión
 * nueva (workers/cron-ingest/src/regeocode.ts).
 */
import { PLACES } from './geocode-places.mjs';

/** Subir en cada cambio de tablas/lógica → dispara la re-geocodificación. */
export const GEOCODE_VERSION = 2;

// ── 1) SPECIFIC: sectores, parroquias, pueblos (zona del terremoto al detalle) ──
// Coordenadas corregidas 2-jul-2026 con GeoNames (las viejas de Tanaguarena,
// Naiguatá, Los Corales, La Sabana, Todasana, Mare… caían EN EL MAR).
/** @type {[string, number, number][]} */
const SPECIFIC = [
  // La Guaira (ex-Vargas)
  ['catia la mar', 10.5959, -67.0257],
  ['punta de mulato', 10.604, -66.918],
  ['punta de mulatos', 10.604, -66.918],
  ['los corales', 10.607, -66.858],
  ['tanaguarenas', 10.6095, -66.8255],
  ['tanaguarena', 10.6095, -66.8255],
  ['caraballeda', 10.6125, -66.8492],
  ['caraballera', 10.6125, -66.8492],
  ['naiguata', 10.62026, -66.73833],
  ['maiquetia', 10.5945, -66.95624],
  ['la sabana', 10.6166, -66.38107],
  ['carayaca', 10.53233, -67.11715],
  ['chichiriviche de la costa', 10.54407, -67.24319],
  ['todasana', 10.62521, -66.45993],
  ['macuto', 10.6086, -66.8911],
  ['oricao', 10.55122, -67.18426],
  ['caribe', 10.61, -66.85], // zona costera Caraballeda/Caribe (muy frecuente)
  ['mare', 10.60728, -66.97921], // Mare Abajo/Arriba, junto a Catia La Mar
  ['playa verde', 10.603, -67.048],
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
  ['la california', 10.489, -66.812],
  ['el silencio', 10.5041, -66.9194],
  ['los teques', 10.3417, -67.0417],
  // Miranda — pueblos
  ['guarenas', 10.4719, -66.6111],
  ['guatire', 10.4761, -66.5408],
  ['charallave', 10.2469, -66.8589],
  ['ocumare del tuy', 10.1136, -66.7806],
  ['santa teresa del tuy', 10.2389, -66.6644],
  ['san antonio de los altos', 10.3833, -66.9667],
  ['higuerote', 10.465, -66.11],
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

// ── 2) CITY: capitales y ciudades mayores (con su estado, para el contexto) ──
/** @type {[string, number, number, string | string[]][]} */
const CITY = [
  // La Guaira ciudad + typos frecuentes (estado vargas): nivel CITY para que los
  // pueblos finos de la costa (Chuspa, Osma, Caruao… vía PLACES) puedan ganarle.
  ['la guaira', 10.6, -66.9314, 'vargas'],
  ['guaira', 10.6, -66.9314, 'vargas'],
  ['guaria', 10.6, -66.9314, 'vargas'], // typo muy frecuente de "Guaira"
  ['guiara', 10.6, -66.9314, 'vargas'], // typo de "Guaira"
  ['puerto ordaz', 8.2967, -62.7167, 'bolivar'],
  ['ciudad guayana', 8.3533, -62.6517, 'bolivar'],
  ['ciudad bolivar', 8.1222, -63.5497, 'bolivar'],
  ['puerto la cruz', 10.2139, -64.6164, 'anzoategui'],
  ['barcelona', 10.1333, -64.6833, 'anzoategui'],
  ['san fernando de apure', 7.8939, -67.4736, 'apure'],
  ['san fernando', 7.8939, -67.4736, 'apure'],
  ['san cristobal', 7.7669, -72.225, 'tachira'],
  ['san juan de los morros', 9.9097, -67.3539, 'guarico'],
  ['san carlos', 9.6611, -68.5836, 'cojedes'],
  ['san felipe', 10.34, -68.7425, 'yaracuy'],
  ['santa elena de uairen', 4.6028, -61.1133, 'bolivar'],
  ['puerto cabello', 10.4731, -68.0125, 'carabobo'],
  ['puerto ayacucho', 5.6639, -67.6236, 'amazonas'],
  ['ciudad ojeda', 10.2025, -71.3119, 'zulia'],
  ['punto fijo', 11.7, -70.2, 'falcon'],
  ['porlamar', 10.95771, -63.86971, 'nueva esparta'],
  ['la asuncion', 11.0333, -63.8628, 'nueva esparta'],
  ['pampatar', 10.9986, -63.7942, 'nueva esparta'],
  ['el tigre', 8.8889, -64.2569, 'anzoategui'],
  ['carupano', 10.6667, -63.25, 'sucre'],
  ['valera', 9.3178, -70.6036, 'trujillo'],
  ['acarigua', 9.5597, -69.2019, 'portuguesa'],
  ['araure', 9.5667, -69.2333, 'portuguesa'],
  ['guanare', 9.0417, -69.7497, 'portuguesa'],
  ['cabimas', 10.4019, -71.4397, 'zulia'],
  ['maturin', 9.7497, -63.1764, 'monagas'],
  ['cumana', 10.4539, -64.1769, 'sucre'],
  ['barinas', 8.6225, -70.2075, 'barinas'],
  ['tucupita', 9.0606, -62.0517, 'delta amacuro'],
  ['trujillo', 9.3669, -70.4358, 'trujillo'],
  ['coro', 11.4044, -69.6736, 'falcon'],
  ['valencia', 10.162, -67.9972, 'carabobo'],
  ['maracay', 10.2469, -67.5958, 'aragua'],
  ['maracaibo', 10.6545, -71.6406, 'zulia'],
  ['barquisimeto', 10.0647, -69.3475, 'lara'],
  ['merida', 8.5897, -71.1561, 'merida'],
  // Caracas abarca Distrito Capital + municipios mirandinos (Gran Caracas).
  ['caracas', 10.4806, -66.9036, ['distrito federal', 'miranda']],
  // Municipios poblados adicionales (cobertura nacional). Todos ≥4 chars,
  // inequívocos como lugar (se evitan 'rubio'/'el limon' por ambigüedad).
  ['la victoria', 10.227, -67.336, 'aragua'],
  ['turmero', 10.228, -67.475, 'aragua'],
  ['cagua', 10.186, -67.461, 'aragua'],
  ['villa de cura', 10.039, -67.489, 'aragua'],
  ['guacara', 10.231, -67.88, 'carabobo'],
  ['los guayos', 10.18, -67.92, 'carabobo'],
  ['naguanagua', 10.244, -68.013, 'carabobo'],
  ['tocuyito', 10.103, -68.099, 'carabobo'],
  ['mariara', 10.273, -67.703, 'carabobo'],
  ['san francisco', 10.55363, -71.70364, 'zulia'],
  ['machiques', 10.067, -72.551, 'zulia'],
  ['el vigia', 8.613, -71.654, 'merida'],
  ['ejido', 8.545, -71.239, 'merida'],
  ['carora', 10.173, -70.081, 'lara'],
  ['el tocuyo', 9.787, -69.797, 'lara'],
  ['cabudare', 10.034, -69.262, 'lara'],
  ['quibor', 9.928, -69.62, 'lara'],
  ['bocono', 9.249, -70.259, 'trujillo'],
  ['tucacas', 10.7877, -68.3305, 'falcon'],
  ['anaco', 9.43, -64.463, 'anzoategui'],
  ['cantaura', 9.308, -64.359, 'anzoategui'],
  ['caripito', 10.11, -63.103, 'monagas'],
  ['caripe', 10.193, -63.49, 'monagas'],
  ['calabozo', 8.924, -67.429, 'guarico'],
  ['valle de la pascua', 9.213, -66.003, 'guarico'],
  ['zaraza', 9.35, -65.323, 'guarico'],
  ['altagracia de orituco', 9.861, -66.38, 'guarico'],
  ['guiria', 10.571, -62.301, 'sucre'],
  ['tinaquillo', 9.918, -68.304, 'cojedes'],
  ['yaritagua', 10.082, -69.131, 'yaracuy'],
  ['chivacoa', 10.158, -68.901, 'yaracuy'],
  ['upata', 8.012, -62.399, 'bolivar'],
  ['tumeremo', 7.302, -61.503, 'bolivar'],
  ['san antonio del tachira', 7.814, -72.443, 'tachira'],
  ['la fria', 8.213, -72.249, 'tachira'],
  ['tariba', 7.817, -72.224, 'tachira']
];

// ── 3) STATE: estados (último recurso, a nivel capital) ──
// 'sucre' y 'bolivar' sueltos son ambiguos (Municipio Sucre/Petare, Av. Bolívar)
// → solo se anclan con el prefijo "estado/edo".
/** @type {[string, number, number, string][]} */
const STATE = [
  ['amazonas', 5.6639, -67.6236, 'amazonas'],
  ['anzoategui', 10.1333, -64.6833, 'anzoategui'],
  ['apure', 7.8939, -67.4736, 'apure'],
  ['aragua', 10.2469, -67.5958, 'aragua'],
  ['carabobo', 10.162, -67.9972, 'carabobo'],
  ['cojedes', 9.6611, -68.5836, 'cojedes'],
  ['delta amacuro', 9.0606, -62.0517, 'delta amacuro'],
  ['falcon', 11.4044, -69.6736, 'falcon'],
  ['guarico', 9.9097, -67.3539, 'guarico'],
  ['lara', 10.0647, -69.3475, 'lara'],
  ['monagas', 9.7497, -63.1764, 'monagas'],
  ['nueva esparta', 10.95771, -63.86971, 'nueva esparta'],
  ['portuguesa', 9.0417, -69.7497, 'portuguesa'],
  ['tachira', 7.7669, -72.225, 'tachira'],
  ['yaracuy', 10.34, -68.7425, 'yaracuy'],
  ['zulia', 10.6545, -71.6406, 'zulia'],
  ['miranda', 10.25, -66.6, 'miranda'],
  ['vargas', 10.6, -66.9314, 'vargas'],
  ['la guaira', 10.6, -66.9314, 'vargas'],
  ['distrito capital', 10.4806, -66.9036, 'distrito federal'],
  ['distrito federal', 10.4806, -66.9036, 'distrito federal'],
  ['estado sucre', 10.4539, -64.1769, 'sucre'],
  ['edo sucre', 10.4539, -64.1769, 'sucre'],
  ['edo. sucre', 10.4539, -64.1769, 'sucre'],
  ['estado bolivar', 8.1222, -63.5497, 'bolivar'],
  ['edo bolivar', 8.1222, -63.5497, 'bolivar'],
  ['edo. bolivar', 8.1222, -63.5497, 'bolivar']
];

/**
 * Normaliza: minúsculas, sin acentos, espacios colapsados.
 * @param {string} text
 * @returns {string}
 */
export function normalizePlace(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita marcas diacríticas (acentos)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parte un texto normalizado en palabras (separador = todo lo no alfanumérico).
 * Equivale a los límites \b del matching por palabra, y además trata guiones y
 * puntuación como separadores ("catia-la-mar" matchea 'catia la mar').
 * @param {string} t @returns {string[]}
 */
export function tokenizePlace(t) {
  return t.split(/[^a-z0-9ñ']+/).filter(Boolean);
}

/**
 * Matcher por N-GRAMAS de tokens: las agujas viven en un Map frase→aguja y el
 * texto se recorre por ventanas de 1..maxN palabras. O(palabras × maxN) lookups
 * por texto — sin regex gigantes. Importa para la re-geocodificación del worker
 * (decenas de miles de textos por tick con límite de CPU) y conserva la
 * semántica de match por PALABRA completa ('cua' no matchea en "evacuado").
 * @param {string[]} needles
 */
function buildMatcher(needles) {
  /** @type {Map<string, string>} frase tokenizada → aguja original */
  const phrases = new Map();
  let maxN = 1;
  for (const n of new Set(needles)) {
    const toks = tokenizePlace(n);
    if (!toks.length) continue;
    if (toks.length > maxN) maxN = toks.length;
    phrases.set(toks.join(' '), n);
  }
  return {
    /** @param {string} t @returns {string[]} agujas encontradas (longitud desc) */
    all(t) {
      return this.allTokens(tokenizePlace(t));
    },
    /** @param {string[]} tokens @returns {string[]} agujas encontradas (longitud desc) */
    allTokens(tokens) {
      /** @type {Set<string>} */
      const found = new Set();
      const top = Math.min(maxN, tokens.length);
      for (let n = top; n >= 1; n--) {
        for (let i = 0; i + n <= tokens.length; i++) {
          const orig = phrases.get(tokens.slice(i, i + n).join(' '));
          if (orig) found.add(orig);
        }
      }
      return [...found].sort((a, b) => b.length - a.length);
    }
  };
}

/** Índices tabla → entradas (por aguja). */
const specIdx = new Map(SPECIFIC.map((e) => [e[0], e]));
const cityIdx = new Map(CITY.map((e) => [e[0], e]));
const stateIdx = new Map(STATE.map((e) => [e[0], e]));
/** @type {Map<string, [string, number, number, string, 0|1][]>} */
const placeIdx = new Map();
for (const e of PLACES) {
  const arr = placeIdx.get(e[0]);
  if (arr) arr.push(e);
  else placeIdx.set(e[0], [e]);
}

const specMatch = buildMatcher(SPECIFIC.map((e) => e[0]));
const cityMatch = buildMatcher(CITY.map((e) => e[0]));
const stateMatch = buildMatcher(STATE.map((e) => e[0]));
const placeMatch = buildMatcher(PLACES.map((e) => e[0]));

/**
 * Geocodifica un texto de lugar a [lat, lng] o null.
 * @param {string | null | undefined} text
 * @returns {[number, number] | null}
 */
export function geocode(text) {
  if (!text) return null;
  const t = normalizePlace(text);
  if (!t) return null;
  const tokens = tokenizePlace(t); // una sola tokenización para los 4 matchers

  // 1) SPECIFIC — sector curado gana siempre (la aguja más larga presente).
  const spec = specMatch.allTokens(tokens)[0];
  const specEntry = spec ? specIdx.get(spec) : undefined;
  if (specEntry) return [specEntry[1], specEntry[2]];

  // 2) Contexto: estados mencionados + estado(s) de la ciudad curada presente.
  const cityNeedle = cityMatch.allTokens(tokens)[0] ?? null;
  const city = (cityNeedle ? cityIdx.get(cityNeedle) : null) ?? null;
  const cityStates = city ? (Array.isArray(city[3]) ? city[3] : [city[3]]) : [];
  const context = new Set(cityStates);
  for (const s of stateMatch.allTokens(tokens)) {
    const st = stateIdx.get(s);
    if (st) context.add(st[3]);
  }

  // 3) PLACES (GeoNames) con guardas de contexto:
  //    - exigeContexto=1 → su estado DEBE estar en el contexto del texto.
  //    - inequívoca → pasa, salvo que el texto tenga contexto y su estado NO
  //      esté (conflicto: "Sector X, Maracaibo" con X en otro estado → gana la
  //      ciudad, no el homónimo lejano).
  let place = null;
  for (const needle of placeMatch.allTokens(tokens)) {
    const cands = placeIdx.get(needle) ?? [];
    const ok = cands.find((e) =>
      e[4] === 1 ? context.has(e[3]) : context.size === 0 || context.has(e[3])
    );
    if (ok) {
      place = ok;
      break; // agujas ya vienen por longitud desc → la primera válida gana
    }
  }

  // 4) Lugar fino vs ciudad: si el lugar es coherente con la ciudad (mismo
  //    estado) o no hay ciudad → gana el lugar; si chocan → gana la ciudad.
  if (place && (!city || cityStates.includes(place[3]))) return [place[1], place[2]];
  if (city) return [city[1], city[2]];
  if (place) return [place[1], place[2]];

  // 5) STATE — último recurso (capital del estado; aguja más larga).
  const stNeedle = stateMatch.allTokens(tokens)[0];
  const stEntry = stNeedle ? stateIdx.get(stNeedle) : undefined;
  if (stEntry) return [stEntry[1], stEntry[2]];
  return null;
}
