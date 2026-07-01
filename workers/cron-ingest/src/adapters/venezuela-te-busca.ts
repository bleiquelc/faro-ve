/**
 * Adapter de ingesta venezuela-te-busca para el Worker cron-ingest.
 *
 * PAGINACIÓN (jul-2026): la fuente pasó a un modelo SOLO-búsqueda. La vista sin
 * filtro devuelve solo 24 recientes con hasMore:false y `?page=N` se ignora; SÓLO
 * `query` (≥3 chars, substring de nombre Y ubicación) pagina, vía cursor opaco. Por
 * eso aquí se ENUMERA por búsqueda: se barre una lista de términos frecuentes
 * (nombres + apellidos + lugares + trigramas, `search-terms.mjs`), paginando cada
 * uno por cursor y cortando al agotar registros NUEVOS (van primero por created_at
 * desc). El estado incremental `ingest_cursor` guarda el ÍNDICE del término por el
 * que seguir la próxima corrida (rota sobre la lista → re-barre y capta nuevos).
 *
 * Reusa el núcleo compartido (fetchSearchValid + mapRecord) y escribe vía la RPC
 * idempotente `ingest_persons_batch` (no duplica: saltea source_id ya existentes).
 * Throttle ético (1 req/2s) heredado del núcleo.
 */
import {
  THROTTLE_MS,
  sleep,
  fetchSearchValid,
  mapRecord
} from '../../../../scripts/ingest/venezuela-te-busca-core.mjs';
import { TERMS } from '../../../../scripts/ingest/search-terms.mjs';

const ROBOTS_URL = 'https://venezuela-te-busca-app.hellogafaro.workers.dev/robots.txt';
const DUP_PAGES = 3; // cortar un término tras K páginas seguidas sin NUEVOS a DB

interface SupabaseLike {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface AdapterDeps {
  supabase: SupabaseLike;
  startCursor: number; // índice del término inicial (rota sobre TERMS)
  maxPagesPerRun: number; // presupuesto de REQUESTS por corrida
  ua: string;
  log: (m: string) => void;
}

export interface AdapterResult {
  imported: number;
  duplicates: number;
  errors: number;
  notes: string;
  nextCursor: number; // índice del término para la próxima corrida
  scanned: number;
  geocodable: number;
}

/** Chequeo ligero de robots.txt: sin Disallow total ni sobre /_root → permitido. */
async function robotsAllows(ua: string): Promise<boolean> {
  try {
    const res = await fetch(ROBOTS_URL, { headers: { 'user-agent': ua } });
    if (!res.ok) return true;
    const txt = (await res.text()).toLowerCase();
    if (/disallow:\s*\/\s*$/m.test(txt)) return false;
    if (/disallow:\s*\/_root/m.test(txt)) return false;
    return true;
  } catch {
    return true;
  }
}

export async function ingest(deps: AdapterDeps): Promise<AdapterResult> {
  const { supabase, maxPagesPerRun, ua, log } = deps;

  if (!(await robotsAllows(ua))) {
    return {
      imported: 0,
      duplicates: 0,
      errors: 0,
      notes: 'robots.txt Disallow → omitido',
      nextCursor: deps.startCursor,
      scanned: 0,
      geocodable: 0
    };
  }

  const total = TERMS.length;
  let idx =
    Number.isFinite(deps.startCursor) && deps.startCursor >= 0
      ? Math.floor(deps.startCursor) % total
      : 0;

  let requests = 0;
  let scanned = 0;
  let geocodable = 0;
  let imported = 0;
  let duplicates = 0;
  let errors = 0;
  let termsProcessed = 0;
  const seen = new Set<string>();

  while (requests < maxPagesPerRun && termsProcessed < total) {
    const term = TERMS[idx];
    let cursor: string | null = null;
    let dupPages = 0;

    while (requests < maxPagesPerRun) {
      let res;
      try {
        res = await fetchSearchValid(term, cursor);
      } catch (e) {
        errors++;
        log(`term="${term}" error: ${(e as Error).message}`);
        break;
      }
      requests++;

      const recs: Array<Record<string, unknown>> = [];
      for (const p of res.persons) {
        const sid = p.id != null ? String(p.id).trim() : '';
        if (!sid || seen.has(sid)) continue;
        seen.add(sid);
        const r = mapRecord(p);
        if (r) {
          recs.push(r as unknown as Record<string, unknown>);
          scanned++;
        }
      }
      geocodable += recs.length;

      let newHere = 0;
      if (recs.length) {
        const { data: cnt, error } = await supabase.rpc('ingest_persons_batch', { p_records: recs });
        if (error) {
          errors++;
          log(`rpc error term="${term}": ${error.message}`);
        } else {
          newHere = typeof cnt === 'number' ? cnt : 0;
          imported += newHere;
          duplicates += recs.length - newHere;
        }
      }

      // Corte temprano: página sin NUEVOS → ya entramos en registros ingestados.
      dupPages = newHere === 0 ? dupPages + 1 : 0;
      if (!res.hasMore || !res.nextCursor || dupPages >= DUP_PAGES) break;
      cursor = res.nextCursor;
      await sleep(THROTTLE_MS);
    }

    termsProcessed++;
    idx = (idx + 1) % total;
    if (requests < maxPagesPerRun) await sleep(THROTTLE_MS);
  }

  return {
    imported,
    duplicates,
    errors,
    notes: `${termsProcessed} términos desde idx ${deps.startCursor}, req ${requests}, nuevos ${imported}, dup ${duplicates}`,
    nextCursor: idx,
    scanned,
    geocodable
  };
}
