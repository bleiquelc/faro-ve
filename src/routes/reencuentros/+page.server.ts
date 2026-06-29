import type { PageServerLoad } from './$types';

/**
 * Lista pública de POSIBLES REENCUENTROS: personas buscadas que figuran A SALVO
 * en otra plataforma (las escribe el cron vía enrich_person → person_found_signals,
 * solo alta confianza o confirmadas → vista reencuentros_public, migración 0029).
 * Degrada a vacío si la vista aún no existe (antes de aplicar 0029).
 */
export interface Reencuentro {
  id: string;
  full_name: string;
  last_known_location_text: string | null;
  source: string;
  source_url: string | null;
  found_status: string | null;
  quote: string | null;
  where_text: string | null;
  confidence: string | null;
  detected_at: string;
}

export const load: PageServerLoad = async ({ locals }) => {
  try {
    // reencuentros_public se agrega en 0029 → aún no está en los tipos generados.
    const { data, error: dbErr } = await (locals.supabase as unknown as {
      from: (t: string) => {
        select: (q: string) => {
          order: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: Reencuentro[] | null; error: unknown }>;
          };
        };
      };
    })
      .from('reencuentros_public')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(300);
    if (dbErr) return { items: [] as Reencuentro[], pending: true };
    return { items: data ?? [], pending: false };
  } catch {
    return { items: [] as Reencuentro[], pending: true };
  }
};
