/**
 * ig-watchdog — vigila la PRODUCCIÓN del auto-publicador de Instagram, no solo
 * que el proceso haya corrido.
 *
 * POR QUÉ EXISTE (29-jul-2026). El mantenimiento chequeaba únicamente "el cron
 * IG corrió hoy: sí". El 28-jul el cron corrió puntual cada hora durante ~24h
 * imprimiendo `Publicadas=0. Intentos=0.` — vivo, sano, y publicando NADA — y
 * nadie se enteró. La causa era la ventana de 400 filas (ver cron-ig.mjs), pero
 * el fallo de OPERACIÓN fue no tener quién mirara el resultado.
 *
 * Un sistema humanitario que deja de publicar en silencio es un fallo grave:
 * cada ficha que no sale es una familia que no llega a más ojos.
 *
 * Dos señales, leídas del propio `cron.log` (Ley de Reuso: el dato ya está ahí,
 * no hace falta un estado nuevo):
 *   1. >24h sin INTENTAR con nadie  → la cola de candidatos está rota/vacía.
 *   2. >48h sin que suba el TOTAL   → intenta pero nunca logra publicar.
 *
 * Es una función pura sobre el texto del log: testeable sin tocar el disco.
 */

const HOUR = 3600_000;
const SIN_INTENTOS_H = Number(process.env.IG_WATCH_ATTEMPTS_H || 24);
const SIN_PUBLICAR_H = Number(process.env.IG_WATCH_POSTED_H || 48);

// Línea de cierre real del cron:
// "2026-07-29T06:57:56.954Z Fin. Publicadas=0. Intentos=0. Posteadas total=174. Reencuentros=24."
const FIN = /^(\S+)\s+Fin\.\s+Publicadas=(\d+)\.\s+Intentos=(\d+)\.\s+Posteadas total=(\d+)\./gm;

/**
 * @typedef {object} IgRun
 * @property {number} ts        epoch ms de la corrida
 * @property {number} publicadas
 * @property {number} intentos
 * @property {number} total     acumulado de fichas publicadas
 */

/**
 * @param {string | null | undefined} text  contenido de ~/.faro-ig/cron.log
 * @param {number} [now] epoch ms (inyectable para tests)
 * @returns {{runs: number, lastRunAt: number|null, lastAttemptAt: number|null,
 *            postedTotal: number|null, alerts: string[]}}
 */
export function analyzeIgLog(text, now = Date.now()) {
  /** @type {IgRun[]} */
  const runs = [];
  if (text) {
    FIN.lastIndex = 0;
    let m;
    while ((m = FIN.exec(String(text))) !== null) {
      const ts = Date.parse(m[1]);
      if (!Number.isFinite(ts)) continue; // timestamp corrupto: se ignora la línea
      runs.push({ ts, publicadas: Number(m[2]), intentos: Number(m[3]), total: Number(m[4]) });
    }
  }

  /** @type {string[]} */
  const alerts = [];
  if (!runs.length) {
    // Sin corridas parseables no hay nada que concluir: de "no corrió" ya avisa
    // el chequeo de "cron IG corrió hoy".
    return { runs: 0, lastRunAt: null, lastAttemptAt: null, postedTotal: null, alerts };
  }

  runs.sort((a, b) => a.ts - b.ts);
  const last = runs[runs.length - 1];
  const conIntentos = runs.filter((r) => r.intentos > 0);
  const lastAttemptAt = conIntentos.length ? conIntentos[conIntentos.length - 1].ts : null;

  // 1) ¿Hace cuánto que no intenta con NADIE?
  const horasSinIntentar = (now - (lastAttemptAt ?? runs[0].ts)) / HOUR;
  if (horasSinIntentar > SIN_INTENTOS_H) {
    alerts.push(
      `El cron de Instagram lleva ${Math.floor(horasSinIntentar)}h sin intentar publicar a nadie ` +
        `(Intentos=0 en todas las corridas). La cola de candidatos está vacía o rota — revisá el cursor en ~/.faro-ig/state.json.`
    );
  }

  // 2) ¿Hace cuánto que el total no sube? Solo concluimos si el log CUBRE la
  //    ventana: si no llega tan atrás, no hay evidencia y no se inventa alarma.
  const corte = now - SIN_PUBLICAR_H * HOUR;
  const previas = runs.filter((r) => r.ts <= corte);
  if (previas.length) {
    const totalHace48h = previas[previas.length - 1].total;
    if (last.total <= totalHace48h) {
      alerts.push(
        `El cron de Instagram no publica hace más de ${SIN_PUBLICAR_H}h ` +
          `(total clavado en ${last.total}). ¿El filtro de fotos rechaza todo o no llegan candidatos?`
      );
    }
  }

  return { runs: runs.length, lastRunAt: last.ts, lastAttemptAt, postedTotal: last.total, alerts };
}
