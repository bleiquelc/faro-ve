/**
 * Footage de fondo para el Reel diario, desde Pexels (gratis, libre de derechos,
 * uso comercial OK). Busca video SERENO de Venezuela / mar / costa, ROTANDO la
 * búsqueda por día. Descarga el mejor portrait. Si no hay key o no hay resultados,
 * devuelve null → make-reel cae a la escena propia (siempre funciona).
 *
 * Key (gratis): https://www.pexels.com/api/  →  ~/.secrets/faro-ve/pexels-key.txt
 * Licencia Pexels: atribución no obligatoria, pero la incluimos en el caption.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const KEYFILE = path.join(os.homedir(), '.secrets', 'faro-ve', 'pexels-key.txt');

function pexelsKey() {
  try { return (process.env.PEXELS_KEY || fs.readFileSync(KEYFILE, 'utf8')).trim(); }
  catch { return ''; }
}

// Venezuela primero; luego respaldos serenos (mar/costa/montaña/amanecer).
const QUERIES = [
  'Caracas Venezuela', 'La Guaira Venezuela', 'Venezuela landscape', 'Avila mountain Caracas',
  'Caribbean sea calm', 'ocean sunrise calm', 'sea waves slow motion', 'tropical coast aerial',
  'mountains sunrise clouds', 'calm ocean horizon', 'coast dawn', 'serene sea sky'
];

export async function getFootage(workDir, dayIndex) {
  const key = pexelsKey();
  if (!key) return null;
  const query = process.env.FOOTAGE_QUERY || QUERIES[dayIndex % QUERIES.length];
  let data;
  try {
    const r = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&size=medium&per_page=15`,
      { headers: { Authorization: key } }
    );
    data = await r.json();
  } catch { return null; }

  const vids = (data.videos || []).filter((v) => v.height > v.width); // solo portrait
  if (!vids.length) return null;
  const v = vids[dayIndex % vids.length];

  const files = (v.video_files || []).filter((f) => f.file_type === 'video/mp4');
  // preferir resolución >= 1280 de alto (la más chica que cumpla); si no, la más grande.
  const pick = files.filter((f) => (f.height || 0) >= 1280).sort((a, b) => a.height - b.height)[0]
    || files.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
  if (!pick) return null;

  const out = path.join(workDir, 'bgvideo.mp4');
  try {
    const resp = await fetch(pick.link);
    fs.writeFileSync(out, Buffer.from(await resp.arrayBuffer()));
  } catch { return null; }

  return { path: out, credit: `Video: ${v.user?.name || 'Pexels'} · Pexels`, query, url: v.url };
}
