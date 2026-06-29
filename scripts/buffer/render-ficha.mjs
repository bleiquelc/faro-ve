/**
 * Renderiza la ficha de UNA persona desaparecida en JPEG 1080x1350 (IG feed 4:5,
 * retrato) con la estética Faro VE: FOTO DOMINANTE arriba (edge-to-edge) + un panel
 * de DATOS LIMPIOS abajo. Genera además el copy simple (nombre, ubicación, #).
 *
 * Lee del API público en vivo (persons_public → ofuscado, sin PII, foto de menores
 * ya nula por regla #3). No toca la DB.
 *
 *   PERSON_ID="<uuid>" node scripts/buffer/render-ficha.mjs
 *   PHOTO_URL="https://..."  → override de la foto (la que elija el filtro/enriquecedor)
 *   NO_PHOTO=1               → modo sin-foto (placeholder)
 *   EXTRA_DESC="texto"       → señas/descripción ya unificada de otras plataformas
 *
 * La CARA nunca se corta: foto 'contain' (completa) sobre un fondo borroso 'cover'.
 */
import { chromium } from '@playwright/test';
import os from 'os';
import fs from 'fs';

const API = 'https://faro-ve.com';
const PERSON_ID = process.env.PERSON_ID;
if (!PERSON_ID) {
  console.error('Falta PERSON_ID. Ej: PERSON_ID="064ecd92-..." node scripts/buffer/render-ficha.mjs');
  process.exit(1);
}

const res = await fetch(`${API}/api/persons?status=missing&limit=1000`);
const body = await res.json();
const list = body.persons || body.data || (Array.isArray(body) ? body : []);
const p = list.find((x) => x.id === PERSON_ID);
if (!p) {
  console.error(`No encontré la persona ${PERSON_ID} en el primer lote (probá otro id reciente).`);
  process.exit(1);
}

// Overrides = datos UNIFICADOS (el enriquecedor merge-a varios registros/plataformas).
const sx = process.env.SEX || p.sex;
const name = (process.env.NAME || p.full_name || `${p.given_name || ''} ${p.family_name || ''}`).trim() || 'Persona sin nombre';
const firstName = name.split(/\s+/)[0];
const loc = (process.env.LOC || p.last_known_location_text || p.home_city || 'Ubicación no especificada').trim();
const sexLabel = sx === 'female' ? 'Mujer' : sx === 'male' ? 'Hombre' : '';
const ageVal = process.env.AGE || p.age;
const ageBit = ageVal ? `${ageVal} años` : '';
// Pronombres: género conocido → gendered; desconocido → neutral por nombre (nada de "la" a un hombre).
const known = sx === 'male' || sx === 'female';
const her = sx === 'male' ? 'lo' : 'la';
const Her = sx === 'male' ? 'Lo' : 'La';
const HER = her === 'lo' ? 'LO' : 'LA';
const vist = her === 'lo' ? 'o' : 'a';
const ctaText = known ? `¿${Her} has visto? Ayúdanos a encontrar${her}.` : `¿Has visto a ${firstName}? Ayúdanos a encontrarle.`;
const capCta = known ? `Si ${her} has visto o tienes información, ayúdanos a encontrar${her}.` : `Si has visto a ${firstName} o tienes información, ayúdanos a encontrarle.`;
const emptyCta = known ? `AYÚDANOS A ENCONTRAR${HER}` : `AYÚDANOS A ENCONTRAR A ${firstName.toUpperCase()}`;
const emptyVist = known ? `vist${vist}` : 'visto';
// Foto: override > API > (NO_PHOTO fuerza vacío). El enriquecedor pasará la mejor foto limpia por PHOTO_URL.
const photo = process.env.NO_PHOTO === '1' ? '' : (process.env.PHOTO_URL || p.photo_url || '');
const extraDesc = (process.env.EXTRA_DESC || p.description || '').trim();

const FARO_SVG = fs.readFileSync(new URL('../../static/faro-icon.svg', import.meta.url), 'utf8');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const descShort = extraDesc.length > 150 ? extraDesc.slice(0, 148).trim() + '…' : extraDesc;
// Tamaño del nombre adaptativo al largo → nombres largos no se salen ni se cortan.
const nameSize = name.length > 34 ? 42 : name.length > 26 ? 48 : name.length > 18 ? 54 : 62;

const photoBlock = photo
  ? `<div class="bg" style="background-image:url('${esc(photo)}')"></div>
     <img class="fg" src="${esc(photo)}" onerror="this.closest('.media').classList.add('noimg')">`
  : '';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
  html,body{width:1080px;height:1350px}
  .frame{position:relative;display:flex;flex-direction:column;width:1080px;height:1350px;overflow:hidden;
    background:#072c3c;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#fff}
  /* MEDIA: foto dominante, edge-to-edge, ocupa el espacio (flex:1). */
  .media{position:relative;flex:1 1 auto;overflow:hidden;background:#06303f}
  .media .bg{position:absolute;inset:0;background-size:cover;background-position:center;filter:blur(36px) brightness(.4);transform:scale(1.2)}
  .media .fg{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;z-index:1}
  /* header sobre la foto (gradiente arriba) → más espacio para la imagen */
  .top{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:center;justify-content:space-between;
    padding:40px 48px 60px;background:linear-gradient(180deg,rgba(7,44,60,.85),rgba(7,44,60,0))}
  .brand{display:flex;align-items:center;gap:16px}
  .brand .ic{width:64px;height:64px;border-radius:16px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.4)}
  .brand .ic svg{width:100%;height:100%;display:block}
  .brand .wm{font-weight:800;font-size:32px;letter-spacing:.5px;line-height:1;text-shadow:0 2px 10px rgba(0,0,0,.5)}
  .brand .wm small{display:block;font-weight:700;font-size:16px;color:#cfe8f1;letter-spacing:3px;margin-top:5px}
  .badge{background:#dc2626;color:#fff;font-weight:800;font-size:28px;letter-spacing:2px;padding:13px 24px;border-radius:999px;box-shadow:0 8px 24px rgba(220,38,38,.5)}
  /* placeholder sin-foto (solo modo seguro) */
  .media .empty{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:22px;color:#cfe8f1;text-align:center;padding:0 80px;z-index:2;
    background:linear-gradient(160deg,#0B4F6C,#072c3c)}
  .media.noimg .bg,.media.noimg .fg{display:none}
  .media.noimg .empty,.media.isempty .empty{display:flex}
  .media .empty .ebig{width:200px;height:200px;border-radius:30px;overflow:hidden;box-shadow:0 12px 36px rgba(0,0,0,.4)}
  .media .empty .ebig svg{width:100%;height:100%;display:block}
  .media .empty .et{font-size:40px;font-weight:800;letter-spacing:1px}
  .media .empty .es{font-size:26px;color:#9ec8d8;font-weight:600;max-width:680px;line-height:1.3}
  /* DATOS LIMPIOS: panel inferior ADAPTATIVO al largo (nada se sale ni se corta). */
  .data{flex:0 0 auto;background:linear-gradient(180deg,#0B4F6C,#08384c);padding:32px 60px 44px;text-align:center;
    box-shadow:0 -18px 40px rgba(0,0,0,.35)}
  .clamp2{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:break-word}
  .name{font-weight:800;line-height:1.05;overflow-wrap:break-word}
  .loc{margin:14px auto 0;max-width:950px;font-size:30px;line-height:1.3;color:#FFE39C;font-weight:600}
  .meta{margin-top:8px;font-size:29px;color:#bce1ed;font-weight:600}
  .desc{margin:14px auto 0;max-width:940px;font-size:26px;line-height:1.32;color:#dbeef4;font-weight:500}
  .cta{margin-top:20px;font-size:32px;font-weight:800}
  .urls{margin-top:9px;font-size:28px;font-weight:700;color:#8ccadf}
  .urls b{color:#fff}
</style></head><body>
  <div class="frame">
    <div class="media ${photo ? '' : 'isempty'}">
      ${photoBlock}
      <div class="empty">
        <div class="ebig">${FARO_SVG}</div>
        <span class="et">${esc(emptyCta)}</span>
        <span class="es">Sin foto disponible · su nombre y dónde fue ${emptyVist} pueden ayudar</span>
      </div>
      <div class="top">
        <div class="brand"><span class="ic">${FARO_SVG}</span>
          <span class="wm">FARO VE<small>MAPA DE ESPERANZA</small></span></div>
        <span class="badge">SE BUSCA</span>
      </div>
    </div>
    <div class="data">
      <div class="name clamp2" style="font-size:${nameSize}px">${esc(name)}</div>
      <div class="loc clamp2">📍 ${esc(loc)}</div>
      ${ageBit || sexLabel ? `<div class="meta">${[ageBit ? `🎂 ${esc(ageBit)}` : '', sexLabel ? `👤 ${esc(sexLabel)}` : ''].filter(Boolean).join(' · ')}</div>` : ''}
      ${descShort ? `<div class="desc clamp2">${esc(descShort)}</div>` : ''}
      <div class="cta">${esc(ctaText)}</div>
      <div class="urls"><b>faro-ve.com</b> · @farovenmap</div>
    </div>
  </div>
</body></html>`;

const outDir = os.homedir() + '/Desktop/faro-fichas-test';
fs.mkdirSync(outDir, { recursive: true });
const out = `${outDir}/${PERSON_ID}.jpg`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready; });
await page.waitForTimeout(500);
await page.screenshot({ path: out, type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: 1080, height: 1350 } });
await browser.close();

const locShort = loc.length > 90 ? loc.slice(0, 88).trim() + '…' : loc;
const tags = ['#TerremotoVenezuela', '#Desaparecidos', '#LaGuaira', '#Venezuela', '#SeBusca', '#FaroVE'];
const caption =
  `🔦 SE BUSCA · ${name}\n` +
  `📍 ${locShort}\n` +
  ([ageBit, sexLabel].filter(Boolean).join(' · ') ? `${[ageBit, sexLabel].filter(Boolean).join(' · ')}\n` : '') +
  (descShort ? `\n${descShort}\n` : '') +
  `\n${capCta} Comparte 🙏\n` +
  `🔗 faro-ve.com\n\n` +
  tags.join(' ');
fs.writeFileSync(`${outDir}/${PERSON_ID}.txt`, caption);

console.log('FICHA:', out);
console.log('FOTO :', photo ? photo : 'no (placeholder)');
console.log('\n--- CAPTION ---\n' + caption);
