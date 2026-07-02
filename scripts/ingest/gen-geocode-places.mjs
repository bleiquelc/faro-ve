#!/usr/bin/env node
/**
 * Genera scripts/ingest/geocode-places.mjs (tabla PLACES del geocoder) a partir
 * del dump público de GeoNames para Venezuela.
 *
 *   Datos: https://download.geonames.org/export/dump/VE.zip  (VE.txt, CC BY 4.0)
 *   Uso:   node scripts/ingest/gen-geocode-places.mjs /ruta/a/VE.txt
 *
 * Selección (precisión sin falsos positivos):
 *  - Sedes administrativas SIEMPRE: PPLC, PPLA, PPLA2 (municipios), PPLA3/PPLA4
 *    (parroquias) → es exactamente la granularidad de "dirección pública".
 *  - Sectores urbanos (PPLX: barrios/urbanizaciones de las ciudades) SIEMPRE,
 *    pero marcados "exigen contexto": solo matchean si el texto menciona su
 *    estado o una ciudad curada del mismo estado (anti falso-positivo).
 *  - Resto de lugares poblados (PPL/PPLL/PPLS/PPLW): solo con población
 *    ≥1000, o TODOS los del estado La Guaira/Vargas (zona del terremoto, adm1=26,
 *    nombre ≥4 chars) — ahí la densidad salva vidas.
 *  - Nombres ≥5 chars (≥4 en Vargas), sin colisión con las tablas curadas
 *    (SPECIFIC/CITY/STATE ganan por nivel) ni con la blacklist de frases genéricas.
 *  - Duplicados: mismo nombre con instancias a <12 km → se funden (gana la sede/
 *    mayor población). Lejanas → una por estado marcada "exige contexto" (solo
 *    matchea si el texto menciona su estado; ver geocode.mjs).
 *  - TODA ancla se valida EN TIERRA con la máscara ve-land (nudgeToLand corre
 *    tierra adentro las costeras; sin tierra a <3 km → se descarta).
 *
 * El archivo generado NO se edita a mano. Re-generar al mejorar la selección.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { onLand, nudgeToLand } from './land-mask.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SRC = process.argv[2];
if (!SRC) {
  console.error('Uso: node scripts/ingest/gen-geocode-places.mjs /ruta/a/VE.txt');
  process.exit(1);
}

const ADM1 = {
  '01': 'amazonas', '02': 'anzoategui', '03': 'apure', '04': 'aragua',
  '05': 'barinas', '06': 'bolivar', '07': 'carabobo', '08': 'cojedes',
  '09': 'delta amacuro', '11': 'falcon', '12': 'guarico', '13': 'lara',
  '14': 'merida', '15': 'miranda', '16': 'monagas', '17': 'nueva esparta',
  '18': 'portuguesa', '19': 'sucre', '20': 'tachira', '21': 'trujillo',
  '22': 'yaracuy', '23': 'zulia', '24': 'dependencias federales',
  '25': 'distrito federal', '26': 'vargas'
};

const SEAT_CODES = new Set(['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4']);
const SECTOR_CODES = new Set(['PPLX']); // sector urbano → exige contexto SIEMPRE
const OTHER_CODES = new Set(['PPL', 'PPLL', 'PPLS', 'PPLW']);

// Frases demasiado genéricas en el habla (aunque sean topónimos únicos en GN):
// matchearlas produciría pines falsos ("la entrada del refugio", "el centro").
const BLACKLIST = new Set([
  'el centro', 'la playa', 'el pueblo', 'la costa', 'el puerto', 'la entrada',
  'la salida', 'el cruce', 'la linea', 'el terminal', 'la bomba', 'el rio',
  'la laguna', 'el cerro', 'la loma', 'la montana', 'el mirador', 'la planta',
  'la fabrica', 'el llano', 'la sabaneta', 'los proximos', 'el centro del pueblo',
  'colonia vacacional', 'la victoria', 'el carmen', 'san jose', 'santa rosa',
  'el placer', 'la ele', 'el mar',
  // frases/nombres de persona que también son topónimos → pin falso asegurado
  'juan diaz', 'maria isabel', 'pedro garcia', 'la luz', 'la mata', 'la venta',
  'el topo', 'la julia', 'la lagunita', 'la fundacion', 'el pozo',
  // sectores célebres de Caracas con homónimo rural (van en el curado SPECIFIC)
  'la california'
]);

const norm = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Agujas ya cubiertas por las tablas curadas de geocode.mjs (ganan por nivel).
// Se extraen del propio archivo para no divergir.
const curatedSrc = readFileSync(join(__dirname, 'geocode.mjs'), 'utf8');
const curated = new Set();
{
  const re = /\['([^']+)',\s*-?\d/g;
  let m;
  while ((m = re.exec(curatedSrc))) curated.add(norm(m[1]));
}

const rows = readFileSync(SRC, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'));

/** @type {Map<string, {lat:number,lng:number,state:string,rank:number,pop:number,ctx:boolean}[]>} */
const byName = new Map();
let considered = 0;

for (const r of rows) {
  const fcode = r[7];
  const adm1 = r[10];
  const state = ADM1[adm1];
  if (!state) continue;
  const isSeat = SEAT_CODES.has(fcode);
  const isSector = SECTOR_CODES.has(fcode);
  const pop = parseInt(r[14], 10) || 0;
  const isVargas = adm1 === '26';
  if (!isSeat && !isSector && !(OTHER_CODES.has(fcode) && (pop >= 1000 || isVargas))) continue;

  const needle = norm(r[2] || r[1]);
  const minLen = isVargas ? 4 : 5;
  if (needle.length < minLen) continue;
  if (!/^[a-z0-9' -]+$/.test(needle)) continue;
  if (curated.has(needle) || BLACKLIST.has(needle)) continue;

  const lat = parseFloat(r[4]);
  const lng = parseFloat(r[5]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  considered++;
  // rank: sede administrativa más alta primero (para elegir "la mejor" instancia)
  const rank = { PPLC: 5, PPLA: 4, PPLA2: 3, PPLA3: 2, PPLA4: 1 }[fcode] ?? 0;
  if (!byName.has(needle)) byName.set(needle, []);
  // ctx: los sectores urbanos exigen contexto SIEMPRE (además de los duplicados)
  byName.get(needle).push({ lat, lng, state, rank, pop, ctx: isSector && !isVargas });
}

const distKm = (a, b) => {
  const mLat = 111.32;
  const mLng = 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * mLat, (a.lng - b.lng) * mLng);
};
const best = (arr) =>
  [...arr].sort((x, y) => y.rank - x.rank || y.pop - x.pop)[0];

/** @type {[string, number, number, string, 0|1][]} [needle, lat, lng, state, ambiguo] */
const out = [];
let dropped = 0;

for (const [needle, insts] of byName) {
  // ¿todas las instancias cerca? → una sola entrada inequívoca
  let maxD = 0;
  for (let i = 0; i < insts.length; i++)
    for (let j = i + 1; j < insts.length; j++) maxD = Math.max(maxD, distKm(insts[i], insts[j]));

  if (maxD < 12) {
    const b = best(insts);
    out.push([needle, b.lat, b.lng, b.state, insts.some((p) => p.ctx) ? 1 : 0]);
  } else {
    // instancias lejanas → una por estado, marcadas "exigen contexto de estado"
    const states = new Map();
    for (const p of insts) {
      if (!states.has(p.state)) states.set(p.state, []);
      states.get(p.state).push(p);
    }
    for (const [st, arr] of states) {
      const b = best(arr);
      out.push([needle, b.lat, b.lng, st, 1]);
    }
  }
}

// Validación EN TIERRA de cada ancla (correr tierra adentro las costeras).
const final = [];
for (const [needle, lat, lng, state, amb] of out) {
  if (onLand(lat, lng)) {
    final.push([needle, lat, lng, state, amb]);
    continue;
  }
  const fixed = nudgeToLand(lat, lng);
  if (fixed) {
    final.push([needle, +fixed[0].toFixed(5), +fixed[1].toFixed(5), state, amb]);
  } else {
    dropped++;
    console.error(`  descartada (sin tierra a <3km): ${needle} (${lat},${lng}) [${state}]`);
  }
}

final.sort((a, b) => a[0].localeCompare(b[0]) || a[3].localeCompare(b[3]));

const header = `/**
 * GENERADO por scripts/ingest/gen-geocode-places.mjs — NO editar a mano.
 *
 * Lugares poblados de Venezuela (sedes de municipio/parroquia + pueblos) para el
 * geocodificador de ingesta. Fuente: GeoNames (https://www.geonames.org/,
 * dump VE.txt), licencia CC BY 4.0 — atribución: "This work includes data from
 * GeoNames". Toda ancla está VERIFICADA EN TIERRA contra la máscara ve-land
 * (las costeras se corren tierra adentro ≤3 km: el pin de una persona se ofusca
 * 200–500 m alrededor del ancla y un ancla en el mar apila pines en la costa).
 *
 * Formato: [aguja normalizada, lat, lng, estado, exigeContexto]
 *   exigeContexto=1 → nombre duplicado entre estados O sector urbano (PPLX):
 *   SOLO matchea si el texto menciona su estado o una ciudad curada del mismo
 *   estado (desambiguación por contexto en geocode.mjs).
 */

/** @type {[string, number, number, string, 0|1][]} */
export const PLACES = [
`;
const body = final
  .map(([n, la, ln, st, amb]) => `  [${JSON.stringify(n)}, ${la}, ${ln}, ${JSON.stringify(st)}, ${amb}]`)
  .join(',\n');
writeFileSync(join(__dirname, 'geocode-places.mjs'), header + body + '\n];\n');

console.log(
  `geocode-places.mjs: ${final.length} anclas (${out.length - dropped} en tierra tras nudge, ${dropped} descartadas) de ${considered} candidatas GeoNames.`
);
const ambigCount = final.filter((e) => e[4] === 1).length;
console.log(`  inequívocas: ${final.length - ambigCount} · ambiguas (exigen estado): ${ambigCount}`);
