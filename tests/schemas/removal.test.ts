import { describe, it, expect } from 'vitest';
import { removalReasonSchema } from '../../src/lib/schemas/person';

/**
 * Retiro self-service (0031). El `id` va en la URL; el body solo trae el motivo.
 */
describe('removalReasonSchema', () => {
  it('acepta los 3 motivos válidos', () => {
    for (const relationship of ['self', 'family_deceased', 'other'] as const) {
      const r = removalReasonSchema.safeParse({ relationship });
      expect(r.success, relationship).toBe(true);
    }
  });

  it('default relationship = other cuando falta', () => {
    const r = removalReasonSchema.parse({});
    expect(r.relationship).toBe('other');
  });

  it('rechaza un motivo desconocido', () => {
    expect(removalReasonSchema.safeParse({ relationship: 'hacker' }).success).toBe(false);
  });

  it('recorta y limita la nota a 500 chars', () => {
    expect(removalReasonSchema.safeParse({ note: 'x'.repeat(501) }).success).toBe(false);
    const r = removalReasonSchema.parse({ note: '  hola  ' });
    expect(r.note).toBe('hola');
  });

  it('acepta el token turnstile opcional', () => {
    const r = removalReasonSchema.parse({ relationship: 'self', 'cf-turnstile-response': 'tok' });
    expect(r.relationship).toBe('self');
  });
});
