import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Cierre de sesión del panel. POST (form en el header) → signOut → login. */
export const POST: RequestHandler = async ({ locals }) => {
  await locals.supabase.auth.signOut();
  throw redirect(303, '/moderar/login');
};
