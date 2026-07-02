import { describe, it, expect } from 'vitest';
import { looksLikePrivilegedKey } from '../../src/lib/utils/key-guard';

/**
 * Regresión del incidente 2-jul-2026: PUBLIC_SUPABASE_ANON_KEY estaba puesta a
 * una clave `sb_secret_…` (bypassa RLS) y se inyectaba en el HTML público. La
 * guarda impide que el cliente de navegador USE una clave privilegiada.
 */

// JWT service_role de ejemplo (header/payload/sig ficticios; el payload trae role).
function jwt(role: string): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'supabase' })}.sig`;
}

describe('looksLikePrivilegedKey', () => {
  it('detecta el nuevo formato de clave secreta (sb_secret_)', () => {
    expect(looksLikePrivilegedKey('sb_secret_AbCdEf123456')).toBe(true);
  });

  it('detecta un JWT service_role (formato viejo)', () => {
    expect(looksLikePrivilegedKey(jwt('service_role'))).toBe(true);
  });

  it('acepta la clave publishable/anon (segura de exponer)', () => {
    expect(looksLikePrivilegedKey('sb_publishable_AbCdEf123456')).toBe(false);
    expect(looksLikePrivilegedKey(jwt('anon'))).toBe(false);
  });

  it('no marca cadenas arbitrarias no-JWT', () => {
    expect(looksLikePrivilegedKey('')).toBe(false);
    expect(looksLikePrivilegedKey('no-es-una-clave')).toBe(false);
    expect(looksLikePrivilegedKey('a.b.c')).toBe(false); // 3 partes pero payload no decodable
  });
});
