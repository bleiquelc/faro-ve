<script lang="ts">
  import { page } from '$app/stores';
  import { COLOR } from '$utils/colors';

  /**
   * FilterChips — filtros del mapa, URL-driven (navegación SvelteKit).
   * Cada chip es un enlace que setea query params; /mapa reconstruye el endpoint.
   * Accesible: enlaces reales, aria-current en el activo, tap targets ≥44px.
   */

  type Chip = { label: string; params: Record<string, string>; dot?: string };

  const CHIPS: Chip[] = [
    { label: 'Todos', params: {} },
    { label: 'Desaparecidos', params: { status: 'missing' }, dot: COLOR.missing },
    { label: 'Menores', params: { is_minor: 'true' }, dot: COLOR.minor },
    { label: 'Urgencia médica', params: { medical_urgent: 'true' }, dot: COLOR.medical },
    { label: 'A salvo', params: { status: 'safe_self_report' }, dot: COLOR.safe },
    { label: 'Cuerpos NN', params: { status: 'unidentified_body' }, dot: COLOR.deceased }
  ];

  function hrefFor(params: Record<string, string>): string {
    const sp = new URLSearchParams(params);
    const qs = sp.toString();
    return qs ? `/mapa?${qs}` : '/mapa';
  }

  function isActive(params: Record<string, string>): boolean {
    const cur = $page.url.searchParams;
    const keys = ['status', 'is_minor', 'medical_urgent'];
    // activo si los params del chip coinciden exactamente con los relevantes de la URL
    const curRelevant = keys.filter((k) => cur.has(k));
    const chipKeys = Object.keys(params);
    if (chipKeys.length !== curRelevant.length) return false;
    return chipKeys.every((k) => cur.get(k) === params[k]);
  }
</script>

<nav
  class="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  aria-label="Filtrar reportes"
>
  {#each CHIPS as chip}
    {@const active = isActive(chip.params)}
    <a
      href={hrefFor(chip.params)}
      data-sveltekit-preload-data="tap"
      aria-current={active ? 'page' : undefined}
      class="min-h-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition {active
        ? 'border-faro-900 bg-faro-900 text-white shadow-sm'
        : 'border-gray-200 bg-white/90 text-gray-700 hover:border-faro-300'}"
    >
      {#if chip.dot}
        <span class="h-2.5 w-2.5 rounded-full" style="background:{chip.dot}" aria-hidden="true"></span>
      {/if}
      {chip.label}
    </a>
  {/each}
</nav>
