/**
 * Adapter de ingesta venezuela-te-busca para el Worker cron-ingest.
 *
 * Reusa el núcleo compartido (parseo + geocodificación + mapeo) y escribe vía la
 * RPC idempotente `ingest_persons_batch` (no duplica: salta los source_id que ya
 * existen). Incremental: procesa hasta `maxPagesPerRun` páginas por corrida desde
 * el cursor guardado; al llegar al final reinicia el cursor para re-escanear y
 * captar nuevos. Throttle ético (1 req/2s) heredado del núcleo.
 */
import {
  PAGE_SIZE,
  THROTTLE_MS,
  sleep,
  fetchPageValid,
  mapRecord
} from '../../../../scripts/ingest/venezuela-te-busca-core.mjs';

const ROBOTS_URL = 'https://venezuela-te-busca-app.hellogafaro.workers.dev/robots.txt';

interface SupabaseLike {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface AdapterDeps {
  supabase: SupabaseLike;
  startCursor: number;
  maxPagesPerRun: number;
  ua: string;
  log: (m: string) => void;
}

export interface AdapterResult {
  imported: number;
  duplicates: number;
  errors: number;
  notes: string;
  nextCursor: number;
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

  let page = deps.startCursor >= 1 ? deps.startCursor : 1;
  let pagesThisRun = 0;
  let scanned = 0;
  let geocodable = 0;
  let imported = 0;
  let duplicates = 0;
  let errors = 0;
  let emptyStreak = 0;
  let totalCount: number | null = null;
  let maxPages = Infinity;

  while (pagesThisRun < maxPagesPerRun) {
    let data;
    try {
      data = await fetchPageValid(page);
    } catch (e) {
      errors++;
      log(`pág ${page} error: ${(e as Error).message}`);
      break;
    }

    if (totalCount === null && typeof data.totalCount === 'number') {
      totalCount = data.totalCount;
      maxPages = Math.ceil(totalCount / PAGE_SIZE) + 3;
    }

    if (!data.persons.length) {
      emptyStreak++;
      pagesThisRun++;
      if (emptyStreak >= 5 || page >= maxPages) {
        // Fin del recorrido. Reinicia el cursor a 1 SOLO si conocemos el total
        // (fin real → re-escanear nuevos el próximo ciclo). Si la fuente glitchea
        // sin dar total, conserva la página para reintentar (evita re-escanear
        // todo desde 1 en bucle).
        page = totalCount !== null ? 1 : page;
        break;
      }
      page++;
      await sleep(THROTTLE_MS);
      continue;
    }
    emptyStreak = 0;

    const recs: Array<Record<string, unknown>> = [];
    for (const p of data.persons) {
      scanned++;
      const r = mapRecord(p);
      if (r) recs.push(r as unknown as Record<string, unknown>);
    }
    geocodable += recs.length;

    if (recs.length) {
      const { data: cnt, error } = await supabase.rpc('ingest_persons_batch', { p_records: recs });
      if (error) {
        errors++;
        log(`rpc error pág ${page}: ${error.message}`);
      } else {
        const ins = typeof cnt === 'number' ? cnt : 0;
        imported += ins;
        duplicates += recs.length - ins;
      }
    }

    page++;
    pagesThisRun++;
    if (page > maxPages) {
      page = 1;
      break;
    }
    await sleep(THROTTLE_MS);
  }

  return {
    imported,
    duplicates,
    errors,
    notes: `escaneados ${scanned}, geocodables ${geocodable}, nuevos ${imported}, dup ${duplicates}`,
    nextCursor: page,
    scanned,
    geocodable
  };
}
