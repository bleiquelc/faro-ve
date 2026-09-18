/**
 * ig-candidates — a quién le toca un intento del cron de Instagram, y por qué se
 * descarta a quien se descarta. Funciones puras (testeables sin red ni disco).
 *
 * POR QUÉ EXISTE (18-sep-2026). El cron pasó 12 días publicando 0 sin que se
 * notara la causa, por dos razones que viven acá:
 *
 *  1. Gastaba sus 15 intentos/corrida en el orden de la página aunque la ficha NO
 *     tuviera foto — impublicable por la regla del founder "SOLO con foto limpia".
 *     En la zona 33600-34800 del corpus (0-1 fotos cada 400) quemaba los 15 en vacío.
 *  2. Logueaba siempre "Sin foto limpia", fuera cual fuera el motivo: ficha sin
 *     `photo_url`, flyer rechazado por la IA o —lo que pasó— la fuente caída dando
 *     404 a TODAS las fotos. Tres causas distintas escondidas en la misma línea.
 */

const WHY_MAX = 160; // una línea de log, no un párrafo

/**
 * Predicado "esta foto YA fue rechazada" (lo inyecta cron-ig desde el caché de IA).
 * El rechazo es permanente por URL (un flyer no deja de ser flyer), así que una
 * ficha cuya única foto está rechazada es tan impublicable como una sin foto.
 * @typedef {(url: string) => boolean} IsRejected
 */
/** @type {IsRejected} */
const NEVER = () => false;

/**
 * VIABLE = tiene foto y esa foto no tiene un rechazo conocido.
 * @param {{photo_url?: string | null}} p
 * @param {IsRejected} isRejected
 */
const isViable = (p, isRejected) => !!(p && p.photo_url) && !isRejected(p.photo_url);

/**
 * ¿Hay en esta página alguien publicable? Decide si el barrido se detiene acá o
 * sigue a la página siguiente (los desiertos de fotos se cruzan en una corrida).
 * @param {Array<{photo_url?: string | null}>} people
 * @param {IsRejected} [isRejected]
 */
export function hasPhotoCandidate(people, isRejected = NEVER) {
  return (people || []).some((p) => isViable(p, isRejected));
}

/**
 * Fichas VIABLES primero (orden relativo intacto); el resto queda al final por si
 * Venezuela Reporta aporta una foto. No muta la entrada.
 * @template {{photo_url?: string | null}} T
 * @param {T[]} people
 * @param {IsRejected} [isRejected]
 * @returns {T[]}
 */
export function prioritizeWithPhoto(people, isRejected = NEVER) {
  const list = people || [];
  return [...list.filter((p) => isViable(p, isRejected)), ...list.filter((p) => !isViable(p, isRejected))];
}

/**
 * Motivo REAL del descarte, para el log y para `state.skipped[id].why`.
 * @param {string[]} photoCands  URLs candidatas que se evaluaron
 * @param {Array<{usable?: boolean, has_minor?: boolean, kind?: string, reason?: string}>} verdicts
 * @returns {string}
 */
export function describeSkip(photoCands, verdicts) {
  if (!photoCands || !photoCands.length) return 'sin photo_url';
  const why = (verdicts || [])
    .map((c) => {
      const kind = c.kind || 'other';
      const reason = c.usable && c.has_minor ? 'menor de edad' : String(c.reason || '').trim();
      return reason ? `${kind}: ${reason}` : kind;
    })
    .join(' · ');
  const out = why || 'sin veredicto';
  return out.length > WHY_MAX ? out.slice(0, WHY_MAX - 1) + '…' : out;
}
