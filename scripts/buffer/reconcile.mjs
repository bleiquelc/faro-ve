/**
 * Reconciliación de REENCUENTROS — cruza personas BUSCADAS en Faro VE contra los
 * reportes "a salvo / encontrada" de otras plataformas. Las que coinciden:
 *  - NO se publican como desaparecidas (la familia quizás no sabe que aparecieron),
 *  - entran a un DOCUMENTO del día con la evidencia exacta (dónde + frase + plataforma)
 *    y el link para contactar a la familia.
 *
 *   LIMIT=50 node scripts/buffer/reconcile.mjs   (LIMIT = registros por estado a escanear)
 *
 * El cron diario corre esto al cierre del día (LIMIT alto / scan completo).
 * Conservador: la IA confirma misma-persona; solo high/medium entran al documento.
 */
import { confirmReunification, nameOverlap, normName } from './found-detector.mjs';
import fs from 'fs';
import os from 'os';

const LIMIT = Number(process.env.LIMIT || 50);
const VR = 'https://venezuelareporta.org/api/v1/personas';
const FARO = 'https://faro-ve.com/api/persons';

async function vrFound(status, n, start = 0) {
  // Pagina (VR cap 100/página) desde `start` hasta `n` o fin. Throttle 600ms.
  const out = [];
  for (let offset = start; offset < n; offset += 100) {
    let arr;
    try { arr = (await (await fetch(`${VR}?status=${status}&limit=100&offset=${offset}${process.env.SINCE ? '&since=' + encodeURIComponent(process.env.SINCE) : ''}`)).json()).personas || []; }
    catch { break; }
    if (!arr.length) break;
    out.push(...arr.map((p) => ({ ...p, _status: status })));
    if (arr.length < 100) break;
    await new Promise((r) => setTimeout(r, 600));
  }
  return out;
}

// 1) Reportes "a salvo/encontrada" de Venezuela Reporta, deduplicados por nombre.
const raw = [...(await vrFound('a_salvo', Number(process.env.A_SALVO_MAX || 600), Number(process.env.A_SALVO_OFFSET || 0))), ...(await vrFound('encontrado', Number(process.env.ENCONTRADO_MAX || LIMIT), Number(process.env.ENCONTRADO_OFFSET || 0)))];
const seen = new Map();
for (const p of raw) {
  const k = normName(p.nombre);
  if (k && !seen.has(k)) seen.set(k, p);
}
const uniq = [...seen.values()];
console.log(`Venezuela Reporta: ${raw.length} reportes a-salvo/encontrada → ${uniq.length} personas únicas a cruzar.`);

// 2) Por cada una, ¿está BUSCADA (missing) en Faro VE?
const candidates = [];
let checked = 0;
for (const f of uniq) {
  const tokens = normName(f.nombre).split(' ').filter((w) => w.length >= 4).sort((a, b) => b.length - a.length);
  if (!tokens.length) continue;
  let flist = [];
  try {
    const fr = await (await fetch(`${FARO}?q=${encodeURIComponent(tokens[0])}&status=missing&limit=50`)).json();
    flist = fr.persons || fr.data || [];
  } catch {
    continue;
  }
  checked++;
  const hit = flist.find((fp) => nameOverlap(fp.full_name, f.nombre) >= 0.5);
  if (!hit) continue;

  // 3) La IA confirma misma-persona + extrae evidencia (conservadora).
  const v = await confirmReunification(
    { nombre: hit.full_name, ciudad: hit.home_city, zona: hit.last_known_location_text, edad: hit.age },
    { nombre: f.nombre, ciudad: f.ciudad, zona: f.zona, edad: f.edad, status: f._status, ultima_vez: f.ultima_vez, descripcion: f.descripcion, platform: 'Venezuela Reporta' }
  );
  if (v.same_person && v.is_found && v.confidence !== 'low') {
    candidates.push({
      nombre: hit.full_name,
      faro_url: `https://faro-ve.com/persona/${hit.id}`,
      vr_status: f._status,
      vr_ciudad: f.ciudad || '',
      vr_zona: f.zona || '',
      vr_ficha: f.ficha_url || '',
      vr_created_at: f.created_at || '', // hora del reporte "a salvo"
      where: v.where || '',
      quote: (v.quote || f.ultima_vez || '').trim(),
      confidence: v.confidence,
      photo_candidates: [hit.photo_url, f.foto_url].filter(Boolean) // para el filtro IA del carrusel
    });
  }
}

// 4) Documento del día.
const date = new Date().toISOString().slice(0, 10);
const dir = os.homedir() + '/Desktop/faro-reencuentros';
fs.mkdirSync(dir, { recursive: true });
const out = `${dir}/reencuentros-${date}.md`;

let md = `# Faro VE — Posibles reencuentros · ${date}\n\n`;
md += `> Personas **buscadas** en Faro VE que **otra plataforma reporta A SALVO / ENCONTRADA**.\n`;
md += `> La familia quizás aún no lo sabe. Revisá y avisale. (Confirmado por IA — confianza high/medium.)\n`;
md += `> Fuente del "a salvo": Venezuela Reporta — venezuelareporta.org (atribución obligatoria).\n\n`;
md += `**${candidates.length} posibles reencuentros** (de ${checked} cruzados).\n\n`;
candidates.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1));
candidates.forEach((c, i) => {
  md += `---\n\n### ${i + 1}. ${c.nombre}  ·  confianza: ${c.confidence}\n`;
  md += `- ✅ Reportada **${c.vr_status.toUpperCase()}** en Venezuela Reporta${c.vr_ciudad ? ` (${c.vr_ciudad})` : ''}\n`;
  if (c.quote) md += `  - 🗣️ Evidencia textual: *"${c.quote}"*${c.where ? ` — ${c.where}` : ''}\n`;
  if (c.vr_ficha) md += `  - 📇 Contacto familia / ficha: ${c.vr_ficha}\n`;
  md += `- 🔎 Aún BUSCADA en Faro VE: ${c.faro_url}\n\n`;
});
if (!candidates.length) md += `_(Sin coincidencias en esta corrida. Subí LIMIT o esperá el scan completo del cron.)_\n`;
fs.writeFileSync(out, md);
fs.writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify({ date, candidates }, null, 2));

console.log(`\nPosibles reencuentros: ${candidates.length}`);
for (const c of candidates) console.log(`  • ${c.nombre} — ${c.vr_status} (${c.confidence}) — "${c.quote.slice(0, 60)}"`);
console.log(`\nDocumento: ${out}`);
