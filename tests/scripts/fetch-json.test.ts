import { describe, it, expect } from 'vitest';
// Helper compartido por TODOS los scripts que hablan con una API externa.
// Regresión que motiva estos tests (29-jul-2026): `cron-ig.mjs` hacía
// `await (await fetch(url)).json()` en top-level; la fuente devolvió una página
// HTML de error y el SyntaxError de undici MATÓ el proceso entero → una hora de
// publicación perdida por cada caída transitoria (3 el 26-jul, 4 el 27-jul).
import { fetchJson, FetchJsonError } from '../../scripts/lib/fetch-json.mjs';

/** Respuesta falsa mínima con la superficie que usa fetchJson. */
function res(
  body: string,
  { status = 200, contentType = 'application/json' }: { status?: number; contentType?: string } = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body
  };
}

/** fetch falso que va devolviendo la cola de respuestas (o lanza si es un Error). */
function fakeFetch(queue: unknown[]) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  };
  return { impl, calls };
}

const NO_WAIT = { retryDelayMs: 0 };

describe('fetchJson — camino feliz', () => {
  it('devuelve el JSON parseado', async () => {
    const { impl } = fakeFetch([res('{"persons":[{"id":"a"}]}')]);
    const data = await fetchJson('https://x.test/api', { fetchImpl: impl, ...NO_WAIT });
    expect(data).toEqual({ persons: [{ id: 'a' }] });
  });

  it('acepta content-type con charset y variantes +json', async () => {
    const { impl } = fakeFetch([res('{"ok":true}', { contentType: 'application/json; charset=utf-8' })]);
    await expect(fetchJson('https://x.test/a', { fetchImpl: impl, ...NO_WAIT })).resolves.toEqual({ ok: true });

    const { impl: impl2 } = fakeFetch([res('{"ok":true}', { contentType: 'application/vnd.api+json' })]);
    await expect(fetchJson('https://x.test/b', { fetchImpl: impl2, ...NO_WAIT })).resolves.toEqual({ ok: true });
  });
});

describe('fetchJson — la regresión: HTML donde se esperaba JSON', () => {
  it('lanza FetchJsonError, NUNCA un SyntaxError de JSON.parse', async () => {
    const html = '<!DOCTYPE html><html><body>Cloudflare error 502</body></html>';
    const { impl } = fakeFetch([
      res(html, { contentType: 'text/html' }),
      res(html, { contentType: 'text/html' }),
      res(html, { contentType: 'text/html' })
    ]);
    const err = await fetchJson('https://faro-ve.com/api/persons', {
      fetchImpl: impl,
      retries: 2,
      ...NO_WAIT
    }).catch((e) => e);

    expect(err).toBeInstanceOf(FetchJsonError);
    expect(err).not.toBeInstanceOf(SyntaxError);
    expect(err.name).toBe('FetchJsonError');
  });

  it('el error identifica la URL, el content-type y un fragmento acotado del cuerpo', async () => {
    const html = '<!DOCTYPE html>' + 'x'.repeat(5000);
    const { impl } = fakeFetch([res(html, { contentType: 'text/html' })]);
    const err = await fetchJson('https://faro-ve.com/api/persons', {
      fetchImpl: impl,
      retries: 0,
      ...NO_WAIT
    }).catch((e) => e);

    expect(err.url).toBe('https://faro-ve.com/api/persons');
    expect(err.contentType).toContain('text/html');
    expect(err.message).toContain('faro-ve.com/api/persons');
    // El fragmento se acota: un log de cron no puede tragarse 5 KB de HTML.
    expect(err.snippet.length).toBeLessThanOrEqual(200);
    expect(err.message.length).toBeLessThan(600);
  });

  it('reintenta ante HTML transitorio y devuelve el JSON cuando la fuente se recupera', async () => {
    const { impl, calls } = fakeFetch([
      res('<!DOCTYPE html>error', { contentType: 'text/html' }),
      res('{"persons":[]}')
    ]);
    await expect(
      fetchJson('https://x.test/api', { fetchImpl: impl, retries: 3, ...NO_WAIT })
    ).resolves.toEqual({ persons: [] });
    expect(calls).toHaveLength(2);
  });

  it('un cuerpo JSON malformado tampoco escapa como SyntaxError', async () => {
    const { impl } = fakeFetch([res('{"persons":[', { contentType: 'application/json' })]);
    const err = await fetchJson('https://x.test/api', { fetchImpl: impl, retries: 0, ...NO_WAIT }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchJsonError);
    expect(err).not.toBeInstanceOf(SyntaxError);
  });
});

describe('fetchJson — política de reintentos', () => {
  it('reintenta ante 5xx y termina bien', async () => {
    const { impl, calls } = fakeFetch([res('', { status: 502, contentType: 'text/html' }), res('{"ok":1}')]);
    await expect(fetchJson('https://x.test/a', { fetchImpl: impl, retries: 3, ...NO_WAIT })).resolves.toEqual({ ok: 1 });
    expect(calls).toHaveLength(2);
  });

  it('reintenta ante 429 (rate-limit de la fuente)', async () => {
    const { impl, calls } = fakeFetch([res('', { status: 429 }), res('{"ok":1}')]);
    await expect(fetchJson('https://x.test/a', { fetchImpl: impl, retries: 3, ...NO_WAIT })).resolves.toEqual({ ok: 1 });
    expect(calls).toHaveLength(2);
  });

  it('NO reintenta ante 404 (fallo permanente: reintentar es gasto inútil)', async () => {
    const { impl, calls } = fakeFetch([res('no existe', { status: 404, contentType: 'text/plain' })]);
    const err = await fetchJson('https://x.test/a', { fetchImpl: impl, retries: 5, ...NO_WAIT }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchJsonError);
    expect(err.status).toBe(404);
    expect(calls).toHaveLength(1);
  });

  it('reintenta ante error de red y respeta el tope de intentos', async () => {
    const { impl, calls } = fakeFetch([
      new Error('ConnectTimeout'),
      new Error('ConnectTimeout'),
      new Error('ConnectTimeout')
    ]);
    const err = await fetchJson('https://x.test/a', { fetchImpl: impl, retries: 2, ...NO_WAIT }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchJsonError);
    // retries=2 → 1 intento inicial + 2 reintentos = 3 llamadas.
    expect(calls).toHaveLength(3);
  });

  it('retries=0 hace exactamente una llamada', async () => {
    const { impl, calls } = fakeFetch([new Error('boom')]);
    await fetchJson('https://x.test/a', { fetchImpl: impl, retries: 0, ...NO_WAIT }).catch(() => {});
    expect(calls).toHaveLength(1);
  });
});

describe('fetchJson — degradación sin matar el proceso', () => {
  it('fetchJson.safe devuelve el fallback en vez de lanzar', async () => {
    const { impl } = fakeFetch([res('<!DOCTYPE html>', { contentType: 'text/html' })]);
    const out = await fetchJson.safe('https://x.test/a', { persons: [] }, {
      fetchImpl: impl,
      retries: 0,
      ...NO_WAIT
    });
    expect(out.ok).toBe(false);
    expect(out.data).toEqual({ persons: [] });
    expect(out.error).toBeInstanceOf(FetchJsonError);
  });

  it('fetchJson.safe devuelve los datos reales cuando todo va bien', async () => {
    const { impl } = fakeFetch([res('{"persons":[1]}')]);
    const out = await fetchJson.safe('https://x.test/a', { persons: [] }, { fetchImpl: impl, ...NO_WAIT });
    expect(out.ok).toBe(true);
    expect(out.data).toEqual({ persons: [1] });
    expect(out.error).toBeNull();
  });
});
