#!/usr/bin/env node
/**
 * Carga la máscara de tierra de Venezuela (scripts/data/ve-land.geojson) en la
 * tabla ve_land y BACKFILLEA los puntos públicos que caían en el mar, recomputando
 * su ofuscación con obfuscate_point_on_land (migración 0017).
 *
 * Solo toca last_known_location_obfuscated (coord PÚBLICA derivada, sin PII); el
 * punto exacto y todo lo demás quedan intactos. Recomputa SOLO los offshore (los
 * que ya están en tierra no se tocan → su offset sigue estable, anti-promediado).
 *
 * Requiere 0017 aplicada. Uso:
 *   DATABASE_URL="$(cat ~/.secrets/faro-ve/db-url.txt)" node scripts/load-ve-land.mjs
 *   ... --dry   (solo reporta cuántos están en el mar, sin escribir)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry');
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: falta DATABASE_URL');
  process.exit(1);
}

const geojson = JSON.parse(readFileSync(join(__dirname, 'data', 've-land.geojson'), 'utf8'));
const geometry = geojson.features?.[0]?.geometry;
// El pipeline SQL (ST_Multi(...)) normaliza Polygon → MultiPolygon, así que aceptamos
// ambos; solo rechazamos lo que claramente no es un polígono.
if (!geometry || (geometry.type !== 'MultiPolygon' && geometry.type !== 'Polygon')) {
  console.error('ERROR: ve-land.geojson no tiene un (Multi)Polygon en features[0].geometry');
  process.exit(1);
}
const geomText = JSON.stringify(geometry);

const OFFSHORE_FILTER = `
  last_known_location_point is not null
  and last_known_location_obfuscated is not null
  and not is_on_land(last_known_location_obfuscated)`;

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  await client.query('begin');
  try {
    // 1) Cargar / actualizar la máscara (validada a MultiPolygon).
    await client.query(
      `insert into ve_land (id, geom)
       values (1, ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)), 3)))
       on conflict (id) do update set geom = excluded.geom`,
      [geomText]
    );
    const v = await client.query('select ST_NPoints(geom) as n from ve_land where id = 1');
    console.log(`🗺  ve_land cargada (${v.rows[0].n} vértices).`);

    // 2) ¿Cuántos puntos públicos caen en el mar?
    const before = await client.query(
      `select count(*)::int as n from persons where ${OFFSHORE_FILTER}`
    );
    console.log(`🌊 puntos públicos en el mar: ${before.rows[0].n}`);

    if (DRY) {
      console.log('— DRY: no se escribe el backfill —');
      await client.query('rollback');
      await client.end();
      return;
    }

    // 3) Backfill personas — recomputar SOLO los offshore. Suprimimos la fila de
    //    audit genérica del trigger (sería 'public/NULL update' x cientos) y
    //    dejamos UNA fila resumen honesta. Flag TRANSACCIONAL (is_local=true): se
    //    limpia solo al COMMIT/ROLLBACK (revisión adversarial: scope de sesión).
    await client.query(`select set_config('faro.skip_persons_audit', '1', true)`);
    const upd = await client.query(
      `update persons
         set last_known_location_obfuscated = obfuscate_point_on_land(last_known_location_point)
       where ${OFFSHORE_FILTER}`
    );

    await client.query(
      `insert into audit_log (actor_type, action, entity_type, reason)
       values ('system', 'backfill_obfuscation', 'person', $1)`,
      [`recomputada ofuscación land-aware para ${upd.rowCount} puntos costeros que caían en el mar (0017). Las coords offshore servidas antes quedan invalidadas.`]
    );

    const after = await client.query(
      `select count(*)::int as n from persons where ${OFFSHORE_FILTER}`
    );

    // 4) Backfill avistamientos (notes) — misma asimetría costera (privacy-004).
    //    notes_public expone sighting_location_obfuscated; sin esto, un avistamiento
    //    costero seguiría en el mar. (El trigger de audit de notes no tiene flag;
    //    suelen ser pocas filas → sus filas de audit son aceptables.)
    const NOTES_OFFSHORE = `sighting_location_point is not null
      and sighting_location_obfuscated is not null
      and not is_on_land(sighting_location_obfuscated)`;
    const nBefore = await client.query(`select count(*)::int as n from notes where ${NOTES_OFFSHORE}`);
    const nUpd = await client.query(
      `update notes
         set sighting_location_obfuscated = obfuscate_point_on_land(sighting_location_point)
       where ${NOTES_OFFSHORE}`
    );

    await client.query('commit');
    console.log(`✅ backfill personas: ${upd.rowCount} puntos recomputados.`);
    console.log(`🏝  personas en el mar ahora: ${after.rows[0].n} (objetivo ~0).`);
    console.log(`✅ backfill avistamientos: ${nUpd.rowCount} de ${nBefore.rows[0].n} recomputados.`);
  } catch (err) {
    await client.query('rollback');
    console.error('❌ error, rollback:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
