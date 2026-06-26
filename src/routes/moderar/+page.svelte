<script lang="ts">
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { COLOR, COLOR_ON, LABEL_ES, categoryForPerson } from '$utils/colors';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  // id de la tarjeta en proceso (deshabilita sus botones mientras se decide).
  let processingId: string | null = null;

  // Acceso type-safe al error de la última decisión. Param estructural: ActionData
  // (unión OptionalUnion de SvelteKit) es asignable a esta forma. Devuelve el
  // mensaje si corresponde a esta tarjeta, o null.
  function cardError(
    f: { id?: string | null; error?: string } | null | undefined,
    id: string
  ): string | null {
    return f && f.error && f.id === id ? f.error : null;
  }

  // Error GLOBAL (no atado a una tarjeta): p.ej. sesión expirada (403 sin id).
  // Garantiza que el moderador siempre vea por qué falló una decisión.
  function globalError(f: { id?: string | null; error?: string } | null | undefined): string | null {
    return f && f.error && !f.id ? f.error : null;
  }

  function cat(it: { status: string; is_minor: boolean; medical_urgent: boolean }) {
    return categoryForPerson(it);
  }

  function ageLabel(age: number | null): string {
    return age != null ? `${age} años` : 'edad desconocida';
  }

  function whenLabel(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' });
  }

  const RELATION_ES: Record<string, string> = {
    self: 'la propia persona',
    family: 'un familiar',
    friend: 'un amigo/a',
    witness: 'un testigo',
    authority: 'una autoridad',
    volunteer: 'un voluntario/a',
    media: 'un medio',
    unknown: 'relación no indicada'
  };
</script>

<svelte:head>
  <title>Cola de moderación · Faro VE</title>
</svelte:head>

<main class="mx-auto w-full max-w-3xl px-4 pb-20 pt-5">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <h1 class="text-2xl font-bold text-gray-900">Reportes por revisar</h1>
    <p class="text-sm text-gray-500">
      {data.total}
      {data.total === 1 ? 'pendiente' : 'pendientes'}
      {#if data.stats}
        · {data.stats.approved ?? 0} aprobados · {data.stats.rejected ?? 0} rechazados
      {/if}
    </p>
  </div>

  <p class="mt-1 text-xs text-gray-400">
    Aprobar publica el reporte en el mapa. Rechazar, duplicado o falta-info lo mantienen fuera del
    público y requieren un motivo.
  </p>

  {#if globalError(form)}
    <div class="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-800" role="alert">
      {globalError(form)}
    </div>
  {/if}

  {#if form?.ok}
    <div class="mt-4 rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-900" role="status">
      ✅ Decisión aplicada. La cola se actualizó.
    </div>
  {/if}

  {#if data.items.length === 0}
    <div class="mt-10 rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center">
      <p class="text-4xl" aria-hidden="true">🕊️</p>
      <p class="mt-3 font-medium text-gray-700">No hay reportes pendientes</p>
      <p class="mt-1 text-sm text-gray-500">Todo lo recibido ya fue revisado. Gracias.</p>
    </div>
  {:else}
    <ul class="mt-5 space-y-5">
      {#each data.items as it (it.id)}
        {@const c = cat(it)}
        <li class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div class="flex flex-col gap-4 p-4 sm:flex-row">
            <!-- Foto (incl. menores: solo para moderación) -->
            <div class="shrink-0">
              {#if it.photoSigned}
                <img
                  src={it.photoSigned}
                  alt={`Foto de ${it.full_name || 'la persona'}`}
                  class="h-28 w-28 rounded-xl object-cover"
                  loading="lazy"
                  on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                />
                {#if it.is_minor}
                  <p class="mt-1 w-28 text-center text-[10px] font-medium text-amber-700">
                    ⚠ Menor — foto solo para moderación
                  </p>
                {/if}
              {:else}
                <div
                  class="flex h-28 w-28 items-center justify-center rounded-xl bg-gray-100 text-3xl"
                  aria-hidden="true"
                >
                  {it.is_minor ? '🧒' : '👤'}
                </div>
              {/if}
            </div>

            <!-- Datos -->
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={`background:${COLOR[c]};color:${COLOR_ON[c]}`}>{LABEL_ES[c]}</span
                >
                {#if it.is_minor}
                  <span class="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">Menor</span>
                {/if}
                {#if it.unaccompanied_minor}
                  <span class="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-800">No acompañado</span>
                {/if}
                {#if it.medical_urgent}
                  <span class="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">Urgencia médica</span>
                {/if}
                {#if it.ai_priority != null}
                  <span class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700" title={it.ai_reasoning ?? ''}>IA {it.ai_priority}</span>
                {/if}
              </div>

              <h2 class="mt-1 truncate text-lg font-bold text-gray-900">
                {it.full_name || 'Sin nombre'}
              </h2>
              <p class="text-sm text-gray-500">
                {ageLabel(it.age)}
                {#if it.sex && it.sex !== 'unknown'}· {it.sex === 'male' ? 'masculino' : it.sex === 'female' ? 'femenino' : 'otro'}{/if}
                · recibido {whenLabel(it.created_at)}
              </p>

              {#if it.last_known_location_text || it.home_neighborhood || it.home_city}
                <p class="mt-2 text-sm text-gray-700">
                  📍 {it.last_known_location_text || [it.home_neighborhood, it.home_city].filter(Boolean).join(', ')}
                </p>
              {/if}

              <!-- Coords EXACTAS — solo el moderador (#1). Verificar ubicación. -->
              {#if it.lat_exact != null && it.lng_exact != null}
                <p class="mt-0.5 text-xs text-gray-500">
                  Coord exacta: {it.lat_exact.toFixed(5)}, {it.lng_exact.toFixed(5)}
                  · <a
                    href={`https://www.google.com/maps?q=${it.lat_exact},${it.lng_exact}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="underline">ver en mapa</a
                  >
                </p>
              {/if}

              {#if it.description}
                <p class="mt-2 line-clamp-3 text-sm text-gray-700">{it.description}</p>
              {/if}

              {#if it.medical_urgent && it.medical_notes}
                <p class="mt-1 text-sm text-orange-800">🏥 {it.medical_notes}</p>
              {/if}

              <p class="mt-2 text-xs text-gray-500">
                Reportado por: {RELATION_ES[it.reporter_relation ?? 'unknown'] ?? 'relación no indicada'}
                {#if it.reporter_name}({it.reporter_name}){/if}
                {#if it.reporter_country}· {it.reporter_country}{/if}
                {#if it.has_reporter_contact}
                  · <span class="text-green-700">tiene contacto (relay posible)</span>
                {:else}
                  · <span class="text-gray-400">sin contacto</span>
                {/if}
              </p>

              {#if it.source && it.source !== 'faro-ve'}
                <p class="mt-1 text-xs text-gray-400">
                  Fuente: {it.source}
                  {#if it.source_url && /^https?:\/\//i.test(it.source_url)}
                    · <a href={it.source_url} target="_blank" rel="noopener noreferrer" class="underline">original</a>
                  {/if}
                </p>
              {/if}
            </div>
          </div>

          <!-- Decisión -->
          <form
            method="POST"
            action="?/decide"
            use:enhance={() => {
              processingId = it.id;
              return async ({ result, update }) => {
                // Sesión expirada (403): el gate ya no puede redirigir un POST →
                // lo hacemos aquí para que el moderador vuelva a entrar.
                if (result.type === 'failure' && result.status === 403) {
                  await goto('/moderar/login');
                  return;
                }
                await update();
                processingId = null;
              };
            }}
            class="border-t border-gray-100 bg-gray-50/60 p-4"
          >
            <input type="hidden" name="id" value={it.id} />
            <label class="sr-only" for={`notes-${it.id}`}>
              Motivo de la decisión para {it.full_name || 'esta persona'}
            </label>
            <textarea
              id={`notes-${it.id}`}
              name="notes"
              rows="2"
              placeholder="Motivo (obligatorio para rechazar, duplicado o falta de información)"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700"
            ></textarea>

            {#if cardError(form, it.id)}
              <p class="mt-1.5 text-sm text-red-700" role="alert">{cardError(form, it.id)}</p>
            {/if}

            <div class="mt-3 flex flex-wrap gap-2">
              <button
                name="decision"
                value="approved"
                disabled={processingId === it.id}
                class="min-h-tap flex-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800 active:scale-[0.98] disabled:opacity-50"
              >
                ✅ Aprobar
              </button>
              <button
                name="decision"
                value="rejected"
                disabled={processingId === it.id}
                class="min-h-tap rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800 active:scale-[0.98] disabled:opacity-50"
              >
                ✖ Rechazar
              </button>
              <button
                name="decision"
                value="duplicate"
                disabled={processingId === it.id}
                class="min-h-tap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50"
              >
                ⧉ Duplicado
              </button>
              <button
                name="decision"
                value="needs_info"
                disabled={processingId === it.id}
                class="min-h-tap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50"
              >
                ❓ Falta info
              </button>
            </div>
          </form>
        </li>
      {/each}
    </ul>
  {/if}

  <!-- ── Cola de avistamientos / información de la comunidad ─────────────── -->
  <div class="mt-12 flex flex-wrap items-baseline justify-between gap-2 border-t border-gray-200 pt-6">
    <h2 class="text-xl font-bold text-gray-900">Avistamientos e información</h2>
    <p class="text-sm text-gray-500">
      {data.notesTotal}
      {data.notesTotal === 1 ? 'pendiente' : 'pendientes'}
      {#if data.notesStats}· {data.notesStats.approved ?? 0} aprobados{/if}
    </p>
  </div>

  {#if data.notes.length === 0}
    <p class="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center text-sm text-gray-500">
      No hay aportes pendientes.
    </p>
  {:else}
    <ul class="mt-4 space-y-4">
      {#each data.notes as nt (nt.id)}
        <li class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div class="p-4">
            <div class="flex flex-wrap items-center gap-1.5 text-xs">
              <span class="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
                {nt.type === 'sighting' ? '👁 Avistamiento' : '💬 Información'}
              </span>
              <span class="text-gray-500">
                sobre <a href={`/persona/${nt.person_id}`} target="_blank" rel="noopener" class="font-medium text-faro-900 underline">{nt.person_name || 'persona'}</a>
              </span>
            </div>
            <p class="mt-2 whitespace-pre-line text-sm text-gray-800">{nt.text}</p>
            {#if nt.sighting_location_text}
              <p class="mt-1 text-sm text-gray-600">📍 {nt.sighting_location_text}</p>
            {/if}
            {#if nt.lat_exact != null && nt.lng_exact != null}
              <p class="mt-0.5 text-xs text-gray-500">
                Coord exacta: {nt.lat_exact.toFixed(5)}, {nt.lng_exact.toFixed(5)}
                · <a href={`https://www.google.com/maps?q=${nt.lat_exact},${nt.lng_exact}`} target="_blank" rel="noopener noreferrer" class="underline">ver</a>
              </p>
            {/if}
            <p class="mt-2 text-xs text-gray-500">
              Autor: {nt.author_name || 'anónimo'}
              {#if nt.has_author_contact}· <span class="text-green-700">dejó contacto</span>{/if}
            </p>
          </div>

          <form
            method="POST"
            action="?/decideNote"
            use:enhance={() => {
              processingId = nt.id;
              return async ({ result, update }) => {
                if (result.type === 'failure' && result.status === 403) {
                  await goto('/moderar/login');
                  return;
                }
                await update();
                processingId = null;
              };
            }}
            class="border-t border-gray-100 bg-gray-50/60 p-4"
          >
            <input type="hidden" name="id" value={nt.id} />
            <label class="sr-only" for={`note-notes-${nt.id}`}>Motivo del rechazo</label>
            <textarea
              id={`note-notes-${nt.id}`}
              name="notes"
              rows="2"
              placeholder="Motivo (obligatorio para rechazar)"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700"
            ></textarea>
            {#if cardError(form, nt.id)}
              <p class="mt-1.5 text-sm text-red-700" role="alert">{cardError(form, nt.id)}</p>
            {/if}
            <div class="mt-3 flex flex-wrap gap-2">
              <button name="decision" value="approved" disabled={processingId === nt.id}
                class="min-h-tap flex-1 rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-800 active:scale-[0.98] disabled:opacity-50">
                ✅ Aprobar
              </button>
              <button name="decision" value="rejected" disabled={processingId === nt.id}
                class="min-h-tap rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800 active:scale-[0.98] disabled:opacity-50">
                ✖ Rechazar
              </button>
            </div>
          </form>
        </li>
      {/each}
    </ul>
  {/if}
</main>
