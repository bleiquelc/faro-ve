/**
 * ficha-fields — resuelve los datos de una ficha de Instagram desde el entorno,
 * usando lo que devuelve la API solo como RESPALDO.
 *
 * POR QUÉ EXISTE (1-ago-2026). El 29-jul se arregló la ventana de 400 filas del
 * `cron-ig.mjs` (barrido con cursor sobre las 47.800 personas), pero
 * `render-ficha.mjs` seguía buscando a la persona en su PROPIO "primer lote" de
 * 1000 — las más nuevas — y hacía `process.exit(1)` si no la encontraba. Como el
 * cron pasó a elegir candidatos del fondo del corpus (cursor 10.400+), el render
 * fallaba SIEMPRE que el cron encontraba una foto limpia, y el `execFileSync`
 * mataba la corrida entera. Resultado: 3 días con `Intentos=15. Publicadas=0.`
 *
 * El cron YA le pasa todos los datos por entorno (son los datos UNIFICADOS con
 * Venezuela Reporta, mejores que los de la API). La consulta a la API es solo
 * comodidad para corridas manuales — nunca debe ser un requisito.
 */

/**
 * @typedef {object} FichaFields
 * @property {string} name
 * @property {string} loc
 * @property {string} age
 * @property {string} sex
 * @property {string} photo
 * @property {string} extraDesc
 */

/**
 * @param {Record<string, string | undefined>} env  process.env (o un subconjunto)
 * @param {Record<string, any> | null | undefined} person  fila de /api/persons, si se pudo obtener
 * @returns {FichaFields}
 * @throws {Error} si falta lo IMPRESCINDIBLE (nombre, o foto salvo NO_PHOTO=1)
 */
export function resolveFichaFields(env, person) {
  const p = person || {};

  const name = String(
    env.NAME || p.full_name || `${p.given_name || ''} ${p.family_name || ''}`
  ).trim();
  if (!name) {
    throw new Error(
      'No se pudo determinar el nombre de la persona (ni por entorno NAME ni por la API).'
    );
  }

  const photo = env.NO_PHOTO === '1' ? '' : String(env.PHOTO_URL || p.photo_url || '').trim();
  if (!photo && env.NO_PHOTO !== '1') {
    // Solo se publica CON foto limpia (decisión founder): sin foto no hay ficha.
    throw new Error(`No hay foto para "${name}" (ni por entorno PHOTO_URL ni por la API).`);
  }

  const loc =
    String(env.LOC || p.last_known_location_text || p.home_city || '').trim() ||
    'Ubicación no especificada';

  return {
    name,
    loc,
    age: String(env.AGE || p.age || '').trim(),
    sex: String(env.SEX || (p.sex && p.sex !== 'unknown' ? p.sex : '') || '').trim(),
    photo,
    extraDesc: String(env.EXTRA_DESC || p.description || '').trim()
  };
}
