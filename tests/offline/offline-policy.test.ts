import { describe, it, expect } from 'vitest';
import {
  OUTBOX_TTL_MS,
  MAX_ATTEMPTS,
  BACKOFF_CEIL_MS,
  classifyResponse,
  backoffMs,
  nextAttemptDelayMs,
  isExpired,
  shouldGiveUp,
  minimizeEnqueuablePayload
} from '$utils/offline-policy';

describe('classifyResponse — mapea la cadena dura de hooks/endpoint a una acción', () => {
  it('2xx (con o sin duplicate) → success: la fila existe server-side, borrar de la outbox', () => {
    expect(classifyResponse(200, { ok: true, id: 'x', duplicate: false }).kind).toBe('success');
    expect(classifyResponse(201, { ok: true, id: 'x', duplicate: false }).kind).toBe('success');
    // ACK-perdido: el reintento idempotente devuelve duplicate:true → sigue siendo éxito.
    expect(classifyResponse(200, { ok: true, id: 'x', duplicate: true }).kind).toBe('success');
  });

  it('400 (Zod) → permanente: no reintentar en loop, el reporte necesita corrección', () => {
    expect(classifyResponse(400, { message: 'Datos inválidos' }).kind).toBe('permanent');
  });

  it('403 turnstile → turnstile: transitorio, regenerar token (no descartar)', () => {
    expect(classifyResponse(403, { error: 'turnstile_required' }).kind).toBe('turnstile');
    expect(classifyResponse(403, { error: 'turnstile_failed' }).kind).toBe('turnstile');
  });

  it('429 → rate-limited con retryAfterSec del cuerpo (detener el lote, respetar la espera)', () => {
    const o = classifyResponse(429, { error: 'rate_limited', retry_after_sec: 3600 });
    expect(o.kind).toBe('rate-limited');
    expect(o.retryAfterSec).toBe(3600);
  });

  it('503 (INSERTS_PAUSED / misconfig) → transitorio-diferido: conservar, backoff largo', () => {
    expect(classifyResponse(503, { error: 'inserts_paused' }).kind).toBe('transient-deferred');
    expect(classifyResponse(503, { error: 'service_misconfigured' }).kind).toBe('transient-deferred');
  });

  it('5xx (500/502 error de DB) → transitorio: reintentar', () => {
    expect(classifyResponse(500, {}).kind).toBe('transient');
    expect(classifyResponse(502, { message: 'No se pudo registrar' }).kind).toBe('transient');
  });

  it('otros 4xx inesperados → permanente (no martillar): 404, 413, 422', () => {
    expect(classifyResponse(404, {}).kind).toBe('permanent');
    expect(classifyResponse(413, {}).kind).toBe('permanent');
    expect(classifyResponse(422, {}).kind).toBe('permanent');
  });
});

describe('backoffMs — exponencial con jitter y techo', () => {
  it('crece con los intentos y nunca supera el techo', () => {
    const noJitter = () => 1; // jitter full → valor máximo del rango
    const a1 = backoffMs(1, noJitter);
    const a2 = backoffMs(2, noJitter);
    const a5 = backoffMs(5, noJitter);
    expect(a2).toBeGreaterThan(a1);
    expect(a5).toBeLessThanOrEqual(BACKOFF_CEIL_MS);
    expect(backoffMs(20, noJitter)).toBeLessThanOrEqual(BACKOFF_CEIL_MS);
  });

  it('aplica jitter dentro de [mitad, total] del backoff base', () => {
    const full = backoffMs(3, () => 1); // rng=1 → tope del rango
    const half = backoffMs(3, () => 0); // rng=0 → piso del rango (mitad)
    expect(half).toBeCloseTo(full / 2, -2);
    expect(half).toBeGreaterThan(0);
  });
});

describe('nextAttemptDelayMs — combina la clase de outcome con el backoff', () => {
  it('rate-limited respeta retryAfterSec si es mayor que el backoff', () => {
    const d = nextAttemptDelayMs({ kind: 'rate-limited', retryAfterSec: 3600 }, 1, () => 1);
    expect(d).toBeGreaterThanOrEqual(3600 * 1000);
  });

  it('turnstile reintenta rápido (token nuevo), por debajo de 1 min', () => {
    const d = nextAttemptDelayMs({ kind: 'turnstile' }, 1, () => 1);
    expect(d).toBeLessThan(60_000);
  });

  it('transient-deferred (503) usa un piso largo (>= 15 min)', () => {
    const d = nextAttemptDelayMs({ kind: 'transient-deferred' }, 1, () => 0);
    expect(d).toBeGreaterThanOrEqual(15 * 60 * 1000);
  });
});

describe('isExpired / shouldGiveUp — retención acotada (#6 Habeas Data)', () => {
  it('expira a las 48h exactas de creado', () => {
    const created = 1_000_000;
    expect(isExpired(created, created + OUTBOX_TTL_MS - 1)).toBe(false);
    expect(isExpired(created, created + OUTBOX_TTL_MS + 1)).toBe(true);
  });
  it('shouldGiveUp tras MAX_ATTEMPTS', () => {
    expect(shouldGiveUp(MAX_ATTEMPTS - 1)).toBe(false);
    expect(shouldGiveUp(MAX_ATTEMPTS)).toBe(true);
  });
});

describe('minimizeEnqueuablePayload — lista blanca + minimización de PII (#1, #2, #26)', () => {
  it('NUNCA persiste el token Turnstile ni el ip_hashed', () => {
    const out = minimizeEnqueuablePayload({
      status: 'missing',
      given_name: 'Ana',
      'cf-turnstile-response': 'tok-123',
      reporter_ip_hashed: 'deadbeef'
    });
    expect(out['cf-turnstile-response']).toBeUndefined();
    expect(out.reporter_ip_hashed).toBeUndefined();
    expect(out.given_name).toBe('Ana');
  });

  it('a-salvo SIN opt-in de ubicación exacta → NO persiste lat/lng en el dispositivo', () => {
    const out = minimizeEnqueuablePayload({
      status: 'safe_self_report',
      given_name: 'Luis',
      share_exact_location_with_searchers: false,
      lat: 10.5,
      lng: -66.9,
      last_known_location_text: 'Me refugié en la escuela'
    });
    expect(out.lat).toBeUndefined();
    expect(out.lng).toBeUndefined();
    expect(out.share_exact_location_with_searchers).toBe(false);
    expect(out.last_known_location_text).toBe('Me refugié en la escuela');
  });

  it('a-salvo CON opt-in explícito → conserva lat/lng (el sujeto eligió compartir)', () => {
    const out = minimizeEnqueuablePayload({
      status: 'safe_self_report',
      share_exact_location_with_searchers: true,
      lat: 10.5,
      lng: -66.9
    });
    expect(out.lat).toBe(10.5);
    expect(out.lng).toBe(-66.9);
  });

  it('desaparecido/cuerpo-NN: lat/lng del tercero se conserva (se ofusca server-side, no es PII del reportante)', () => {
    const out = minimizeEnqueuablePayload({
      status: 'missing',
      given_name: 'Ana',
      lat: 10.5,
      lng: -66.9
    });
    expect(out.lat).toBe(10.5);
    expect(out.lng).toBe(-66.9);
  });

  it('es inmutable: no muta el objeto de entrada', () => {
    const input = { status: 'missing', 'cf-turnstile-response': 'tok' };
    const copy = { ...input };
    minimizeEnqueuablePayload(input);
    expect(input).toEqual(copy);
  });

  it('ALLOWLIST: un campo no listado (debug/desconocido) NUNCA llega al disco', () => {
    const out = minimizeEnqueuablePayload({
      status: 'missing',
      given_name: 'Ana',
      __debug: 'secreto',
      reporter_ip_hashed: 'deadbeef',
      randomField: { nested: true }
    });
    expect(out.__debug).toBeUndefined();
    expect(out.randomField).toBeUndefined();
    expect(out.reporter_ip_hashed).toBeUndefined();
    expect(out.given_name).toBe('Ana');
    // Solo claves de la lista blanca:
    expect(Object.keys(out).every((k) => ['status', 'given_name'].includes(k))).toBe(true);
  });
});
