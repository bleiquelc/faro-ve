/**
 * Genera la GUÍA PDF descargable/distribuible de Faro Auxilio desde los MISMOS
 * datos verificados de la app (única fuente de verdad → el PDF es idéntico al
 * contenido validado). Cada procedimiento muestra su FUENTE oficial + hay una
 * bibliografía completa al final. Cero invención: solo renderiza los datos.
 *
 *   npx tsx scripts/gen-guide-pdf.ts
 *   → static/guia-primeros-auxilios-faro-ve.pdf
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

const fecha = new Date().toLocaleDateString('es-VE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const li = (items: string[] | undefined): string =>
  (items ?? []).map((t) => `<li>${esc(t)}</li>`).join('');

function sourceBlock(ids: string[]): string {
  const seen = new Set<string>();
  const rows = ids
    .map((id) => SOURCES[id])
    .filter((s): s is NonNullable<typeof s> => !!s && !seen.has(s.id) && seen.add(s.id) !== undefined)
    .map((s) => `<div class="src"><b>${esc(s.org)}</b> — ${esc(s.title)}<br><span class="url">${esc(s.url)}</span></div>`)
    .join('');
  return `<div class="sources"><div class="sources-h">Fuente${ids.length > 1 ? 's' : ''} oficial${ids.length > 1 ? 'es' : ''}:</div>${rows}</div>`;
}

let n = 0;
const categoriesHtml = CATEGORIES.map((cat) => {
  const procs = cat.procedures
    .map((p) => {
      n++;
      return `
      <section class="proc">
        <h3><span class="num">${n}</span> ${esc(p.title)}</h3>
        ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
        <div class="block"><div class="block-h pasos">Pasos</div><ol>${li(p.steps)}</ol></div>
        ${p.dont && p.dont.length ? `<div class="block"><div class="block-h dont">Qué NO hacer</div><ul>${li(p.dont)}</ul></div>` : ''}
        ${p.callEmergency && p.callEmergency.length ? `<div class="block"><div class="block-h call">Cuándo llamar al 911</div><ul>${li(p.callEmergency)}</ul></div>` : ''}
        ${sourceBlock(p.sources)}
      </section>`;
    })
    .join('');
  return `
    <div class="category">
      <h2>${esc(cat.title)}</h2>
      ${cat.intro ? `<p class="cat-intro">${esc(cat.intro)}</p>` : ''}
      ${procs}
    </div>`;
}).join('');

const verified = CONTACTS.filter((c) => c.tier === 'verified');
const unverified = CONTACTS.filter((c) => c.tier !== 'verified');
const contactsHtml = `
  <div class="category">
    <h2>Contactos de emergencia</h2>
    <p class="cat-intro">Ante cualquier emergencia, llama primero al <b>911</b>. Solo los contactos verificados muestran número marcable; un número errado cuesta vidas.</p>
    <div class="block"><div class="block-h pasos">Verificados</div>
      ${verified
        .map(
          (c) => `<div class="contact"><b>${esc(c.name)}</b>${c.searchPersons ? ' · personas desaparecidas' : ''}<br>
          ${c.dial.map((d) => `<span class="tel">${esc(d.label)}: ${esc(d.tel)}</span>`).join(' · ')}
          ${c.zone ? `<br><span class="muted">${esc(c.zone)}</span>` : ''}${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ''}</div>`
        )
        .join('')}
    </div>
    ${
      unverified.length
        ? `<div class="block"><div class="block-h dont">Sin verificar (no llamar a ciegas — usa el 911)</div>
      ${unverified
        .map(
          (c) => `<div class="contact"><b>${esc(c.name)}</b>${c.unverifiedPhone ? ` — ${esc(c.unverifiedPhone)} <span class="muted">(sin verificar)</span>` : ''}${c.zone ? `<br><span class="muted">${esc(c.zone)}</span>` : ''}${c.note ? `<br><span class="muted">${esc(c.note)}</span>` : ''}</div>`
        )
        .join('')}
    </div>`
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
  @page { size: A4; margin: 16mm 14mm 20mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2933; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  .cover { height: 247mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
  .cover .logo { margin-bottom: 14px; }
  .cover h1 { font-size: 30pt; color: #0B4F6C; margin: 6px 0; line-height: 1.05; }
  .cover .sub { font-size: 13pt; color: #334e5c; margin: 2px 0; }
  .cover .meta { font-size: 10pt; color: #5b6b73; margin-top: 8px; }
  .cover .count { font-size: 12pt; color: #0B4F6C; font-weight: 700; margin-top: 16px; }
  .disclaimer { border: 1.5px solid #f0c000; background: #fffbe8; border-radius: 10px; padding: 12px 16px; font-size: 9.5pt; color: #5b4b00; max-width: 150mm; margin: 18px auto 0; }
  .share { margin-top: 14px; font-size: 10.5pt; color: #0B4F6C; font-weight: 600; }
  h2 { font-size: 17pt; color: #fff; background: #0B4F6C; padding: 8px 12px; border-radius: 8px; margin: 0 0 8px; page-break-after: avoid; }
  .category { page-break-before: always; }
  .cat-intro { color: #475259; font-size: 10pt; margin: 0 0 10px; }
  .proc { page-break-inside: avoid; border: 1px solid #e3eaee; border-radius: 10px; padding: 10px 14px; margin: 0 0 10px; }
  .proc h3 { font-size: 12.5pt; color: #0B4F6C; margin: 0 0 4px; }
  .num { display: inline-block; min-width: 22px; height: 22px; line-height: 22px; text-align: center; background: #0B4F6C; color: #fff; border-radius: 50%; font-size: 9.5pt; margin-right: 6px; }
  .summary { color: #475259; font-size: 9.8pt; margin: 0 0 8px; }
  .block { margin: 7px 0; }
  .block-h { font-weight: 700; font-size: 9.5pt; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 2px; }
  .block-h.pasos { color: #0B4F6C; }
  .block-h.dont { color: #b42318; }
  .block-h.call { color: #b54708; }
  ol, ul { margin: 2px 0 2px 0; padding-left: 20px; }
  li { margin: 2px 0; }
  .sources { margin-top: 8px; border-top: 1px dashed #cdd9df; padding-top: 6px; }
  .sources-h { font-size: 8.5pt; font-weight: 700; color: #5b6b73; text-transform: uppercase; letter-spacing: .03em; }
  .src { font-size: 8.6pt; color: #3a4a52; margin-top: 3px; }
  .url { color: #0B6E8C; font-size: 8pt; word-break: break-all; }
  .contact { margin: 6px 0; font-size: 10pt; }
  .tel { color: #0B4F6C; font-weight: 600; }
  .muted { color: #6b7780; font-size: 9pt; }
  .biblio-item { font-size: 8.8pt; margin: 5px 0; color: #3a4a52; }
</style></head>
<body>
  <div class="cover">
    <div class="logo">
      <svg width="120" height="120" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFF3CC"/>
        <circle cx="24" cy="24" r="15" fill="#0B4F6C"/>
        <circle cx="24" cy="24" r="15" fill="none" stroke="#FFE9A8" stroke-width="1.6"/>
        <rect x="21" y="13.5" width="6" height="21" rx="2.4" fill="#fff"/>
        <rect x="13.5" y="21" width="21" height="6" rx="2.4" fill="#fff"/>
      </svg>
    </div>
    <h1>Guía de Primeros<br>Auxilios y Emergencias</h1>
    <div class="sub">Faro VE — Mapa de Esperanza · Venezuela</div>
    <div class="count">${PROCEDURE_COUNT} guías paso a paso · información de fuentes oficiales</div>
    <div class="meta">IFRC/Cruz Roja · AHA · OMS · CDC · OPS · UNICEF · Mayo Clinic · FUNVISIS/Protección Civil</div>
    <div class="meta">Actualizada el ${esc(fecha)} · faro-ve.com</div>
    <div class="disclaimer">${esc(DISCLAIMER)}</div>
    <div class="share">Comparte esta guía libremente. Puede ayudar a salvar una vida.</div>
  </div>

  ${categoriesHtml}
  ${contactsHtml}

  <div class="category">
    <h2>Fuentes oficiales (bibliografía)</h2>
    <p class="cat-intro">Todo el contenido de esta guía se curó de estas fuentes oficiales y científicas. No reemplaza la atención de un profesional de salud.</p>
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
  margin: { top: '16mm', bottom: '20mm', left: '14mm', right: '14mm' },
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate:
    '<div style="width:100%;font-size:7pt;color:#8a969d;padding:0 14mm;display:flex;justify-content:space-between;font-family:Helvetica,Arial,sans-serif;"><span>Faro VE · faro-ve.com · En revisión — no reemplaza atención profesional</span><span class="pageNumber"></span>/<span class="totalPages"></span></div>'
});
await browser.close();

const kb = Math.round(fs.statSync(outPdf).size / 1024);
console.log(`PDF generado: ${outPdf} (${kb} KB) · ${PROCEDURE_COUNT} guías · ${Object.keys(SOURCES).length} fuentes`);
if (!process.env.HTML_OUT) fs.rmSync(tmpHtml, { force: true });
