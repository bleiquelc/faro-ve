/**
 * Paso 1 — descubre tu organizationId + el channelId de Instagram en Buffer.
 * La key NUNCA va en el código ni en el chat: se lee de la variable de entorno.
 *
 * Correr:   BUFFER_API_KEY="tu_key" node scripts/buffer/buffer-ids.mjs
 *
 * Si el campo `account { organizations }` da error, pegá el output (GraphQL
 * errors) y ajusto la query al nombre real del schema.
 */
const KEY = process.env.BUFFER_API_KEY;
if (!KEY) {
  console.error('Falta BUFFER_API_KEY. Corré:  BUFFER_API_KEY="..." node scripts/buffer/buffer-ids.mjs');
  process.exit(1);
}

async function gql(query) {
  const r = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  const j = await r.json();
  if (j.errors) console.error('GraphQL errors:\n', JSON.stringify(j.errors, null, 2));
  return j.data;
}

// 1) Organización
const orgs = await gql(`{ account { organizations { id name } } }`);
console.log('Organizaciones:\n', JSON.stringify(orgs, null, 2));
const orgId = orgs?.account?.organizations?.[0]?.id;
if (!orgId) {
  console.error('\nNo pude sacar orgId. Pegame el output de arriba y ajusto la query.');
  process.exit(1);
}

// 2) Canales → ubicar el de Instagram
const chans = await gql(
  `query { channels(input: { organizationId: "${orgId}" }) { id displayName service isQueuePaused } }`
);
console.log('\nCanales:\n', JSON.stringify(chans, null, 2));
const ig = (chans?.channels || []).find((c) => c.service === 'instagram');
console.log(
  ig
    ? `\n✅ organizationId: ${orgId}\n✅ Instagram channelId: ${ig.id}  (${ig.displayName})`
    : '\n⚠️ No hay canal Instagram conectado en Buffer todavía → conectalo primero en el dashboard.'
);
