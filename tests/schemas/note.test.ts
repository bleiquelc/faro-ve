import { describe, it, expect } from 'vitest';
import { reportNoteSchema, PUBLIC_NOTE_TYPE } from '$schemas/note';

const PERSON = '11111111-2222-3333-4444-555555555555';
const CARACAS = { lat: 10.4806, lng: -66.9036 };
const BOGOTA = { lat: 4.711, lng: -74.0721 };

const base = { person_id: PERSON, type: 'sighting', text: 'La vi en la plaza ayer' };

describe('reportNoteSchema', () => {
  it('acepta una nota válida con defaults', () => {
    const r = reportNoteSchema.safeParse({ person_id: PERSON, text: 'Tengo un dato' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe('info_update');
  });

  it('exige person_id UUID y texto no vacío', () => {
    expect(reportNoteSchema.safeParse({ person_id: 'no-uuid', text: 'x' }).success).toBe(false);
    expect(reportNoteSchema.safeParse({ person_id: PERSON, text: '   ' }).success).toBe(false);
  });

  it('rechaza un tipo fuera de la whitelist pública', () => {
    expect(reportNoteSchema.safeParse({ ...base, type: 'moderator_note' }).success).toBe(false);
    expect(reportNoteSchema.safeParse({ ...base, type: 'status_change' }).success).toBe(false);
  });

  it('cubre los tipos públicos permitidos', () => {
    expect([...PUBLIC_NOTE_TYPE].sort()).toEqual(['info_update', 'sighting']);
  });

  it('exige lat y lng juntas', () => {
    expect(reportNoteSchema.safeParse({ ...base, lat: CARACAS.lat }).success).toBe(false);
    expect(reportNoteSchema.safeParse({ ...base, ...CARACAS }).success).toBe(true);
  });

  it('descarta coords fuera de Venezuela (no falla la nota)', () => {
    const r = reportNoteSchema.safeParse({ ...base, ...BOGOTA });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.lat).toBeUndefined();
      expect(r.data.lng).toBeUndefined();
    }
  });

  it('valida el email del autor si se da', () => {
    expect(reportNoteSchema.safeParse({ ...base, author_email: 'no-email' }).success).toBe(false);
    expect(reportNoteSchema.safeParse({ ...base, author_email: 'a@b.com' }).success).toBe(true);
  });

  it('limita la longitud del texto', () => {
    expect(reportNoteSchema.safeParse({ ...base, text: 'a'.repeat(2001) }).success).toBe(false);
  });
});
