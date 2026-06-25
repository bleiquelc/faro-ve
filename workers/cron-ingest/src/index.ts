/**
 * Faro VE — cron-ingest worker.
 *
 * Schedule: cada 6 horas (0 0,6,12,18 UTC = 20:00, 02:00, 08:00, 14:00 Caracas).
 *
 * Por cada import_sources.enabled=true:
 *   1. Fetch + parse robots.txt; si disallow → skip + audit_log.
 *   2. Lee la URL base con UA INGEST_USER_AGENT, throttle 1 req / 2s.
 *   3. Pasa el HTML al adapter correspondiente (por slug).
 *   4. Si <INGEST_MIN_PARSE_RATE de records parsean OK → abort + email admin.
 *   5. Dedup pre-insert SQL (full_name_normalized + ±24h + ST_DWithin 5km).
 *   6. UPSERT a persons con source + source_id + auto_approved si trust=allowed.
 *   7. Actualiza import_sources con last_run_* y total_imported.
 *
 * NOTA D1: skeleton funcional. Adapters individuales se implementan en D4
 * (cada uno en su archivo bajo src/lib/server/ingest/<slug>.ts). Este index
 * orquesta, no parsea.
 */

import { createClient } from '@supabase/supabase-js';

export interface Env {
  PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_SALT: string;
  RESEND_API_KEY: string;
  RESEND_INBOUND_OPTOUT: string;
  INGEST_USER_AGENT: string;
  INGEST_REQUEST_DELAY_MS: string;
  INGEST_MIN_PARSE_RATE: string;
  INGEST_STATE?: KVNamespace;
}

interface IngestResult {
  slug: string;
  imported: number;
  duplicates: number;
  errors: number;
  notes: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runIngest(env));
  }
};

async function runIngest(env: Env): Promise<void> {
  if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[cron-ingest] Falta config Supabase — abortando.');
    return;
  }

  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: sources, error } = await supabase
    .from('import_sources')
    .select('*')
    .eq('enabled', true)
    .neq('trust', 'disabled');

  if (error) {
    console.error('[cron-ingest] No se pudo leer import_sources:', error.message);
    return;
  }

  const results: IngestResult[] = [];

  for (const source of sources ?? []) {
    try {
      const result = await ingestSource(source, env, supabase);
      results.push(result);
      console.log(
        `[cron-ingest] ${source.slug}: ${result.imported} importados / ${result.duplicates} duplicados / ${result.errors} errores`
      );

      await supabase
        .from('import_sources')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: result.errors === 0 ? 'ok' : 'partial',
          last_run_imported: result.imported,
          last_run_duplicates: result.duplicates,
          last_run_errors: result.errors,
          total_imported: (source.total_imported ?? 0) + result.imported
        })
        .eq('id', source.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron-ingest] ${source.slug} falló:`, msg);
      results.push({ slug: source.slug, imported: 0, duplicates: 0, errors: 1, notes: msg });
      await supabase
        .from('import_sources')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_status: 'failed',
          last_run_errors: 1
        })
        .eq('id', source.id);
    }
  }

  console.log('[cron-ingest] Resumen:', JSON.stringify(results, null, 2));
}

// ─────────────────────────────────────────────────────────────────────────────
// ingestSource — D1 stub. Cada slug tendrá su adapter dedicado en D4.
// ─────────────────────────────────────────────────────────────────────────────

async function ingestSource(
  source: { slug: string; base_url: string },
  env: Env,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _supabase: any
): Promise<IngestResult> {
  // D4: import dinámico del adapter por slug:
  //   const adapter = await import(`./adapters/${source.slug}.ts`);
  //   const records = await adapter.extract({ baseUrl, fetcher: makeFetcher(env) });
  //
  // robots.txt check con robots-parser, throttle 1 req/2s, dedup, upsert.

  console.log(`[cron-ingest] ${source.slug} (${source.base_url}) — adapter pendiente D4`);
  return { slug: source.slug, imported: 0, duplicates: 0, errors: 0, notes: 'D1 stub' };
}
