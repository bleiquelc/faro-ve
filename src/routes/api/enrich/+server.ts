import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/enrich — el cron escribe en la DB de Faro datos unificados de otras
 * plataformas (rellena faltantes, registra señales de reencuentro). Protegido por
 * token (ENRICH_TOKEN). El service_role vive en el server (locals.supabaseAdmin);
 * la RPC enrich_person (migración 0029) nunca pisa lo bueno ni toca PII/coords/foto.
 */
function envOf(platform: App.Platform | undefined, key: string): string {
  return (platform?.env as Record<string, string> | undefined)?.[key] ?? '';
}

// Comparación vía digests SHA-256 (tiempo constante respecto al contenido):
// comparar los hashes no filtra prefijos del token por timing side-channel.
async function tokenMatches(given: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(given)),
    crypto.subtle.digest('SHA-256', enc.encode(expected))
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  const expected = envOf(platform, 'ENRICH_TOKEN');
  if (!expected) throw error(503, { message: 'Enriquecimiento no configurado.' });
  if (!(await tokenMatches(request.headers.get('x-enrich-token') ?? '', expected))) {
    throw error(403, { message: 'Token inválido.' });
  }

  const payload = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!payload || typeof payload !== 'object' || !payload.id) throw error(400, { message: 'Falta id.' });

  const { data, error: dbErr } = await locals.supabaseAdmin.rpc('enrich_person', { payload });
  if (dbErr) throw error(500, { message: dbErr.message });
  return json({ ok: true, data });
};
