import { describe, it, expect } from 'vitest';
import { looksLikeRealError } from '../../scripts/lib/err-log.mjs';

/**
 * El mantenimiento alertaba "el reel registró errores" TODOS LOS DÍAS desde el
 * 13-jul porque `daily.mjs` consideraba error cualquier err.log con tamaño > 0.
 * Pero ffmpeg escribe TODO su output normal a stderr (banner de versión, streams,
 * progreso) → `reel.err.log` pesaba 13-16 KB a diario aunque el reel se
 * programara perfecto. Resultado: exit 1 con "2 PROBLEMA(S)" a diario y el
 * founder dejó de distinguir señal de ruido.
 *
 * Los fragmentos de abajo son REALES, copiados de ~/.faro-ig/*.bak.
 */

// Ruido: salida normal de ffmpeg (reel.err.log.2026-07-29.bak).
const RUIDO_FFMPEG = `ffmpeg version N-124033-gd538a71ad5-tessus  https://evermeet.cx/ffmpeg/  Copyright (c) 2000-2026 the FFmpeg developers
  built with Apple clang version 17.0.0 (clang-1700.6.4.2)
  libavutil      60. 30.100 / 60. 30.100
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/Users/x/.faro-ig/reel-work/bgvideo.mp4':
  Metadata:
    major_brand     : isom
  Duration: 00:00:19.35, start: 0.000000, bitrate: 2632 kb/s
  Stream #0:0(und): Video: h264 (avc1 / 0x31637661), yuv420p(tv, bt709), 1080x1920
[libx264 @ 0x7f8e1] using SAR=1/1
[out#0/mp4 @ 0x7f8e2] video:1234kB audio:0kB subtitle:0kB
frame=  450 fps= 89 q=28.0 Lsize=    1234kB time=00:00:15.00 bitrate= 673.9kbits/s speed=2.97x`;

// Error REAL: el crash del cron IG (cron.err.log.2026-07-29.bak).
const CRASH_IG = `<anonymous_script>:1
<!DOCTYPE html>
^

SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
    at JSON.parse (<anonymous>)
    at parseJSONFromBytes (node:internal/deps/undici/undici:4255:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)

Node.js v24.14.0`;

// Error REAL: la red al despertar el Mac (reel.err.log.2026-07-05.bak).
const RED_CAIDA = `TypeError: fetch failed
    at node:internal/deps/undici/undici:13502:13
  [cause]: ConnectTimeoutError: Connect Timeout Error
      code: 'UND_ERR_CONNECT_TIMEOUT'`;

describe('looksLikeRealError — ruido que NO debe alertar', () => {
  it('la salida normal de ffmpeg no es un error', () => {
    expect(looksLikeRealError(RUIDO_FFMPEG)).toBe(false);
  });

  it('un log vacío o en blanco no es un error', () => {
    expect(looksLikeRealError('')).toBe(false);
    expect(looksLikeRealError('   \n\n  ')).toBe(false);
    expect(looksLikeRealError(null)).toBe(false);
  });

  it('avisos informativos sueltos no son un error', () => {
    expect(looksLikeRealError('Warning: deprecated flag\nnota: seguimos igual')).toBe(false);
  });

  it('ruido de ffmpeg CON progreso repetido tampoco alerta', () => {
    expect(looksLikeRealError(RUIDO_FFMPEG.repeat(3))).toBe(false);
  });
});

describe('looksLikeRealError — errores reales que SÍ deben alertar', () => {
  it('detecta el crash de JSON del cron IG', () => {
    expect(looksLikeRealError(CRASH_IG)).toBe(true);
  });

  it('detecta la red caída al despertar el Mac', () => {
    expect(looksLikeRealError(RED_CAIDA)).toBe(true);
  });

  it('detecta un error real ENTERRADO en el ruido de ffmpeg', () => {
    // El caso peligroso: si un fallo real ocurre el mismo día que el ruido,
    // NO puede quedar enmascarado.
    expect(looksLikeRealError(RUIDO_FFMPEG + '\n' + CRASH_IG)).toBe(true);
  });

  it('detecta las familias habituales de fallo', () => {
    expect(looksLikeRealError('Error: no se pudo abrir el archivo')).toBe(true);
    expect(looksLikeRealError('Traceback (most recent call last):')).toBe(true);
    expect(looksLikeRealError('connect ECONNREFUSED 127.0.0.1:54321')).toBe(true);
    expect(looksLikeRealError('getaddrinfo ENOTFOUND api.buffer.com')).toBe(true);
    expect(looksLikeRealError('npm ERR! code ELIFECYCLE')).toBe(true);
    expect(looksLikeRealError('Error: Cannot find module "./x.mjs"')).toBe(true);
  });
});
