import { describe, it, expect } from 'vitest';
import { analyzeIgLog } from '../../scripts/lib/ig-watchdog.mjs';

/**
 * El mantenimiento vigilaba que el cron IG "corrió hoy", pero no su PRODUCCIÓN.
 * El 28-jul el cron quedó imprimiendo `Publicadas=0. Intentos=0.` cada hora
 * durante ~24h — corriendo perfecto, publicando nada — y nadie se enteró.
 * Un sistema humanitario que deja de publicar en silencio es un fallo grave.
 */

const H = 3600_000;
/** Genera una línea real de cierre del cron. */
const fin = (isoHoursAgo: number, publicadas: number, intentos: number, total: number, now = Date.parse('2026-07-29T09:00:00Z')) =>
  `${new Date(now - isoHoursAgo * H).toISOString()} Fin. Publicadas=${publicadas}. Intentos=${intentos}. Posteadas total=${total}. Reencuentros=24.`;

const NOW = Date.parse('2026-07-29T09:00:00Z');

describe('analyzeIgLog — lee la producción real del cron', () => {
  it('parsea las corridas y el último total publicado', () => {
    const log = [fin(3, 1, 4, 173), fin(2, 1, 2, 174), fin(1, 0, 5, 174)].join('\n');
    const r = analyzeIgLog(log, NOW);
    expect(r.runs).toBe(3);
    expect(r.postedTotal).toBe(174);
    expect(r.alerts).toEqual([]);
  });

  it('ignora líneas que no son cierres de corrida', () => {
    const log = ['2026-07-29T08:00:00Z Candidatos: 0 (cursor 400/41276).', fin(1, 1, 3, 174)].join('\n');
    expect(analyzeIgLog(log, NOW).runs).toBe(1);
  });
});

describe('analyzeIgLog — alerta: >24h sin intentar publicar a nadie', () => {
  it('alerta cuando lleva 26h con Intentos=0 en todas las corridas', () => {
    const log = Array.from({ length: 26 }, (_, i) => fin(26 - i, 0, 0, 174)).join('\n');
    const r = analyzeIgLog(log, NOW);
    expect(r.alerts.join(' ')).toMatch(/sin intentar/i);
  });

  it('NO alerta si hubo intentos dentro de las últimas 24h', () => {
    const log = [fin(30, 0, 0, 174), fin(5, 0, 12, 174), fin(1, 0, 0, 174)].join('\n');
    const r = analyzeIgLog(log, NOW);
    expect(r.alerts.join(' ')).not.toMatch(/sin intentar/i);
  });

  it('el caso REAL del 28-jul: intentos solo hace 21h todavía no alerta, a las 25h sí', () => {
    const base = [fin(21, 0, 11, 174), ...Array.from({ length: 20 }, (_, i) => fin(20 - i, 0, 0, 174))];
    expect(analyzeIgLog(base.join('\n'), NOW).alerts.join(' ')).not.toMatch(/sin intentar/i);
    // 4h después, el mismo log visto más tarde: ya cruza el umbral.
    expect(analyzeIgLog(base.join('\n'), NOW + 4 * H).alerts.join(' ')).toMatch(/sin intentar/i);
  });
});

describe('analyzeIgLog — alerta: el total publicado no sube en 48h', () => {
  it('alerta si Posteadas total lleva 50h clavado', () => {
    const log = Array.from({ length: 50 }, (_, i) => fin(50 - i, 0, 3, 174)).join('\n');
    const r = analyzeIgLog(log, NOW);
    expect(r.alerts.join(' ')).toMatch(/no publica hace más de/);
  });

  it('NO alerta si publicó algo dentro de las 48h', () => {
    const log = [...Array.from({ length: 50 }, (_, i) => fin(50 - i, 0, 3, 173)), fin(0.5, 1, 3, 174)].join('\n');
    expect(analyzeIgLog(log, NOW).alerts.join(' ')).not.toMatch(/no publica hace más de/);
  });

  it('NO alerta si el log no cubre 48h todavía (honesto: no hay evidencia)', () => {
    const log = [fin(5, 0, 3, 174), fin(1, 0, 3, 174)].join('\n');
    expect(analyzeIgLog(log, NOW).alerts.join(' ')).not.toMatch(/no publica hace más de/);
  });
});

describe('analyzeIgLog — bordes', () => {
  it('un log vacío o sin corridas no alerta (de eso ya avisa "corrió hoy")', () => {
    expect(analyzeIgLog('', NOW).alerts).toEqual([]);
    expect(analyzeIgLog('ruido\nsin formato', NOW).alerts).toEqual([]);
    expect(analyzeIgLog(null, NOW).alerts).toEqual([]);
  });

  it('tolera timestamps corruptos sin romperse', () => {
    const log = 'no-es-fecha Fin. Publicadas=0. Intentos=0. Posteadas total=174. Reencuentros=24.';
    expect(() => analyzeIgLog(log, NOW)).not.toThrow();
  });
});
