/**
 * Re-geocodificación de los registros INGESTADOS cuando mejora el geocoder.
 *
 * Por qué existe (bug 2-jul-2026): 10 anclas del geocoder caían EN EL MAR
 * (Tanaguarena ~5 km mar adentro, Todasana ~6 km…). La ofuscación obligatoria
 * 200–500 m agotaba sus 16 intentos alrededor de un ancla marina y el
 * snap-a-costa apilaba miles de pines SOBRE el agua. Además, el fallback por
 * estado apilaba registros en capitales lejos de su dirección real. El geocoder
 * v2 (anclas verificadas en tierra + lugares GeoNames + contexto de estado)
 * corrige la causa; este módulo corrige el DATO ya guardado.
 *
 * Cómo:
 *  - Corre en el worker (Cloudflare SÍ alcanza la DB; el Mac no — IPv6) por
 *    conexión pg DIRECTA al Session Pooler (secret SUPABASE_DB_URL), porque el
 *    UPDATE masivo vía PostgREST dispararía el audit-trigger por fila (~46k
 *    filas de diff jsonb = decenas de MB de ruido en audit_log).
 *  - PAGINADO y RESUMABLE: páginas keyset por id (PAGE_SIZE filas), cada página
 *    en su propia transacción con advisory lock (anti-solape) y el flag
 *    transaccional faro.skip_persons_audit (igual que scripts/load-ve-land.mjs).
 *    El progreso vive en app_config('regeocode_progress'); si el worker muere a
 *    mitad, el próximo tick retoma donde iba. Al terminar: recompute offshore +
 *    UNA fila de audit resumen + app_config('geocode_version') = versión.
 *  - Gate por versión: corre UNA sola vez por GEOCODE_VERSION (cada tick del
 *    cron solo paga un SELECT a app_config).
 *
 * Alcance / privacidad (#1):
 *  - El punto BASE (last_known_location_point) solo se toca en filas de la
 *    fuente ingestada (source = 'venezuela-te-busca'): los reportes humanos
 *    tienen coordenadas propias que JAMÁS se recalculan desde texto.
 *  - El pase final offshore recomputa SOLO la coordenada pública DERIVADA
 *    (last_known_location_obfuscated) de CUALQUIER fila que haya quedado en el
 *    mar — a propósito, mismo criterio que la 0017/load-ve-land: no expone
 *    nada (la recomputa obfuscate_point_on_land, que garantiza ≥200 m), solo
 *    corrige el pin público. El punto exacto no se lee ni se mueve.
 *  - Si el punto no cambia, no se escribe → el offset ofuscado queda estable
 *    (anti-promediado). Si cambia, el trigger 0017 re-ofusca EN TIERRA.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — módulo .mjs compartido sin tipos
import { geocode, GEOCODE_VERSION } from '../../../scripts/ingest/geocode.mjs';

const SOURCE = 'venezuela-te-busca';
const PAGE_SIZE = 10000; // filas por página (keyset por id, 1 transacción c/u)
const MAX_PAGES_PER_TICK = 8; // techo por tick (~80k filas; geocode ≈ 10ms/1k)
const BATCH = 5000; // filas por UPDATE (unnest) dentro de una página
const LOCK_KEY = 20260702; // advisory lock anti-solape entre ticks

export interface RegeocodeEnv {
  SUPABASE_DB_URL?: string;
}

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
}

interface Progress {
  v: number; // versión del geocoder en curso
  lastId: string; // keyset: último id procesado
  moved: number; // acumulado de puntos re-geocodificados
  seen: number; // acumulado de filas examinadas
  unpinned: number; // filas sin geocode y sin pin (quedan buscables por nombre)
}

async function makeClient(url: string): Promise<PgClient> {
  // pg soporta Workers vía cloudflare:sockets (nodejs_compat). Import dinámico
  // para que el resto del worker no dependa de pg si el secret no está.
  const { default: pg } = await import('pg');
  return new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000
  }) as unknown as PgClient;
}

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/**
 * Corre (o retoma) la re-geocodificación si la versión del geocoder es más
 * nueva que la aplicada. Fail-safe: sin secret, sin lock o con error → no hace
 * nada y la ingesta del tick sigue; el próximo tick reintenta/retoma.
 */
export async function regeocodeIfNeeded(
  env: RegeocodeEnv,
  log: (m: string) => void = console.log
): Promise<void> {
  if (!env.SUPABASE_DB_URL) {
    log('[regeocode] sin SUPABASE_DB_URL — omitido (setear con wrangler secret put)');
    return;
  }

  const client = await makeClient(env.SUPABASE_DB_URL);
  await client.connect();
  try {
    // Gate barato por versión.
    const v = await client.query(
      `select key, value from app_config where key in ('geocode_version', 'regeocode_progress')`
    );
    const cfg = new Map(v.rows.map((r) => [String(r.key), String(r.value)]));
    const applied = parseInt(cfg.get('geocode_version') ?? '0', 10) || 0;
    if (applied >= GEOCODE_VERSION) return;

    let prog: Progress = { v: GEOCODE_VERSION, lastId: ZERO_UUID, moved: 0, seen: 0, unpinned: 0 };
    const rawProg = cfg.get('regeocode_progress');
    if (rawProg) {
      try {
        const p = JSON.parse(rawProg) as Progress;
        if (p.v === GEOCODE_VERSION && p.lastId) prog = p;
      } catch {
        /* progreso corrupto → se reinicia (idempotente) */
      }
    }

    log(
      `[regeocode] geocoder v${GEOCODE_VERSION} (aplicada v${applied}) — ` +
        (prog.seen ? `retomando en ${prog.seen} filas vistas…` : 'arrancando…')
    );

    const cache = new Map<string, [number, number] | null>();

    for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
      await client.query('begin');
      const lock = await client.query('select pg_try_advisory_xact_lock($1) as ok', [LOCK_KEY]);
      if (!lock.rows[0].ok) {
        await client.query('rollback');
        log('[regeocode] otra corrida en curso — omitido');
        return;
      }

      // Suprime el audit genérico por fila (flag transaccional, como load-ve-land);
      // al final se inserta UNA fila de audit resumen honesta.
      await client.query(`select set_config('faro.skip_persons_audit', '1', true)`);

      const res = await client.query(
        `select id, last_known_location_text as txt,
                ST_Y(last_known_location_point::geometry) as lat,
                ST_X(last_known_location_point::geometry) as lng
           from persons
          where source = $1 and id > $2
          order by id
          limit ${PAGE_SIZE}`,
        [SOURCE, prog.lastId]
      );

      const ids: string[] = [];
      const lats: number[] = [];
      const lngs: number[] = [];
      for (const r of res.rows) {
        const txt = (r.txt as string | null) ?? '';
        let c = cache.get(txt);
        if (c === undefined) {
          c = geocode(txt) as [number, number] | null;
          cache.set(txt, c);
        }
        if (!c) {
          if (r.lat == null) prog.unpinned++;
          continue; // NUNCA quitar un pin existente (ancla vieja > sin pin)
        }
        const same =
          r.lat != null &&
          Math.abs((r.lat as number) - c[0]) < 1e-7 &&
          Math.abs((r.lng as number) - c[1]) < 1e-7;
        if (same) continue; // sin cambio → sin churn; el offset queda estable
        ids.push(r.id as string);
        lats.push(c[0]);
        lngs.push(c[1]);
      }

      // UPDATE por lotes. El trigger trg_persons_obfuscate (0017) recomputa la
      // ofuscación EN TIERRA porque el punto cambió (change-guard).
      for (let i = 0; i < ids.length; i += BATCH) {
        const r = await client.query(
          `update persons p
              set last_known_location_point =
                    ST_SetSRID(ST_MakePoint(u.lng, u.lat), 4326)::geography
             from (select unnest($1::uuid[]) as id,
                          unnest($2::float8[]) as lat,
                          unnest($3::float8[]) as lng) u
            where p.id = u.id`,
          [ids.slice(i, i + BATCH), lats.slice(i, i + BATCH), lngs.slice(i, i + BATCH)]
        );
        prog.moved += r.rowCount ?? 0;
      }

      prog.seen += res.rows.length;
      const done = res.rows.length < PAGE_SIZE;
      if (!done) prog.lastId = res.rows[res.rows.length - 1].id as string;

      if (done) {
        // Pase final: puntos públicos derivados que sigan en el mar (cualquier
        // fila — ver "Alcance" arriba) → re-ofuscar en tierra (criterio 0017).
        const off = await client.query(
          `update persons
              set last_known_location_obfuscated = obfuscate_point_on_land(last_known_location_point)
            where last_known_location_point is not null
              and last_known_location_obfuscated is not null
              and not is_on_land(last_known_location_obfuscated)`
        );

        await client.query(
          `insert into audit_log (actor_type, action, entity_type, reason)
           values ('system', 'regeocode', 'person', $1)`,
          [
            `geocoder v${GEOCODE_VERSION}: ${prog.moved} puntos base re-geocodificados de ${prog.seen} examinados ` +
              `(anclas en tierra + lugares GeoNames + contexto de estado), ${off.rowCount ?? 0} ofuscados offshore ` +
              `recomputados, ${prog.unpinned} sin geocode (buscables por nombre).`
          ]
        );
        await client.query(
          `insert into app_config (key, value, updated_at)
           values ('geocode_version', $1, now())
           on conflict (key) do update set value = excluded.value, updated_at = now()`,
          [String(GEOCODE_VERSION)]
        );
        await client.query(`delete from app_config where key = 'regeocode_progress'`);
        await client.query('commit');
        log(
          `[regeocode] ✓ v${GEOCODE_VERSION} COMPLETA: ${prog.moved}/${prog.seen} puntos movidos · ` +
            `${off.rowCount ?? 0} offshore recomputados · ${prog.unpinned} sin pin`
        );
        return;
      }

      // Página intermedia: persistir progreso y seguir (o dejar al próximo tick).
      await client.query(
        `insert into app_config (key, value, updated_at)
         values ('regeocode_progress', $1, now())
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [JSON.stringify(prog)]
      );
      await client.query('commit');
      log(`[regeocode] …página ${page + 1}: ${prog.seen} vistas, ${prog.moved} movidas`);
    }

    log(`[regeocode] tick agotado (${prog.seen} vistas) — retoma el próximo tick`);
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {
      /* conexión ya caída */
    }
    // No relanzar: la ingesta del tick debe correr igual; el próximo tick retoma.
    log(`[regeocode] ✖ ${e instanceof Error ? e.message : String(e)} — se retoma en el próximo tick`);
  } finally {
    await client.end();
  }
}
