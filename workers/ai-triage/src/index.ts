/**
 * Faro VE — Cron de triage IA cada 15 minutos.
 *
 * Lee N reportes pending sin ai_priority y los clasifica con Haiku 4.5:
 *   urgency: low | medium | high | critical
 *   category: standard | medical | minor | deceased | suspicious
 *   reasoning: 1-2 frases en español
 *
 * Escribe persons.ai_priority (0-100), persons.ai_reasoning, persons.ai_classified_at.
 * La cola moderación ordena por (ai_priority desc, medical_urgent desc, is_minor desc, created_at asc).
 *
 * Budget guard: si ai_budget_daily.spent_usd >= LLM_DAILY_BUDGET_USD del día → abort silencioso.
 * Privacidad: el LLM jamás recibe email/phone reportante ni coord exacta.
 */

import { createClient } from '@supabase/supabase-js';

export interface Env {
  PUBLIC_SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_GATEWAY_URL: string;
  LLM_MODEL_DEFAULT: string;
  LLM_DAILY_BUDGET_USD: string;
  TRIAGE_BATCH_SIZE: string;
}

const HAIKU_INPUT_USD_PER_M = 1.0;
const HAIKU_OUTPUT_USD_PER_M = 5.0;

const URGENCY_TO_PRIORITY: Record<string, number> = {
  critical: 95,
  high: 75,
  medium: 50,
  low: 25
};

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runModeration(env));
  }
};

// IA-moderación PRIMERO (restaurar reportes reales auto-ocultados = prioridad,
// usa poco budget) y luego triage (prioriza el resto con lo que quede del día).
async function runModeration(env: Env): Promise<void> {
  await runRestore(env);
  await runTriage(env);
}

async function runTriage(env: Env): Promise<void> {
  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const budgetLimit = Number(env.LLM_DAILY_BUDGET_USD ?? 5);
  const today = new Date().toISOString().slice(0, 10);

  const { data: budget } = await supabase
    .from('ai_budget_daily')
    .select('spent_usd')
    .eq('date', today)
    .maybeSingle();

  if (budget && Number(budget.spent_usd) >= budgetLimit) {
    console.warn(`[ai-triage] Budget diario excedido ($${budget.spent_usd}) — abort.`);
    return;
  }

  const batchSize = Math.max(1, Number(env.TRIAGE_BATCH_SIZE ?? 20));

  const { data: pending, error } = await supabase
    .from('persons')
    .select(
      'id, given_name, family_name, age, sex, status, is_minor, medical_urgent, medical_category, medical_notes, description, clothing_top, clothing_bottom, distinguishing_marks, home_neighborhood, home_city, last_seen_at, source'
    )
    // Publish-first (0021): los reportes entran 'approved', no 'pending'. Se
    // clasifican los visibles sin prioridad (no ocultos, no retirados). Más
    // nuevos primero: prioriza los casos actuales dentro del budget del día.
    .in('moderation_status', ['pending', 'approved'])
    .eq('auto_hidden', false)
    .is('ai_priority', null)
    .is('withdrawn_at', null)
    .order('created_at', { ascending: false })
    .limit(batchSize);

  if (error) {
    console.error('[ai-triage] Fetch error:', error.message);
    return;
  }

  if (!pending || pending.length === 0) {
    console.log('[ai-triage] Sin pending para clasificar.');
    return;
  }

  for (const person of pending) {
    try {
      const classification = await classifyOne(person, env);
      const priority = URGENCY_TO_PRIORITY[classification.urgency] ?? 50;
      await supabase
        .from('persons')
        .update({
          ai_priority: priority,
          ai_reasoning: classification.reasoning,
          ai_classified_at: new Date().toISOString()
        })
        .eq('id', person.id);
      console.log(`[ai-triage] ${person.id}: ${classification.urgency} (${priority})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ai-triage] ${person.id} falló:`, msg);
    }
  }
}

interface Classification {
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: 'standard' | 'medical' | 'minor' | 'deceased' | 'suspicious';
  reasoning: string;
}

async function classifyOne(person: object, env: Env): Promise<Classification> {
  const url = `${env.ANTHROPIC_GATEWAY_URL || 'https://api.anthropic.com'}/v1/messages`;
  const sanitized = stripPii(person);

  const systemPrompt = `Eres el asistente de triage de Faro VE, PWA humanitaria post-terremoto Venezuela 24-jun-2026.
Clasificas reportes de personas (sin PII) para priorizar la cola de moderación.

Reglas:
- "critical" si: es menor solo, condición médica que requiere atención urgente (insulina, diálisis, oxígeno), embarazada, recién nacido, o cuerpo NN reciente.
- "high" si: adulto en zona de búsqueda activa con condición de salud crónica conocida; menor acompañado de adulto.
- "medium" si: adulto sin condición especial, descripción razonable.
- "low" si: descripción muy vaga, duplicado probable, status ya 'safe' o 'found'.
- Si dudas, prioriza arriba.

Responde SOLO con JSON válido. Ejemplo:
{"urgency":"high","category":"medical","reasoning":"Mujer 67 años con condición de diálisis reportada en sector Petare, sin contacto desde réplica de ayer."}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: env.LLM_MODEL_DEFAULT ?? 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(sanitized) }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);

  const json = (await res.json()) as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const text = json.content?.[0]?.text ?? '{}';
  const parsed = safeJsonParse(text);

  // Charge budget (best-effort, no bloquea si falla)
  if (json.usage) {
    const cost =
      (json.usage.input_tokens / 1_000_000) * HAIKU_INPUT_USD_PER_M +
      (json.usage.output_tokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_M;
    chargeBudget(cost, env.LLM_MODEL_DEFAULT, env).catch(() => {});
  }

  return {
    urgency: ((parsed.urgency as string) ?? 'medium').toLowerCase() as Classification['urgency'],
    category: ((parsed.category as string) ?? 'standard').toLowerCase() as Classification['category'],
    reasoning: (parsed.reasoning as string) ?? 'Clasificación automática IA.'
  };
}

// ─── IA-moderación: restaurar perfiles auto-ocultados que la IA juzga reales ───
// Reusa el patrón de triage. SESGO FUERTE A RESTAURAR. Si la IA falla o no hay
// budget → default = restaurar (proteger al real, regla del founder). Así, si
// trolls ocultan un reporte verdadero, vuelve solo en minutos sin que nadie modere.
async function runRestore(env: Env): Promise<void> {
  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const batchSize = Math.max(1, Number(env.TRIAGE_BATCH_SIZE ?? 20));
  const { data: hidden, error } = await supabase
    .from('persons')
    .select(
      'id, given_name, family_name, age, sex, status, is_minor, medical_urgent, medical_category, medical_notes, description, clothing_top, clothing_bottom, distinguishing_marks, home_neighborhood, home_city, last_seen_at, source'
    )
    .eq('auto_hidden', true)
    .is('withdrawn_at', null)
    .order('hidden_at', { ascending: true })
    .limit(batchSize);

  if (error) {
    console.error('[ai-restore] Fetch error:', error.message);
    return;
  }
  if (!hidden || hidden.length === 0) return;

  // ¿Hay budget para usar la IA? Si no, default = restaurar (proteger al real).
  const budgetLimit = Number(env.LLM_DAILY_BUDGET_USD ?? 5);
  const today = new Date().toISOString().slice(0, 10);
  const { data: budget } = await supabase
    .from('ai_budget_daily')
    .select('spent_usd')
    .eq('date', today)
    .maybeSingle();
  const overBudget = budget != null && Number(budget.spent_usd) >= budgetLimit;

  for (const person of hidden) {
    const id = (person as { id: string }).id;
    try {
      if (overBudget) {
        await supabase.rpc('restore_person', {
          p_id: id,
          p_reason: 'IA sin presupuesto del día — restaurado por defecto para no perder un reporte real.'
        });
        console.log(`[ai-restore] ${id}: restaurado (sin budget)`);
        continue;
      }
      const verdict = await judgeReal(person, env);
      if (verdict.restore) {
        await supabase.rpc('restore_person', { p_id: id, p_reason: `IA juzgó real: ${verdict.reason}` });
        console.log(`[ai-restore] ${id}: RESTAURADO — ${verdict.reason}`);
      } else {
        console.log(`[ai-restore] ${id}: se mantiene oculto — ${verdict.reason}`);
      }
    } catch (err) {
      // IA falló → restaurar por defecto (proteger al real).
      await supabase
        .rpc('restore_person', { p_id: id, p_reason: 'IA no disponible — restaurado por defecto.' })
        .then(undefined, () => {});
      console.error(
        `[ai-restore] ${id} IA falló → restaurado por defecto:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

interface Verdict {
  restore: boolean;
  reason: string;
}

async function judgeReal(person: object, env: Env): Promise<Verdict> {
  const url = `${env.ANTHROPIC_GATEWAY_URL || 'https://api.anthropic.com'}/v1/messages`;
  const sanitized = stripPii(person);

  const systemPrompt = `Eres el moderador de Faro VE, PWA humanitaria post-terremoto Venezuela 24-jun-2026. Te paso un reporte de persona (SIN datos personales) que la comunidad marcó como dudoso y fue auto-ocultado. Decide si es un reporte REAL de una persona desaparecida o fallecida (restaurar) o si es BASURA evidente: spam, troll, prueba ("test test"), insultos, propaganda o texto sin sentido (mantener oculto).

SESGO FUERTE A RESTAURAR: si PODRÍA ser un reporte real, restaura. Solo manténlo oculto si es CLARAMENTE basura. Perder el reporte real de alguien atrapado es MUCHO peor que mostrar uno dudoso.

Responde SOLO con JSON válido. Ejemplo:
{"restore":true,"reason":"Describe a una mujer de 34 años con ropa y zona específicas; podría ser real."}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: env.LLM_MODEL_DEFAULT ?? 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(sanitized) }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}`);

  const json = (await res.json()) as {
    content: Array<{ text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };
  const parsed = safeJsonParse(json.content?.[0]?.text ?? '{}');

  if (json.usage) {
    const cost =
      (json.usage.input_tokens / 1_000_000) * HAIKU_INPUT_USD_PER_M +
      (json.usage.output_tokens / 1_000_000) * HAIKU_OUTPUT_USD_PER_M;
    chargeBudget(cost, env.LLM_MODEL_DEFAULT, env).catch(() => {});
  }

  // Default a restaurar salvo que la IA diga restore:false explícito.
  const restore = parsed.restore !== false;
  return { restore, reason: (parsed.reason as string) ?? 'Restaurado por defecto (proteger al real).' };
}

function stripPii(p: object): object {
  // Defensa en profundidad: aunque la query ya no pidió PII, doble check.
  const allowed = new Set([
    'given_name',
    'family_name',
    'age',
    'sex',
    'status',
    'is_minor',
    'medical_urgent',
    'medical_category',
    'medical_notes',
    'description',
    'clothing_top',
    'clothing_bottom',
    'distinguishing_marks',
    'home_neighborhood',
    'home_city',
    'last_seen_at',
    'source'
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

async function chargeBudget(usd: number, model: string, env: Env): Promise<void> {
  const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  await supabase.rpc('ai_budget_charge', { p_usd: usd, p_model: model, p_cached: false });
}
