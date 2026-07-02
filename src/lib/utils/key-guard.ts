/**
 * Guarda anti clave-privilegiada (incidente 2-jul-2026).
 *
 * `PUBLIC_SUPABASE_ANON_KEY` se inyecta en el HTML del cliente (por diseño de
 * SvelteKit: toda var `PUBLIC_*`). Si su valor fuera una clave SECRETA/
 * service_role, cualquiera podría leerla del código fuente y saltar RLS para
 * ver coord exacta + PII (reglas #1/#2). Esta función pura detecta esas claves
 * para que el cliente de navegador NUNCA las use y para hacer ruidoso el error.
 *
 * Módulo sin dependencias de `$env` → testeable de forma aislada.
 */

/**
 * ¿La cadena parece una clave PRIVILEGIADA (bypassa RLS)?
 *  - `sb_secret_…`  → clave secreta del nuevo formato de Supabase (server-only).
 *  - JWT con `"role":"service_role"` → service_role del formato viejo.
 */
export function looksLikePrivilegedKey(key: string): boolean {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return true;
  // JWT: header.payload.signature — el payload (base64url) trae el rol.
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString();
      const payload = JSON.parse(json);
      if (payload?.role === 'service_role') return true;
    } catch {
      /* no es un JWT decodable → no concluir nada */
    }
  }
  return false;
}
