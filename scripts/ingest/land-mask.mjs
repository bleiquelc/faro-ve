/**
 * Máscara de tierra de Venezuela para USO LOCAL (generador del gazetteer + tests).
 * Lee scripts/data/ve-land.geojson (geoBoundaries ADM0, la misma que puebla la
 * tabla ve_land en la DB) y responde si un punto cae en tierra (ray casting).
 *
 * NO sustituye a is_on_land() de la DB (esa es la verdad para la ofuscación);
 * esto existe para que las ANCLAS del geocoder nunca se ubiquen en el mar:
 * un ancla en el agua hace que la ofuscación 200-500m fracase los 16 intentos
 * y el snap-a-costa apile miles de pines sobre la línea de costa (bug 2-jul).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {number[][][][] | null} MultiPolygon [poly][ring][vertex][lng,lat] */
let POLYS = null;

function load() {
  if (POLYS) return POLYS;
  const g = JSON.parse(
    readFileSync(join(__dirname, '..', 'data', 've-land.geojson'), 'utf8')
  );
  const geom = g.features?.[0]?.geometry;
  if (!geom) throw new Error('ve-land.geojson sin geometry');
  /** @type {number[][][][]} */
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  POLYS = polys;
  return polys;
}

/** @param {[number,number]} pt [lng,lat] @param {number[][]} ring */
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * ¿El punto (lat, lng) cae en tierra venezolana según la máscara?
 * @param {number} lat @param {number} lng @returns {boolean}
 */
export function onLand(lat, lng) {
  /** @type {[number, number]} */
  const pt = [lng, lat];
  for (const poly of load()) {
    if (inRing(pt, poly[0])) {
      let inHole = false;
      for (let k = 1; k < poly.length; k++) {
        if (inRing(pt, poly[k])) {
          inHole = true;
          break;
        }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

/**
 * Si (lat, lng) está en el mar según la máscara, lo corre TIERRA ADENTRO al
 * candidato en-tierra más cercano (16 rumbos × radios crecientes hasta maxKm).
 * Devuelve [lat, lng] en tierra, o null si no encuentra (punto muy mar adentro).
 * Solo para ANCLAS de pueblos costeros (aproximadas por diseño); jamás se usa
 * sobre coordenadas de personas.
 * @param {number} lat @param {number} lng @param {number} [maxKm]
 * @returns {[number, number] | null}
 */
export function nudgeToLand(lat, lng, maxKm = 3) {
  if (onLand(lat, lng)) return [lat, lng];
  const mLat = 111320;
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
  for (let rM = 250; rM <= maxKm * 1000; rM += 250) {
    for (let k = 0; k < 16; k++) {
      const a = (2 * Math.PI * k) / 16;
      const la = lat + (rM * Math.cos(a)) / mLat;
      const ln = lng + (rM * Math.sin(a)) / mLng;
      if (onLand(la, ln)) return [la, ln];
    }
  }
  return null;
}
