<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import InstallPrompt from '$components/InstallPrompt.svelte';
  import FaroLogo from '$components/FaroLogo.svelte';

  /**
   * Home — el MAPA VIVO es el fondo (luces de color que respiran sobre las
   * ciudades). El faro, el texto y los botones FLOTAN sobre el mapa. El número
   * REAL de personas reportadas cuenta hacia arriba al cargar → sensación de
   * "vivo". "Ver el mapa" abre /mapa (data real e interactiva).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;

  // Conteo animado del total real de personas reportadas.
  let total = 0;
  const shown = tweened(0, { duration: 1800, easing: cubicOut });

  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
    try {
      const res = await fetch('/api/persons?count=exact');
      if (res.ok) {
        const d = (await res.json()) as { total?: number };
        total = d.total ?? 0;
        const reduce =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        await shown.set(total, { duration: reduce ? 0 : 1800 });
      }
    } catch {
      /* el número es decorativo; si falla, no rompe el home */
    }
  });
</script>

<svelte:head>
  <title>Faro VE — Mapa de Esperanza Venezuela</title>
  <meta
    name="description"
    content="Mapa humanitario para reportar y buscar personas tras el terremoto del 24-jun-2026 en Venezuela. Gratuito, con privacidad por diseño."
  />
  <meta property="og:title" content="Faro VE — Mapa de Esperanza Venezuela" />
  <meta
    property="og:description"
    content="Reporta y busca personas tras el terremoto del 24-jun-2026 en Venezuela. Mapa instalable, gratuito, anti-estafa."
  />
  <meta name="twitter:title" content="Faro VE — Mapa de Esperanza Venezuela" />
  <meta
    name="twitter:description"
    content="Reporta y busca personas tras el terremoto del 24-jun-2026 en Venezuela."
  />
</svelte:head>

<div class="relative h-[100dvh] w-full overflow-hidden bg-[#06202b]">
  <!-- Fondo: el mapa de esperanza VIVO (ambiente, no interactivo) -->
  <div class="absolute inset-0" aria-hidden="true">
    {#if MapComp}
      <svelte:component this={MapComp} interactive={false} />
    {/if}
  </div>

  <!-- Viñeta sutil arriba/abajo solo para legibilidad del texto flotante.
       El centro queda despejado: se ven las luces del mapa. z-[800] sobre Leaflet. -->
  <div
    class="pointer-events-none absolute inset-0 z-[800] bg-gradient-to-b from-[#06202b]/75 via-transparent to-[#06202b]/85"
    aria-hidden="true"
  ></div>

  <!-- Contenido flotante (sin tarjeta) -->
  <main
    class="absolute inset-0 z-[1000] flex flex-col items-center justify-between px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2.25rem)] text-center text-white"
  >
    <!-- Arriba: faro con halo oscuro + título -->
    <div class="flex flex-col items-center gap-3">
      <div class="relative grid place-items-center">
        <!-- Halo oscuro: pocket de noche para que la luz del faro brille -->
        <div
          class="pointer-events-none absolute h-48 w-48 rounded-full"
          style="background: radial-gradient(circle, rgba(3,16,23,0.92) 0%, rgba(3,16,23,0.6) 36%, rgba(3,16,23,0) 70%)"
          aria-hidden="true"
        ></div>
        <div class="relative">
          <FaroLogo size={104} light />
        </div>
      </div>
      <h1 class="text-2xl font-bold [text-shadow:0_2px_12px_rgb(0_0_0_/0.7)]">
        Faro VE — Mapa de Esperanza
      </h1>
      <p class="max-w-xs text-sm text-white/90 [text-shadow:0_1px_8px_rgb(0_0_0_/0.7)]">
        Reporta y busca personas tras el terremoto del 24-jun-2026 en Venezuela.
      </p>

      <!-- Número REAL contando hacia arriba — el mapa está vivo. -->
      {#if total > 0}
        <p class="mt-1 flex flex-col items-center leading-none" aria-label="{total} personas reportadas">
          <span
            class="text-4xl font-extrabold tabular-nums text-white [text-shadow:0_2px_16px_rgb(0_0_0_/0.85)]"
          >
            {Math.round($shown).toLocaleString('es-VE')}
          </span>
          <span
            class="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85 [text-shadow:0_1px_8px_rgb(0_0_0_/0.7)]"
          >
            personas reportadas
          </span>
        </p>
      {/if}
    </div>

    <!-- Abajo: acciones flotantes -->
    <div class="w-full max-w-sm space-y-3">
      <a
        href="/mapa"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex w-full items-center justify-center gap-2.5 rounded-2xl bg-faro-900 px-6 py-4 text-lg font-semibold text-white shadow-xl shadow-black/40 ring-1 ring-white/10 transition active:scale-[0.98] hover:bg-faro-800 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <span aria-hidden="true">🗺️</span>
        <span>Ver el mapa</span>
        <span aria-hidden="true" class="text-white/80">→</span>
      </a>

      <div class="grid grid-cols-2 gap-3">
        <a
          href="/reportar/desaparecido"
          data-sveltekit-preload-data="hover"
          class="min-h-tap flex flex-col items-center justify-center gap-1 rounded-xl border border-white/25 bg-white/15 px-3 py-3 text-sm font-medium text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-white/25 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          <span class="text-xl" aria-hidden="true">🔎</span>
          <span>Reportar a alguien</span>
        </a>
        <a
          href="/reportar/a-salvo"
          data-sveltekit-preload-data="hover"
          class="min-h-tap flex flex-col items-center justify-center gap-1 rounded-xl border border-white/25 bg-white/15 px-3 py-3 text-sm font-medium text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-white/25 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/60"
        >
          <span class="text-xl" aria-hidden="true">💚</span>
          <span>Estoy a salvo</span>
        </a>
      </div>

      <a
        href="/reportar/punto-ayuda"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-black/30 backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <span aria-hidden="true">🤝</span>
        <span>Registrar un punto de ayuda</span>
      </a>

      <div class="flex items-center justify-center pt-1">
        <InstallPrompt />
      </div>

      <p class="text-xs text-white/70 [text-shadow:0_1px_6px_rgb(0_0_0_/0.7)]">
        Sin ánimo de lucro ·
        <a href="mailto:contacto@faro-ve.com" class="underline">Contacto</a> ·
        <a href="mailto:opt-out@faro-ve.com" class="underline">opt-out</a>
      </p>
    </div>
  </main>
</div>
