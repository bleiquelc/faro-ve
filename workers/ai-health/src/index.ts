/**
 * Faro VE — Cron diario "Faro Health".
 *
 * Schedule: 09:00 hora Caracas (13:00 UTC) cada día.
 *
 * Recoge métricas últimas 24h:
 *   - Reportes nuevos por categoría (missing, safe, NN, médica, menor)
 *   - Cola pending actual
 *   - Errores scrapers (import_sources last_run_status='failed')
 *   - Costo IA día previo (ai_budget_daily)
 *   - Matches confirmados
 *   - Anomalías (picos IP, blocklist hits, opt-out received)
 *
 * Haiku 4.5 vía Cloudflare AI Gateway resume → email al founder via Resend.
 *
 * Privacidad: NUNCA envía PII reportante ni coords exactas al LLM.
 * Solo agregados numéricos.
 */

import { createClient } from '@supabase/supabase-js';

export interface Env {
  PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_GATEWAY_URL: string;
  RESEND_API_KEY: string;
  LLM_MODEL_DEFAULT: string;
  HEALTH_FROM_EMAIL: string;
  HEALTH_TO_EMAIL: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runHealthCheck(env));
  }
};

async function runHealthCheck(env: Env): Promise<void> {
  if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ai-health] Falta config Supabase — abortando.');
    return;
  }

  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Recolectar métricas (agregadas, sin PII)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [
    { count: newPersons },
    { count: pendingCount },
    { count: minorCount },
    { count: medicalCount },
    { count: matchesCount },
    { data: failedSources },
    { data: budget }
  ] = await Promise.all([
    supabase.from('persons').select('*', { count: 'exact', head: true }).gte('created_at', since),
    supabase.from('persons').select('*', { count: 'exact', head: true }).eq('moderation_status', 'pending'),
    supabase.from('persons').select('*', { count: 'exact', head: true }).eq('is_minor', true).gte('created_at', since),
    supabase.from('persons').select('*', { count: 'exact', head: true }).eq('medical_urgent', true).gte('created_at', since),
    supabase.from('links').select('*', { count: 'exact', head: true }).eq('type', 'confirmed_match').gte('created_at', since),
    supabase.from('import_sources').select('slug,last_run_status,last_run_errors').eq('last_run_status', 'failed'),
    supabase.from('ai_budget_daily').select('*').eq('date', yesterday).single()
  ]);

  const metrics = {
    last_24h: {
      new_persons: newPersons ?? 0,
      minor_reports: minorCount ?? 0,
      medical_urgent: medicalCount ?? 0,
      confirmed_matches: matchesCount ?? 0
    },
    queue: {
      pending: pendingCount ?? 0
    },
    scrapers: {
      failed_sources: failedSources?.map((s) => s.slug) ?? []
    },
    ai_budget_yesterday: budget
      ? {
          spent_usd: Number(budget.spent_usd ?? 0),
          queries: Number(budget.queries ?? 0),
          cached_hits: Number(budget.cached_hits ?? 0),
          blocked_by_budget: Number(budget.blocked_by_budget ?? 0)
        }
      : null
  };

  // 2. Pasar a IA para resumen humano
  let summary = `Reporte automatizado — Faro VE día ${new Date().toISOString().slice(0, 10)}`;
  try {
    summary = await summarizeWithAI(metrics, env);
  } catch (err) {
    console.error('[ai-health] LLM falló, usando fallback formateado:', err);
    summary = formatFallback(metrics);
  }

  // 3. Enviar email
  await sendHealthEmail(summary, metrics, env);
}

async function summarizeWithAI(metrics: object, env: Env): Promise<string> {
  if (!env.ANTHROPIC_API_KEY || !env.ANTHROPIC_GATEWAY_URL) {
    throw new Error('Anthropic no configurado');
  }
  const url = `${env.ANTHROPIC_GATEWAY_URL}/v1/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: env.LLM_MODEL_DEFAULT ?? 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:
        'Eres el asistente de salud operativa de Faro VE, una PWA humanitaria que ayuda a buscar personas tras el terremoto del 24-jun-2026 en Venezuela. Resume las métricas en español neutral, claro, sin alarmismo. Destaca lo crítico al principio: errores de scraping, cola pending alta (>50), reportes de menores nuevos, presupuesto IA cerca del límite. Sé conciso (máx 200 palabras).',
      messages: [{ role: 'user', content: JSON.stringify(metrics) }]
    })
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content: Array<{ text: string }> };
  return json.content?.[0]?.text ?? formatFallback(metrics);
}

function formatFallback(m: ReturnType<typeof JSON.parse> | object): string {
  return `Resumen automático Faro VE (fallback sin IA):\n\n${JSON.stringify(m, null, 2)}`;
}

async function sendHealthEmail(summary: string, metrics: object, env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.error('[ai-health] Sin RESEND_API_KEY — log y abort');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: env.HEALTH_FROM_EMAIL,
      to: env.HEALTH_TO_EMAIL,
      subject: `[Faro Health] ${new Date().toISOString().slice(0, 10)}`,
      text: `${summary}\n\n---\nMétricas raw:\n${JSON.stringify(metrics, null, 2)}`
    })
  });
  if (!res.ok) console.error('[ai-health] Resend rechazó:', res.status, await res.text());
}
