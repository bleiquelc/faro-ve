<script lang="ts">
  import { goto } from '$app/navigation';
  import { COLOR, COLOR_ON, LABEL_ES, categoryForPerson } from '$utils/colors';
  import FaroIcon from '$components/FaroIcon.svelte';
  import type { PersonPublic } from '$schemas/person';
  import type { PageData } from './$types';

  /**
   * Búsqueda por nombre — encuentra a TODOS, incluidos los reportes SIN ubicación
   * geocodificable (que en el mapa no tendrían pin). Cada resultado lleva a su
   * ficha; los sin coords muestran "sin localización en el mapa" pero igual su
   * última zona en TEXTO. Así nadie queda sin posibilidad de ser ubicado.
   */
  export let data: PageData;

  let query = data.q;
  $: results = data.results as PersonPublic[];
  $: total = data.total;
  $: truncated = total > results.length;
  $: searched = data.q.length > 0;

  function submit() {
    const v = query.trim();
    goto(v ? `/buscar?q=${encodeURIComponent(v)}` : '/buscar', { keepFocus: true, noScroll: true });
  }

  function zone(p: PersonPublic): string | null {
    return p.home_neighborhood || p.home_city || p.last_known_location_text || null;
  }
  const ageLabel = (p: PersonPublic) => (p.age != null ? `, ${p.age} años` : '');
</script>

<svelte:head>
  <title>Buscar persona — Faro VE</title>
</svelte:head>

<main
  class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]"
>
  <a
    href="/"
    data-sveltekit-preload-data="hover"
    class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Inicio
  </a>

  <h1 class="text-2xl font-bold text-gray-900">Buscar a una persona</h1>
  <p class="mt-1 text-sm text-gray-600">
    Escribe el nombre. Aparecen <strong>todos los reportes</strong>, incluso los que aún no tienen
    una ubicación en el mapa.
  </p>

  <form class="mt-5" on:submit|preventDefault={submit}>
    <div class="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200">
      <span aria-hidden="true" class="text-faro-900"><FaroIcon name="search" size={20} /></span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        bind:value={query}
        type="search"
        inputmode="search"
        enterkeyhint="search"
        autofocus
        maxlength="120"
        placeholder="Nombre o apellido…"
        aria-label="Buscar persona por nombre"
        class="min-h-tap w-full bg-transparent text-base text-gray-900 outline-none"
      />
      <button
        type="submit"
        class="min-h-tap shrink-0 rounded-full bg-faro-900 px-4 py-2 text-sm font-semibold text-white transition active:scale-95 hover:bg-faro-800"
      >
        Buscar
      </button>
    </div>
  </form>

  <a
    href="/reencuentros"
    data-sveltekit-preload-data="hover"
    class="min-h-tap mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 ring-1 ring-green-200 transition active:scale-[0.99] hover:bg-green-100"
  >
    <span>¿Quizás ya apareció? Mirá los posibles reencuentros</span>
    <span aria-hidden="true">→</span>
  </a>

  {#if searched}
    <p class="mt-5 text-sm text-gray-500" aria-live="polite">
      {results.length === 0
        ? 'No encontramos a nadie con ese nombre.'
        : `${total} ${total === 1 ? 'resultado' : 'resultados'} para "${data.q}"`}
    </p>
    {#if truncated}
      <p class="mt-1 text-xs text-amber-700">
        Mostrando los primeros {results.length}. Afina el nombre o el apellido para acotar y que no
        se te escape nadie.
      </p>
    {/if}

    {#if results.length === 0}
      <div class="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-5 text-center text-sm text-gray-600">
        Prueba con otra forma del nombre (solo el nombre, o solo el apellido). Si la persona aún no
        fue reportada, puedes
        <a href="/reportar/desaparecido" class="font-medium text-faro-800 underline">crear el reporte</a>.
        También revisá los
        <a href="/reencuentros" class="font-medium text-green-700 underline">posibles reencuentros</a>
        — gente reportada a salvo en otra plataforma.
      </div>
    {:else}
      <ul class="mt-3 space-y-2.5">
        {#each results as p (p.id)}
          {@const cat = categoryForPerson(p)}
          {@const z = zone(p)}
          <li>
            <a
              href="/persona/{p.id}"
              data-sveltekit-preload-data="hover"
              class="block rounded-xl border border-gray-200 bg-white p-3.5 transition active:scale-[0.99] hover:border-faro-300 hover:shadow-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style="background:{COLOR[cat]};color:{COLOR_ON[cat]}">{LABEL_ES[cat]}</span
                >
                <span aria-hidden="true" class="text-gray-300">→</span>
              </div>
              <p class="mt-1.5 font-semibold text-gray-900">{p.full_name || 'Sin nombre'}{ageLabel(p)}</p>
              {#if p.lat == null}
                <p class="mt-1 text-xs text-amber-700">
                  📍 Sin localización en el mapa{#if z} · última zona indicada: <span class="text-gray-600">{z}</span>{/if}
                </p>
              {:else if z}
                <p class="mt-1 text-xs text-gray-500">📍 {z} <span class="text-gray-400">(zona aproximada)</span></p>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <div class="mt-6 rounded-xl border border-faro-100 bg-faro-50 p-5 text-sm text-faro-900">
      Escribe un nombre arriba y toca <strong>Buscar</strong>. También puedes ver el
      <a href="/mapa" class="font-medium underline">mapa completo</a>.
    </div>
  {/if}
</main>
