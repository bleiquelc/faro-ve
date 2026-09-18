import { describe, it, expect } from 'vitest';
import { rehostCacheKeys } from '../../scripts/lib/photo-cache-rehost.mjs';

/**
 * POR QUÉ EXISTE (18-sep-2026). El caché de veredictos de visión (Haiku) se indexa
 * por URL. Cuando la fuente cambió de dominio, las mismas imágenes pasaron a tener
 * otra URL → 1.853 veredictos YA PAGADOS quedaban huérfanos y se re-pagarían.
 * Misma imagen, mismo path, otro host = mismo veredicto (misión-ley Art. 3).
 */

const OLD = 'https://viejo.example';
const NEW = 'https://nuevo.example';
const v = (usable: boolean, ts = 1) => ({ v: { usable, kind: 'photo' }, ts });

describe('rehostCacheKeys', () => {
  it('renombra el host de las claves del dominio viejo y conserva veredicto + ts', () => {
    const ns = { [`${OLD}/media/photos/a.webp`]: v(true, 111) };
    const { map, moved } = rehostCacheKeys(ns, OLD, NEW);
    expect(moved).toBe(1);
    expect(map).toEqual({ [`${NEW}/media/photos/a.webp`]: v(true, 111) });
  });

  it('no toca claves de otros hosts (Supabase propio, Venezuela Reporta)', () => {
    const ns = { 'https://x.supabase.co/p/1.jpg': v(false), [`${OLD}/p/2.jpg`]: v(true) };
    const { map, moved, kept } = rehostCacheKeys(ns, OLD, NEW);
    expect(moved).toBe(1);
    expect(kept).toBe(1);
    expect(map['https://x.supabase.co/p/1.jpg']).toEqual(v(false));
  });

  it('si la clave nueva YA existe gana la existente (más reciente) y lo cuenta como colisión', () => {
    const ns = { [`${OLD}/p/1.jpg`]: v(true, 1), [`${NEW}/p/1.jpg`]: v(false, 999) };
    const { map, collisions } = rehostCacheKeys(ns, OLD, NEW);
    expect(collisions).toBe(1);
    expect(Object.keys(map)).toEqual([`${NEW}/p/1.jpg`]);
    expect(map[`${NEW}/p/1.jpg`]).toEqual(v(false, 999));
  });

  it('es idempotente y no muta la entrada', () => {
    const ns = { [`${OLD}/p/1.jpg`]: v(true) };
    const frozen = JSON.parse(JSON.stringify(ns));
    const once = rehostCacheKeys(ns, OLD, NEW);
    const twice = rehostCacheKeys(once.map, OLD, NEW);
    expect(ns).toEqual(frozen);
    expect(twice.moved).toBe(0);
    expect(twice.map).toEqual(once.map);
  });

  it('exige que el host coincida como prefijo de origen, no como substring', () => {
    const ns = { [`${OLD}.evil.example/p/1.jpg`]: v(true) };
    expect(rehostCacheKeys(ns, OLD, NEW).moved).toBe(0);
  });

  it('tolera namespace vacío o ausente', () => {
    expect(rehostCacheKeys(undefined, OLD, NEW)).toEqual({ map: {}, moved: 0, kept: 0, collisions: 0 });
  });
});
