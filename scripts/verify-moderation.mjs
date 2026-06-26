#!/usr/bin/env node
/**
 * Gate de moderación (0016) — verificación de las RPCs en una transacción que
 * SIEMPRE hace ROLLBACK. No persiste nada → seguro de correr incluso contra
 * producción (no deja datos de prueba, a diferencia de un seed).
 *
 * Uso:
 *   DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/verify-moderation.mjs
 *
 * Verifica:
 *   1. moderation_queue incluye un pending, con coord EXACTA (#1) y SIN PII (#2).
 *   2. moderate_person('approved') actualiza persons y lo publica en persons_public.
 *   3. moderate_person registra el approve en audit_log con actor=moderador.
 *   4. rechazar sin motivo → excepción.
 *   5. moderador no autorizado → excepción.
 *   6. decisión fuera de whitelist → excepción.
 *   7. anon/authenticated NO pueden ejecutar las RPCs (grants).
 */
import pg from 'pg';

const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ Falta DATABASE_URL');
  process.exit(1);
}

const client = new Client({ connectionString: url });
let failed = false;
const assert = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) failed = true;
};
// Cada caso negativo va en su propio SAVEPOINT: en Postgres una excepción aborta
// TODA la transacción ("current transaction is aborted"), así que sin savepoint el
// primer expectThrow envenenaría los siguientes. El savepoint aísla cada fallo.
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

  // Moderador de prueba (el rollback lo elimina).
  const mod = await client.query(
    `insert into moderators (email, full_name, role, active)
     values ('verify-moderation@faro-ve.test', 'Verify Bot', 'moderator', true)
     returning id`
  );
  const modId = mod.rows[0].id;

  // Persona pending de prueba, con coords y "PII" cifrada.
  const per = await client.query(
    `insert into persons (given_name, family_name, status, moderation_status,
        last_known_location_point, last_known_location_obfuscated, reporter_email_encrypted)
     values ('VERIFY', 'PENDING', 'missing', 'pending',
        ST_SetSRID(ST_MakePoint(-66.9, 10.5), 4326)::geography,
        ST_SetSRID(ST_MakePoint(-66.9, 10.5), 4326)::geography,
        encrypt_pii('verify@example.com'))
     returning id`
  );
  const perId = per.rows[0].id;

  // 1) Cola
  const q = await client.query('select moderation_queue(50, 0) as q');
  const items = q.rows[0].q.items ?? [];
  const item = items.find((i) => i.id === perId);
  assert(!!item, 'moderation_queue incluye la persona pending');
  if (item) {
    assert(
      item.lat_exact != null && Math.abs(item.lat_exact - 10.5) < 1e-6,
      'la cola expone la coord EXACTA al moderador (#1)'
    );
    assert(
      !('reporter_email' in item) && !('reporter_email_encrypted' in item),
      'la cola NO expone PII de reportante (#2)'
    );
    assert(item.has_reporter_contact === true, 'has_reporter_contact=true sin revelar el dato');
  }

  // 2) Aprobar
  const r = await client.query('select moderate_person($1, $2, $3, $4) as r', [
    perId,
    'approved',
    modId,
    null
  ]);
  assert(r.rows[0].r.to === 'approved', 'moderate_person aprueba');
  const after = await client.query(
    'select moderation_status, moderated_by, moderated_at from persons where id = $1',
    [perId]
  );
  assert(
    after.rows[0].moderation_status === 'approved' &&
      after.rows[0].moderated_by === modId &&
      !!after.rows[0].moderated_at,
    'persons actualizado: status + moderated_by + moderated_at'
  );
  const pub = await client.query('select 1 from persons_public where id = $1', [perId]);
  assert(pub.rowCount === 1, 'tras aprobar, la persona entra a persons_public');

  // 3) Audit
  const aud = await client.query(
    `select actor_id, actor_type from audit_log
     where entity_type = 'person' and entity_id = $1 and action = 'approve'`,
    [perId]
  );
  assert(
    aud.rowCount === 1 && aud.rows[0].actor_id === modId,
    'audit_log: exactamente 1 fila approve con actor = moderador'
  );
  // No debe quedar la fila genérica "fantasma" (action='update', actor service_role/NULL).
  const ghost = await client.query(
    `select count(*)::int as n from audit_log
     where entity_type = 'person' and entity_id = $1 and action = 'update'`,
    [perId]
  );
  assert(ghost.rows[0].n === 0, 'sin fila audit-fantasma (update/service_role) en moderación');

  // 4) Rechazar sin motivo
  await expectThrow(
    () => client.query('select moderate_person($1, $2, $3, $4)', [perId, 'rejected', modId, null]),
    'rechazar sin motivo lanza excepción'
  );

  // 5) Moderador no autorizado
  await expectThrow(
    () =>
      client.query('select moderate_person($1, $2, $3, $4)', [
        perId,
        'approved',
        '00000000-0000-0000-0000-000000000000',
        null
      ]),
    'moderador no autorizado rechazado'
  );

  // 6) Decisión inválida
  await expectThrow(
    () => client.query('select moderate_person($1, $2, $3, $4)', [perId, 'deleted', modId, 'x']),
    'decisión fuera de la whitelist rechazada'
  );

  // 7) Grants
  const g = await client.query(
    `select
       has_function_privilege('anon', 'moderate_person(uuid,text,uuid,text)', 'execute') as anon_decide,
       has_function_privilege('authenticated', 'moderation_queue(int,int)', 'execute') as auth_queue,
       has_function_privilege('anon', 'moderation_stats()', 'execute') as anon_stats`
  );
  assert(g.rows[0].anon_decide === false, 'anon NO puede ejecutar moderate_person');
  assert(g.rows[0].auth_queue === false, 'authenticated NO puede ejecutar moderation_queue');
  assert(g.rows[0].anon_stats === false, 'anon NO puede ejecutar moderation_stats');
} catch (err) {
  console.error('❌ Error inesperado en el gate:', err.message);
  failed = true;
} finally {
  // Rollback SIEMPRE — el gate no deja rastro (seguro contra prod).
  await client.query('rollback').catch(() => {});
  await client.end();
}

console.log(failed ? '\n🔴 GATE MODERACIÓN: FAIL' : '\n🟢 GATE MODERACIÓN: PASS');
process.exit(failed ? 1 : 0);
