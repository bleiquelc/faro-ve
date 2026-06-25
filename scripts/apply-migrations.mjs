#!/usr/bin/env node
/**
 * Faro VE — aplicador de migraciones idempotente.
 *
 * Lee supabase/migrations/*.sql en orden lexicográfico y las aplica contra
 * DATABASE_URL, cada archivo en su propia transacción. Registra lo aplicado en
 * la tabla _faro_migrations para poder re-correr sin duplicar.
 *
 * Uso:
 *   DATABASE_URL="postgresql://postgres.<ref>:<pass>@<pooler-host>:5432/postgres" \
 *     node scripts/apply-migrations.mjs
 *
 * Flags:
 *   --dry      lista qué se aplicaría sin ejecutar.
 *   --salt     setea app.salt en la DB (ALTER DATABASE ... SET app.salt) leyendo
 *              ~/.secrets/faro-ve/APP_SALT.txt — necesario para hash_email/encrypt.
 *
 * Nota: usar el puerto 5432 (session pooler) para DDL, NO el 6543 (transaction).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');
const DRY = process.argv.includes('--dry');
const SET_SALT = process.argv.includes('--salt');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL. Ej:');
  console.error(
    '  DATABASE_URL="postgresql://postgres.<ref>:<pass>@<host>:5432/postgres" node scripts/apply-migrations.mjs'
  );
  process.exit(1);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No hay migraciones en', MIGRATIONS_DIR);
  process.exit(1);
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  // Supabase requiere TLS; el pooler usa cert válido.
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log(`Conectado. ${files.length} migraciones encontradas.\n`);

  await client.query(`
    create table if not exists _faro_migrations (
      name text primary key,
      applied_at timestamptz not null default now(),
      checksum text
    );
  `);

  const { rows: applied } = await client.query('select name from _faro_migrations');
  const appliedSet = new Set(applied.map((r) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`⏭  ${file} (ya aplicada)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (DRY) {
      console.log(`📝 ${file} (${sql.split('\n').length} líneas) — DRY, no ejecutado`);
      continue;
    }
    process.stdout.write(`▶  ${file} ... `);
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _faro_migrations(name) values($1)', [file]);
      await client.query('commit');
      console.log('OK');
    } catch (err) {
      await client.query('rollback');
      console.log('FALLÓ');
      console.error(`\n❌ ${file}:\n${err.message}\n`);
      throw err;
    }
  }

  if (SET_SALT && !DRY) {
    const saltPath = join(homedir(), '.secrets', 'faro-ve', 'APP_SALT.txt');
    const salt = readFileSync(saltPath, 'utf8').trim();
    if (salt.length < 32) throw new Error('APP_SALT muy corto en ' + saltPath);
    // Guarda el salt en app_config (tabla privada). get_app_salt() lo lee.
    // (Supabase no permite ALTER DATABASE SET con el rol postgres.)
    await client.query(
      `insert into app_config(key, value) values('app_salt', $1)
       on conflict(key) do update set value = excluded.value, updated_at = now()`,
      [salt]
    );
    console.log(`\n🔑 app_salt guardado en app_config (longitud ${salt.length}).`);
  }

  console.log('\n✅ Migraciones aplicadas.');
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await client.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
