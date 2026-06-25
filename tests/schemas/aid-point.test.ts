import { describe, it, expect } from 'vitest';
import {
  registerAidPointSchema,
  voteAidPointSchema,
  reactivateAidPointSchema,
  aidPointFiltersSchema,
  isKnownSupply,
  AID_TYPE
} from '$schemas/aid-point';

// Caracas (dentro de Venezuela) y Bogotá (fuera) para el gating geográfico.
const CARACAS = { lat: 10.4806, lng: -66.9036 };
const BOGOTA = { lat: 4.711, lng: -74.0721 };

const baseRegister = {
  type: 'water',
  name: 'Centro de acopio La Vega',
  address_text: 'Av. principal, sector La Vega',
  lat: CARACAS.lat,
  lng: CARACAS.lng
};

describe('registerAidPointSchema', () => {
  it('acepta un punto válido y aplica defaults', () => {
    const r = registerAidPointSchema.safeParse(baseRegister);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.supplies).toEqual([]); // default
      expect(r.data.type).toBe('water');
    }
  });

  it('rechaza tipo desconocido', () => {
    const r = registerAidPointSchema.safeParse({ ...baseRegister, type: 'nope' });
    expect(r.success).toBe(false);
  });

  it('exige nombre y dirección', () => {
    expect(registerAidPointSchema.safeParse({ ...baseRegister, name: 'x' }).success).toBe(false);
    expect(registerAidPointSchema.safeParse({ ...baseRegister, address_text: 'abc' }).success).toBe(
      false
    );
  });

  it('exige coords y las exige DENTRO de Venezuela', () => {
    // Sin coords → falla (a diferencia de personas, aquí son obligatorias).
    const noCoords = { type: 'water', name: 'X centro', address_text: 'calle 1' };
    expect(registerAidPointSchema.safeParse(noCoords).success).toBe(false);
    // Fuera de Venezuela → falla (no se descarta como en personas: aquí es obligatoria).
    const outside = registerAidPointSchema.safeParse({ ...baseRegister, ...BOGOTA });
    expect(outside.success).toBe(false);
  });

  it('rechaza ocupación actual mayor que la capacidad máxima', () => {
    const r = registerAidPointSchema.safeParse({
      ...baseRegister,
      type: 'shelter_temporary',
      capacity_current: 50,
      capacity_max: 10
    });
    expect(r.success).toBe(false);
  });

  it('limita la cantidad de etiquetas de insumos', () => {
    const many = Array.from({ length: 25 }, (_, i) => `s${i}`);
    const r = registerAidPointSchema.safeParse({ ...baseRegister, supplies: many });
    expect(r.success).toBe(false);
  });

  it('acepta todos los tipos del enum aid_type', () => {
    for (const t of AID_TYPE) {
      const r = registerAidPointSchema.safeParse({ ...baseRegister, type: t });
      expect(r.success, `tipo ${t}`).toBe(true);
    }
  });
});

describe('voteAidPointSchema', () => {
  it('acepta confirm y report', () => {
    expect(voteAidPointSchema.safeParse({ vote: 'confirm' }).success).toBe(true);
    expect(voteAidPointSchema.safeParse({ vote: 'report' }).success).toBe(true);
  });
  it('rechaza un voto inválido', () => {
    expect(voteAidPointSchema.safeParse({ vote: 'maybe' }).success).toBe(false);
    expect(voteAidPointSchema.safeParse({}).success).toBe(false);
  });
});

describe('reactivateAidPointSchema', () => {
  it('exige un WhatsApp de longitud razonable', () => {
    expect(reactivateAidPointSchema.safeParse({ phone: '+584121234567' }).success).toBe(true);
    expect(reactivateAidPointSchema.safeParse({ phone: '123' }).success).toBe(false);
    expect(reactivateAidPointSchema.safeParse({}).success).toBe(false);
  });
});

describe('aidPointFiltersSchema', () => {
  it('default de limit y type opcional', () => {
    const r = aidPointFiltersSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.limit).toBe(1000);
  });
  it('valida el formato de bbox', () => {
    expect(aidPointFiltersSchema.safeParse({ bbox: '-67,10,-66,11' }).success).toBe(true);
    expect(aidPointFiltersSchema.safeParse({ bbox: 'malo' }).success).toBe(false);
  });
  it('rechaza type fuera del enum', () => {
    expect(aidPointFiltersSchema.safeParse({ type: 'nope' }).success).toBe(false);
  });
});

describe('isKnownSupply', () => {
  it('reconoce etiquetas válidas y descarta basura', () => {
    expect(isKnownSupply('agua')).toBe(true);
    expect(isKnownSupply('comida')).toBe(true);
    expect(isKnownSupply('<script>')).toBe(false);
    expect(isKnownSupply('dinero')).toBe(false);
  });
});
