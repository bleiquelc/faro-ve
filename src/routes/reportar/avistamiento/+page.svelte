<script lang="ts">
  import FaroIcon from "$components/FaroIcon.svelte";
  import InfoForm from "$components/InfoForm.svelte";
  import type { PersonPublic } from "$schemas/person";

  /**
   * "¿Viste a alguien que buscan?" — avistamiento. Un avistamiento SIEMPRE es
   * sobre una persona reportada (las notas exigen person_id), así que esto reusa:
   * 1) la búsqueda por nombre GET /api/persons?q= (persons_public), y
   * 2) el componente InfoForm probado (POST /api/notes, type='sighting').
   * No hay camino paralelo de notas: se monta el mismo InfoForm de la ficha.
   */

  let q = "";
  let state: "idle" | "loading" | "results" | "empty" | "error" = "idle";
  let results: PersonPublic[] = [];
  let selected: PersonPublic | null = null;

  async function search() {
    const term = q.trim();
    if (term.length < 2) return;
    selected = null;
    state = "loading";
    try {
      const res = await fetch(
        `/api/persons?q=${encodeURIComponent(term)}&limit=20`,
      );
      if (!res.ok) {
        state = "error";
        return;
      }
      const data = (await res.json()) as { persons: PersonPublic[] };
      results = data.persons ?? [];
      state = results.length ? "results" : "empty";
    } catch {
      state = "error";
    }
  }

  function detailLine(p: PersonPublic): string {
    const parts: string[] = [];
    if (p.age != null) parts.push(`${p.age} años`);
    if (p.sex === "female") parts.push("femenino");
    else if (p.sex === "male") parts.push("masculino");
    if (p.home_neighborhood) parts.push(p.home_neighborhood);
    else if (p.last_known_location_text) parts.push(p.last_known_location_text);
    return parts.join(" · ");
  }
</script>

<svelte:head>
  <title>Reportar un avistamiento — Faro VE</title>
</svelte:head>

<main
  class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]"
>
  <a
    href="/"
    class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Inicio
  </a>

  <div class="flex items-center gap-2.5">
    <span class="text-faro-900" aria-hidden="true"
      ><FaroIcon name="sighting" size={26} /></span
    >
    <h1 class="text-2xl font-bold text-gray-900">
      ¿Viste a alguien que buscan?
    </h1>
  </div>
  <p class="mt-1.5 text-sm text-gray-600">
    Busca por su nombre entre las personas reportadas. Si la encuentras,
    cuéntanos dónde y cuándo la viste — puede ayudar a su familia a hallarla.
  </p>

  {#if !selected}
    <form class="mt-5" on:submit|preventDefault={search}>
      <div
        class="min-h-tap flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200"
      >
        <span aria-hidden="true">🔎</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input
          bind:value={q}
          type="text"
          inputmode="search"
          enterkeyhint="search"
          autofocus
          placeholder="Nombre de la persona que viste…"
          aria-label="Buscar persona por nombre"
          class="min-h-tap w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        {#if q}
          <button
            type="button"
            on:click={() => {
              q = "";
              state = "idle";
            }}
            aria-label="Borrar búsqueda"
            class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95"
          >
            ✕
          </button>
        {/if}
      </div>
      <button
        type="submit"
        disabled={q.trim().length < 2}
        class="min-h-tap mt-3 flex w-full items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white transition hover:bg-faro-800 disabled:opacity-60"
      >
        Buscar
      </button>
    </form>

    {#if state === "loading"}
      <p class="mt-6 text-center text-sm text-slate-500">Buscando…</p>
    {:else if state === "error"}
      <p class="mt-6 text-center text-sm text-red-600">
        No se pudo buscar. Verifica tu conexión e intenta de nuevo.
      </p>
    {:else if state === "empty"}
      <div
        class="mt-6 rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-600 ring-1 ring-slate-200"
      >
        <p>No encontramos a nadie con "{q}".</p>
        <p class="mt-2">
          Quizás aún no fue reportada.
          <a
            href="/reportar/desaparecido"
            class="font-medium text-faro-800 underline"
            >Reportar a esta persona como desaparecida</a
          >.
        </p>
      </div>
    {:else if state === "results"}
      <p
        class="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Toca a la persona que viste
      </p>
      <ul class="space-y-2">
        {#each results as p (p.id)}
          <li>
            <button
              type="button"
              on:click={() => (selected = p)}
              class="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-faro-300 active:scale-[0.99]"
            >
              <span class="text-faro-900" aria-hidden="true"
                ><FaroIcon name="report" size={22} /></span
              >
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold text-slate-800"
                  >{p.full_name}</span
                >
                {#if detailLine(p)}
                  <span class="block truncate text-xs text-slate-500"
                    >{detailLine(p)}</span
                  >
                {/if}
              </span>
              <span aria-hidden="true" class="text-slate-300">→</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {:else}
    <button
      type="button"
      on:click={() => (selected = null)}
      class="min-h-tap mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-faro-900 hover:underline"
    >
      <span aria-hidden="true">←</span> Elegir otra persona
    </button>

    <div
      class="mt-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200"
    >
      <p class="font-semibold text-slate-800">{selected.full_name}</p>
      {#if detailLine(selected)}
        <p class="mt-0.5 text-xs text-slate-500">{detailLine(selected)}</p>
      {/if}
    </div>

    <!-- Reusa el InfoForm probado de la ficha (POST /api/notes, type='sighting'). -->
    <InfoForm personId={selected.id} personName={selected.full_name} />
  {/if}
</main>
