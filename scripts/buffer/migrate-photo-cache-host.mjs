/**
 * Migra el HOST de las claves del caché de fotos (~/.faro-ig/ai-cache.json, ns
 * "photo") cuando la fuente cambia de dominio. Misma imagen + mismo path = mismo
 * veredicto de visión: no se re-paga a Anthropic (misión-ley Art. 3).
 *
 *   node scripts/buffer/migrate-photo-cache-host.mjs            # DRY: solo cuenta
 *   node scripts/buffer/migrate-photo-cache-host.mjs --apply    # backup + escribe
 *   FROM=https://viejo TO=https://nuevo node … --apply          # otra mudanza
 *
 * Idempotente (re-correrlo mueve 0). Deja backup `ai-cache.json.bak-<fecha>` al lado.
 * Correrlo con el cron IG PAUSADO (`touch ~/.faro-ig/paused`): el caché se escribe
 * con read-modify-write y una corrida simultánea podría pisar el archivo.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { rehostCacheKeys } from '../lib/photo-cache-rehost.mjs';
import { BASE } from '../ingest/venezuela-te-busca-core.mjs';

const FILE = path.join(os.homedir(), '.faro-ig', 'ai-cache.json');
const FROM = process.env.FROM || 'https://venezuela-te-busca-app.hellogafaro.workers.dev';
const TO = process.env.TO || BASE;
const APPLY = process.argv.includes('--apply');

if (!fs.existsSync(FILE)) {
  console.error(`No existe ${FILE} — nada que migrar.`);
  process.exit(1);
}

let db;
try {
  db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  console.error(`No pude leer/parsear ${FILE}: ${e.message} — no toco nada.`);
  process.exit(1);
}

const { map, moved, kept, collisions } = rehostCacheKeys(db.photo, FROM, TO);
console.log(`${APPLY ? 'APPLY' : 'DRY'} · ${FROM} → ${TO}`);
console.log(`  photo: ${moved} claves a mover · ${kept} de otros hosts intactas · ${collisions} colisiones (gana la existente)`);

if (!APPLY) {
  console.log('  (dry) no se escribió nada. Agregá --apply para migrar.');
  process.exit(0);
}
if (!moved && !collisions) {
  console.log('  nada que migrar (ya estaba migrado).');
  process.exit(0);
}

const backup = `${FILE}.bak-${new Date().toISOString().slice(0, 10)}`;
if (!fs.existsSync(backup)) fs.copyFileSync(FILE, backup);
const tmp = `${FILE}.tmp-${process.pid}`;
fs.writeFileSync(tmp, JSON.stringify({ ...db, photo: map }));
fs.renameSync(tmp, FILE); // escritura atómica: nunca queda un JSON a medias
console.log(`  ✓ migrado. Backup: ${backup}`);
