import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { moderationDecisionSchema, type ModerationQueue } from '$schemas/moderation';
import { requireModerator } from '$server/auth';

const BUCKET_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i;
const PAGE_SIZE = 25;

/**
 * Cola de moderación. Lee vía RPC SECURITY DEFINER con service_role (server-side)
 * — el moderador YA fue validado en hooks + requireModerator. La RPC entrega
 * coords EXACTAS (el moderador las ve, #1) y NUNCA PII de reportante (#2).
 */
export const load: PageServerLoad = async ({ locals }) => {
  const moderator = requireModerator(locals);

  const [queueRes, statsRes] = await Promise.all([
    locals.supabaseAdmin.rpc('moderation_queue', { p_limit: PAGE_SIZE, p_offset: 0 }),
    locals.supabaseAdmin.rpc('moderation_stats')
  ]);

  if (queueRes.error) {
    console.error('[moderar load]', queueRes.error.message);
    throw error(502, { message: 'No se pudo cargar la cola de moderación.' });
  }

  const queue = (queueRes.data ?? { total: 0, items: [] }) as ModerationQueue;
  const stats = statsRes.error ? null : (statsRes.data as Record<string, number> | null);
  if (statsRes.error) console.error('[moderar stats]', statsRes.error.message);

  // Firmar fotos del bucket privado para que el moderador las vea (TTL corto).
  // URLs externas (fuentes ingestadas) se usan tal cual. En paralelo (cola ≤25).
  const items = await Promise.all(
    queue.items.map(async (it) => {
      let photoSigned: string | null = null;
      const raw = it.photo_url;
      if (raw) {
        if (/^https?:\/\//i.test(raw)) {
          photoSigned = raw;
        } else if (BUCKET_PATH_RE.test(raw)) {
          const { data: signed } = await locals.supabaseAdmin.storage
            .from('report-photos')
            .createSignedUrl(raw, 300);
          photoSigned = signed?.signedUrl ?? null;
        }
      }
      return { ...it, photoSigned };
    })
  );

  return { moderator, total: queue.total, items, stats };
};

export const actions: Actions = {
  decide: async ({ request, locals }) => {
    // Frontera de autorización: las escrituras corren con service_role (ignora
    // RLS) → si esto falta, cualquiera podría moderar. Sesión expirada → 403.
    if (!locals.moderator) {
      return fail(403, { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
    }

    const form = await request.formData();
    const rawId = form.get('id');
    const idStr = typeof rawId === 'string' ? rawId : '';
    const parsed = moderationDecisionSchema.safeParse({
      id: idStr,
      decision: form.get('decision'),
      notes: (form.get('notes') as string)?.trim() || undefined
    });
    if (!parsed.success) {
      return fail(400, {
        ok: false,
        id: idStr,
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos.'
      });
    }
    const { id, decision, notes } = parsed.data;

    const { data, error: rpcError } = await locals.supabaseAdmin.rpc('moderate_person', {
      p_id: id,
      p_decision: decision,
      p_moderator_id: locals.moderator.id,
      p_notes: notes ?? null
    });

    if (rpcError) {
      console.error('[moderar decide]', rpcError.message);
      return fail(502, { ok: false, id, error: 'No se pudo aplicar la decisión. Intenta de nuevo.' });
    }

    return { ok: true, id, decision, result: data };
  }
};
