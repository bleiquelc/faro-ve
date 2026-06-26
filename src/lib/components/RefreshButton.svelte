<script lang="ts">
  /**
   * RefreshButton — "Actualizar": trae lo más reciente con precisión.
   *
   * Trae DOS cosas (lo que pidió el founder: nuevos registros + mejoras nuevas):
   *  1. Datos frescos: el mapa va por red (no se cachea aún) → la recarga los trae.
   *  2. Versión nueva de la app: pide al SW buscar update (reg.update()). Nuestro
   *     SW hace skipWaiting()+clients.claim(); cuando el nuevo TOMA CONTROL dispara
   *     `controllerchange` → recién ahí recargamos, para que la recarga corra sobre
   *     el shell actualizado (no antes, que serviría el shell viejo y la mejora
   *     llegaría una recarga tarde). Si no hay versión nueva / no hay SW / offline,
   *     recarga directa. Red de seguridad: si controllerchange no llega, recarga a 4s.
   *
   * Accesible: <button> real, aria-label, estado ocupado anunciado, tap ≥44px.
   */

  import FaroIcon from '$components/FaroIcon.svelte';

  export let label = 'Actualizar';
  export let compact = false; // solo ícono (para barras compactas)
  export let tone: 'light' | 'dark' = 'dark'; // dark = sobre fondo claro

  let busy = false;

  function hardReload() {
    if (typeof location !== 'undefined') location.reload();
  }

  async function refresh() {
    if (busy) return;
    busy = true;

    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      hardReload();
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        hardReload();
        return;
      }

      // Recargamos UNA vez: cuando el nuevo SW tome control, o por red de seguridad.
      let done = false;
      const reloadOnce = () => {
        if (done) return;
        done = true;
        hardReload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });

      await reg.update().catch(() => {});
      // Si algún SW quedó esperando, fuérzalo (nuestro SW ya hace skipWaiting,
      // esto es defensa para cualquier variante futura).
      reg.waiting?.postMessage?.({ type: 'SKIP_WAITING' });

      // Sin versión nueva (ni instalando ni esperando) → no habrá controllerchange:
      // recargamos igual para traer registros frescos.
      if (!reg.installing && !reg.waiting) {
        reloadOnce();
        return;
      }

      // Hay una versión instalándose: espera el controllerchange; si no llega en
      // 4s (p.ej. el nuevo no toma control), recarga igual para no colgar el botón.
      setTimeout(reloadOnce, 4000);
    } catch {
      hardReload();
    }
  }
</script>

<button
  type="button"
  on:click={refresh}
  disabled={busy}
  aria-label="Actualizar para ver los reportes y mejoras más recientes"
  aria-busy={busy}
  title="Actualizar"
  class="min-h-tap inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.96] disabled:opacity-70 {tone ===
  'dark'
    ? 'border-gray-200 bg-white/90 text-faro-900 hover:border-faro-300 focus:ring-2 focus:ring-faro-300'
    : 'border-white/25 bg-white/15 text-white backdrop-blur-md hover:bg-white/25 focus:ring-2 focus:ring-white/60'} focus:outline-none"
>
  <span class="inline-flex leading-none" class:faro-spin={busy}><FaroIcon name="refresh" size={18} /></span>
  {#if !compact}
    <span>{busy ? 'Actualizando…' : label}</span>
  {/if}
</button>

<style>
  .faro-spin {
    display: inline-block;
    animation: faro-refresh-spin 0.8s linear infinite;
  }
  @keyframes faro-refresh-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .faro-spin {
      animation: none;
    }
  }
</style>
