<script lang="ts">
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import InstallPrompt from '$components/InstallPrompt.svelte';
  import FaroLogo from '$components/FaroLogo.svelte';
  import FaroIcon from '$components/FaroIcon.svelte';
  import { COLOR } from '$utils/colors';

  // Acciones secundarias (fila compacta de chips glassy con iconografía propia).
  const ACTIONS = [
    { href: '/mapa?buscar=1', icon: 'search', label: 'Buscar' },
    { href: '/reportar/desaparecido', icon: 'report', label: 'Reportar' },
    { href: '/reportar/a-salvo', icon: 'safe', label: 'A salvo' },
    { href: '/reportar/punto-ayuda', icon: 'aid', label: 'Registrar' }
  ] as const;

  /**
   * Home — el MAPA VIVO es el fondo (luces de color que respiran sobre las
   * ciudades). El faro, el texto y los botones FLOTAN sobre el mapa. El número
   * REAL de personas reportadas cuenta hacia arriba al cargar → sensación de
   * "vivo". "Ver el mapa" abre /mapa (data real e interactiva).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let MapComp: any = null;

  // Conteo animado del total real + burbujas por categoría (con conteos reales).
  let total = 0;
  let stats: Record<string, number> | null = null;
  const shown = tweened(0, { duration: 1800, easing: cubicOut });

  // Burbujas con los colores de los filtros internos. Solo se muestran las que
  // tienen datos reales (>0) — no inventamos categorías vacías.
  const CAT_DEFS = [
    { token: 'missing', label: 'Desaparecidos', key: 'missing' },
    { token: 'minor', label: 'Niños', key: 'minors' },
    { token: 'medical', label: 'Emergencias', key: 'medical' },
    { token: 'deceased', label: 'Fallecidos', key: 'deceased' },
    { token: 'safe', label: 'A salvo', key: 'safe' }
  ] as const;
  $: bubbles = stats
    ? CAT_DEFS.map((d) => ({ ...d, count: stats?.[d.key] ?? 0 })).filter((b) => b.count > 0)
    : [];

  onMount(async () => {
    MapComp = (await import('$components/Map.svelte')).default;
    try {
      const res = await fetch('/api/persons/stats');
      if (res.ok) {
        const d = (await res.json()) as Record<string, number>;
        stats = d;
        total = d.total ?? 0;
        const reduce =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        await shown.set(total, { duration: reduce ? 0 : 1800 });
      }
    } catch {
      /* los números son informativos; si falla, no rompe el home */
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

      <!-- Burbujas por categoría (conteos reales, colores de filtro, vivas). -->
      {#if bubbles.length}
        <div class="flex max-w-xs flex-wrap items-center justify-center gap-1.5">
          {#each bubbles as b (b.token)}
            <span
              class="flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 shadow-sm backdrop-blur-sm"
            >
              <span
                class="hope-dot h-2.5 w-2.5 shrink-0 rounded-full"
                style="background:{COLOR[b.token]};color:{COLOR[b.token]}"
              ></span>
              <span class="text-xs font-bold tabular-nums text-white">
                {b.count.toLocaleString('es-VE')}
              </span>
              <span class="text-[11px] font-medium text-white/85">{b.label}</span>
            </span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Abajo: acciones flotantes -->
    <div class="w-full max-w-sm space-y-3">
      <a
        href="/mapa"
        data-sveltekit-preload-data="hover"
        class="min-h-tap flex w-full items-center justify-center gap-2.5 rounded-2xl bg-faro-900/55 px-6 py-3.5 text-lg font-semibold text-white shadow-xl shadow-black/30 ring-1 ring-white/20 backdrop-blur-md transition active:scale-[0.98] hover:bg-faro-900/70 focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        <FaroIcon name="map" size={24} />
        <span>Ver el mapa</span>
        <span aria-hidden="true" class="text-white/75">→</span>
      </a>

      <!-- Acciones con iconografía propia; contenedores transparentes (dejan ver el mapa). -->
      <div class="grid grid-cols-4 gap-2">
        {#each ACTIONS as a (a.href)}
          <a
            href={a.href}
            data-sveltekit-preload-data="hover"
            class="min-h-tap flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/10 px-1 py-2.5 text-[11px] font-medium text-white shadow-lg shadow-black/20 ring-1 ring-white/15 backdrop-blur-md transition active:scale-[0.97] hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            <FaroIcon name={a.icon} size={22} />
            <span>{a.label}</span>
          </a>
        {/each}
      </div>

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

<style>
  /* Las burbujas se sienten vivas: el punto de color respira con su propio glow. */
  .hope-dot {
    box-shadow: 0 0 7px 1px currentColor;
    animation: hope-breath 2.6s ease-in-out infinite;
  }
  @keyframes hope-breath {
    0%,
    100% {
      opacity: 0.7;
      transform: scale(0.82);
    }
    50% {
      opacity: 1;
      transform: scale(1.1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hope-dot {
      animation: none;
    }
  }
</style>
