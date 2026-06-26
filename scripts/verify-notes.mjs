#!/usr/bin/env node
/**
 * Gate de avistamientos/info (0018) — verificación en una transacción que SIEMPRE
 * hace ROLLBACK. Seguro contra prod (no deja datos).
 *
 *   DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/verify-notes.mjs
 *
 * Verifica: create_note_report inserta pending; notes_moderation_queue expone
 * coord EXACTA (#1) y SIN PII de autor (#2); moderate_note publica/rechaza con
 * audit (sin fantasma); casos negativos; grants.
 */
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ Falta DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let failed = false;
const assert = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) failed = true;
};
const expectThrow = async (fn, msg) => {
  let threw = false;
  await client.query('savepoint sp');
  try {
    await fn();
  } catch {
    threw = true;
  }
  await client.query(threw ? 'rollback to savepoint sp' : 'release savepoint sp');
  assert(threw, msg);
};

await client.connect();
try {
  await client.query('begin');

  const mod = await client.query(
    `insert into moderators (email, role, active) values ('verify-notes@faro-ve.test','moderator',true) returning id`
  );
  const modId = mod.rows[0].id;

  // Persona aprobada a la que referirá la nota.
  const per = await client.query(
    `insert into persons (given_name, status, moderation_status) values ('VERIFY','missing','approved') returning id`
  );
  const perId = per.rows[0].id;

  // Persona NO pública (pending) — una nota sobre ella debe rechazarse.
  const perPending = await client.query(
    `insert into persons (given_name, status, moderation_status) values ('VERIFYPEND','missing','pending') returning id`
  );
  const perPendingId = perPending.rows[0].id;

  // 1) create_note_report (avistamiento con coord + contacto del autor).
  const created = await client.query(`select create_note_report($1::jsonb) as r`, [
    JSON.stringify({
      person_id: perId,
      type: 'sighting',
      text: 'La vi cerca de la plaza',
      lat: 10.5,
      lng: -66.9,
      author_email: 'autor@example.com'
    })
  ]);
  const noteId = created.rows[0].r.id;
  assert(!!noteId, 'create_note_report inserta una nota');

  const st = await client.query(
    `select moderation_status, author_made_contact, author_email_encrypted is not null as enc,
            sighting_location_obfuscated is not null as obf
       from notes where id = $1`,
    [noteId]
  );
  assert(st.rows[0].moderation_status === 'pending', 'la nota entra pending (#18)');
  assert(st.rows[0].enc === true, 'PII del autor cifrada en DB (#2)');
  assert(st.rows[0].obf === true, 'ubicación del avistamiento ofuscada');

  // 2) Cola
  const q = await client.query('select notes_moderation_queue(50,0) as q');
  const item = (q.rows[0].q.items ?? []).find((i) => i.id === noteId);
  assert(!!item, 'notes_moderation_queue incluye la nota pending');
  if (item) {
    assert(
      item.lat_exact != null && Math.abs(item.lat_exact - 10.5) < 1e-6,
      'la cola expone la coord EXACTA del avistamiento al moderador (#1)'
    );
    assert(
      !('author_email' in item) && !('author_email_encrypted' in item),
      'la cola NO expone PII del autor (#2)'
    );
    assert(item.has_author_contact === true, 'has_author_contact=true sin revelar el dato');
    assert(item.person_name != null, 'la cola trae el nombre de la persona referida');
  }

  // 3) Aprobar → pública + audit sin fantasma
  const r = await client.query(`select moderate_note($1,'approved',$2,null) as r`, [noteId, modId]);
  assert(r.rows[0].r.to === 'approved', 'moderate_note aprueba');
  const pub = await client.query('select 1 from notes_public where id = $1', [noteId]);
  assert(pub.rowCount === 1, 'tras aprobar, la nota entra a notes_public');
  const aud = await client.query(
    `select actor_id from audit_log where entity_type='note' and entity_id=$1 and action='approve'`,
    [noteId]
  );
  assert(aud.rowCount === 1 && aud.rows[0].actor_id === modId, 'audit: 1 fila approve con actor=moderador');
  const ghost = await client.query(
    `select count(*)::int n from audit_log where entity_type='note' and entity_id=$1 and action='update'`,
    [noteId]
  );
  assert(ghost.rows[0].n === 0, 'sin fila audit-fantasma en moderación de notas');

  // 4) Rechazar → hidden + fuera de notes_public
  const r2 = await client.query(`select moderate_note($1,'rejected',$2,'spam') as r`, [noteId, modId]);
  assert(r2.rows[0].r.to === 'rejected', 'moderate_note rechaza');
  const pub2 = await client.query('select 1 from notes_public where id = $1', [noteId]);
  assert(pub2.rowCount === 0, 'tras rechazar, la nota sale de notes_public');

  // 5) Negativos
  await expectThrow(
    () => client.query(`select moderate_note($1,'rejected',$2,null)`, [noteId, modId]),
    'rechazar sin motivo lanza excepción'
  );
  await expectThrow(
    () => client.query(`select moderate_note($1,'approved','00000000-0000-0000-0000-000000000000',null)`, [noteId]),
    'moderador no autorizado rechazado'
  );
  await expectThrow(
    () => client.query(`select create_note_report($1::jsonb)`, [JSON.stringify({ person_id: perId, text: '' })]),
    'create_note_report sin texto lanza excepción'
  );
  await expectThrow(
    () =>
      client.query(`select create_note_report($1::jsonb)`, [
        JSON.stringify({ person_id: '00000000-0000-0000-0000-000000000000', text: 'x' })
      ]),
    'create_note_report con person_id inexistente lanza excepción'
  );
  await expectThrow(
    () =>
      client.query(`select create_note_report($1::jsonb)`, [
        JSON.stringify({ person_id: perPendingId, text: 'x' })
      ]),
    'create_note_report sobre persona NO pública (pending) lanza excepción'
  );
  await expectThrow(
    () => client.query(`select moderate_note($1,'duplicate',$2,'x')`, [noteId, modId]),
    'decisión fuera de approved/rejected rechazada para notas'
  );

  // 6) Grants — funciones + tablas (endurecimiento: sin INSERT directo)
  const g = await client.query(
    `select
       has_function_privilege('anon','create_note_report(jsonb)','execute') as anon_create,
       has_function_privilege('authenticated','notes_moderation_queue(int,int)','execute') as auth_queue,
       has_function_privilege('anon','moderate_note(uuid,text,uuid,text)','execute') as anon_mod,
       has_table_privilege('anon','notes','INSERT') as anon_notes_ins,
       has_table_privilege('authenticated','notes','INSERT') as auth_notes_ins,
       has_table_privilege('anon','persons','INSERT') as anon_persons_ins`
  );
  assert(g.rows[0].anon_create === false, 'anon NO puede ejecutar create_note_report');
  assert(g.rows[0].auth_queue === false, 'authenticated NO puede ejecutar notes_moderation_queue');
  assert(g.rows[0].anon_mod === false, 'anon NO puede ejecutar moderate_note');
  assert(g.rows[0].anon_notes_ins === false, 'anon NO puede INSERT directo en notes (solo vía RPC)');
  assert(g.rows[0].auth_notes_ins === false, 'authenticated NO puede INSERT directo en notes');
  assert(g.rows[0].anon_persons_ins === false, 'anon NO puede INSERT directo en persons');
} catch (err) {
  console.error('❌ Error inesperado:', err.message);
  failed = true;
} finally {
  await client.query('rollback').catch(() => {});
  await client.end();
}

console.log(failed ? '\n🔴 GATE NOTAS: FAIL' : '\n🟢 GATE NOTAS: PASS');
process.exit(failed ? 1 : 0);
