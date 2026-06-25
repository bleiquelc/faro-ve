import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildMapsUrl,
  formatAddressForClipboard,
  getPreferredMapApp,
  setPreferredMapApp,
  clearPreferredMapApp
} from '../../src/lib/utils/navigation';

const CARACAS = { lat: 10.4806, lng: -66.9036 };

beforeEach(() => {
  // localStorage stub mínimo SSR-safe para que el helper no tire
  const store: Record<string, string> = {};
  // @ts-expect-error patching global
  globalThis.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    }
  };
});

describe('buildMapsUrl', () => {
  it('Apple Maps usa scheme maps:// con daddr+dirflg', () => {
    const url = buildMapsUrl('apple', CARACAS.lat, CARACAS.lng);
    expect(url).toMatch(/^maps:\/\/\?daddr=10\.480600,-66\.903600&dirflg=d/);
  });

  it('Apple Maps con label incluye q encodeado', () => {
    const url = buildMapsUrl('apple', CARACAS.lat, CARACAS.lng, 'Hospital JM');
    expect(url).toContain('q=Hospital%20JM');
  });

  it('Google Maps usa URL universal HTTPS', () => {
    const url = buildMapsUrl('google', CARACAS.lat, CARACAS.lng);
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=10.480600,-66.903600&travelmode=driving'
    );
  });

  it('Waze usa waze.com/ul con ll+navigate=yes', () => {
    expect(buildMapsUrl('waze', CARACAS.lat, CARACAS.lng)).toBe(
      'https://waze.com/ul?ll=10.480600,-66.903600&navigate=yes'
    );
  });

  it('OsmAnd usa scheme osmand.geo con zoom', () => {
    expect(buildMapsUrl('osmand', CARACAS.lat, CARACAS.lng)).toBe(
      'osmand.geo:10.480600,-66.903600?z=18'
    );
  });

  it('redondea a 6 decimales (no expone microposición)', () => {
    const url = buildMapsUrl('google', 10.480612345678, -66.903698765432);
    expect(url).toContain('10.480612');
    expect(url).toContain('-66.903699');
    expect(url).not.toContain('345678');
  });
});

describe('preferred map app — localStorage persistencia', () => {
  it('inicialmente null', () => {
    expect(getPreferredMapApp()).toBeNull();
  });

  it('set/get round-trip', () => {
    setPreferredMapApp('waze');
    expect(getPreferredMapApp()).toBe('waze');
  });

  it('rechaza valores no válidos al leer', () => {
    localStorage.setItem('preferred_map_app', 'tomtom');
    expect(getPreferredMapApp()).toBeNull();
  });

  it('clear borra la preferencia', () => {
    setPreferredMapApp('apple');
    clearPreferredMapApp();
    expect(getPreferredMapApp()).toBeNull();
  });
});

describe('formatAddressForClipboard', () => {
  it('formato completo con nombre + dirección + landmark + entrada + coords', () => {
    const txt = formatAddressForClipboard({
      name: 'Refugio Cáritas Catia',
      address: 'Av. Principal de Catia, casa 12',
      landmark: 'al lado de la iglesia',
      entrance_notes: 'tocar timbre lateral, preguntar por María',
      lat: 10.5126,
      lng: -66.9569
    });
    expect(txt).toBe(
      'Refugio Cáritas Catia — Av. Principal de Catia, casa 12 — Referencia: al lado de la iglesia — Entrada: tocar timbre lateral, preguntar por María — Coords: 10.512600, -66.956900'
    );
  });

  it('omite campos opcionales nulos sin dejar separadores sueltos', () => {
    const txt = formatAddressForClipboard({ address: 'Calle 5 # 23' });
    expect(txt).toBe('Calle 5 # 23');
  });
});
