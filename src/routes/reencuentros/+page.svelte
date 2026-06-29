<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  function fhora(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getUTCDate()} ${MES[d.getUTCMonth()]} · ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  }
</script>

<svelte:head>
  <title>Posibles reencuentros · Faro VE</title>
  <meta
    name="description"
    content="Personas buscadas que figuran reportadas a salvo en otra plataforma. Si reconocés a alguien, avisá a su familia."
  />
</svelte:head>

<main class="mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-20 pt-[calc(env(safe-area-inset-top)+1rem)]">
  <a
    href="/"
    data-sveltekit-preload-data="hover"
    class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Inicio
  </a>

  <h1 class="text-3xl font-bold text-gray-900">Posibles reencuentros</h1>
  <p class="mt-2 text-base leading-relaxed text-gray-700">
    Estas personas siguen <strong>buscadas</strong> en Faro VE, pero figuran reportadas
    <strong class="text-green-700">a salvo o encontradas</strong> en otra plataforma. Su familia quizás
    aún no lo sabe. Si reconocés a alguien, <strong>avisale a su familia</strong> y verificá siempre en la fuente.
  </p>

  {#if data.items.length}
    <ul class="mt-8 space-y-4">
      {#each data.items as r (r.id)}
        <li class="rounded-2xl border border-green-200 bg-green-50/60 p-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-bold text-gray-900">{r.full_name}</h2>
            <span class="shrink-0 rounded-full bg-green-600 px-2.5 py-1 text-xs font-bold uppercase text-white">
              {r.found_status === 'encontrado' ? 'Encontrada' : 'A salvo'}
            </span>
          </div>
          <dl class="mt-3 space-y-1.5 text-sm leading-relaxed text-gray-700">
            <div class="flex gap-2">
              <dt class="w-24 shrink-0 font-semibold uppercase tracking-wide text-gray-500">Reportado</dt>
              <dd>{fhora(r.detected_at)} · {r.source}</dd>
            </div>
            {#if r.where_text || r.last_known_location_text}
              <div class="flex gap-2">
                <dt class="w-24 shrink-0 font-semibold uppercase tracking-wide text-gray-500">Dónde</dt>
                <dd class="text-faro-900">{r.where_text || r.last_known_location_text}</dd>
              </div>
            {/if}
            {#if r.quote}
              <div class="flex gap-2">
                <dt class="w-24 shrink-0 font-semibold uppercase tracking-wide text-gray-500">Detalle</dt>
                <dd class="italic">“{r.quote}”</dd>
              </div>
            {/if}
          </dl>
          {#if r.source_url}
            <a
              href={r.source_url}
              target="_blank"
              rel="noopener noreferrer"
              class="min-h-tap mt-3 inline-flex items-center gap-1.5 rounded-lg bg-faro-900 px-3 py-2 text-sm font-medium text-white"
            >
              Verificar y contactar a la familia →
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <div class="mt-10 rounded-2xl border border-gray-200 bg-white p-6 text-center text-gray-600">
      <p class="font-medium">Aún no hay reencuentros publicados.</p>
      <p class="mt-1 text-sm">
        El sistema cruza las plataformas cada día; cuando detecte una persona buscada reportada a salvo en otra
        fuente, aparecerá acá.
      </p>
    </div>
  {/if}

  <p class="mt-10 border-t border-gray-100 pt-5 text-center text-xs leading-relaxed text-gray-500">
    Faro VE · Cruce de datos con Venezuela Reporta y otras fuentes · Verificá siempre en la fuente antes de dar
    por cierto un reencuentro.
  </p>
</main>
