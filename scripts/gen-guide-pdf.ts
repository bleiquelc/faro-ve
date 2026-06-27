/**
 * Genera la GUÍA PDF descargable/distribuible de Faro Auxilio desde los MISMOS
 * datos verificados de la app (única fuente de verdad → idéntica al contenido
 * validado, cero invención).
 *
 * Diseño guiado por PSICOLOGÍA DEL COLOR para facilitar el entendimiento:
 *  - Color semántico CONSISTENTE (el usuario aprende el código):
 *      AZUL  = pasos a seguir (calma, confianza, orden)
 *      ROJO  = lo que NO hacer (alto/peligro)
 *      NARANJA = cuándo llamar al 911 (urgencia/atención)
 *    Reforzado con SÍMBOLOS (número, ✕, ☎) y posición → también sirve para
 *    daltónicos (no depende solo del color).
 *  - Color de IDENTIDAD por categoría (reconocimiento/navegación) con degradado.
 *  - Pasos como MAPA visual: círculos numerados grandes unidos por una guía.
 *  - Letras grandes, iconos propios de la app, leyenda del código en la portada.
 *  - Fuente oficial citada en cada guía + bibliografía completa.
 *
 *   npx tsx scripts/gen-guide-pdf.ts   → static/guia-primeros-auxilios-faro-ve.pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import {
  CATEGORIES,
  CONTACTS,
  SOURCES,
  DISCLAIMER,
  PROCEDURE_COUNT
} from '../src/lib/data/auxilio/index';

const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const fecha = new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });

// ── Paleta por categoría (psicología del color) ─────────────────────────────
type Pal = { g1: string; g2: string; bar: string; soft: string };
const PALETTE: Record<string, Pal> = {
  // Azul faro: confianza, calma, atención médica.
  'primeros-auxilios': { g1: '#0B4F6C', g2: '#1789a6', bar: '#0B4F6C', soft: '#e8f3f8' },
  // Verde: salud, seguridad, prevención.
  'salud-prevencion': { g1: '#15803d', g2: '#37a96d', bar: '#15803d', soft: '#e9f7ef' },
  // Ámbar/tierra: sismo, preparación, alerta serena.
  'sismo-supervivencia': { g1: '#b06a09', g2: '#dd9b1f', bar: '#b06a09', soft: '#fdf4e4' }
};
const PAL_CONTACT: Pal = { g1: '#b42318', g2: '#e0584c', bar: '#b42318', soft: '#fdeceb' };
const PAL_BIB: Pal = { g1: '#475569', g2: '#74859a', bar: '#475569', soft: '#eef1f5' };
const palOf = (id: string): Pal => PALETTE[id] ?? PAL_BIB;

// ── Iconos: se extraen de AuxilioIcon.svelte (misma fuente que la app) ──────
const iconSrc = fs.readFileSync(path.join(process.cwd(), 'src/lib/components/AuxilioIcon.svelte'), 'utf8');
const ICONS: Record<string, string> = {};
const reIcon = /\{(?::else )?#?if name === "([^"]+)"\}([\s\S]*?)(?=\{:else if name ===|\{:else\}|\{\/if\})/g;
let mm: RegExpExecArray | null;
while ((mm = reIcon.exec(iconSrc))) {
  ICONS[mm[1]] = mm[2].replace(/<!--[\s\S]*?-->/g, '').trim();
}
function iconSvg(id: string, color: string, size: number): string {
  const inner = ICONS[id];
  if (!inner) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const stepsHtml = (items: string[]): string =>
  `<div class="steps">${items
    .map(
      (t, i) =>
        `<div class="step"><div class="rail"><div class="dot">${i + 1}</div>${i < items.length - 1 ? '<div class="line"></div>' : ''}</div><div class="step-t">${esc(t)}</div></div>`
    )
    .join('')}</div>`;

const marks = (items: string[], cls: string, sym: string): string =>
  items.map((t) => `<div class="mark ${cls}"><span class="sym">${sym}</span><span>${esc(t)}</span></div>`).join('');

function sourceBlock(ids: string[]): string {
  const seen = new Set<string>();
  const rows = ids
    .map((id) => SOURCES[id])
    .filter((s): s is NonNullable<typeof s> => !!s && !seen.has(s.id) && seen.add(s.id) !== undefined)
    .map((s) => `<div class="src"><b>${esc(s.org)}</b> — ${esc(s.title)}<br><span class="url">${esc(s.url)}</span></div>`)
    .join('');
  return `<div class="sources"><div class="sources-h">Fuente${ids.length > 1 ? 's' : ''} oficial${ids.length > 1 ? 'es' : ''}:</div>${rows}</div>`;
}

const sectionHeader = (g1: string, g2: string, icon: string, title: string): string =>
  `<h2 style="background:linear-gradient(135deg,${g1},${g2})">${icon}<span>${title}</span></h2>`;

let n = 0;
const categoriesHtml = CATEGORIES.map((cat) => {
  const pal = palOf(cat.id);
  const procs = cat.procedures
    .map((p) => {
      n++;
      return `
      <section class="proc" style="border-left-color:${pal.bar}">
        <div class="proc-head">
          <span class="proc-icon" style="background:${pal.soft}">${iconSvg(p.id, pal.bar, 30) || `<span class="proc-num" style="color:${pal.bar}">${n}</span>`}</span>
          <h3 style="color:${pal.bar}">${esc(p.title)}</h3>
        </div>
        ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
        <div class="sec-h pasos">Sigue estos pasos, en orden</div>
        ${stepsHtml(p.steps)}
        ${p.dont && p.dont.length ? `<div class="box box-dont"><div class="sec-h dont">Qué NO hacer</div>${marks(p.dont, 'is-dont', '✕')}</div>` : ''}
        ${p.callEmergency && p.callEmergency.length ? `<div class="box box-call"><div class="sec-h call">Llama YA al 911 si…</div>${marks(p.callEmergency, 'is-call', '☎')}</div>` : ''}
        ${sourceBlock(p.sources)}
      </section>`;
    })
    .join('');
  return `<div class="category">
      ${sectionHeader(pal.g1, pal.g2, iconSvg(cat.id, '#ffffff', 26), esc(cat.title))}
      ${cat.intro ? `<p class="cat-intro">${esc(cat.intro)}</p>` : ''}
      ${procs}
    </div>`;
}).join('');

const verified = CONTACTS.filter((c) => c.tier === 'verified');
const unverified = CONTACTS.filter((c) => c.tier !== 'verified');
const contactsHtml = `<div class="category">
    ${sectionHeader(PAL_CONTACT.g1, PAL_CONTACT.g2, iconSvg('nacional-emergencia', '#ffffff', 26), 'Contactos de emergencia')}
    <p class="cat-intro">Ante cualquier emergencia llama primero al <b>911</b>. Solo los contactos verificados muestran número marcable; un número errado cuesta vidas.</p>
    <div class="sec-h pasos">Verificados (puedes llamar)</div>
    ${verified
      .map(
        (c) => `<div class="contact"><b>${esc(c.name)}</b>${c.searchPersons ? ' · personas desaparecidas' : ''}<br>${c.dial.map((d) => `<span class="tel">${esc(d.label)}: ${esc(d.tel)}</span>`).join(' · ')}${c.zone ? `<br><span class="muted">${esc(c.zone)}</span>` : ''}${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ''}</div>`
      )
      .join('')}
    ${
      unverified.length
        ? `<div class="box box-dont"><div class="sec-h dont">Sin verificar — no llames a ciegas, usa el 911</div>
    ${unverified
      .map(
        (c) => `<div class="contact"><b>${esc(c.name)}</b>${c.unverifiedPhone ? ` — ${esc(c.unverifiedPhone)} <span class="muted">(sin verificar)</span>` : ''}${c.zone ? `<br><span class="muted">${esc(c.zone)}</span>` : ''}${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ''}</div>`
      )
      .join('')}</div>`
        : ''
    }
  </div>`;

const biblio = Object.values(SOURCES)
  .sort((a, b) => a.org.localeCompare(b.org))
  .map((s) => `<div class="biblio-item"><b>${esc(s.org)}</b> — ${esc(s.title)}<br><span class="url">${esc(s.url)}</span></div>`)
  .join('');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 14mm 13mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d2b33; font-size: 12.5pt; line-height: 1.5; margin: 0; }

  /* Portada */
  .cover { height: 252mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always;
           background: radial-gradient(120% 60% at 50% 12%, #eef7fb 0%, #ffffff 60%); border-radius: 0; }
  .cover h1 { font-size: 34pt; color: #0B4F6C; margin: 10px 0 4px; line-height: 1.04; }
  .cover .sub { font-size: 15pt; color: #334e5c; }
  .cover .count { font-size: 14pt; color: #0B4F6C; font-weight: 800; margin-top: 16px; }
  .cover .meta { font-size: 11pt; color: #5b6b73; margin-top: 4px; }
  .disclaimer { border: 2px solid #f0c000; background: linear-gradient(135deg,#fffdf2,#fff6da); border-radius: 12px; padding: 14px 18px; font-size: 11pt; color: #5b4b00; max-width: 156mm; margin: 20px auto 0; }
  .share { margin-top: 14px; font-size: 12.5pt; color: #0B4F6C; font-weight: 800; }
  /* Leyenda del código de color (enseña a decodificar) */
  .legend { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 18px; }
  .legend .chip { display: flex; align-items: center; gap: 8px; font-size: 11pt; font-weight: 700; padding: 7px 14px; border-radius: 999px; }
  .legend .lg { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 11pt; }
  .legend .c-blue { background: #e8f3f8; color: #0B4F6C; }  .legend .c-blue .lg { background: linear-gradient(135deg,#0B4F6C,#0d6e8c); }
  .legend .c-red  { background: #fdeceb; color: #b42318; }  .legend .c-red .lg  { background: #b42318; }
  .legend .c-or   { background: #fdf0e1; color: #b54708; }  .legend .c-or .lg   { background: #d97706; }

  /* Encabezado de categoría con degradado de identidad */
  h2 { font-size: 20pt; color: #fff; padding: 11px 16px; border-radius: 12px; margin: 0 0 10px; display: flex; align-items: center; gap: 10px; page-break-after: avoid; box-shadow: 0 1px 0 rgba(0,0,0,.04); }
  /* Las categorías FLUYEN (sin forzar página nueva) → sin hojas blancas. El
     encabezado de color separa visualmente; page-break-after:avoid lo mantiene
     con su contenido. */
  .category { margin-top: 18px; }
  .cat-intro { color: #44525a; font-size: 11.5pt; margin: 0 0 14px; }

  /* Tarjeta de procedimiento: SÍ puede partirse entre páginas (evita huecos
     blancos). Solo los pasos/ítems individuales no se parten (abajo). */
  .proc { background: #fff; border: 1.5px solid #e6edf1; border-left: 6px solid #0B4F6C; border-radius: 12px; padding: 14px 16px 12px; margin: 0 0 14px; }
  .proc-head { display: flex; align-items: center; gap: 12px; margin-bottom: 2px; page-break-inside: avoid; page-break-after: avoid; }
  .proc-icon { flex: none; width: 48px; height: 48px; border-radius: 13px; display: flex; align-items: center; justify-content: center; }
  .proc-num { font-size: 17pt; font-weight: 800; }
  .proc h3 { font-size: 15.5pt; margin: 0; line-height: 1.15; }
  .summary { color: #44525a; font-size: 11.5pt; margin: 5px 0 10px; }

  /* Etiquetas de sección como píldoras de color */
  .sec-h { display: inline-block; font-weight: 800; font-size: 11pt; padding: 4px 13px; border-radius: 999px; margin: 12px 0 8px; page-break-after: avoid; }
  .sec-h.pasos { background: #e3f1f7; color: #0B6E8C; }
  .sec-h.dont  { background: #fadbd8; color: #a31810; margin-top: 0; }
  .sec-h.call  { background: #fbdcc0; color: #9a3a06; margin-top: 0; }

  /* Mapa de pasos: círculos numerados grandes unidos por una guía */
  .steps { margin: 2px 0 4px; }
  .step { display: flex; gap: 14px; align-items: stretch; page-break-inside: avoid; }
  .rail { flex: none; width: 36px; display: flex; flex-direction: column; align-items: center; }
  .dot { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#0B4F6C,#0d7290); color: #fff; font-weight: 800; font-size: 16pt; display: flex; align-items: center; justify-content: center; flex: none; box-shadow: 0 1px 2px rgba(11,79,108,.3); }
  .line { width: 3px; flex: 1; min-height: 10px; background: linear-gradient(#9fc8d8,#cfe2ea); margin: 3px 0; border-radius: 2px; }
  .step-t { font-size: 12.5pt; line-height: 1.45; padding: 7px 0 13px; }

  /* Cajas semánticas */
  .box { border-radius: 12px; padding: 10px 14px 12px; margin: 12px 0 4px; }
  .box-dont { background: linear-gradient(135deg,#fdeeed,#fbe1df); border: 1.5px solid #f3c2bd; }
  .box-call { background: linear-gradient(135deg,#fff3e8,#ffe7d3); border: 1.5px solid #f3c79a; }
  .mark { display: flex; gap: 10px; align-items: flex-start; font-size: 12pt; padding: 4px 0; page-break-inside: avoid; }
  .mark .sym { flex: none; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12pt; color: #fff; }
  .is-dont .sym { background: #c0392b; }
  .is-call .sym { background: #d97706; }

  .sources { margin-top: 12px; border-top: 1.5px dashed #cdd9df; padding-top: 8px; }
  .sources-h { font-size: 9.5pt; font-weight: 800; color: #5b6b73; text-transform: uppercase; letter-spacing: .03em; }
  .src { font-size: 9.5pt; color: #3a4a52; margin-top: 4px; }
  .url { color: #0B6E8C; font-size: 9pt; word-break: break-all; }

  .contact { margin: 8px 0; font-size: 12pt; }
  .tel { color: #0B4F6C; font-weight: 700; }
  .muted { color: #6b7780; font-size: 10.5pt; }
  .biblio-item { font-size: 10pt; margin: 7px 0; color: #3a4a52; }
</style></head>
<body>
  <div class="cover">
    <svg width="130" height="130" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="23" fill="#FFF3CC"/>
      <circle cx="24" cy="24" r="15" fill="#0B4F6C"/>
      <circle cx="24" cy="24" r="15" fill="none" stroke="#FFE9A8" stroke-width="1.6"/>
      <rect x="21" y="13.5" width="6" height="21" rx="2.4" fill="#fff"/>
      <rect x="13.5" y="21" width="21" height="6" rx="2.4" fill="#fff"/>
    </svg>
    <h1>Guía de Primeros<br>Auxilios y Emergencias</h1>
    <div class="sub">Faro VE — Mapa de Esperanza · Venezuela</div>
    <div class="count">${PROCEDURE_COUNT} guías paso a paso · fáciles de seguir</div>
    <div class="meta">Información de fuentes oficiales: IFRC/Cruz Roja · AHA · OMS · CDC · OPS · UNICEF · Mayo Clinic · FUNVISIS</div>
    <div class="meta">Actualizada el ${esc(fecha)} · faro-ve.com</div>
    <div class="legend">
      <span class="chip c-blue"><span class="lg">1</span> Pasos a seguir</span>
      <span class="chip c-red"><span class="lg">✕</span> Lo que NO hacer</span>
      <span class="chip c-or"><span class="lg">☎</span> Cuándo llamar al 911</span>
    </div>
    <div class="disclaimer">${esc(DISCLAIMER)}</div>
    <div class="share">Comparte esta guía libremente. Puede ayudar a salvar una vida.</div>
  </div>

  ${categoriesHtml}
  ${contactsHtml}

  <div class="category">
    ${sectionHeader(PAL_BIB.g1, PAL_BIB.g2, iconSvg('info', '#ffffff', 26), 'Fuentes oficiales (bibliografía)')}
    <p class="cat-intro">Todo el contenido se curó de estas fuentes oficiales y científicas. No reemplaza la atención de un profesional de salud.</p>
    ${biblio}
  </div>
</body></html>`;

const tmpHtml = process.env.HTML_OUT || path.join(process.cwd(), '.svelte-kit', 'guia-tmp.html');
fs.mkdirSync(path.dirname(tmpHtml), { recursive: true });
fs.writeFileSync(tmpHtml, html);

const outPdf = path.join(process.cwd(), 'static', 'guia-primeros-auxilios-faro-ve.pdf');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmpHtml, { waitUntil: 'load' });
await page.pdf({
  path: outPdf,
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '18mm', left: '13mm', right: '13mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:7pt;color:#8a969d;padding:0 13mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;"><span>Faro VE · faro-ve.com · En revisión — no reemplaza atención profesional</span><span class="pageNumber"></span>/<span class="totalPages"></span></div>'
});
await browser.close();

const kb = Math.round(fs.statSync(outPdf).size / 1024);
const withIcon = CATEGORIES.flatMap((c) => c.procedures).filter((p) => ICONS[p.id]).length;
console.log(`PDF: ${outPdf} (${kb} KB) · ${PROCEDURE_COUNT} guías · ${withIcon} con ícono · ${Object.keys(SOURCES).length} fuentes`);
if (!process.env.HTML_OUT) fs.rmSync(tmpHtml, { force: true });
