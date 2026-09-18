/**
 * photo-cache-rehost — renombra el HOST de las claves del caché de fotos cuando la
 * fuente cambia de dominio. Función pura; el script que la aplica al disco es
 * scripts/buffer/migrate-photo-cache-host.mjs.
 *
 * POR QUÉ EXISTE (18-sep-2026). `~/.faro-ig/ai-cache.json` indexa el veredicto de
 * visión (Haiku) por URL. La fuente se mudó de dominio conservando el path de cada
 * imagen: misma imagen, otra URL. Sin esto, 1.853 veredictos YA PAGADOS quedaban
 * huérfanos y se volvían a pagar (misión-ley Art. 3: no re-pagar lo ya resuelto).
 */

/**
 * @template V
 * @param {Record<string, V> | null | undefined} nsMap  namespace del caché (p. ej. `db.photo`)
 * @param {string} fromOrigin  origen viejo, sin barra final (https://host)
 * @param {string} toOrigin    origen nuevo, sin barra final
 * @returns {{map: Record<string, V>, moved: number, kept: number, collisions: number}}
 */
export function rehostCacheKeys(nsMap, fromOrigin, toOrigin) {
  const prefix = fromOrigin.replace(/\/+$/, '') + '/'; // con la barra: prefijo de ORIGEN, no substring
  const target = toOrigin.replace(/\/+$/, '') + '/';
  const entries = Object.entries(nsMap || {});

  // 1) Lo que NO es del host viejo se conserva tal cual (incluye claves ya migradas).
  const base = Object.fromEntries(entries.filter(([k]) => !k.startsWith(prefix)));

  // 2) Lo del host viejo se re-aloja; si la clave nueva ya existe, gana la existente.
  const taken = new Set(Object.keys(base));
  /** @type {Array<[string, V]>} */
  const moved = [];
  let collisions = 0;
  for (const [k, val] of entries) {
    if (!k.startsWith(prefix)) continue;
    const nk = target + k.slice(prefix.length);
    if (taken.has(nk)) {
      collisions++;
      continue;
    }
    taken.add(nk);
    moved.push([nk, val]);
  }

  return {
    map: { ...base, ...Object.fromEntries(moved) },
    moved: moved.length,
    kept: Object.keys(base).length,
    collisions
  };
}
