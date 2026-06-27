// Genera src/lib/data/auxilio/expansion.ts desde la salida verificada del workflow.
// Dropea agua-sodis (invención), aplica fixes menores, mapea fuentes a ids.
import fs from 'fs';

const OUT =
  '/private/tmp/claude-501/-Users-bleiquelcolina-Desktop-faro-ve/94032d53-0702-46e8-b0eb-32c902648701/tasks/wai62aaxi.output';
const result = JSON.parse(fs.readFileSync(OUT, 'utf8')).result;

const DROP = new Set(['agua-sodis']);
const FIRST_AID = new Set([
  'anafilaxia',
  'intoxicacion-envenenamiento',
  'mordedura-serpiente',
  'objeto-clavado',
  'golpe-cabeza',
  'sangrado-nariz',
  'inhalacion-humo'
]);

// ids de fuentes ya existentes (para no colisionar al hacer spread).
const existingSrc = new Set(
  [...fs.readFileSync('src/lib/data/auxilio/sources.ts', 'utf8').matchAll(/^\s{2}(?:"([a-z0-9-]+)"|([a-z0-9-]+))\s*:\s*\{/gim)].map(
    (m) => m[1] || m[2]
  )
);

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Fix de fidelidad de citas: inhalacion-humo citó por error la página de
// "Poisoning" de Mayo (la dedup por URL la compartía con intoxicación). Esa
// guía tiene 4 fuentes correctas más; quitamos la mal etiquetada.
const SOURCE_EXCLUDE = {
  "inhalacion-humo": [
    "https://www.mayoclinic.org/first-aid/first-aid-poisoning/basics/art-20056657",
  ],
};

const byUrl = new Map();
const srcList = [];
function idFor(s) {
  if (byUrl.has(s.url)) return byUrl.get(s.url);
  const base = slug(s.org).split('-').slice(0, 2).join('-') || 'fuente';
  const used = new Set([...srcList.map((x) => x.id), ...existingSrc]);
  let id = base,
    n = 1;
  while (used.has(id)) {
    n++;
    id = `${base}-${n}`;
  }
  byUrl.set(s.url, id);
  srcList.push({ id, org: s.org, title: s.title, url: s.url });
  return id;
}

const fa = [];
const salud = [];
for (const { proc } of result) {
  if (DROP.has(proc.id)) continue;
  let steps = [...proc.steps];
  let dont = [...(proc.dont || [])];
  const call = [...(proc.callEmergency || [])];

  if (proc.id === 'anafilaxia') {
    steps = steps.map((t) =>
      t
        .replace(/unas?\s*100\s*por\s*minuto/gi, 'de 100 a 120 por minuto')
        .replace(/100\s*compresiones\s*por\s*minuto/gi, '100 a 120 compresiones por minuto')
    );
  }
  if (proc.id === 'intoxicacion-envenenamiento') {
    dont = [
      ...dont,
      'NO entres a un espacio cerrado lleno de gas o humo para rescatar sin protección: puedes intoxicarte tú también. Espera a los bomberos.'
    ];
  }

  const exclude = SOURCE_EXCLUDE[proc.id] || [];
  const sources = (proc.sources || []).filter((s) => !exclude.includes(s.url)).map(idFor);
  const obj = { id: proc.id, title: proc.title, summary: proc.summary, steps, dont, callEmergency: call, sources };
  (FIRST_AID.has(proc.id) ? fa : salud).push(obj);
}

const q = (s) => JSON.stringify(s);
const arr = (a) => (a.length ? '[\n' + a.map((x) => '      ' + q(x)).join(',\n') + '\n    ]' : '[]');
const proc = (p) =>
  `  {\n    id: ${q(p.id)},\n    title: ${q(p.title)},\n    summary: ${q(p.summary)},\n    steps: ${arr(
    p.steps
  )},\n    dont: ${arr(p.dont)},\n    callEmergency: ${arr(p.callEmergency)},\n    sources: [${p.sources
    .map(q)
    .join(', ')}]\n  }`;

let ts = `/**
 * GENERADO desde el workflow de investigación+verificación (auxilio-biblioteca-expansion).
 * 11 procedimientos verificados (accurate, cero invención). agua-sodis se descartó
 * (invención: afirmaba que el vidrio bloquea UV-A). No editar a mano: regenerar con
 * scripts/gen-expansion.mjs si hace falta.
 */
import type { Procedure, Source } from './types';

export const EXPANSION_SOURCES: Record<string, Source> = {
`;
ts += srcList
  .map((s) => `  ${q(s.id)}: { id: ${q(s.id)}, org: ${q(s.org)}, title: ${q(s.title)}, url: ${q(s.url)} }`)
  .join(',\n');
ts += `\n};\n\nexport const EXPANSION_FIRST_AID: Procedure[] = [\n${fa.map(proc).join(',\n')}\n];\n\nexport const EXPANSION_SALUD: Procedure[] = [\n${salud
  .map(proc)
  .join(',\n')}\n];\n`;

fs.writeFileSync('src/lib/data/auxilio/expansion.ts', ts);
console.log(`sources únicas: ${srcList.length} | first-aid: ${fa.length} | salud: ${salud.length}`);
console.log('first-aid ids:', fa.map((p) => p.id).join(', '));
console.log('salud ids:', salud.map((p) => p.id).join(', '));
