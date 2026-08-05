/**
 * idle-ui.ts — visibilidad de la UI del home por ACTIVIDAD (modo memorial).
 *
 * Al entrar, el home es solo el mapa de luz (UI oculta). Cualquier gesto
 * (mover el dedo/ratón, tocar, teclado, foco) la revela; tras `idleMs` sin
 * actividad vuelve a desvanecerse y el memorial respira solo.
 *
 * Notas de diseño:
 *  - La UI se oculta SOLO visualmente (opacity) — nunca `aria-hidden` ni
 *    `display:none`: el lector de pantalla siempre la tiene, y el primer Tab
 *    la revela (focusin cuenta como actividad).
 *  - `shouldStayVisible` permite no esconder mientras haya foco de teclado
 *    dentro de la UI (ocultar bajo el foco desorienta).
 *  - SSR-safe: sin window no instala nada (la UI queda visible, correcto para
 *    no-JS — la regla #7 exige el footer visible).
 */
import { writable, type Writable } from 'svelte/store';

export interface IdleUI {
  /** true = UI visible. Suscribible con $ en componentes. */
  visible: Writable<boolean>;
  /** Revela la UI y re-arma el temporizador. */
  wake: () => void;
  /** Oculta la UI ya mismo (entrada al memorial). */
  sleep: () => void;
  /** Quita listeners y timers. Llamar en onDestroy. */
  destroy: () => void;
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'focusin'] as const;

export function createIdleUI(
  idleMs = 10_000,
  shouldStayVisible?: () => boolean
): IdleUI {
  const visible = writable(true); // SSR/no-JS: visible por defecto
  let timer: ReturnType<typeof setTimeout> | null = null;

  const arm = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // Con foco de teclado dentro de la UI no se esconde: re-armamos y esperamos.
      if (shouldStayVisible?.()) {
        arm();
        return;
      }
      visible.set(false);
    }, idleMs);
  };

  const wake = (): void => {
    visible.set(true);
    arm();
  };

  const sleep = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    visible.set(false);
  };

  if (typeof window !== 'undefined') {
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, wake, { passive: true });
    }
  }

  return {
    visible,
    wake,
    sleep,
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (typeof window !== 'undefined') {
        for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, wake);
      }
    }
  };
}
