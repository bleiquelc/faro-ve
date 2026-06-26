import { describe, it, expect } from 'vitest';
import {
  moderationDecisionSchema,
  loginRequestSchema,
  MODERATION_DECISION
} from '$schemas/moderation';

const UUID = '11111111-2222-3333-4444-555555555555';

describe('moderationDecisionSchema', () => {
  it('acepta aprobar sin nota', () => {
    const r = moderationDecisionSchema.safeParse({ id: UUID, decision: 'approved' });
    expect(r.success).toBe(true);
  });

  it('exige nota para rechazar / duplicado / falta-info', () => {
    for (const decision of ['rejected', 'duplicate', 'needs_info'] as const) {
      expect(
        moderationDecisionSchema.safeParse({ id: UUID, decision }).success,
        `${decision} sin nota debe fallar`
      ).toBe(false);
      expect(
        moderationDecisionSchema.safeParse({ id: UUID, decision, notes: 'motivo claro' }).success,
        `${decision} con nota debe pasar`
      ).toBe(true);
    }
  });

  it('rechaza una decisión fuera del enum', () => {
    expect(
      moderationDecisionSchema.safeParse({ id: UUID, decision: 'deleted', notes: 'x' }).success
    ).toBe(false);
  });

  it('rechaza un id que no es UUID', () => {
    expect(moderationDecisionSchema.safeParse({ id: 'no-uuid', decision: 'approved' }).success).toBe(
      false
    );
  });

  it('recorta la nota y limita su longitud', () => {
    const long = 'a'.repeat(1001);
    expect(
      moderationDecisionSchema.safeParse({ id: UUID, decision: 'rejected', notes: long }).success
    ).toBe(false);
    const r = moderationDecisionSchema.safeParse({
      id: UUID,
      decision: 'rejected',
      notes: '  con espacios  '
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe('con espacios');
  });

  it('cubre las 4 decisiones del enum', () => {
    expect([...MODERATION_DECISION].sort()).toEqual(
      ['approved', 'duplicate', 'needs_info', 'rejected'].sort()
    );
  });
});

describe('loginRequestSchema', () => {
  it('normaliza el correo a minúsculas y lo recorta', () => {
    const r = loginRequestSchema.safeParse({ email: '  MOD@Faro-VE.com ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('mod@faro-ve.com');
  });

  it('rechaza un correo inválido', () => {
    expect(loginRequestSchema.safeParse({ email: 'no-es-correo' }).success).toBe(false);
    expect(loginRequestSchema.safeParse({}).success).toBe(false);
  });
});
