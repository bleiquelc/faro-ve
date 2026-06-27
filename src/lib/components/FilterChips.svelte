<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { COLOR } from '$utils/colors';

  /**
   * FilterChips — filtros del mapa COMBINABLES, URL-driven, CON CONTEO por categoría.
   *
   * Lógica (lo que pidió el founder, "los que combinen, con lógica"):
   *  - Estado (Desaparecidos / A salvo / Cuerpos NN): single-select dentro del
   *    grupo — una persona tiene UN estado. Tocar el activo lo apaga.
   *  - Atributos (Menores / Urgencia médica): toggles INDEPENDIENTES que combinan
   *    con el estado y entre sí → "desaparecido menor", "emergencia menor", etc.
   *  - "Todos": limpia los tres (conserva la capa de ayuda y la búsqueda).
   *
   * CONTEO (reusa /api/persons/stats, cacheado en el edge): cada chip muestra
   * cuántos hay en su categoría. Los chips en 0 (categorías sin datos AÚN, p.ej.
   * cuerpos NN / a salvo / urgencia) se ATENÚAN y deshabilitan → el usuario ve de
   * un vistazo qué hay y qué no, en vez de tocar un filtro que deja el mapa en
   * blanco sin explicación. Si /stats falla, los chips funcionan igual (sin conteo).
   *
   * El API /api/persons ya hace AND de status + is_minor + medical_urgent, así que
   * cada combinación filtra de verdad. La capa "Ayuda" (aid=1) es ortogonal.
   * Accesible: enlaces reales, aria-current en activos, aria-disabled en vacíos.
   */

  type StatKey = 'missing' | 'safe' | 'deceased' | 'minors' | 'medical';
  type StatusChip = { kind: 'status'; label: string; value: string; dot: string; statKey: StatKey };
  type ToggleChip = { kind: 'toggle'; label: string; param: string; dot: string; statKey: StatKey };

  const STATUS: StatusChip[] = [
    { kind: 'status', label: 'Desaparecidos', value: 'missing', dot: COLOR.missing, statKey: 'missing' },
    { kind: 'status', label: 'A salvo', value: 'safe_self_report', dot: COLOR.safe, statKey: 'safe' },
    { kind: 'status', label: 'Cuerpos NN', value: 'unidentified_body', dot: COLOR.deceased, statKey: 'deceased' }
  ];
  const TOGGLES: ToggleChip[] = [
    { kind: 'toggle', label: 'Menores', param: 'is_minor', dot: COLOR.minor, statKey: 'minors' },
    { kind: 'toggle', label: 'Urgencia médica', param: 'medical_urgent', dot: COLOR.medical, statKey: 'medical' }
  ];

  const FILTER_KEYS = ['status', 'is_minor', 'medical_urgent'];

  // Conteos por categoría — reusa el endpoint de stats existente (no construye nada).
  type Stats = { total: number; missing: number; minors: number; medical: number; deceased: number; safe: number };
  let stats: Stats | null = null;
  onMount(async () => {
    try {
      const r = await fetch('/api/persons/stats');
      if (r.ok) {
        const d = (await r.json()) as Stats & { ok?: boolean };
        if (d?.ok) stats = d;
      }
    } catch {
      /* sin conteos: los chips siguen funcionando igual */
    }
  });
  const fmtN = (n: number): string => n.toLocaleString('es-VE');

  $: cur = $page.url.searchParams;

  function build(mutate: (sp: URLSearchParams) => void): string {
    const sp = new URLSearchParams($page.url.searchParams);
    mutate(sp);
    const qs = sp.toString();
    return qs ? `/mapa?${qs}` : '/mapa';
  }

  // "Todos": limpia los filtros de personas (conserva aid, q).
  $: allActive = !FILTER_KEYS.some((k) => cur.has(k));
  function allHref(): string {
    return build((sp) => FILTER_KEYS.forEach((k) => sp.delete(k)));
  }

  // Estado: single-select; tocar el activo lo apaga.
  function statusHref(value: string): string {
    return build((sp) => {
      if (sp.get('status') === value) sp.delete('status');
      else sp.set('status', value);
    });
  }
  // Atributo: toggle independiente on/off.
  function toggleHref(param: string): string {
    return build((sp) => {
      if (sp.get(param) === 'true') sp.delete(param);
      else sp.set(param, 'true');
    });
  }

  // Chip "Ayuda": toggle ortogonal de la capa de lugares de servicio (aid=1).
  $: aidOn = cur.get('aid') === '1';
  function aidToggleHref(): string {
    return build((sp) => (aidOn ? sp.delete('aid') : sp.set('aid', '1')));
  }
</script>

<nav
  class="flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
  aria-label="Filtrar reportes (se pueden combinar)"
>
  <!-- Todos (reset) -->
  <a
    href={allHref()}
    data-sveltekit-preload-data="tap"
    aria-current={allActive ? 'true' : undefined}
    class="min-h-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] {allActive
      ? 'border-faro-900 bg-faro-900 text-white shadow-sm'
      : 'border-gray-200 bg-white/90 text-gray-700 hover:border-faro-300'}"
  >
    Todos
    {#if stats}<span class="tabular-nums text-xs {allActive ? 'text-white/85' : 'text-gray-400'}">{fmtN(stats.total)}</span>{/if}
  </a>

  <!-- Estado (single-select) -->
  {#each STATUS as chip}
    {@const active = cur.get('status') === chip.value}
    {@const n = stats ? stats[chip.statKey] : null}
    {@const empty = n === 0 && !active}
    <a
      href={statusHref(chip.value)}
      data-sveltekit-preload-data="tap"
      aria-current={active ? 'true' : undefined}
      aria-disabled={empty ? 'true' : undefined}
      tabindex={empty ? -1 : undefined}
      title={empty ? 'Sin reportes en esta categoría todavía' : undefined}
      class="min-h-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] {empty
        ? 'pointer-events-none opacity-45'
        : ''} {active
        ? 'border-faro-900 bg-faro-900 text-white shadow-sm'
        : 'border-gray-200 bg-white/90 text-gray-700 hover:border-faro-300'}"
    >
      <span class="h-2.5 w-2.5 rounded-full" style="background:{chip.dot}" aria-hidden="true"></span>
      {chip.label}
      {#if n !== null}<span class="tabular-nums text-xs {active ? 'text-white/85' : 'text-gray-400'}">{fmtN(n)}</span>{/if}
    </a>
  {/each}

  <!-- Separador entre estado y atributos combinables -->
  <span class="my-1 w-px shrink-0 self-stretch bg-gray-200" aria-hidden="true"></span>

  <!-- Atributos (toggles independientes, combinan con todo) -->
  {#each TOGGLES as chip}
    {@const active = cur.get(chip.param) === 'true'}
    {@const n = stats ? stats[chip.statKey] : null}
    {@const empty = n === 0 && !active}
    <a
      href={toggleHref(chip.param)}
      data-sveltekit-preload-data="tap"
      aria-current={active ? 'true' : undefined}
      aria-disabled={empty ? 'true' : undefined}
      tabindex={empty ? -1 : undefined}
      aria-label={empty
        ? `${chip.label}: sin reportes todavía`
        : active
          ? `Quitar filtro ${chip.label}`
          : `Añadir filtro ${chip.label} (combinable)`}
      class="min-h-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] {empty
        ? 'pointer-events-none opacity-45'
        : ''} {active
        ? 'border-faro-900 bg-faro-900 text-white shadow-sm'
        : 'border-gray-200 bg-white/90 text-gray-700 hover:border-faro-300'}"
    >
      <span class="text-xs" aria-hidden="true">{active ? '✓' : '+'}</span>
      <span class="h-2.5 w-2.5 rounded-full" style="background:{chip.dot}" aria-hidden="true"></span>
      {chip.label}
      {#if n !== null}<span class="tabular-nums text-xs {active ? 'text-white/85' : 'text-gray-400'}">{fmtN(n)}</span>{/if}
    </a>
  {/each}

  <!-- Separador entre filtros de personas y la capa de ayuda -->
  <span class="my-1 w-px shrink-0 self-stretch bg-gray-200" aria-hidden="true"></span>

  <!-- Toggle de la capa de lugares de servicio (ortogonal a los filtros) -->
  <a
    href={aidToggleHref()}
    data-sveltekit-preload-data="tap"
    aria-current={aidOn ? 'true' : undefined}
    aria-label={aidOn ? 'Ocultar la capa de puntos de ayuda' : 'Mostrar la capa de puntos de ayuda'}
    class="min-h-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200 ease-out active:scale-[0.97] {aidOn
      ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm'
      : 'border-gray-200 bg-white/90 text-gray-700 hover:border-cyan-300'}"
  >
    <span aria-hidden="true">🤝</span>
    Ayuda
  </a>

  {#if aidOn}
    <!-- Entrada contextual a dar de alta un punto (solo con la capa activa) -->
    <a
      href="/reportar/punto-ayuda"
      data-sveltekit-preload-data="hover"
      class="min-h-tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-cyan-400 bg-white/90 px-3.5 py-2 text-sm font-medium text-cyan-800 transition-all duration-200 ease-out active:scale-[0.97] hover:bg-cyan-50"
    >
      <span aria-hidden="true">➕</span>
      Registrar
    </a>
  {/if}
</nav>
