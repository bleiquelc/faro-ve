<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Turnstile from '$components/Turnstile.svelte';

  /**
   * Retiro self-service (0031). Dos caminos para llegar acá:
   *  - Desde una ficha: `?id=<uuid>&name=<nombre>` ya preselecciona el registro.
   *  - Directo: se busca por nombre (reusa GET /api/persons?q=) y se elige.
   * Modelo (founder): inmediato y reversible — el registro sale del mapa al
   * instante; queda reversible 30 días por si es un retiro malicioso.
   */

  type Hit = { id: string; full_name: string | null; last_known_location_text: string | null };

  let selected: { id: string; name: string } | null = null;
  let relationship: 'self' | 'family_deceased' | 'other' = 'family_deceased';
  let note = '';
  let token = '';

  let query = '';
  let hits: Hit[] = [];
  let searching = false;
  let searchError = '';
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  let submitting = false;
  let errorMsg = '';
  let done = false;

  onMount(() => {
    const id = $page.url.searchParams.get('id');
    const name = $page.url.searchParams.get('name');
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      selected = { id, name: name?.trim() || 'este registro' };
    }
  });

  function scheduleSearch() {
    if (searchTimer) clearTimeout(searchTimer);
    searchError = '';
    const q = query.trim();
    if (q.length < 3) {
      hits = [];
      return;
    }
    searchTimer = setTimeout(runSearch, 350);
  }

  async function runSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    searching = true;
    try {
      const res = await fetch(`/api/persons?q=${encodeURIComponent(q)}&limit=20`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { persons: Hit[] };
      hits = data.persons ?? [];
    } catch {
      searchError = 'No se pudo buscar. Revisa tu conexión e intenta de nuevo.';
      hits = [];
    } finally {
      searching = false;
    }
  }

  function choose(h: Hit) {
    selected = { id: h.id, name: h.full_name || 'este registro' };
    hits = [];
    query = '';
  }

  async function submit() {
    errorMsg = '';
    if (!selected) {
      errorMsg = 'Primero elige el registro que quieres retirar.';
      return;
    }
    submitting = true;
    try {
      const res = await fetch(`/api/persons/${selected.id}/remove`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ relationship, note: note.trim() || undefined, 'cf-turnstile-response': token })
      });
      if (res.ok) {
        done = true;
      } else if (res.status === 429) {
        errorMsg = 'Demasiadas solicitudes desde tu conexión. Espera un rato e intenta de nuevo.';
      } else if (res.status === 403) {
        errorMsg = 'La verificación anti-bot no se completó. Recarga la página e intenta otra vez.';
      } else {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg = j.message || 'No se pudo procesar el retiro. Intenta de nuevo en unos minutos.';
      }
    } catch {
      errorMsg = 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Retirar un registro del mapa · Faro VE</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-8">
  <a href="/privacidad" class="text-sm text-faro-700 underline">← Privacidad</a>
  <h1 class="mt-3 text-xl font-bold text-gray-900">Retirar un registro del mapa</h1>

  {#if done}
    <div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <p class="text-emerald-900">
        Listo. <strong>{selected?.name}</strong> ya no aparece en el mapa público.
      </p>
      <p class="mt-2 text-sm text-emerald-800">
        El retiro es inmediato. Los datos personales asociados se eliminan por completo a los 30
        días. Si esto fue un error, escríbenos a
        <a class="underline" href="mailto:contacto@faro-ve.com">contacto@faro-ve.com</a> y podemos
        revertirlo dentro de ese plazo.
      </p>
      <a href="/" class="mt-4 inline-block rounded-xl bg-faro-700 px-4 py-2 text-sm font-semibold text-white">
        Volver al inicio
      </a>
    </div>
  {:else}
    <p class="mt-2 text-sm leading-relaxed text-gray-600">
      Puedes pedir que se retire tu propio registro, o el de un familiar que falleció. Sale del
      mapa <strong>de inmediato</strong>. Es reversible por 30 días (por si alguien lo hace por
      error o de mala fe), luego los datos personales se eliminan por completo.
    </p>

    {#if !selected}
      <!-- Paso 1: elegir el registro -->
      <label class="mt-6 block text-sm font-medium text-gray-800" for="q">
        Busca por nombre a la persona del registro
      </label>
      <input
        id="q"
        class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        placeholder="Nombre y/o apellido"
        bind:value={query}
        on:input={scheduleSearch}
        autocomplete="off"
      />
      {#if searching}
        <p class="mt-2 text-xs text-gray-500">Buscando…</p>
      {/if}
      {#if searchError}
        <p class="mt-2 text-xs text-red-600" role="alert">{searchError}</p>
      {/if}
      {#if hits.length}
        <ul class="mt-3 space-y-2">
          {#each hits as h (h.id)}
            <li>
              <button
                type="button"
                class="w-full rounded-xl border border-gray-200 px-3 py-2 text-left hover:border-faro-400 hover:bg-faro-50"
                on:click={() => choose(h)}
              >
                <span class="block text-sm font-medium text-gray-900">{h.full_name || 'Sin nombre'}</span>
                {#if h.last_known_location_text}
                  <span class="block text-xs text-gray-500">{h.last_known_location_text}</span>
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      {:else if query.trim().length >= 3 && !searching}
        <p class="mt-2 text-xs text-gray-500">Sin resultados. Prueba con otra forma del nombre.</p>
      {/if}
    {:else}
      <!-- Paso 2: motivo + confirmación -->
      <div class="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <p class="text-sm text-gray-800">
          Registro a retirar: <strong>{selected.name}</strong>
        </p>
        <button type="button" class="mt-1 text-xs text-faro-700 underline" on:click={() => (selected = null)}>
          elegir otro
        </button>
      </div>

      <fieldset class="mt-5">
        <legend class="text-sm font-medium text-gray-800">¿Por qué quieres retirarlo?</legend>
        <label class="mt-2 flex items-start gap-2 text-sm text-gray-700">
          <input type="radio" bind:group={relationship} value="self" class="mt-0.5" />
          <span>Soy yo y quiero salir del mapa</span>
        </label>
        <label class="mt-2 flex items-start gap-2 text-sm text-gray-700">
          <input type="radio" bind:group={relationship} value="family_deceased" class="mt-0.5" />
          <span>Es mi familiar y falleció</span>
        </label>
        <label class="mt-2 flex items-start gap-2 text-sm text-gray-700">
          <input type="radio" bind:group={relationship} value="other" class="mt-0.5" />
          <span>Otro motivo</span>
        </label>
      </fieldset>

      <label class="mt-4 block text-sm font-medium text-gray-800" for="note">
        Nota (opcional)
      </label>
      <textarea
        id="note"
        class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        rows="2"
        maxlength="500"
        placeholder="Si quieres, cuéntanos algo que nos ayude a entender el pedido."
        bind:value={note}
      ></textarea>

      <div class="mt-4">
        <Turnstile bind:token />
      </div>

      {#if errorMsg}
        <p class="mt-3 text-sm text-red-600" role="alert">{errorMsg}</p>
      {/if}

      <button
        type="button"
        class="mt-4 w-full rounded-xl bg-faro-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        on:click={submit}
        disabled={submitting}
      >
        {submitting ? 'Procesando…' : 'Retirar del mapa'}
      </button>
      <p class="mt-2 text-center text-xs text-gray-400">
        Con cariño y respeto. Si te equivocaste, se puede revertir escribiéndonos.
      </p>
    {/if}
  {/if}
</main>
