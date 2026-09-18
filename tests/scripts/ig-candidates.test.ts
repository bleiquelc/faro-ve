import { describe, it, expect } from 'vitest';
import { prioritizeWithPhoto, hasPhotoCandidate, describeSkip } from '../../scripts/lib/ig-candidates.mjs';

/**
 * POR QUÉ EXISTE (18-sep-2026). Dos fallos del cron IG que juntos lo dejaron 12
 * días publicando 0 sin que se notara:
 *
 *  1. Gastaba sus 15 intentos/corrida en el orden de la página, aunque la ficha
 *     NO tuviera foto (imposible de publicar: regla "solo con foto limpia"). En la
 *     zona 33600-34800 del corpus (0-1 fotos por cada 400) quemaba los 15 en vacío.
 *  2. Logueaba siempre "Sin foto limpia", fuera el motivo que fuera: ficha sin
 *     photo_url, flyer rechazado por la IA, o —lo que pasó— la fuente caída
 *     devolviendo 404 a TODAS las fotos. Tres causas distintas, una sola línea.
 */

const p = (id: string, photo_url: string | null = null) => ({ id, photo_url });

describe('prioritizeWithPhoto — los intentos van primero a quien se puede publicar', () => {
  it('pone primero las fichas con foto, conservando el orden relativo', () => {
    const fresh = [p('a'), p('b', 'u1'), p('c'), p('d', 'u2')];
    expect(prioritizeWithPhoto(fresh).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('no muta la lista original', () => {
    const fresh = [p('a'), p('b', 'u1')];
    const copy = [...fresh];
    prioritizeWithPhoto(fresh);
    expect(fresh).toEqual(copy);
  });

  it('tolera vacío y foto en blanco', () => {
    expect(prioritizeWithPhoto([])).toEqual([]);
    expect(prioritizeWithPhoto([p('a', ''), p('b', 'u')]).map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('hasPhotoCandidate — ¿vale la pena detener el barrido en esta página?', () => {
  it('true solo si alguna ficha trae photo_url', () => {
    expect(hasPhotoCandidate([p('a'), p('b', 'u')])).toBe(true);
    expect(hasPhotoCandidate([p('a'), p('b', '')])).toBe(false);
    expect(hasPhotoCandidate([])).toBe(false);
  });
});

describe('describeSkip — el log dice el motivo REAL', () => {
  it('sin candidatos de foto', () => {
    expect(describeSkip([], [])).toBe('sin photo_url');
  });

  it('fuente caída: deja a la vista el unreachable y el HTTP', () => {
    const why = describeSkip(['u'], [{ usable: false, kind: 'unreachable', reason: 'HTTP 404' }]);
    expect(why).toBe('unreachable: HTTP 404');
  });

  it('rechazo de la IA: tipo + razón', () => {
    const why = describeSkip(['u'], [{ usable: false, kind: 'poster', reason: 'texto SE BUSCA' }]);
    expect(why).toBe('poster: texto SE BUSCA');
  });

  it('foto usable pero de un menor', () => {
    const why = describeSkip(['u'], [{ usable: true, has_minor: true, kind: 'photo', reason: '' }]);
    expect(why).toBe('photo: menor de edad');
  });

  it('varias fotos: une los motivos y acota el largo para que quepa en una línea de log', () => {
    const long = 'x'.repeat(400);
    const why = describeSkip(['u1', 'u2'], [
      { usable: false, kind: 'group', reason: 'tres personas' },
      { usable: false, kind: 'error', reason: long }
    ]);
    expect(why.startsWith('group: tres personas · error: ')).toBe(true);
    expect(why.length).toBeLessThanOrEqual(160);
  });
});

/**
 * Casi-desiertos (18-sep-2026, visto al simular la primera corrida tras el arreglo):
 * la página del cursor tenía 1 sola ficha con foto… y esa foto ya estaba RECHAZADA
 * en el caché de IA (un flyer no deja de ser flyer). "Tiene photo_url" no basta: lo
 * que decide si vale la pena detenerse es si hay alguien VIABLE.
 */
describe('viabilidad — una foto ya rechazada en caché no cuenta', () => {
  const rejected = (url: string) => url === 'flyer';

  it('hasPhotoCandidate ignora las fotos con rechazo conocido', () => {
    expect(hasPhotoCandidate([p('a', 'flyer'), p('b')], rejected)).toBe(false);
    expect(hasPhotoCandidate([p('a', 'flyer'), p('b', 'nueva')], rejected)).toBe(true);
  });

  it('prioritizeWithPhoto pone primero a las viables y manda las rechazadas al fondo', () => {
    const fresh = [p('a', 'flyer'), p('b'), p('c', 'nueva'), p('d', 'otra')];
    expect(prioritizeWithPhoto(fresh, rejected).map((x) => x.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('sin predicado se comporta como antes (toda foto es viable)', () => {
    expect(hasPhotoCandidate([p('a', 'flyer')])).toBe(true);
  });
});
