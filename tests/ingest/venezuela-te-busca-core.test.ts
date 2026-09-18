import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  BASE,
  fetchSearch,
  fetchSearchValid,
  mapRecord,
  isPermanentError,
  nextFailStreak,
  shouldAbortIngest,
  resumeOffset,
  MAX_TERM_FAILS
} from '../../scripts/ingest/venezuela-te-busca-core.mjs';

/**
 * POR QUÉ EXISTE (18-sep-2026). Entre el 5 y el 6-sep la fuente se mudó de
 * `venezuela-te-busca-app.hellogafaro.workers.dev` a `app.venezuelateayuda.com` y
 * movió el buscador de `/` a `/finder`. El host viejo pasó a responder
 * `404 · error code: 1042` a TODO. La ingesta siguió 12 días reintentando 4× cada
 * término (4+6+8 s) hasta morir por `ETIMEDOUT` a los 15 min, sin avanzar el
 * cursor y reportando "timeout" en vez de "404".
 *
 * Fixtures SINTÉTICOS a propósito: la respuesta real trae PII del reportante
 * (nombre/teléfono/email) y eso no entra al repo (regla #2).
 */

/** Codifica un valor al formato plano turbo-stream que entiende `decode()`. */
function encode(value: unknown): unknown[] {
  const arr: unknown[] = [];
  const put = (v: unknown): number => {
    const idx = arr.length;
    arr.push(null);
    if (v === null || typeof v !== 'object') {
      arr[idx] = v;
      return idx;
    }
    if (Array.isArray(v)) {
      arr[idx] = v.map(put);
      return idx;
    }
    const o: Record<string, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const ki = put(k);
      o['_' + ki] = put(val);
    }
    arr[idx] = o;
    return idx;
  };
  put(value);
  return arr;
}

const body = (routes: Record<string, unknown>) => JSON.stringify(encode(routes)) + '\n';
const res = (status: number, text: string) => ({ ok: status >= 200 && status < 300, status, text: async () => text });

const PERSONA = { id: 'abc-1', firstName: 'Ana', lastName: 'Prueba', status: 'missing', photoUrl: '/media/photos/abc-1.webp' };
const okBody = body({
  root: { data: { country: 'VE' } },
  'routes/finder': { data: { persons: [PERSONA], pagination: { nextCursor: 'CUR', hasMore: true }, totalCount: 1 } }
});
// Lo que devuelve HOY la ruta vieja `/_root.data`: un redirect de React Router.
const redirectBody = JSON.stringify([['SingleFetchRedirect', 1], { _2: 3 }, 'redirect', '/finder?query=maria']) + '\n';

afterEach(() => vi.useRealTimers());

describe('fuente mudada — dominio y ruta de datos nuevos', () => {
  it('BASE apunta al dominio nuevo (el workers.dev viejo da 404/1042)', () => {
    expect(BASE).toBe('https://app.venezuelateayuda.com');
  });

  it('fetchSearch pide /finder.data y lee la clave routes/finder', async () => {
    const fetchImpl = vi.fn(async () => res(200, okBody));
    const r = await fetchSearch('maría', null, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://app.venezuelateayuda.com/finder.data?query=mar%C3%ADa');
    expect(r.persons).toHaveLength(1);
    expect(r.nextCursor).toBe('CUR');
    expect(r.hasMore).toBe(true);
  });

  it('reenvía el cursor opaco en las páginas siguientes', async () => {
    const fetchImpl = vi.fn(async () => res(200, okBody));
    await fetchSearch('ana', 'a+b/c=', fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://app.venezuelateayuda.com/finder.data?query=ana&cursor=a%2Bb%2Fc%3D');
  });

  it('mapRecord arma photo_url sobre el host nuevo', () => {
    expect(mapRecord(PERSONA)?.photo_url).toBe('https://app.venezuelateayuda.com/media/photos/abc-1.webp');
  });
});

describe('errores permanentes — fallar rápido, no reintentar 18 s por término', () => {
  it('un 404 lanza un error que lleva el status', async () => {
    const fetchImpl = vi.fn(async () => res(404, 'error code: 1042'));
    await expect(fetchSearch('maria', null, fetchImpl)).rejects.toMatchObject({ status: 404 });
  });

  it('si la ruta cambió (redirect/otra clave) el error es claro y permanente, no un TypeError', async () => {
    const fetchImpl = vi.fn(async () => res(202, redirectBody));
    const err = await fetchSearch('maria', null, fetchImpl).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/routes\/finder/);
    expect(isPermanentError(err)).toBe(true);
  });

  it('un 200 con HTML (challenge/página de error) da un error CLARO y transitorio, no un SyntaxError crudo', async () => {
    // Mismo criterio que lib/fetch-json.mjs: una página HTML puede ser pasajera → se
    // reintenta. Si es permanente, el corte por racha lo frena en 5 términos (~100 s).
    const fetchImpl = vi.fn(async () => res(200, '<!DOCTYPE html><html><body>Just a moment…</body></html>'));
    const err = await fetchSearch('maria', null, fetchImpl).catch((e) => e);
    expect(err.name).not.toBe('SyntaxError');
    expect(err.message).toMatch(/no es turbo-stream/);
    expect(err.message).toMatch(/finder\.data/);
    expect(isPermanentError(err)).toBe(false);
  });

  it('isPermanentError: 4xx sí (salvo 429); 5xx, red y 429 no', () => {
    expect(isPermanentError({ status: 404 })).toBe(true);
    expect(isPermanentError({ status: 401 })).toBe(true);
    expect(isPermanentError({ status: 429 })).toBe(false);
    expect(isPermanentError({ status: 503 })).toBe(false);
    expect(isPermanentError(new Error('fetch failed'))).toBe(false);
    expect(isPermanentError(null)).toBe(false);
  });

  it('fetchSearchValid NO reintenta un 404 (1 sola petición)', async () => {
    const fetchImpl = vi.fn(async () => res(404, 'error code: 1042'));
    await expect(fetchSearchValid('maria', null, { fetchImpl })).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fetchSearchValid SÍ reintenta lo transitorio (503 → 200)', async () => {
    vi.useFakeTimers();
    let n = 0;
    const fetchImpl = vi.fn(async () => (++n === 1 ? res(503, 'upstream') : res(200, okBody)));
    const p = fetchSearchValid('maria', null, { fetchImpl });
    await vi.runAllTimersAsync();
    const r = await p;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.persons).toHaveLength(1);
  });
});

describe('corte por fallos consecutivos (regla #12: si la fuente no parsea → abort + alerta)', () => {
  it('la racha sube con cada fallo y se resetea con un éxito', () => {
    expect(nextFailStreak(0, true)).toBe(1);
    expect(nextFailStreak(3, true)).toBe(4);
    expect(nextFailStreak(4, false)).toBe(0);
  });

  it('al abortar, el cursor retoma en el PRIMER término de la racha fallida (no re-escanea los buenos)', () => {
    // 40 términos OK + 4 fallidos ya contados + el 5º que dispara el corte (no contado).
    expect(resumeOffset(44, 5)).toBe(40);
    // La racha empezó en el primer término de la corrida: no se avanza nada.
    expect(resumeOffset(4, 5)).toBe(0);
    // Sin racha (corrida normal): avanza todo lo hecho. Nunca negativo.
    expect(resumeOffset(155, 0)).toBe(155);
    expect(resumeOffset(0, 5)).toBe(0);
  });

  it('aborta al llegar al tope, no antes', () => {
    expect(MAX_TERM_FAILS).toBe(5);
    expect(shouldAbortIngest(4)).toBe(false);
    expect(shouldAbortIngest(5)).toBe(true);
    expect(shouldAbortIngest(2, 2)).toBe(true);
  });
});
