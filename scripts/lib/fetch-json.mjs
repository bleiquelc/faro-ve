/**
 * fetchJson — GET/POST de JSON a prueba de páginas de error.
 *
 * POR QUÉ EXISTE (29-jul-2026). El patrón `await (await fetch(url)).json()`
 * estaba repetido en 13 sitios de `scripts/`. Cuando la fuente devuelve HTML en
 * vez de JSON (error 5xx de Cloudflare, rate-limit, captcha), `res.json()` lanza
 * un `SyntaxError` de undici. En un top-level await de un `.mjs` eso NO es
 * atrapable por el llamador: **mata el proceso entero**. Le costó al
 * auto-publicador de Instagram una hora de publicación por caída transitoria
 * (3 el 26-jul, 4 el 27-jul, 1 el 28-jul — verificado cruzando `cron.err.log`
 * con las horas faltantes en `cron.log`).
 *
 * Contrato:
 *  - Valida `res.ok` y el `content-type` ANTES de parsear.
 *  - Reintenta lo transitorio (red, 5xx, 429, página HTML) con backoff.
 *  - NO reintenta lo permanente (4xx salvo 429): reintentar es gasto inútil
 *    (misión-ley Art. 3 - cada token ahorrado es para la reconstrucción).
 *  - Lanza SIEMPRE `FetchJsonError` con URL + status + fragmento ACOTADO del
 *    cuerpo. Nunca deja escapar un `SyntaxError` crudo.
 *  - `fetchJson.safe(url, fallback, opts)` degrada sin lanzar, para los cron
 *    que deben seguir vivos.
 *
 * Ley de Reuso: este es el ÚNICO camino de JSON-sobre-HTTP de los scripts.
 * No escribir otro `res.json()` a mano.
 */

/**
 * @typedef {object} FetchJsonErrorInfo
 * @property {string} [url]
 * @property {number} [status]
 * @property {string} [contentType]
 * @property {string} [snippet]
 * @property {unknown} [cause]
 */

/** Error tipado: el llamador puede distinguir causa sin parsear strings. */
export class FetchJsonError extends Error {
  /**
   * @param {string} message
   * @param {FetchJsonErrorInfo} [info]
   */
  constructor(message, info = {}) {
    super(message);
    this.name = 'FetchJsonError';
    /** @type {string} */
    this.url = info.url ?? '';
    /** @type {number} */
    this.status = info.status ?? 0;
    /** @type {string} */
    this.contentType = info.contentType ?? '';
    /** @type {string} */
    this.snippet = info.snippet ?? '';
    if (info.cause !== undefined) this.cause = info.cause;
  }
}

const SNIPPET_MAX = 200; // un log de cron no puede tragarse 5 KB de HTML

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Recorta y aplana el cuerpo para que quepa en una línea de log.
 * @param {unknown} body
 * @returns {string}
 */
function snippetOf(body) {
  return String(body ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX);
}

/**
 * ¿Vale la pena reintentar? Solo lo transitorio.
 * @param {number} status
 * @returns {boolean}
 */
function isTransient(status) {
  return status === 0 || status === 429 || status >= 500;
}

/**
 * Mensaje legible de un error desconocido (catch da `unknown`).
 * @param {unknown} e
 * @returns {string}
 */
function msgOf(e) {
  return e instanceof Error ? e.message : String(e);
}

/**
 * @typedef {RequestInit & {
 *   retries?: number,
 *   retryDelayMs?: number,
 *   timeoutMs?: number,
 *   fetchImpl?: (url: string, init?: any) => Promise<any>
 * }} FetchJsonOptions
 */

/**
 * Pide JSON y devuelve el objeto parseado.
 * @param {string} url
 * @param {FetchJsonOptions} [opts]
 * @returns {Promise<any>}
 * @throws {FetchJsonError}
 */
export async function fetchJson(url, opts = {}) {
  const {
    retries = 2,
    retryDelayMs = 1000,
    timeoutMs = 30000,
    fetchImpl = globalThis.fetch,
    ...init
  } = opts;

  /** @type {FetchJsonError | null} */
  let last = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs * attempt); // backoff lineal

    /** @type {any} */
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: init.signal ?? AbortSignal.timeout(timeoutMs)
      });
    } catch (e) {
      // Error de red/timeout: siempre transitorio.
      last = new FetchJsonError(`Red caída pidiendo ${url}: ${msgOf(e)}`, { url, cause: e });
      continue;
    }

    /** @type {number} */
    const status = response.status;
    /** @type {string} */
    const contentType = response.headers?.get?.('content-type') || '';

    // Cuerpo como texto: parsear a mano nos deja incluir el fragmento en el error.
    /** @type {string} */
    let body;
    try {
      body = await response.text();
    } catch (e) {
      last = new FetchJsonError(`No se pudo leer el cuerpo de ${url}: ${msgOf(e)}`, {
        url,
        status,
        contentType,
        cause: e
      });
      continue;
    }

    if (!response.ok) {
      const err = new FetchJsonError(
        `HTTP ${status} en ${url} - ${snippetOf(body) || '(cuerpo vacío)'}`,
        { url, status, contentType, snippet: snippetOf(body) }
      );
      if (!isTransient(status)) throw err; // permanente: fallar rápido
      last = err;
      continue;
    }

    if (!/\bjson\b/i.test(contentType)) {
      // Este es el caso que mataba el proceso: 200 con página HTML.
      last = new FetchJsonError(
        `Se esperaba JSON de ${url} y llegó "${contentType || 'sin content-type'}" - ${snippetOf(body)}`,
        { url, status, contentType, snippet: snippetOf(body) }
      );
      continue;
    }

    try {
      return JSON.parse(body);
    } catch (e) {
      // JSON declarado pero malformado (respuesta truncada) - puede ser transitorio.
      last = new FetchJsonError(`JSON inválido de ${url}: ${msgOf(e)} - ${snippetOf(body)}`, {
        url,
        status,
        contentType,
        snippet: snippetOf(body),
        cause: e
      });
    }
  }

  throw last;
}

/**
 * Variante que NUNCA lanza: para los cron que deben seguir vivos y degradar.
 * @param {string} url
 * @param {any} fallback
 * @param {FetchJsonOptions} [opts]
 * @returns {Promise<{ok: boolean, data: any, error: FetchJsonError | null}>}
 */
fetchJson.safe = async function safe(url, fallback, opts = {}) {
  try {
    return { ok: true, data: await fetchJson(url, opts), error: null };
  } catch (error) {
    return {
      ok: false,
      data: fallback,
      error: error instanceof FetchJsonError ? error : new FetchJsonError(msgOf(error), { url })
    };
  }
};
