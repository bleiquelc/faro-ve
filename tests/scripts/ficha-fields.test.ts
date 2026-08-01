import { describe, it, expect } from 'vitest';
import { resolveFichaFields } from '../../scripts/lib/ficha-fields.mjs';

/**
 * REGRESIÓN (1-ago-2026). El 29-jul se arregló la ventana de 400 filas de
 * `cron-ig.mjs` (barrido con cursor), pero `render-ficha.mjs` seguía buscando a
 * la persona en su PROPIO "primer lote" de 1000 — las más nuevas. Como el cron
 * pasó a elegir candidatos del fondo del corpus (cursor 10.400+), el render no
 * los encontraba, salía con exit 1 y `execFileSync` MATABA la corrida entera:
 * 3 días con Intentos=15 y Publicadas=0.
 *
 * El cron YA le pasa todos los datos por entorno. La búsqueda en la API es solo
 * un respaldo para corridas manuales.
 */

describe('resolveFichaFields — el caso que rompió la publicación', () => {
  it('funciona con la persona NO encontrada en la API si el entorno trae los datos', () => {
    const f = resolveFichaFields(
      {
        NAME: 'María Torrealba',
        LOC: 'Naiguatá, La Guaira',
        AGE: '34',
        SEX: 'female',
        PHOTO_URL: 'https://ejemplo.test/foto.jpg'
      },
      null // ← la API no la trajo: antes esto era exit(1)
    );
    expect(f.name).toBe('María Torrealba');
    expect(f.loc).toBe('Naiguatá, La Guaira');
    expect(f.age).toBe('34');
    expect(f.sex).toBe('female');
    expect(f.photo).toBe('https://ejemplo.test/foto.jpg');
  });

  it('el entorno GANA sobre lo que trae la API (datos unificados con VR)', () => {
    const f = resolveFichaFields(
      { NAME: 'Nombre Unificado', LOC: 'Zona precisa', PHOTO_URL: 'https://x.test/b.jpg' },
      { full_name: 'Nombre Viejo', last_known_location_text: 'Zona vaga', photo_url: 'https://x.test/a.jpg' }
    );
    expect(f.name).toBe('Nombre Unificado');
    expect(f.loc).toBe('Zona precisa');
    expect(f.photo).toBe('https://x.test/b.jpg');
  });

  it('usa la API como respaldo cuando el entorno viene vacío (corrida manual)', () => {
    const f = resolveFichaFields(
      {},
      { full_name: 'Luis Pérez', last_known_location_text: 'Caracas', age: 20, sex: 'male', photo_url: 'https://x.test/c.jpg' }
    );
    expect(f.name).toBe('Luis Pérez');
    expect(f.loc).toBe('Caracas');
    expect(f.sex).toBe('male');
  });

  it('arma el nombre desde given/family si no hay full_name', () => {
    expect(resolveFichaFields({ PHOTO_URL: 'x' }, { given_name: 'Ana', family_name: 'Gil' }).name).toBe('Ana Gil');
  });
});

describe('resolveFichaFields — qué SÍ es motivo de fallo', () => {
  it('falla si no hay forma de saber el nombre', () => {
    expect(() => resolveFichaFields({ PHOTO_URL: 'x' }, null)).toThrow(/nombre/i);
  });

  it('falla si no hay foto (la ficha sin foto no se publica, decisión founder)', () => {
    expect(() => resolveFichaFields({ NAME: 'Ana Gil' }, null)).toThrow(/foto/i);
  });

  it('NO_PHOTO=1 permite render sin foto (uso interno de previsualización)', () => {
    const f = resolveFichaFields({ NAME: 'Ana Gil', NO_PHOTO: '1' }, null);
    expect(f.photo).toBe('');
  });

  it('cae a un texto neutro cuando no se conoce la ubicación', () => {
    const f = resolveFichaFields({ NAME: 'Ana Gil', PHOTO_URL: 'x' }, null);
    expect(f.loc).toMatch(/no especificada/i);
  });
});
