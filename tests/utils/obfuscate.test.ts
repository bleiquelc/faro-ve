import { describe, it, expect } from 'vitest';
import { obfuscatePoint, projectPoint, haversineDistanceM } from '../../src/lib/utils/obfuscate';

describe('obfuscatePoint — privacidad por diseño (anillo 200-500m)', () => {
  const CARACAS = { lat: 10.4806, lng: -66.9036 };

  it('coloca el punto siempre en el anillo [minR, maxR] con defaults', () => {
    for (let i = 0; i < 200; i++) {
      const ofuscado = obfuscatePoint(CARACAS);
      const d = haversineDistanceM(CARACAS, ofuscado);
      expect(d).toBeGreaterThanOrEqual(200);
      expect(d).toBeLessThanOrEqual(500);
    }
  });

  it('respeta minRadiusM/maxRadiusM personalizados', () => {
    for (let i = 0; i < 100; i++) {
      const ofuscado = obfuscatePoint(CARACAS, { minRadiusM: 50, maxRadiusM: 150 });
      const d = haversineDistanceM(CARACAS, ofuscado);
      expect(d).toBeGreaterThanOrEqual(50);
      expect(d).toBeLessThanOrEqual(150);
    }
  });

  it('cubre bearings 0..360° (no se concentra en una dirección)', () => {
    const buckets = new Array(8).fill(0); // 8 sectores de 45°
    const N = 800;
    for (let i = 0; i < N; i++) {
      const o = obfuscatePoint(CARACAS);
      const dy = o.lat - CARACAS.lat;
      const dx = o.lng - CARACAS.lng;
      const θ = (Math.atan2(dy, dx) * 180) / Math.PI; // [-180, 180]
      const sector = Math.floor(((θ + 360) % 360) / 45);
      buckets[sector]++;
    }
    // Cada sector debería tener ~N/8 = 100. Tolerancia ±50%.
    for (const c of buckets) {
      expect(c).toBeGreaterThan(50);
      expect(c).toBeLessThan(160);
    }
  });

  it('distribución radial uniforme en el anillo (no clusterea en el centro)', () => {
    const inner: number[] = [];
    const outer: number[] = [];
    for (let i = 0; i < 400; i++) {
      const d = haversineDistanceM(CARACAS, obfuscatePoint(CARACAS));
      // anillo 200-500: la mitad-radial es ~350m
      (d < 350 ? inner : outer).push(d);
    }
    // Por área del anillo, hay más superficie en el borde externo →
    // sqrt() del random distribuye uniformemente por área.
    // Esperamos outer >= inner aproximadamente.
    expect(outer.length).toBeGreaterThan(inner.length * 0.7);
    expect(inner.length).toBeGreaterThan(outer.length * 0.5);
  });

  it('es determinístico con un RNG inyectado', () => {
    let n = 0;
    const seq = [0.25, 0.75, 0.1, 0.9];
    const rng = () => seq[n++ % seq.length];
    const a = obfuscatePoint(CARACAS, { rng });
    n = 0;
    const b = obfuscatePoint(CARACAS, { rng });
    expect(a.lat).toBe(b.lat);
    expect(a.lng).toBe(b.lng);
  });

  it('rechaza lat/lng inválidos', () => {
    expect(() => obfuscatePoint({ lat: NaN, lng: 0 })).toThrow();
    expect(() => obfuscatePoint({ lat: 0, lng: Infinity })).toThrow();
  });

  it('rechaza radios inválidos', () => {
    expect(() => obfuscatePoint(CARACAS, { minRadiusM: -1, maxRadiusM: 100 })).toThrow();
    expect(() => obfuscatePoint(CARACAS, { minRadiusM: 100, maxRadiusM: 50 })).toThrow();
  });
});

describe('projectPoint + haversineDistanceM — sanity', () => {
  it('projectPoint a 0m devuelve el mismo punto (con tolerancia float)', () => {
    const p = { lat: 10.4806, lng: -66.9036 };
    const r = projectPoint(p, 0, 0);
    expect(r.lat).toBeCloseTo(p.lat, 9);
    expect(r.lng).toBeCloseTo(p.lng, 9);
  });

  it('projectPoint norte 1000m → ~0.009° lat', () => {
    const p = { lat: 0, lng: 0 };
    const r = projectPoint(p, 1000, 0); // bearing 0 = norte
    expect(r.lat).toBeGreaterThan(0.008);
    expect(r.lat).toBeLessThan(0.010);
    expect(r.lng).toBeCloseTo(0, 9);
  });

  it('haversine recíproco: dist(A,B) == dist(B,A)', () => {
    const a = { lat: 10.4806, lng: -66.9036 };
    const b = { lat: 10.5061, lng: -66.9148 };
    expect(haversineDistanceM(a, b)).toBeCloseTo(haversineDistanceM(b, a), 6);
  });
});
