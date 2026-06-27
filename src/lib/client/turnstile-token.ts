/**
 * Token Turnstile PROGRAMÁTICO para el replay de la cola offline.
 *
 * El replay reusa POST /api/persons (cadena dura intacta) y por tanto necesita un
 * token Turnstile FRESCO por cada entrada (los tokens son de un solo uso y caducan
 * ~300s, así que NO se pueden guardar en la cola). Aquí se obtiene uno on-demand:
 *
 *  - Modo invisible (default): renderiza el widget fuera de pantalla e intenta
 *    resolver sin molestar al usuario. Si Cloudflare exige un challenge
 *    interactivo (común con VPN en VE), no habrá token → timeout → el llamador
 *    cae al modo interactivo (botón "Enviar ahora" del banner).
 *  - Modo interactivo: renderiza el widget VISIBLE en el contenedor dado.
 *
 * Sin PUBLIC_TURNSTILE_SITE_KEY (dev) devuelve '' — hooks.server.ts relaja
 * Turnstile en dev, así que el envío funciona igual para iterar.
 */
import { env } from '$env/dynamic/public';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove?: (id?: string) => void;
  reset?: (id?: string) => void;
};

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function api(): TurnstileApi | undefined {
  return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

function loadScript(): Promise<void> {
  if (api()) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile_script_failed'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface TokenOptions {
  /** true → widget visible en `container`; false → invisible fuera de pantalla. */
  interactive?: boolean;
  container?: HTMLElement;
  timeoutMs?: number;
}

/**
 * Devuelve un token nuevo, o '' si Turnstile no está configurado (dev).
 * Rechaza con Error si hay timeout / error de challenge (el llamador decide
 * reprogramar o pedir interacción).
 */
export async function getTurnstileToken(opts: TokenOptions = {}): Promise<string> {
  const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY ?? '';
  if (!siteKey) return ''; // dev: hooks relaja Turnstile

  const { interactive = false, container, timeoutMs = interactive ? 120_000 : 8_000 } = opts;
  await loadScript();
  const t = api();
  if (!t) throw new Error('turnstile_unavailable');

  // Contenedor: el dado (interactivo/visible) o uno temporal fuera de pantalla.
  let host: HTMLElement;
  let temporary = false;
  if (interactive && container) {
    host = container;
    host.replaceChildren();
  } else {
    host = document.createElement('div');
    host.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:300px;height:65px;opacity:0;pointer-events:none;';
    document.body.appendChild(host);
    temporary = true;
  }

  return new Promise<string>((resolve, reject) => {
    let widgetId: string | undefined;
    let settled = false;

    const cleanup = () => {
      try {
        t.remove?.(widgetId);
      } catch {
        /* noop */
      }
      if (temporary) host.remove();
    };
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      fn();
    };

    const timer = setTimeout(() => done(() => reject(new Error('turnstile_timeout'))), timeoutMs);

    try {
      widgetId = t.render(host, {
        sitekey: siteKey,
        // 'interaction-only' no muestra nada salvo que se requiera challenge.
        appearance: interactive ? 'always' : 'interaction-only',
        retry: 'never',
        callback: (token: string) => done(() => resolve(token)),
        'error-callback': () => done(() => reject(new Error('turnstile_error'))),
        'expired-callback': () => done(() => reject(new Error('turnstile_expired')))
      });
    } catch {
      done(() => reject(new Error('turnstile_render_failed')));
    }
  });
}
