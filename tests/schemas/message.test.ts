import { describe, it, expect } from 'vitest';
import { relayMessageSchema, relayReplySchema } from '../../src/lib/schemas/message';

describe('relayMessageSchema (relay anti-estafa, 0032)', () => {
  const valid = {
    sender_email: 'maria@example.com',
    body: 'Creo que vi a esta persona en el refugio de Catia La Mar el martes.'
  };

  it('acepta el mínimo válido (solo email + mensaje)', () => {
    const r = relayMessageSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sender_email).toBe('maria@example.com');
      expect(r.data.sender_name).toBeUndefined();
      expect(r.data.subject).toBeUndefined();
    }
  });

  it('normaliza el email a minúsculas y con trim', () => {
    const r = relayMessageSchema.safeParse({ ...valid, sender_email: '  MARIA@Example.COM ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sender_email).toBe('maria@example.com');
  });

  it('rechaza email inválido (sin él no hay canal de respuesta)', () => {
    expect(relayMessageSchema.safeParse({ ...valid, sender_email: 'no-es-email' }).success).toBe(false);
    expect(relayMessageSchema.safeParse({ body: valid.body }).success).toBe(false);
  });

  it('rechaza mensaje corto (<10) y largo (>2000)', () => {
    expect(relayMessageSchema.safeParse({ ...valid, body: 'hola' }).success).toBe(false);
    expect(relayMessageSchema.safeParse({ ...valid, body: 'x'.repeat(2001) }).success).toBe(false);
  });

  it('nombre y asunto vacíos se vuelven undefined (no strings vacíos a la DB)', () => {
    const r = relayMessageSchema.safeParse({ ...valid, sender_name: '', subject: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.sender_name).toBeUndefined();
      expect(r.data.subject).toBeUndefined();
    }
  });

  it('respeta topes de longitud de nombre (120) y asunto (200)', () => {
    expect(relayMessageSchema.safeParse({ ...valid, sender_name: 'x'.repeat(121) }).success).toBe(false);
    expect(relayMessageSchema.safeParse({ ...valid, subject: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('relayReplySchema (respuesta vía reply_token)', () => {
  const token = 'a'.repeat(48);

  it('acepta token hex de 48 + respuesta válida', () => {
    expect(relayReplySchema.safeParse({ token, body: 'Sí, soy yo. Gracias por avisar.' }).success).toBe(true);
  });

  it('rechaza tokens malformados (longitud o charset)', () => {
    expect(relayReplySchema.safeParse({ token: 'a'.repeat(47), body: 'Hola, gracias.' }).success).toBe(false);
    expect(relayReplySchema.safeParse({ token: 'z'.repeat(48), body: 'Hola, gracias.' }).success).toBe(false);
    expect(relayReplySchema.safeParse({ token: '../../../etc', body: 'Hola, gracias.' }).success).toBe(false);
  });

  it('rechaza respuesta corta (<5) y larga (>2000)', () => {
    expect(relayReplySchema.safeParse({ token, body: 'ok' }).success).toBe(false);
    expect(relayReplySchema.safeParse({ token, body: 'x'.repeat(2001) }).success).toBe(false);
  });
});
