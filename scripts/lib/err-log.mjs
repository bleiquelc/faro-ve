/**
 * err-log — distingue un ERROR REAL del ruido que muchas herramientas escriben
 * a stderr por diseño.
 *
 * POR QUÉ EXISTE (29-jul-2026). `scripts/maintenance/daily.mjs` consideraba
 * error cualquier `err.log` con tamaño > 0. Pero ffmpeg escribe TODO su output
 * normal a stderr (banner de versión, `configure` flags, streams, progreso
 * `frame= ... fps=`), así que `reel.err.log` pesaba 13-16 KB TODOS los días y
 * disparaba "el reel diario registró errores" desde el 13-jul — aunque el reel
 * quedara programado ✅ en el mismo reporte.
 *
 * Consecuencia real: el mantenimiento salía `exit 1` con "2 PROBLEMA(S)" a
 * diario y el founder dejó de poder distinguir señal de ruido. Una alerta que
 * grita siempre es una alerta apagada.
 *
 * Criterio: no intentamos enumerar el ruido (infinito), sino RECONOCER las
 * firmas de fallo. Validado contra 17 días de logs reales de ~/.faro-ig:
 * 0 falsos positivos en el ruido de ffmpeg, 5 señales en el crash del cron IG
 * (29-jul) y 33 en la caída de red del 5-jul.
 */

/**
 * Firmas de fallo. Deliberadamente específicas: preferimos dejar pasar un
 * formato raro (que igual queda archivado en el .bak para inspección) antes que
 * volver a inundar al founder de alertas falsas.
 * @type {RegExp[]}
 */
const SEÑALES = [
  // Errores de JS/Node al principio de línea (Error:, SyntaxError:, …).
  /^[ \t]*(?:Uncaught |Unhandled )?(?:Eval|Range|Reference|Syntax|Type|URI|Assertion|FetchJson)?Error\b/m,
  // Stack traces de Node.
  /^[ \t]*at .+\((?:node:|\/|[A-Za-z]:\\)/m,
  /\bnode:internal\b/,
  /\bUnhandledPromiseRejection\b/,
  // Códigos de red/sistema.
  /\b(?:ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|EPIPE|EACCES|ENOENT|EHOSTUNREACH|UND_ERR_[A-Z_]+)\b/,
  // Otros runtimes / herramientas.
  /^Traceback \(most recent call last\)/m,
  /^npm ERR!/m,
  /^panic:/m,
  /\bCannot find module\b/,
  /\bcommand not found\b/
];

/**
 * ¿El contenido de un err.log representa un fallo real?
 * @param {string | null | undefined} text
 * @returns {boolean}
 */
export function looksLikeRealError(text) {
  if (!text) return false;
  const s = String(text);
  if (!s.trim()) return false;
  return SEÑALES.some((re) => re.test(s));
}

/**
 * Primera línea significativa del error, para que la alerta diga QUÉ pasó en vez
 * de solo "revisá el archivo".
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function firstErrorLine(text) {
  if (!text) return '';
  for (const line of String(text).split('\n')) {
    const l = line.trim();
    if (l && SEÑALES.some((re) => re.test(l))) return l.slice(0, 160);
  }
  return '';
}

const SUMMARY_MAX = 400; // un reporte diario no puede tragarse 5 KB de stderr

/**
 * Resumen de un fallo de `execFileSync` que nombra la CAUSA, no solo el síntoma.
 *
 * POR QUÉ EXISTE (18-sep-2026). La ingesta falló 11 días con `HTTP 404` en todos
 * los términos, pero el reporte decía solo "spawnSync node ETIMEDOUT": el resumen
 * leía la cola de stdout y el 404 salía por stderr. Ahora se leen las dos.
 *
 * @param {{message?: string, stdout?: unknown, stderr?: unknown} | null | undefined} e
 * @returns {string}
 */
export function execFailureSummary(e) {
  const tailOf = (/** @type {unknown} */ b) =>
    String(b ?? '').trim().split('\n').filter(Boolean).slice(-2).join(' | ');
  const parts = [String(e?.message ?? e ?? 'error desconocido'), tailOf(e?.stdout), tailOf(e?.stderr)].filter(Boolean);
  const out = parts.join(' — ');
  return out.length > SUMMARY_MAX ? out.slice(0, SUMMARY_MAX - 1) + '…' : out;
}
