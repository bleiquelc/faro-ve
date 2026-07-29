import { describe, it, expect } from 'vitest';
import { personFiltersSchema } from '../../src/lib/schemas/person';

/**
 * `offset` se agregó el 29-jul-2026 para que el auto-publicador de Instagram
 * pueda BARRER el corpus completo. Sin él, `/api/persons` (que ordena por
 * created_at DESC) devolvía siempre las mismas N filas más nuevas: el cron solo
 * había visto 400 de 47.820 personas y llevaba ~24h publicando 0.
 * Es aditivo — la federación y el mapa siguen funcionando sin pasarlo.
 */
describe('personFiltersSchema — offset', () => {
  it('por defecto es 0 (comportamiento previo intacto)', () => {
    const f = personFiltersSchema.parse({});
    expect(f.offset).toBe(0);
    expect(f.limit).toBe(1000);
  });

  it('acepta un offset válido desde el query string (llega como texto)', () => {
    expect(personFiltersSchema.parse({ offset: '400' }).offset).toBe(400);
    expect(personFiltersSchema.parse({ offset: '47000' }).offset).toBe(47000);
  });

  it('rechaza offset negativo, fraccionario o no numérico', () => {
    expect(personFiltersSchema.safeParse({ offset: '-1' }).success).toBe(false);
    expect(personFiltersSchema.safeParse({ offset: '1.5' }).success).toBe(false);
    expect(personFiltersSchema.safeParse({ offset: 'abc' }).success).toBe(false);
  });

  it('convive con el resto de los filtros', () => {
    const f = personFiltersSchema.parse({ status: 'missing', limit: '400', offset: '800' });
    expect(f).toMatchObject({ status: 'missing', limit: 400, offset: 800 });
  });
});
