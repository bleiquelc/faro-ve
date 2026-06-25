#!/usr/bin/env node
/**
 * Seed de reportes de PRUEBA (source='test', approved) para validar el mapa:
 * clusters, colores por categoría, pulsos de menores/médicos.
 *
 * Uso:   DATABASE_URL="..." node scripts/seed-test-persons.mjs
 * Limpiar: DATABASE_URL="..." node scripts/seed-test-persons.mjs --clean
 *
 * NO es data real. Se borra con --clean (delete where source='test').
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Coords base por zona (se les añade jitter). [lat, lng]
const ZONES = {
  petare: [10.4773, -66.8186],
  catia: [10.5126, -66.9569],
  elvalle: [10.4569, -66.93],
  chacao: [10.4933, -66.8537],
  guaira: [10.6004, -66.9354],
  valencia: [10.162, -67.9972],
  maracay: [10.2469, -67.5958],
  caracas: [10.4806, -66.9036]
};

const j = (n) => (Math.random() - 0.5) * n; // jitter

// [given, family, age|null, status, medical_urgent, medical_category, zone, clothes]
const PEOPLE = [
  ['María', 'González', 8, 'missing', false, null, 'petare', 'vestido rosado'],
  ['José', 'Pérez', 6, 'missing', false, null, 'catia', 'franela azul, short'],
  ['Ana', 'Rodríguez', 14, 'missing', false, null, 'elvalle', 'uniforme escolar'],
  ['Luis', 'Martínez', 4, 'missing', false, null, 'caracas', 'pijama de dinosaurios'],
  ['Carmen', 'López', 72, 'missing', true, 'dialysis', 'chacao', 'bata de casa'],
  ['Pedro', 'Sánchez', 58, 'missing', true, 'insulin_dependent', 'valencia', 'camisa a cuadros'],
  ['Rosa', 'Díaz', 34, 'missing', true, 'pregnancy', 'maracay', 'vestido floreado'],
  ['Miguel', 'Torres', 67, 'missing', true, 'oxygen_dependent', 'guaira', 'suéter gris'],
  ['Juan', 'Ramírez', 45, 'missing', false, null, 'petare', 'jean y franela negra'],
  ['Elena', 'Flores', 29, 'missing', false, null, 'catia', 'blusa blanca'],
  ['Carlos', 'Rivas', 51, 'missing', false, null, 'chacao', 'camisa azul'],
  ['Sofía', 'Mendoza', 23, 'missing', false, null, 'caracas', 'sudadera roja'],
  ['Andrés', 'Castro', 38, 'missing', false, null, 'valencia', 'chemise verde'],
  ['Lucía', 'Romero', 17, 'missing', false, null, 'elvalle', 'jean roto, top negro'],
  ['Diego', 'Vargas', 41, 'missing', false, null, 'maracay', 'franela del Magallanes'],
  ['Patricia', 'Silva', 63, 'missing', false, null, 'guaira', 'vestido azul marino'],
  [null, null, 50, 'unidentified_body', false, null, 'caracas', 'pantalón beige, sin camisa'],
  [null, null, 30, 'unidentified_body', false, null, 'petare', 'jean azul, zapatos negros'],
  [null, null, null, 'unidentified_body', false, null, 'guaira', 'franela amarilla'],
  ['Gabriel', 'Núñez', 27, 'safe_self_report', false, null, 'chacao', null],
  ['Daniela', 'Ortiz', 33, 'safe_self_report', false, null, 'valencia', null],
  ['Ricardo', 'Guerra', 19, 'safe_self_report', false, null, 'caracas', null],
  ['Fernanda', 'Rojas', 11, 'missing', false, null, 'maracay', 'camiseta de Frozen'],
  ['Héctor', 'Medina', 55, 'hospitalized', true, 'chronic_disease', 'caracas', 'bata de hospital'],
  ['Isabel', 'Cabrera', 70, 'missing', true, 'mobility_impaired', 'catia', 'falda larga, bastón'],
  ['Tomás', 'Aguilar', 9, 'missing', false, null, 'elvalle', 'gorra roja, morral azul'],
  ['Valentina', 'Reyes', 16, 'missing', false, null, 'chacao', 'chaqueta jean'],
  ['Óscar', 'Fuentes', 47, 'missing', false, null, 'petare', 'overol de trabajo'],
  ['Camila', 'Salazar', 5, 'missing', false, null, 'guaira', 'vestido amarillo, coletas'],
  ['Mateo', 'Ríos', 2, 'missing', false, null, 'valencia', 'mameluco celeste']
];

async function main() {
  await client.connect();

  if (process.argv.includes('--clean')) {
    const r = await client.query("delete from persons where source='test'");
    console.log(`🧹 Borrados ${r.rowCount} reportes de prueba.`);
    await client.end();
    return;
  }

  let n = 0;
  for (let i = 0; i < PEOPLE.length; i++) {
    const [given, family, age, status, med, medcat, zone, clothes] = PEOPLE[i];
    const [baseLat, baseLng] = ZONES[zone];
    const lat = baseLat + j(0.03);
    const lng = baseLng + j(0.03);
    const unaccompanied = age != null && age < 18 && Math.random() < 0.4;

    await client.query(
      `insert into persons
        (given_name, family_name, age, status, medical_urgent, medical_category,
         unaccompanied_minor, clothing_top, home_neighborhood, home_city,
         last_known_location_point, moderation_status, source, source_id, last_seen_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         ST_GeogFromText($11), 'approved', 'test', $12, now() - ($13 || ' hours')::interval)`,
      [
        given,
        family,
        age,
        status,
        med,
        medcat,
        unaccompanied,
        clothes,
        zone,
        zone === 'valencia' ? 'Valencia' : zone === 'maracay' ? 'Maracay' : 'Caracas',
        `SRID=4326;POINT(${lng} ${lat})`,
        `test-${i}`,
        Math.floor(Math.random() * 48)
      ]
    );
    n++;
  }
  console.log(`✅ ${n} reportes de prueba insertados (source='test').`);

  const { rows } = await client.query(
    "select status, count(*)::int n from persons where source='test' group by status order by n desc"
  );
  console.log('Por estado:', rows.map((r) => `${r.status}:${r.n}`).join('  '));
  await client.end();
}

main().catch(async (e) => {
  console.error(e.message);
  try { await client.end(); } catch { /* noop */ }
  process.exit(1);
});
