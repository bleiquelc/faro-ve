/**
 * Carrusel IG de POSIBLES REENCUENTROS — FOTO-DOMINANTE (engancha desde el slide 1):
 *   cada slide = FOTO grande arriba + banda de ESTATUS (✅ FIGURA A SALVO) debajo +
 *   PIE con info TITULADA (REPORTADO / DÓNDE / VERIFICÁ) + último slide = cierre/CTA.
 *
 * Máxima verificación: cada foto pasa por el FILTRO IA (descarta flyers/cédulas/
 * screenshots/grupos/menores). Solo confianza ALTA. Lidera con las que SÍ tienen foto
 * limpia (para que la gente no tenga que deslizar para ver una cara).
 *
 *   JSON=".../reencuentros-FECHA.json" node scripts/buffer/render-reencuentros-carousel.mjs
 */
import { chromium } from '@playwright/test';
import { classifyPhoto } from './photo-filter.mjs';
import fs from 'fs';
import os from 'os';

const dirIn = os.homedir() + '/Desktop/faro-reencuentros';
const pick = (process.env.JSON) || (() => { const j = fs.readdirSync(dirIn).filter((f) => f.endsWith('.json')).sort().reverse()[0]; return j ? `${dirIn}/${j}` : ''; })();
if (!pick || !fs.existsSync(pick)) { console.error('No hay JSON de reencuentros. Corré reconcile.mjs.'); process.exit(1); }
const data = JSON.parse(fs.readFileSync(pick, 'utf8'));
const MAX = Number(process.env.MAX_CASES || 9);

let cands = (data.candidates || []).filter((c) => c.confidence === 'high');
// Máxima verificación: filtro IA por cada foto candidata → elegir una LIMPIA.
for (const c of cands) {
  c.photo = '';
  for (const u of c.photo_candidates || []) {
    const r = await classifyPhoto(u);
    if (r.usable && !r.has_minor) { c.photo = u; break; }
  }
}
// Lidera con las que tienen foto limpia (enganche visual).
cands.sort((a, b) => (b.photo ? 1 : 0) - (a.photo ? 1 : 0));
cands = cands.slice(0, MAX);
const withPhoto = cands.filter((c) => c.photo).length;
console.log(`Casos: ${cands.length} (con foto limpia: ${withPhoto}).`);

const FARO_SVG = fs.readFileSync(new URL('../../static/faro-icon.svg', import.meta.url), 'utf8');
const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fhora = (iso) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${MES[d.getUTCMonth()]} · ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

const total = cands.length + 1;
const CSS = `
  *{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
  .frame{position:relative;display:flex;flex-direction:column;width:1080px;height:1350px;overflow:hidden;color:#fff;
    background:#072c3c;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
  .media{position:relative;flex:1 1 auto;overflow:hidden;background:#06303f;min-height:560px}
  .media .bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(36px) brightness(.4);transform:scale(1.2)}
  .media .fg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1}
  .media .ph{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;color:#7fb3c6;background:linear-gradient(160deg,#0B4F6C,#072c3c)}
  .media .ph .ic{width:180px;height:180px;border-radius:28px;overflow:hidden}
  .media .ph .ic svg{width:100%;height:100%}
  .ribbon{position:absolute;top:40px;left:40px;z-index:3;background:#16a34a;color:#fff;font-weight:800;font-size:26px;letter-spacing:1px;padding:12px 22px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
  .num{position:absolute;top:46px;right:44px;z-index:3;font-size:26px;font-weight:800;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.6)}
  .statusband{flex:0 0 auto;background:#16a34a;color:#fff;text-align:center;font-weight:900;font-size:40px;letter-spacing:1px;padding:18px}
  .info{flex:0 0 auto;background:#0B4F6C;padding:24px 56px 6px;text-align:center}
  .name{font-weight:800;line-height:1.05;overflow-wrap:break-word;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
  .foot{flex:0 0 auto;background:linear-gradient(180deg,#0B4F6C,#08384c);padding:18px 56px 44px;display:flex;flex-direction:column;gap:14px}
  .row{display:flex;gap:16px;align-items:baseline}
  .row .k{flex:0 0 200px;font-size:24px;font-weight:800;letter-spacing:1px;color:#8ccadf;text-transform:uppercase}
  .row .v{flex:1;font-size:30px;font-weight:600;color:#fff;overflow-wrap:break-word;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
  .row .v.hi{color:#FFE39C}
  /* cierre */
  .close{display:flex;flex-direction:column;justify-content:center;height:100%;padding:80px 64px;text-align:center;background:linear-gradient(160deg,#0B4F6C,#072c3c)}
  .close .br{display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:30px}
  .close .br .ic{width:70px;height:70px;border-radius:16px;overflow:hidden}
  .close h2{font-size:60px;font-weight:900;line-height:1.05}
  .close p{font-size:34px;margin-top:24px;color:#eaf6fa;line-height:1.3}
  .close .cta{font-size:40px;font-weight:800;color:#FFE39C;margin-top:34px}
  .close .src{font-size:26px;color:#bce1ed;margin-top:26px}
  .close .hand{font-size:30px;font-weight:800;margin-top:30px}
`;

function caseHTML(c, i) {
  const media = c.photo
    ? `<div class="bg" style="background-image:url('${esc(c.photo)}')"></div><img class="fg" src="${esc(c.photo)}">`
    : `<div class="ph"><div class="ic">${FARO_SVG}</div></div>`;
  const donde = c.where || [c.vr_ciudad, c.vr_zona].filter(Boolean).join(', ') || 'La Guaira';
  return `<div class="frame">
    <div class="media">${media}<span class="ribbon">🟢 POSIBLE REENCUENTRO</span><span class="num">${i + 1}/${total}</span></div>
    <div class="statusband">✅ FIGURA A SALVO</div>
    <div class="info"><div class="name" style="font-size:${c.nombre.length > 30 ? 40 : c.nombre.length > 22 ? 46 : 54}px">${esc(c.nombre)}</div></div>
    <div class="foot">
      <div class="row"><span class="k">Reportado</span><span class="v">${esc(fhora(c.vr_created_at))} · Venezuela Reporta</span></div>
      <div class="row"><span class="k">Dónde</span><span class="v hi">${esc(donde)}</span></div>
      <div class="row"><span class="k">Verificá</span><span class="v">venezuelareporta.org · avisá a su familia</span></div>
    </div>
  </div>`;
}
function closeHTML() {
  return `<div class="frame"><div class="close">
    <div class="br"><span class="ic">${FARO_SVG}</span><span style="font-size:34px;font-weight:800">FARO VE</span></div>
    <h2>¿Reconocés a alguien?</h2>
    <p>Avisale a su familia. Un solo dato puede cerrar una búsqueda y devolver la calma.</p>
    <div class="cta">Lista completa →<br>faro-ve.com/reencuentros</div>
    <div class="src">Fuentes: Venezuela Reporta · Faro VE<br>Verificá siempre en la fuente antes de dar por cierto.</div>
    <div class="hand">@farovenmap</div>
  </div></div>`;
}

const slides = [...cands.map(caseHTML), closeHTML()];
const outDir = dirIn + '/carrusel';
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
const files = [];
for (let i = 0; i < slides.length; i++) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${slides[i]}</body></html>`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const f = `${outDir}/slide-${String(i + 1).padStart(2, '0')}.jpg`;
  await page.screenshot({ path: f, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  files.push(f);
}
await browser.close();

const caption =
  `🟢 POSIBLES REENCUENTROS\n\n` +
  `Cruzamos las plataformas: estas personas siguen BUSCADAS pero figuran reportadas A SALVO en otra. Sus familias quizás no lo saben.\n\n` +
  `Deslizá → si reconocés a alguien, avisale a su familia. Verificá siempre en la fuente.\n\n` +
  `Lista completa: faro-ve.com/reencuentros · Fuente: Venezuela Reporta\n\n` +
  `#TerremotoVenezuela #Reencuentro #Desaparecidos #LaGuaira #Venezuela #FaroVE`;
fs.writeFileSync(`${outDir}/caption.txt`, caption);
console.log(`Slides: ${files.length} (con foto: ${withPhoto}/${cands.length})`);
files.forEach((f) => console.log('  ' + f));
