import { describe, it, expect } from 'vitest';
// El geocodificador es un módulo .mjs del pipeline de ingesta (sin red, determinista).
import { geocode, normalizePlace } from '../../scripts/ingest/geocode.mjs';

const VE = { latMin: 0.6, latMax: 12.3, lngMin: -73.4, lngMax: -59.8 };
function inVenezuela([lat, lng]: [number, number]) {
  return lat >= VE.latMin && lat <= VE.latMax && lng >= VE.lngMin && lng <= VE.lngMax;
}

describe('normalizePlace', () => {
  it('baja a minúsculas, quita acentos y colapsa espacios', () => {
    expect(normalizePlace('  San   Cristóbal ')).toBe('san cristobal');
    expect(normalizePlace('Mérida')).toBe('merida');
  });
});

describe('geocode — especificidad por nivel', () => {
  it('un sector/pueblo (SPECIFIC) gana sobre el estado, aunque el estado sea más largo', () => {
    // 'petare' (6) < 'miranda' (7) en longitud, pero SPECIFIC gana a STATE.
    expect(geocode('Petare, Miranda')).toEqual([10.4773, -66.8186]);
    // 'cua' (3) gana a 'miranda' por nivel.
    expect(geocode('Lo vieron en Cúa, estado Miranda')).toEqual([10.1606, -66.8881]);
    // El Valle (parroquia) gana a Caracas (ciudad).
    expect(geocode('El Valle de Caracas')).toEqual([10.45, -66.9]);
  });

  it('dentro de un nivel gana la aguja más larga (más específica)', () => {
    expect(geocode('Catia La Mar')).toEqual([10.5959, -67.0257]); // no 'catia'
    expect(geocode('Puerto La Cruz')).toEqual([10.2139, -64.6164]); // no 'cruz'/'puerto'
    expect(geocode('San Fernando de Apure')).toEqual([7.8939, -67.4736]); // no 'apure'
  });

  it('cae a CITY y luego a STATE cuando no hay sector', () => {
    expect(geocode('Ciudad Bolívar')).toEqual([8.1222, -63.5497]); // CITY
    expect(geocode('en el estado Lara')).toEqual([10.0647, -69.3475]); // STATE → Barquisimeto
  });
});

describe('geocode — límite de palabra (anti falsos positivos)', () => {
  it("'cua' NO matchea dentro de 'evacuado'", () => {
    expect(geocode('Fue evacuado del refugio')).toBeNull();
  });
  it("'bolivar' suelto (Av./Plaza Bolívar) no geolocaliza a Bolívar", () => {
    expect(geocode('Avenida Bolívar')).toBeNull();
  });
});

describe('geocode — robustez', () => {
  it('acentos y mayúsculas no importan', () => {
    expect(geocode('MÉRIDA')).toEqual([8.5897, -71.1561]);
    expect(geocode('San Cristóbal, Táchira')).toEqual([7.7669, -72.225]);
  });
  it('texto desconocido o vacío → null', () => {
    expect(geocode('Narnia')).toBeNull();
    expect(geocode('')).toBeNull();
    expect(geocode(null as unknown as string)).toBeNull();
    expect(geocode(undefined as unknown as string)).toBeNull();
  });
  it('toda coord devuelta cae dentro de Venezuela', () => {
    const samples = [
      'La Guaira',
      'Maracaibo',
      'Puerto Ordaz',
      'Maturín',
      'Punto Fijo',
      'Santa Elena de Uairén',
      'Petare',
      'estado Amazonas'
    ];
    for (const s of samples) {
      const c = geocode(s);
      expect(c, s).not.toBeNull();
      expect(inVenezuela(c as [number, number]), s).toBe(true);
    }
  });
});
