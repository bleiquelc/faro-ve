import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { z } from "zod";
import { KNOWLEDGE_BASE, SYSTEM_RULES } from "$server/ai/auxilio-knowledge";

/**
 * POST /api/ai/ask — chat IA de Faro Auxilio (Haiku 4.5 vía Cloudflare AI
 * Gateway, o directo a Anthropic si no hay gateway).
 *
 * Cadena de protección (hooks.server.ts, antes de aquí): config-guard →
 * rate-limit 10/IP/día (KV) → kill-switch. (Exento de Turnstile: es de solo
 * lectura, acotado por rate-limit + budget; un captcha por mensaje rompería el
 * chat.) Aquí: validación Zod + geo-switch + budget guard + llamada al modelo.
 *
 * ROBUSTEZ (el núcleo estático es el fallback): si falta la API key, se topa el
 * budget, no hay red, o el modelo falla → responde 200 con `fallback:true` y un
 * mensaje que remite a las guías + 911. Nunca rompe la página.
 *
 * Privacidad (regla #16): el modelo recibe solo la pregunta del usuario + las
 * guías verificadas. No se le envía PII ni datos de la base.
 */

const askSchema = z.object({
  question: z.string().trim().min(2, "Escribe tu pregunta").max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .max(8)
    // Rechaza turnos consecutivos del mismo rol: impide que un cliente forje
    // turnos "assistant" falsos para inyectar contexto/instrucciones.
    .refine(
      (h) => h.every((m, i) => i === 0 || m.role !== h[i - 1].role),
      "Historial inválido.",
    )
    .optional(),
});

const FALLBACK =
  "El asistente con IA no está disponible en este momento. Usa las guías de Faro Auxilio (tienen los pasos verificados) y, ante una emergencia, llama al 911.";

const GEO_FALLBACK =
  "El asistente con IA está disponible por ahora solo en Venezuela. Las guías de Faro Auxilio sí funcionan en todas partes; ante una emergencia, llama al número local de emergencias.";

// Precios Haiku 4.5 (USD por millón de tokens) — para el budget guard.
const HAIKU_INPUT_USD_PER_M = 1.0;
const HAIKU_OUTPUT_USD_PER_M = 5.0;

function envOf(platform: App.Platform | undefined, key: string): string {
  return (platform?.env as Record<string, string> | undefined)?.[key] ?? "";
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw error(400, { message: "Cuerpo JSON inválido." });
  }
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    throw error(400, {
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
  }
  const { question, history } = parsed.data;

  const apiKey = envOf(platform, "ANTHROPIC_API_KEY");
  // Sin key → solo estático (no dispara gasto). Default seguro.
  if (!apiKey) return json({ ok: true, fallback: true, answer: FALLBACK });

  // Geo-switch (default GLOBAL). Solo gatea si app_config.ai_ve_only = 'true'.
  // La lectura va por la función SECURITY DEFINER app_flag (si no existe o
  // falla, default = global → no gatea). Ver migración 0023.
  try {
    const { data: flag } = await locals.supabaseAdmin.rpc("app_flag", {
      p_key: "ai_ve_only",
    });
    if (flag === "true") {
      const country =
        (platform as { cf?: { country?: string } } | undefined)?.cf?.country ??
        request.headers.get("CF-IPCountry") ??
        "";
      if (country !== "VE")
        return json({
          ok: true,
          fallback: true,
          geo: true,
          answer: GEO_FALLBACK,
        });
    }
  } catch {
    /* sin config legible → global (no gatear). */
  }

  // Budget guard ($5/día por defecto, regla #14). Si se topa → solo estático.
  const budgetLimit = Number(envOf(platform, "LLM_DAILY_BUDGET_USD") || "5");
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: b } = await locals.supabaseAdmin
      .from("ai_budget_daily")
      .select("spent_usd")
      .eq("date", today)
      .maybeSingle();
    if (b && Number(b.spent_usd) >= budgetLimit) {
      locals.supabaseAdmin.rpc("ai_budget_blocked").then(undefined, () => {});
      return json({ ok: true, fallback: true, budget: true, answer: FALLBACK });
    }
  } catch {
    /* si no se puede leer el budget, el rate-limit 10/día acota el gasto. */
  }

  const model =
    envOf(platform, "LLM_MODEL_DEFAULT") || "claude-haiku-4-5-20251001";
  const gateway = envOf(platform, "ANTHROPIC_GATEWAY_URL");
  const url = `${gateway || "https://api.anthropic.com"}/v1/messages`;

  const messages = [
    ...(history ?? []).map((h) => ({ role: h.role, content: h.content })),
    { role: "user" as const, content: question },
  ];

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        // system como string (compatible sin headers beta). El caché de
        // respuestas idénticas lo da el Cloudflare AI Gateway (regla #14).
        system: `${SYSTEM_RULES}\n\n${KNOWLEDGE_BASE}`,
        messages,
      }),
    });

    if (!res.ok) {
      console.error("[ai/ask] anthropic", res.status);
      return json({ ok: true, fallback: true, answer: FALLBACK });
    }

    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const answer = (data.content ?? [])
      .map((c) => c.text ?? "")
      .join("")
      .trim();
    if (!answer) return json({ ok: true, fallback: true, answer: FALLBACK });

    // Cobra el budget (best-effort, no bloquea la respuesta).
    if (data.usage) {
      const cost =
        ((data.usage.input_tokens ?? 0) / 1_000_000) * HAIKU_INPUT_USD_PER_M +
        ((data.usage.output_tokens ?? 0) / 1_000_000) * HAIKU_OUTPUT_USD_PER_M;
      locals.supabaseAdmin
        .rpc("ai_budget_charge", {
          p_usd: cost,
          p_model: model,
          p_cached: false,
        })
        .then(undefined, () => {});
    }

    return json({ ok: true, fallback: false, answer });
  } catch (e) {
    console.error("[ai/ask]", e instanceof Error ? e.message : String(e));
    return json({ ok: true, fallback: true, answer: FALLBACK });
  }
};
