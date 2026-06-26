import { error, redirect } from '@sveltejs/kit';

/**
 * Gating de moderador — server-only ($lib/server, nunca llega al cliente).
 *
 * El moderador YA fue validado en hooks.server.ts (getUser() contra Supabase
 * Auth + lookup en la tabla moderators). Estos helpers solo leen ese resultado
 * y cortan el flujo. Son la frontera de autorización del panel: como las
 * escrituras del panel corren con service_role (que ignora RLS), la autorización
 * la imponemos NOSOTROS aquí — si esto falta, cualquiera podría moderar.
 */

export interface Moderator {
  id: string;
  email: string;
  role: 'admin' | 'moderator';
}

/** Páginas: sin moderador → redirige al login (no error ruidoso). */
export function requireModerator(locals: App.Locals): Moderator {
  if (!locals.moderator) throw redirect(303, '/moderar/login');
  return locals.moderator;
}

/** Acciones / endpoints: sin moderador → 403 (no redirige un POST). */
export function assertModerator(locals: App.Locals): Moderator {
  if (!locals.moderator) throw error(403, { message: 'Acción disponible solo para moderadores.' });
  return locals.moderator;
}
