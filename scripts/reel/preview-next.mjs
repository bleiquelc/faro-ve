/**
 * Vista previa de los próximos Reels diarios (versículo + tema de fondo), usando
 * la MISMA rotación por día que make-reel/footage. Solo lectura, no genera nada.
 *   N=8 node scripts/reel/preview-next.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QUERIES } from './footage.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const msgs = JSON.parse(fs.readFileSync(path.join(HERE, 'messages.json'), 'utf8'));
const themes = {
  'Caracas Venezuela': 'Caracas', 'La Guaira Venezuela': 'La Guaira',
  'Venezuela landscape': 'paisaje de Venezuela', 'Avila mountain Caracas': 'el Ávila',
  'Caribbean sea calm': 'mar Caribe en calma', 'ocean sunrise calm': 'amanecer en el mar',
  'sea waves slow motion': 'olas suaves', 'tropical coast aerial': 'costa tropical (aérea)',
  'mountains sunrise clouds': 'montañas al amanecer', 'calm ocean horizon': 'horizonte del mar',
  'coast dawn': 'costa al alba', 'serene sea sky': 'mar y cielo sereno'
};

const N = Number(process.env.N || 8);
for (let k = 1; k <= N; k++) {
  const d = new Date(Date.now() + k * 864e5);
  const doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 7) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5);
  const m = msgs[doy % msgs.length];
  const q = QUERIES[doy % QUERIES.length];
  const fecha = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  console.log(`\n${fecha[0].toUpperCase() + fecha.slice(1)} · 16:00`);
  console.log(`  “${m.text}” — ${m.ref}`);
  console.log(`  fondo: ${themes[q] || q}`);
}
