/**
 * Detector IA (Haiku 4.5) de REENCUENTRO.
 *
 * Caso: una persona figura BUSCADA en Faro VE, pero otra plataforma la reporta
 * A SALVO / ENCONTRADA. La familia quizás no lo sabe. Este módulo:
 *  - isFoundStatus(): señal ESTRUCTURADA (status a_salvo/encontrado/found/etc.).
 *  - confirmReunification(): la IA confirma si son LA MISMA persona y extrae la
 *    evidencia (dónde está + la frase textual de la fuente). CONSERVADORA: ante
 *    duda devuelve low/false — un falso positivo le daría a una familia una
 *    esperanza equivocada.
 *
 * NO publica nada. Alimenta la lista de reencuentros + el documento del día.
 */
import fs from 'fs';

const KEY = fs.readFileSync(process.env.HOME + '/.secrets/faro-ve/anthropic-key.txt', 'utf8').trim();
const MODEL = 'claude-haiku-4-5-20251001';

export function isFoundStatus(status, platform) {
  const s = String(status || '').toLowerCase();
  if (platform === 'venezuela_reporta') return s === 'a_salvo' || s === 'encontrado';
  if (platform === 'faro') return ['found_alive', 'safe_self_report', 'sheltered', 'hospitalized'].includes(s);
  if (platform === 'venezuela_te_busca') return s === 'found' || s === 'found_alive';
  return false;
}

export const normName = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin acentos
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Distancia de edición (Levenshtein) — tolera errores de tipeo en nombres. */
export function lev(a, b) {
  a = a || ''; b = b || '';
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Dos tokens "coinciden" si son iguales o difieren por pocos caracteres (tipeo). */
function tokenMatch(x, y) {
  if (x === y) return true;
  const d = lev(x, y), L = Math.max(x.length, y.length);
  return L >= 6 ? d <= 2 : L >= 4 ? d <= 1 : false;
}

/** Solapamiento DIFUSO de nombres (pre-filtro barato y tolerante a tipeos antes de
 *  gastar IA). La IA (confirmReunification) hace la confirmación final. */
export function nameOverlap(a, b) {
  const ta = [...new Set(normName(a).split(' ').filter((w) => w.length > 2))];
  const tb = [...new Set(normName(b).split(' ').filter((w) => w.length > 2))];
  if (!ta.length || !tb.length) return 0;
  let hit = 0;
  for (const w of ta) if (tb.some((z) => tokenMatch(w, z))) hit++;
  return hit / Math.min(ta.length, tb.length);
}

/** IA: ¿es la misma persona y está a salvo/ubicada? Devuelve evidencia. */
export async function confirmReunification(faro, found) {
  const prompt = `Dos reportes de personas tras el terremoto de Venezuela (jun-2026). Decidí si son LA MISMA persona, y si el REPORTE B indica que está A SALVO / UBICADA / con su familia / en un hospital.

REPORTE A — BUSCADA (desaparecida) en Faro VE:
  nombre: ${faro.nombre} | ciudad/zona: ${faro.ciudad || ''} ${faro.zona || ''} | edad: ${faro.edad || '?'}

REPORTE B — posible "a salvo/encontrada" en ${found.platform}:
  nombre: ${found.nombre} | ciudad/zona: ${found.ciudad || ''} ${found.zona || ''} | edad: ${found.edad || '?'} | estado: ${found.status} | última info: ${found.ultima_vez || ''} | descripción: ${found.descripcion || ''}

Responde SOLO con JSON válido:
{"same_person": boolean, "confidence": "high|medium|low", "is_found": boolean, "where": "lugar/hospital si se menciona, si no vacío", "quote": "frase textual del REPORTE B que dice que está a salvo/ubicada", "reason": "breve"}

same_person=true SOLO si el nombre coincide claramente Y la ubicación/edad son compatibles. Sé CONSERVADOR: ante cualquier duda usá confidence "low" o same_person=false. Un falso positivo le daría a una familia una esperanza equivocada.`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 320, messages: [{ role: 'user', content: prompt }] })
  });
  const j = await resp.json();
  if (j.error) return { same_person: false, confidence: 'low', is_found: false, where: '', quote: '', reason: 'error: ' + j.error.message };
  const txt = (j.content?.[0]?.text || '').trim();
  const m = txt.match(/\{[\s\S]*\}/);
  try {
    const o = JSON.parse(m ? m[0] : txt);
    return {
      same_person: !!o.same_person,
      confidence: o.confidence || 'low',
      is_found: !!o.is_found,
      where: o.where || '',
      quote: o.quote || '',
      reason: o.reason || ''
    };
  } catch {
    return { same_person: false, confidence: 'low', is_found: false, where: '', quote: '', reason: 'parse_error' };
  }
}
