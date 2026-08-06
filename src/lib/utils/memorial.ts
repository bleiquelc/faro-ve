/**
 * memorial.ts — helpers puros del MODO MEMORIAL del home.
 *
 * El home es un lugar de memoria: sobre el mapa de luces aparecen, muy sutiles,
 * los nombres de las personas que SEGUIMOS BUSCANDO (dato ya público en
 * persons_public — el nombre de un desaparecido es público para que alguien lo
 * reconozca). Decisión founder 5-ago-2026: NO se nominan fallecidos (no existe
 * ese dato con nombre, y el precedente del proyecto — caso Guerrero — fue que
 * la familia pidió RETIRAR; se honra sin nominar, con frases de tributo).
 *
 * Todo aquí es puro y testeable (tests/utils/memorial.test.ts).
 */

/** Palabras conectoras que van en minúscula dentro de un nombre propio. */
const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'dos', 'van', 'von', 'el']);

/**
 * Frases que delatan que el "nombre" scrapeado NO es un nombre de persona
 * (la fuente trae basura tipo "Todos los que se encuentran en la imagen").
 */
const JUNK = /imagen|foto|desconocid|sin nombre|no identificad|persona[s]? (de|en) la|\bnn\b|todos? l[oa]s|quien(es)? se encuentr|familiar(es)? de/i;

/**
 * Limpia un nombre para mostrarlo con dignidad en el memorial.
 * Devuelve null si no parece un nombre de persona presentable.
 */
export function cleanDisplayName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // La fuente usa "|" (y a veces "/") para variantes del mismo nombre
  // ("Mayerlin Olivero | Oliveros") → nos quedamos con la primera.
  const s = raw.split(/[|/]/)[0].replace(/\s+/g, ' ').trim();
  if (s.length < 5 || s.length > 60) return null;
  if (/\d/.test(s)) return null; // dígitos = cédulas/teléfonos/basura, jamás en el memorial
  if (JUNK.test(s)) return null;
  const words = s.split(' ');
  if (words.length < 2 || words.length > 6) return null; // nombre y apellido reales

  // Title-case consistente (las fuentes traen MAYÚSCULAS sostenidas o minúsculas).
  const cased = words.map((w, i) => {
    const lower = w.toLocaleLowerCase('es-VE');
    if (i > 0 && PARTICLES.has(lower)) return lower;
    // Respeta compuestos con guion o apóstrofe (María-José, D'Angelo).
    return lower.replace(/(^|[-'])(\p{L})/gu, (m, sep, ch) => sep + ch.toLocaleUpperCase('es-VE'));
  });
  return cased.join(' ');
}

/**
 * Offset aleatorio para pedir un lote de nombres distinto en cada visita —
 * así el memorial va rotando entre los ~40.000 y no repite siempre los mismos.
 * `rand` inyectable para tests.
 */
export function pickOffset(total: number, batch: number, rand: () => number = Math.random): number {
  const max = Math.max(0, (total || 0) - batch);
  if (max <= 0) return 0;
  return Math.floor(rand() * max);
}

/** Fisher–Yates inmutable (no muta el array de entrada). `rand` inyectable. */
export function shuffled<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Nota: el tributo a quienes ya no están vive como línea central fija del
// mar de nombres ("Venezuela los sigue buscando", MemorialSea.svelte) — la
// rotación de frases intercaladas se retiró con el rediseño del 6-ago.
