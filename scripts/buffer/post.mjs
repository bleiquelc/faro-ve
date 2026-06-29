/**
 * Publica UNA ficha en Instagram (@farovenmap) vía Buffer GraphQL.
 * La key se lee del entorno; nada de secretos en código/chat.
 *
 *   BUFFER_API_KEY="$(cat ~/.secrets/faro-ve/buffer-key.txt)" \
 *   CHANNEL_ID="6a4190975ab6d2f106819d3d" \
 *   IMG_URL="https://.../ficha.jpg" \
 *   TEXT_FILE="ruta/al/caption.txt" \
 *   WHEN_MIN=4 \                # opcional: publica en N minutos (customScheduled). Sin esto → addToQueue.
 *   node scripts/buffer/post.mjs
 */
import fs from 'fs';

const KEY = process.env.BUFFER_API_KEY;
const CH = process.env.CHANNEL_ID;
// IMG_URLS (coma-separadas) = CARRUSEL; IMG_URL = una sola imagen.
const IMGS = (process.env.IMG_URLS || process.env.IMG_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
const TEXT = process.env.TEXT_FILE ? fs.readFileSync(process.env.TEXT_FILE, 'utf8') : process.env.TEXT;
if (!KEY || !CH || !IMGS.length || !TEXT) {
  console.error('Faltan envs: BUFFER_API_KEY, CHANNEL_ID, IMG_URL|IMG_URLS, TEXT_FILE|TEXT');
  process.exit(1);
}

const whenMin = Number(process.env.WHEN_MIN || 0);
const sched =
  whenMin > 0
    ? `schedulingType: automatic, mode: customScheduled, dueAt: "${new Date(Date.now() + whenMin * 60000).toISOString()}"`
    : `schedulingType: automatic, mode: addToQueue`;

// JSON.stringify escapa el texto (saltos de línea, comillas, emojis) de forma segura.
const input = `{
  text: ${JSON.stringify(TEXT)},
  channelId: ${JSON.stringify(CH)},
  ${sched},
  assets: [${IMGS.map((u, i) => `{ image: { url: ${JSON.stringify(u)}, metadata: { altText: "Faro VE ${i + 1}" } } }`).join(', ')}],
  metadata: { instagram: { type: post, shouldShareToFeed: true } }
}`;
const query = `mutation { createPost(input: ${input}) {
  ... on PostActionSuccess { post { id text dueAt } }
  ... on MutationError { message }
} }`;

const r = await fetch('https://api.buffer.com', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
});
console.log(JSON.stringify(await r.json(), null, 2));
console.log(whenMin > 0 ? `\n→ programada para publicarse en ~${whenMin} min` : '\n→ agregada a la cola de Buffer');
