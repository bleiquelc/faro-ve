<script lang="ts">
  /**
   * Botón flotante de "Faro Auxilio" — SIEMPRE visible (regla del founder).
   *
   * Posición: borde derecho, centrado vertical. Es el único punto libre de las
   * barras superiores e inferiores de las pantallas a pantalla completa (home y
   * mapa), y queda fijo sobre el contenido que hace scroll en el resto.
   *
   * Lleva al núcleo estático /auxilio (primeros auxilios + contactos), que
   * funciona offline. Se oculta a sí mismo cuando ya estás en /auxilio.
   */
  import { page } from "$app/stores";
  import FaroAuxilio from "$components/FaroAuxilio.svelte";

  $: hidden = $page.url.pathname.startsWith("/auxilio");
</script>

{#if !hidden}
  <a
    href="/auxilio"
    data-sveltekit-preload-data="hover"
    aria-label="Faro Auxilio — primeros auxilios y contactos de emergencia"
    class="fa-fab group fixed right-2.5 top-1/2 z-[1100] flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl bg-faro-900/95 px-2 py-2 text-white shadow-xl shadow-black/40 ring-1 ring-white/25 backdrop-blur-md transition active:scale-95 hover:bg-faro-900 focus:outline-none focus:ring-2 focus:ring-white/70"
  >
    <span
      class="fa-ring pointer-events-none absolute inset-0 rounded-2xl"
      aria-hidden="true"
    ></span>
    <FaroAuxilio compact size={30} />
    <span class="text-[10px] font-semibold leading-none tracking-wide"
      >Auxilio</span
    >
  </a>
{/if}

<style>
  /* Anillo de atención muy sutil — invita a tocar sin alarmar. */
  .fa-ring {
    box-shadow: 0 0 0 0 rgba(255, 233, 168, 0.55);
    animation: fa-attn 3.4s ease-out infinite;
  }
  @keyframes fa-attn {
    0% {
      box-shadow: 0 0 0 0 rgba(255, 233, 168, 0.5);
    }
    60%,
    100% {
      box-shadow: 0 0 0 10px rgba(255, 233, 168, 0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fa-ring {
      animation: none;
    }
  }
</style>
