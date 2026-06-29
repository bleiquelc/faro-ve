/**
 * Filtro de seguridad de FOTOS (Haiku 4.5 visión) — decide si una foto es PUBLICABLE
 * en un cartel de persona desaparecida. Bloquea cédulas, screenshots, fotos de grupo,
 * documentos y menores. SOLO se publica con foto limpia (regla del founder).
 *
 * CLI:   PHOTO_URL="https://..." node scripts/buffer/photo-filter.mjs
 * Módulo: import { classifyPhoto } from './photo-filter.mjs'
 *
 * Usa la key local (no en chat/repo) y Haiku (default barato, dentro del budget IA).
 */
import fs from 'fs';

const KEY = fs.readFileSync(process.env.HOME + '/.secrets/faro-ve/anthropic-key.txt', 'utf8').trim();
const MODEL = 'claude-haiku-4-5-20251001';

const PROMPT = `Eres un filtro de seguridad para una cuenta humanitaria. NOSOTROS generamos el cartel, así que necesitamos una FOTOGRAFÍA LIMPIA de la persona — NUNCA un cartel ya hecho ni una imagen con texto/datos. Analiza la imagen y responde SOLO con JSON válido:
{"usable": boolean, "kind": "photo|selfie|flyer|poster|id_document|screenshot|group|document|other", "faces": number, "has_minor": boolean, "has_text_overlay": boolean, "has_contact_or_id": boolean, "reason": "breve"}

usable=true SOLO si es una FOTOGRAFÍA limpia de UNA sola persona ADULTA donde se ve su cara, SIN texto sobreimpreso, SIN banners, SIN números, SIN marco de cartel.
usable=false si:
- es un CARTEL/FLYER de persona desaparecida (texto tipo "DESAPARECIDO", "SE BUSCA", "AYÚDANOS", "LOCALIZAR"), o CUALQUIER imagen con texto sobreimpreso o banners → has_text_overlay=true;
- contiene NÚMEROS de teléfono o de CÉDULA/identidad → has_contact_or_id=true;
- es documento de identidad / cédula / pasaporte / carnet;
- es un screenshot de chat o app;
- es una foto de GRUPO (más de una persona);
- aparece un MENOR de edad.
Sé MUY ESTRICTO: ante CUALQUIER texto encima de la imagen, número de contacto/cédula, o duda → usable=false. Preferimos descartar de más que exponer datos o publicar un cartel ajeno.`;

// Detecta el formato por los magic bytes (no por el content-type, que en esta
// fuente miente: sirve PNG con header webp). Anthropic exige el media_type correcto.
function sniffMedia(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

export async function classifyPhoto(url) {
  let r;
  try {
    r = await fetch(url);
  } catch (e) {
    return { usable: false, kind: 'unreachable', faces: 0, has_minor: false, reason: String(e.message || e) };
  }
  if (!r.ok) return { usable: false, kind: 'unreachable', faces: 0, has_minor: false, reason: `HTTP ${r.status}` };
  const buf = Buffer.from(await r.arrayBuffer());
  const media = sniffMedia(buf); // por los BYTES reales (el header miente: dice webp pero son png)
  if (!media) return { usable: false, kind: 'not_image', faces: 0, has_minor: false, reason: 'formato no reconocido' };
  const b64 = buf.toString('base64');

  let j;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: media, data: b64 } },
          { type: 'text', text: PROMPT }
        ] }]
      })
    });
    j = await resp.json();
  } catch (e) {
    return { usable: false, kind: 'error', faces: 0, has_minor: false, reason: 'fetch: ' + (e.message || e) };
  }
  if (j.error) return { usable: false, kind: 'error', faces: 0, has_minor: false, reason: j.error.message };
  const txt = (j.content?.[0]?.text || '').trim();
  const m = txt.match(/\{[\s\S]*\}/);
  try {
    const out = JSON.parse(m ? m[0] : txt);
    const badKind = ['flyer', 'poster', 'id_document', 'screenshot', 'group', 'document'].includes(out.kind);
    // usable real = el modelo dijo usable Y nada de: menor, texto sobreimpreso, contacto/cédula, tipo malo.
    const usable = !!out.usable && !out.has_minor && !out.has_text_overlay && !out.has_contact_or_id && !badKind;
    return {
      usable, kind: out.kind || 'other', faces: out.faces ?? 0,
      has_minor: !!out.has_minor, has_text_overlay: !!out.has_text_overlay, has_contact_or_id: !!out.has_contact_or_id,
      reason: out.reason || ''
    };
  } catch {
    return { usable: false, kind: 'parse_error', faces: 0, has_minor: false, reason: txt.slice(0, 140) };
  }
}

if (process.env.PHOTO_URL) {
  console.log(JSON.stringify(await classifyPhoto(process.env.PHOTO_URL)));
}
