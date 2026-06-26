import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Gate del panel de moderación. Sin moderador validado → al login. Las rutas de
 * auth (login + callback) quedan exentas para no entrar en bucle de redirección.
 *
 * Defensa en profundidad: cada +page.server.ts / form action vuelve a exigir
 * locals.moderator (las escrituras corren con service_role, que ignora RLS).
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
  const isAuthRoute =
    url.pathname.startsWith('/moderar/login') || url.pathname.startsWith('/moderar/auth');

  if (!locals.moderator && !isAuthRoute) {
    throw redirect(303, '/moderar/login');
  }

  return { moderator: locals.moderator };
};
