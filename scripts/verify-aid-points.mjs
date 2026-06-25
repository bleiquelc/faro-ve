#!/usr/bin/env node
/**
 * Faro VE — Gate de la capa de ayuda comunitaria (migración 0014).
 *
 * Corre supabase/tests/aid_points_community.test.sql DENTRO de una transacción y
 * hace ROLLBACK (no deja datos). Verifica: alta pública → auto-ocultar (net≥3) →
 * reactivar con WhatsApp cifrado → reseteo del net → re-ocultar → privacidad.
 *
 * Uso:  DATABASE_URL="postgresql://...:5432/postgres" node scripts/verify-aid-points.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  // extensions en el path → pgp_sym_decrypt / get_app_salt resuelven.
  await client.query('set search_path = public, extensions');

  const sql = readFileSync(
    join(__dirname, '..', 'supabase', 'tests', 'aid_points_community.test.sql'),
    'utf8'
  );

  let pass = false;
  let detail = '';
  try {
    await client.query('begin');
    await client.query(sql); // lanza si alguna aserción falla
    pass = true;
    detail = 'alta → auto-ocultar(net≥3) → reactivar(cifrado) → reset → re-ocultar → privacidad';
  } catch (e) {
    detail = e.message.split('\n')[0];
  } finally {
    await client.query('rollback'); // no dejar datos de prueba
  }

  console.log('\n═══════ GATE capa de ayuda (0014) ═══════');
  console.log(`${pass ? '✅' : '❌'} aid_points_community — ${detail}`);
  console.log('═════════════════════════════════════════');
  console.log(pass ? '🟢 GATE 0014: PASS' : '🔴 GATE 0014: FAIL');
  await client.end();
  process.exit(pass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await client.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
