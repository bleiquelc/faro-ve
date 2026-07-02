import { describe, it, expect } from 'vitest';
// El geocodificador es un módulo .mjs del pipeline de ingesta (sin red, determinista).
import { geocode, normalizePlace, GEOCODE_VERSION } from '../../scripts/ingest/geocode.mjs';
import { PLACES } from '../../scripts/ingest/geocode-places.mjs';
import { onLand } from '../../scripts/ingest/land-mask.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

// ── v2 (2-jul-2026): anclas EN TIERRA + precisión GeoNames + contexto ──────────

describe('geocode v2 — TODA ancla está en tierra (regresión del bug pines-en-el-mar)', () => {
  // Bug 2-jul: 10 anclas caían en el mar (Tanaguarena a ~5 km mar adentro…) →
  // la ofuscación agotaba sus 16 intentos y el snap-a-costa apilaba miles de
  // pines SOBRE el agua. Estas pruebas hacen imposible reintroducirlo.
  it('las anclas curadas (SPECIFIC/CITY/STATE) caen en tierra', () => {
    const src = readFileSync(join(__dirname, '../../scripts/ingest/geocode.mjs'), 'utf8');
    const re = /\[\s*'([^']+)',\s*(-?[\d.]+),\s*(-?[\d.]+)/g;
    let m: RegExpExecArray | null;
    let checked = 0;
    while ((m = re.exec(src))) {
      checked++;
      expect(onLand(parseFloat(m[2]), parseFloat(m[3])), `${m[1]} en el mar`).toBe(true);
    }
    expect(checked).toBeGreaterThan(150); // sanity: la regex sí leyó las tablas
  });

  it('las anclas generadas (GeoNames) caen en tierra y dentro de Venezuela', () => {
    for (const [needle, lat, lng] of PLACES) {
      expect(inVenezuela([lat, lng]), needle).toBe(true);
      expect(onLand(lat, lng), `${needle} en el mar`).toBe(true);
    }
    expect(PLACES.length).toBeGreaterThan(2000);
  });

  it('las anclas que caían en el mar quedaron corregidas', () => {
    const fixed: Array<[string, number]> = [
      ['Tanaguarena', 10.62], // antes 10.6178,-66.8222 (~5 km mar adentro)
      ['Naiguatá', 10.63],
      ['Los Corales', 10.61],
      ['La Sabana, La Guaira', 10.62],
      ['Todasana', 10.63],
      ['Porlamar', 10.96],
      ['Tucacas', 10.79]
    ];
    for (const [text, latMax] of fixed) {
      const c = geocode(text);
      expect(c, text).not.toBeNull();
      const [lat, lng] = c as [number, number];
      expect(onLand(lat, lng), `${text} sigue en el mar`).toBe(true);
      expect(lat, text).toBeLessThan(latMax + 0.01);
      expect(lng).toBeLessThan(0);
    }
  });
});

describe('geocode v2 — precisión por lugares de GeoNames', () => {
  it('pueblos de la costa de La Guaira ganan a la ciudad La Guaira', () => {
    // Antes: "Chuspa, La Guaira" → ancla de La Guaira ciudad (a ~60 km).
    const chuspa = geocode('Chuspa, La Guaira') as [number, number];
    expect(chuspa).not.toBeNull();
    expect(chuspa[1]).toBeCloseTo(-66.31, 1); // Chuspa real
    const caruao = geocode('Caruao, estado La Guaira') as [number, number];
    expect(caruao[1]).toBeCloseTo(-66.35, 1);
  });

  it('sedes de municipio resuelven al municipio, no a la capital del estado', () => {
    // Antes: "Municipio Lagunillas, Zulia" → Maracaibo (capital). Ahora → Lagunillas.
    const c = geocode('Lagunillas, Zulia') as [number, number];
    expect(c).not.toBeNull();
    expect(c[0]).toBeLessThan(10.4); // Lagunillas (COL) está al sur de Maracaibo
  });

  it('sector urbano (PPLX) exige contexto coherente', () => {
    // El Silencio con Caracas → sector curado de Caracas.
    expect(geocode('El Silencio, Caracas')).toEqual([10.5041, -66.9194]);
    // "La California" sin contexto → sector curado de Caracas (no el caserío de La Guaira).
    expect(geocode('La California, Caracas')).toEqual([10.489, -66.812]);
  });

  it('nombre duplicado entre estados NO matchea sin mención del estado', () => {
    // 'santa rosa' existe en varios estados → sin estado en el texto, nada.
    expect(geocode('Santa Rosa')).toBeNull();
  });

  it('conflicto lugar-fino vs ciudad de otro estado → gana la ciudad', () => {
    // 'lagunillas' existe en Zulia y Mérida; con "Mérida" en el texto debe caer
    // en la de Mérida (o en la ciudad), jamás en la de Zulia.
    const c = geocode('Lagunillas, Mérida') as [number, number];
    expect(c).not.toBeNull();
    expect(c[1]).toBeGreaterThan(-71.6); // no es la Lagunillas de Zulia (-71.25… ok ambas >-71.6; el punto: no Maracaibo)
    expect(c[0]).toBeLessThan(9.0); // zona andina, no Zulia (≥10)
  });

  it('estados ambiguos solo con prefijo estado/edo', () => {
    expect(geocode('Sucre')).toBeNull(); // Municipio Sucre/Av. Sucre = ambiguo
    expect(geocode('estado Sucre')).toEqual([10.4539, -64.1769]); // Cumaná
    expect(geocode('Bolívar')).toBeNull();
    expect(geocode('edo Bolivar')).toEqual([8.1222, -63.5497]); // Ciudad Bolívar
  });

  it('GEOCODE_VERSION existe y es ≥2 (gatilla la re-geocodificación del worker)', () => {
    expect(GEOCODE_VERSION).toBeGreaterThanOrEqual(2);
  });
});
