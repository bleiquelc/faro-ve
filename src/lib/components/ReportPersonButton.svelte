<script lang="ts">
  import Turnstile from '$components/Turnstile.svelte';

  /**
   * "Reportar perfil falso / información incorrecta" — autorregulación comunitaria.
   * POST /api/persons/[id]/vote {vote:'report'}. Si net (reports−confirms) ≥ 3, el
   * perfil se auto-oculta (reversible) y se avisa al founder. Mantiene confiable el
   * mapa sin que nadie modere en tiempo real (publish-first).
   */
  export let personId: string;

  let open = false;
  let token = '';
  let submitting = false;
  let errorMsg = '';
  let done = false;
  let turnstileRef: { reset: () => void } | null = null;

  async function submit(): Promise<void> {
    errorMsg = '';
    submitting = true;
    try {
      const res = await fetch(`/api/persons/${personId}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote: 'report', 'cf-turnstile-response': token })
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg = j.message || 'No se pudo enviar. Intenta de nuevo en unos minutos.';
        turnstileRef?.reset(); // token de un solo uso → renovar para reintentar
        return;
      }
      done = true;
    } catch {
      errorMsg = 'No se pudo enviar. Verifica tu conexión e intenta de nuevo.';
      turnstileRef?.reset();
    } finally {
      submitting = false;
    }
  }
</script>

<section class="mt-4">
  {#if done}
    <p class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
      Gracias. Si varias personas reportan este perfil como falso o incorrecto, se oculta
      automáticamente mientras se revisa.
    </p>
  {:else if !open}
    <button
      type="button"
      on:click={() => (open = true)}
      class="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400"
    >
      <span aria-hidden="true">⚑</span> Reportar perfil falso o con información incorrecta
    </button>
  {:else}
    <form class="space-y-3 rounded-xl border border-gray-200 p-4" on:submit|preventDefault={submit}>
      <p class="text-sm text-gray-700">
        ¿Este perfil es <strong>falso, duplicado o tiene información incorrecta</strong>? Tu reporte
        ayuda a mantener el mapa confiable. Si varias personas lo reportan, se oculta para revisión.
      </p>

      <Turnstile bind:token bind:this={turnstileRef} />

      {#if errorMsg}
        <p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{errorMsg}</p>
      {/if}

      <div class="flex gap-2">
        <button
          type="button"
          on:click={() => (open = false)}
          class="min-h-tap rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          class="min-h-tap flex flex-1 items-center justify-center rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
        >
          {submitting ? 'Enviando…' : 'Reportar'}
        </button>
      </div>
    </form>
  {/if}
</section>
