/**
 * Paso 2 — prueba UNA publicación a Instagram vía Buffer (toda la cadena).
 * La key se lee del entorno; nada de secretos en el código ni en el chat.
 *
 * Correr:
 *   BUFFER_API_KEY="tu_key" \
 *   CHANNEL_ID="el_channelId_de_IG" \
 *   IMG_URL="https://url-publica-de-una-imagen.jpg" \
 *   node scripts/buffer/buffer-test-post.mjs
 *
 * Notas:
 * - IMG_URL debe ser PÚBLICA (Buffer la descarga). Para la prueba sirve cualquier
 *   imagen pública; en producción será la ficha PNG hospedada (R2/Supabase).
 * - schedulingType:automatic => Buffer publica solo (requiere IG Business conectado).
 *   Si tu IG es personal, Buffer solo manda "recordatorio" (notification).
 * - mode:addToQueue => entra al próximo hueco de tu cola de Buffer.
 */
const KEY = process.env.BUFFER_API_KEY;
const CH = process.env.CHANNEL_ID;
const IMG = process.env.IMG_URL;
if (!KEY || !CH || !IMG) {
  console.error('Faltan envs. Necesito BUFFER_API_KEY, CHANNEL_ID, IMG_URL.');
  process.exit(1);
}

const mutation = `
mutation {
  createPost(input: {
    text: "Prueba Faro VE — ficha de prueba (se puede borrar).",
    channelId: "${CH}",
    schedulingType: automatic,
    mode: addToQueue,
    assets: [{ image: { url: "${IMG}", metadata: { altText: "Ficha de prueba Faro VE" } } }],
    metadata: { instagram: { type: post, shouldShareToFeed: true } }
  }) {
    ... on PostActionSuccess { post { id text } }
    ... on MutationError { message }
  }
}`;

const r = await fetch('https://api.buffer.com', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: mutation })
});
console.log(JSON.stringify(await r.json(), null, 2));
