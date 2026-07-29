/**
 * Siembra los reencuentros (high-confidence) en la DB de Faro vía /api/enrich.
 * Para CADA uno corre el filtro IA sobre sus fotos candidatas → adjunta SOLO una
 * foto limpia (nada de flyers/cédulas/menores); si ninguna pasa, va sin foto.
 *
 *   JSON="ruta.json" node scripts/buffer/seed-reencuentros.mjs   (default: el último de ~/Desktop/faro-reencuentros)
 *
 * Requiere: migración 0030 aplicada (columna photo_url) + ENRICH_TOKEN en Pages.
 */
import { classifyPhoto } from './photo-filter.mjs';
import { fetchJson } from '../lib/fetch-json.mjs';
import fs from 'fs';
import os from 'os';

const TOKEN = fs.readFileSync(os.homedir() + '/.secrets/faro-ve/enrich-token.txt', 'utf8').trim();
const dir = os.homedir() + '/Desktop/faro-reencuentros';
const file = process.env.JSON || `${dir}/${fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort().reverse()[0]}`;
const { candidates } = JSON.parse(fs.readFileSync(file, 'utf8'));
const high = candidates.filter((c) => c.confidence === 'high');
console.log(`Sembrando ${high.length} reencuentros high (de ${file}) con filtro de foto IA…`);

let ok = 0, err = 0, withPhoto = 0;
const errs = [];
for (const c of high) {
  const id = (c.faro_url.match(/persona\/([0-9a-f-]+)/) || [])[1];
  if (!id) continue;
  let photo = '';
  for (const u of c.photo_candidates || []) {
    const r = await classifyPhoto(u);
    if (r.usable && !r.has_minor) { photo = u; break; }
  }
  if (photo) withPhoto++;
  const fsig = { source: 'venezuela-reporta', source_url: c.vr_ficha, found_status: c.vr_status, quote: c.quote || ('estado: ' + c.vr_status), where_text: c.where, confidence: 'high' };
  if (photo) fsig.photo_url = photo;
  const { ok: httpOk, data: j, error } = await fetchJson.safe('https://faro-ve.com/api/enrich', {}, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-enrich-token': TOKEN }, body: JSON.stringify({ id, found_signal: fsig })
  });
  if (httpOk && j.ok) ok++; else { err++; if (errs.length < 5) errs.push(`${c.nombre}: ${j.message || error?.status || error?.message}`); }
}
console.log(`\n✅ escritos: ${ok} · con foto limpia: ${withPhoto} · ✗ errores: ${err}`);
errs.forEach((e) => console.log('   ' + e));
