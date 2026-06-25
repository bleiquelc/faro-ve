/**
 * Helper de ofuscación lado-cliente — espejo de la función SQL obfuscate_point.
 *
 * USO PRINCIPAL: testing local + estimaciones UI ("ubicación aproximada ~300m").
 * NO sustituye la ofuscación SQL — la fuente de verdad es el trigger DB
 * trg_persons_obfuscate_loc, que se ejecuta SIEMPRE antes de cualquier INSERT/UPDATE.
 *
 * Algoritmo:
 *  - Bearing uniforme 0..2π.
 *  - Distancia con sqrt(random()) → distribución uniforme en anillo (no
 *    concentrada en el centro como random() lineal).
 *  - ST_Project equivalente: WGS84 con Haversine inverso.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface ObfuscateOptions {
  /** Radio mínimo en metros. Default 200. */
  minRadiusM?: number;
  /** Radio máximo en metros. Default 500. */
  maxRadiusM?: number;
  /** RNG inyectable para tests determinísticos. Default Math.random. */
  rng?: () => number;
}

const EARTH_RADIUS_M = 6_378_137;

/** Ofusca un punto en un anillo radial aleatorio. */
export function obfuscatePoint(
  p: LatLng,
  opts: ObfuscateOptions = {}
): LatLng {
  const minR = opts.minRadiusM ?? 200;
  const maxR = opts.maxRadiusM ?? 500;
  const rng = opts.rng ?? Math.random;

  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    throw new TypeError('obfuscatePoint: lat/lng inválidos');
  }
  if (minR < 0 || maxR < minR) {
    throw new RangeError('obfuscatePoint: radios inválidos');
  }

  const bearing = rng() * 2 * Math.PI;
  const distance = minR + Math.sqrt(rng()) * (maxR - minR);

  return projectPoint(p, distance, bearing);
}

/**
 * Proyecta un punto a una distancia (m) y bearing (rad).
 * Fórmula esférica destination point (Haversine inverso).
 */
export function projectPoint(p: LatLng, distanceM: number, bearingRad: number): LatLng {
  const φ1 = (p.lat * Math.PI) / 180;
  const λ1 = (p.lng * Math.PI) / 180;
  const δ = distanceM / EARTH_RADIUS_M;

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearingRad)
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
    );

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180
  };
}

/** Distancia Haversine en metros. */
export function haversineDistanceM(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const x = sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}
