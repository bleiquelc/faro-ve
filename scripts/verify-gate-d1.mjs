#!/usr/bin/env node
/**
 * Faro VE — Gate Día 1: verificación contra el Supabase real.
 * Uso: DATABASE_URL="..." node scripts/verify-gate-d1.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const results = [];
const ok = (name, pass, detail) => results.push({ name, pass, detail });

async function main() {
  await client.connect();

  // 1. Organizaciones verificadas >= 5
  {
    const { rows } = await client.query(
      "select count(*)::int n from organizations where verified = true"
    );
    ok('orgs verificadas >= 5', rows[0].n >= 5, `${rows[0].n} verificadas`);
  }

  // 2. anchor_places sembradas
  {
    const { rows } = await client.query('select count(*)::int n from anchor_places');
    ok('anchor_places > 50', rows[0].n > 50, `${rows[0].n} lugares`);
  }

  // 3. obfuscate_point: distinto + dentro de 200-500m
  {
    const { rows } = await client.query(`
      select ST_AsText(p) orig, ST_AsText(o) obf,
             ST_Distance(p, o) dist
      from (select ST_GeogFromText('SRID=4326;POINT(-66.9036 10.4806)') p,
                   obfuscate_point(ST_GeogFromText('SRID=4326;POINT(-66.9036 10.4806)')) o) t
    `);
    const d = Number(rows[0].dist);
    ok(
      'obfuscate_point ofusca 200-500m',
      rows[0].orig !== rows[0].obf && d >= 200 && d <= 500,
      `dist=${d.toFixed(1)}m`
    );
  }

  // 4. persons_public NO expone coord exacta; sí lat/lng obfuscated
  {
    const { rows } = await client.query(`
      select column_name from information_schema.columns
      where table_name = 'persons_public'
    `);
    const cols = rows.map((r) => r.column_name);
    const leaksExact = cols.includes('last_known_location_point');
    const hasObf = cols.includes('last_known_location_obfuscated') && cols.includes('lat');
    const noPii =
      !cols.includes('reporter_email_hash') &&
      !cols.includes('reporter_email_encrypted') &&
      !cols.includes('edit_token_hash');
    ok(
      'persons_public sin coord exacta ni PII',
      !leaksExact && hasObf && noPii,
      `cols=${cols.length}, leak_point=${leaksExact}`
    );
  }

  // 5. RLS habilitada en persons/notes/messages
  {
    const { rows } = await client.query(`
      select relname, relrowsecurity from pg_class
      where relname in ('persons','notes','messages','aid_points','organizations')
      order by relname
    `);
    const allOn = rows.every((r) => r.relrowsecurity);
    ok('RLS habilitada en tablas sensibles', allOn, rows.map((r) => `${r.relname}:${r.relrowsecurity}`).join(' '));
  }

  // 6. get_app_salt() configurado (len 64)
  {
    try {
      const { rows } = await client.query('select length(get_app_salt())::int n');
      ok('APP_SALT configurado (len 64)', rows[0].n === 64, `len=${rows[0].n}`);
    } catch (e) {
      ok('APP_SALT configurado (len 64)', false, e.message);
    }
  }

  // 7. Trigger de menor fuerza photo_visibility admin_only
  {
    const { rows } = await client.query(`
      insert into persons (given_name, family_name, age, photo_url, photo_visibility, status, source, source_id)
      values ('Nino','Test', 8, 'http://x/y.jpg', 'public', 'missing', 'gate-test', 'minor-1')
      returning is_minor, photo_visibility
    `);
    const okMinor = rows[0].is_minor === true && rows[0].photo_visibility === 'admin_only';
    ok('menor → photo_visibility admin_only (trigger)', okMinor, `minor=${rows[0].is_minor} vis=${rows[0].photo_visibility}`);
    await client.query("delete from persons where source='gate-test'");
  }

  // 8. Migraciones registradas == número de archivos .sql en disco
  {
    const { readdirSync } = await import('node:fs');
    const fileCount = readdirSync(join(__dirname, '..', 'supabase', 'migrations')).filter((f) =>
      f.endsWith('.sql')
    ).length;
    const { rows } = await client.query('select count(*)::int n from _faro_migrations');
    ok('todas las migraciones aplicadas', rows[0].n === fileCount, `${rows[0].n}/${fileCount}`);
  }

  // 9. Test de estabilidad de ofuscación (anti-promediado) end-to-end
  {
    try {
      const sql = readFileSync(join(__dirname, '..', 'supabase', 'tests', 'obfuscation_stability.test.sql'), 'utf8');
      await client.query(sql);
      ok('estabilidad ofuscación (anti-promediado)', true, 'offset invariante en 100 ediciones');
    } catch (e) {
      ok('estabilidad ofuscación (anti-promediado)', false, e.message.split('\n')[0]);
    }
  }

  // ── Reporte ──
  console.log('\n══════════ GATE DÍA 1 ══════════');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? '✅' : '❌'} ${r.name} — ${r.detail}`);
    if (!r.pass) allPass = false;
  }
  console.log('════════════════════════════════');
  console.log(allPass ? '🟢 GATE D1: PASS' : '🔴 GATE D1: FAIL');
  await client.end();
  process.exit(allPass ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  try { await client.end(); } catch { /* noop */ }
  process.exit(1);
});
