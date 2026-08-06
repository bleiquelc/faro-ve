import { describe, it, expect } from 'vitest';
import { cleanDisplayName, pickOffset, shuffled } from '../../src/lib/utils/memorial';

describe('cleanDisplayName (dignidad del memorial)', () => {
  it('title-casea nombres scrapeados en MAYÚSCULAS', () => {
    expect(cleanDisplayName('MARÍA JOSÉ RAMÍREZ QUERO')).toBe('María José Ramírez Quero');
  });

  it('title-casea nombres en minúsculas', () => {
    expect(cleanDisplayName('luduin josué marín yepez')).toBe('Luduin Josué Marín Yepez');
  });

  it('mantiene partículas en minúscula (menos la primera palabra)', () => {
    expect(cleanDisplayName('maría DE LA cruz')).toBe('María de la Cruz');
  });

  it('respeta compuestos con guion', () => {
    expect(cleanDisplayName('ana-sofía pérez')).toBe('Ana-Sofía Pérez');
  });

  it('colapsa espacios múltiples', () => {
    expect(cleanDisplayName('  Rafael   Torrealba ')).toBe('Rafael Torrealba');
  });

  it('rechaza basura scrapeada real ("todos los que se encuentran en la imagen")', () => {
    expect(cleanDisplayName('Todos los Que Se Encuentran En la Imagen')).toBeNull();
  });

  it('rechaza nombres con dígitos (cédulas/teléfonos)', () => {
    expect(cleanDisplayName('Pedro Pérez 12345678')).toBeNull();
  });

  it('rechaza una sola palabra (no identifica a nadie con dignidad)', () => {
    expect(cleanDisplayName('Yelmos')).toBeNull();
  });

  it('rechaza null/vacío/demasiado corto/demasiado largo', () => {
    expect(cleanDisplayName(null)).toBeNull();
    expect(cleanDisplayName('')).toBeNull();
    expect(cleanDisplayName('A B')).toBeNull();
    expect(cleanDisplayName('X'.repeat(61))).toBeNull();
  });

  it('rechaza descripciones tipo "persona no identificada" / NN', () => {
    expect(cleanDisplayName('Persona No Identificada')).toBeNull();
    expect(cleanDisplayName('Cuerpo NN Hallado')).toBeNull();
  });

  it('con variantes separadas por | o / se queda con la primera (visto en prod 6-ago)', () => {
    expect(cleanDisplayName('Mayerlin Olivero | Oliveros')).toBe('Mayerlin Olivero');
    expect(cleanDisplayName('maría pérez / peres')).toBe('María Pérez');
    // la primera variante debe ser un nombre digno por sí sola (≥2 palabras)
    expect(cleanDisplayName('Roselbi / Rosleibis Ulloa')).toBeNull();
    expect(cleanDisplayName('X | Pérez González')).toBeNull();
  });
});

describe('pickOffset', () => {
  it('devuelve 0 cuando el total no supera el lote', () => {
    expect(pickOffset(0, 60)).toBe(0);
    expect(pickOffset(60, 60)).toBe(0);
    expect(pickOffset(30, 60)).toBe(0);
  });

  it('es determinista con rand inyectado y respeta el rango [0, total-batch]', () => {
    expect(pickOffset(1000, 60, () => 0)).toBe(0);
    expect(pickOffset(1000, 60, () => 0.5)).toBe(470);
    // rand → 1 nunca ocurre (Math.random es [0,1)), pero el floor acota igual:
    expect(pickOffset(1000, 60, () => 0.999999)).toBeLessThanOrEqual(940);
  });
});

describe('shuffled', () => {
  it('no muta el original y conserva los elementos', () => {
    const src = ['a', 'b', 'c', 'd'];
    const out = shuffled(src, () => 0.42);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
    expect(out.slice().sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

