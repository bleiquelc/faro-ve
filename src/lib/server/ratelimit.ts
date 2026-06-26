/**
 * Mínimo estructural del KV que usamos (get/put). Evita el choque de identidad
 * entre el `KVNamespace` global (ambient de @cloudflare/workers-types, el que usa
 * app.d.ts) y el importado como módulo. Cualquier KVNamespace encaja por forma.
 */
interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * Rate-limit de ventana fija sobre Cloudflare KV — server-only.
 *
 * Devuelve true si se permite el intento (y lo cuenta), false si se excedió.
 * La clave lleva el bucket de la ventana → cada ventana es una clave nueva con
 * TTL → se auto-expira (nunca permanente; no castiga a IPs detrás de NAT).
 *
 * Mismo patrón endurecido que hooks.server.ts (handleRateLimit), reusable para
 * mutaciones que NO pasan por la cadena pública /api (p.ej. el login del panel).
 */
export async function fixedWindowRateLimit(
  kv: KvLike,
  bucketKey: string,
  windowSec: number,
  max: number
): Promise<boolean> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowBucket = Math.floor(nowSec / windowSec);
  const key = `rl:${bucketKey}:${windowBucket}`;

  const count = parseInt((await kv.get(key)) ?? '0', 10) || 0;
  if (count >= max) return false;

  const remaining = windowSec - (nowSec % windowSec);
  await kv.put(key, (count + 1).toString(), { expirationTtl: Math.max(60, remaining) });
  return true;
}
