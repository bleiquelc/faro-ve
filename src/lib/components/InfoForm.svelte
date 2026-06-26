<script lang="ts">
  import Turnstile from '$components/Turnstile.svelte';
  import { tick } from 'svelte';

  /**
   * "Tengo información / La vi" — aporte público sobre una persona del mapa.
   * Va a moderación (pending) antes de mostrarse en la ficha. La ubicación del
   * avistamiento se ofusca (land-aware) server-side; el contacto del autor es
   * opcional, se cifra y NUNCA se hace público (sirve para el relay anti-PII).
   */
  export let personId: string;
  export let personName: string;

  let open = false;
  let type: 'sighting' | 'info_update' = 'sighting';
  let text = '';
  let where = '';
  let lat: number | null = null;
  let lng: number | null = null;
  let geoState: 'idle' | 'loading' | 'ok' | 'denied' = 'idle';

  let authorName = '';
  let authorPhone = '';
  let authorEmail = '';

  let token = '';
  let submitting = false;
  let errorMsg = '';
  let done = false;
  let turnstileRef: { reset: () => void } | null = null;
  let formEl: HTMLFormElement | null = null;

  $: who = personName?.trim() || 'esta persona';

  // Al abrir, mover el foco al textarea (lectores de pantalla / teclado no
  // pierden el contexto del formulario que acaba de aparecer).
  async function openForm(): Promise<void> {
    open = true;
    await tick();
    formEl?.querySelector('textarea')?.focus();
  }

  function useLocation(): void {
    if (!('geolocation' in navigator)) {
      geoState = 'denied';
      return;
    }
    geoState = 'loading';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        geoState = 'ok';
      },
      () => {
        geoState = 'denied';
        lat = null;
        lng = null;
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  async function submit(): Promise<void> {
    errorMsg = '';
    if (!text.trim()) {
      errorMsg = 'Cuéntanos lo que sabes.';
      return;
    }
    submitting = true;
    try {
      const body: Record<string, unknown> = {
        person_id: personId,
        type,
        text: text.trim(),
        sighting_location_text: where.trim() || undefined,
        author_name: authorName.trim() || undefined,
        author_email: authorEmail.trim() || undefined,
        author_phone: authorPhone.trim() || undefined,
        'cf-turnstile-response': token
      };
      if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
      }
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg = j.message || 'No se pudo enviar. Intenta de nuevo en unos minutos.';
        turnstileRef?.reset(); // el token Turnstile es de un solo uso → renovarlo para reintentar
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
    <div class="rounded-xl border border-faro-200 bg-faro-50 p-4 text-center">
      <p class="text-2xl" aria-hidden="true">🙏</p>
      <p class="mt-1 text-sm font-medium text-faro-900">Gracias por tu aporte</p>
      <p class="mt-1 text-xs text-gray-600">
        Un moderador lo revisará antes de publicarlo, para proteger a las personas y evitar abusos.
      </p>
    </div>
  {:else if !open}
    <button
      type="button"
      on:click={openForm}
      class="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg border border-faro-900 px-4 py-3 font-semibold text-faro-900 transition hover:bg-faro-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700"
    >
      <span aria-hidden="true">💡</span> Tengo información / La vi
    </button>
  {:else}
    <form bind:this={formEl} class="space-y-4 rounded-xl border border-gray-200 p-4" on:submit|preventDefault={submit}>
      <p class="text-sm font-semibold text-gray-900">¿Qué sabes sobre {who}?</p>

      <div class="flex gap-2 text-sm">
        <label class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 {type === 'sighting' ? 'border-faro-900 bg-faro-50 font-semibold text-faro-900' : 'border-gray-300 text-gray-600'}">
          <input type="radio" bind:group={type} value="sighting" class="sr-only" /> 👁 La vi
        </label>
        <label class="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 {type === 'info_update' ? 'border-faro-900 bg-faro-50 font-semibold text-faro-900' : 'border-gray-300 text-gray-600'}">
          <input type="radio" bind:group={type} value="info_update" class="sr-only" /> 💬 Tengo un dato
        </label>
      </div>

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Cuéntanos *</span>
        <textarea
          bind:value={text}
          required
          maxlength="2000"
          rows="3"
          placeholder={type === 'sighting' ? 'La vi el martes cerca de…' : 'Lo que sepas que pueda ayudar…'}
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700"
        ></textarea>
      </label>

      {#if type === 'sighting'}
        <label class="block">
          <span class="text-sm font-medium text-gray-700">¿Dónde?</span>
          <input
            bind:value={where}
            maxlength="300"
            placeholder="Sector, calle, referencia…"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700"
          />
        </label>
        <button
          type="button"
          on:click={useLocation}
          aria-busy={geoState === 'loading'}
          disabled={geoState === 'loading'}
          class="min-h-tap inline-flex items-center gap-2 rounded-lg border border-faro-900 px-3 py-2 text-sm font-medium text-faro-900 hover:bg-faro-50 disabled:opacity-60"
        >
          <span aria-hidden="true">📍</span>
          {geoState === 'loading'
            ? 'Obteniendo ubicación…'
            : geoState === 'ok'
              ? 'Ubicación añadida ✓ (se mostrará aproximada)'
              : 'Usar mi ubicación actual'}
        </button>
        {#if geoState === 'denied'}
          <p class="text-xs text-amber-700">No se pudo obtener la ubicación. Describe la zona arriba.</p>
        {/if}
      {/if}

      <fieldset class="space-y-3 rounded-lg border border-gray-200 p-3">
        <legend class="px-1 text-xs font-semibold text-gray-700">Tu contacto (opcional, privado)</legend>
        <p class="text-xs text-gray-500">
          No se muestra. Sirve para que la familia te contacte por un canal seguro, sin revelar tus datos.
        </p>
        <input bind:value={authorName} maxlength="120" placeholder="Tu nombre" aria-label="Tu nombre (opcional)"
          class="min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700" />
        <input bind:value={authorPhone} type="tel" maxlength="40" placeholder="Tu WhatsApp" autocomplete="tel" aria-label="Tu WhatsApp (opcional)"
          class="min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700" />
        <input bind:value={authorEmail} type="email" maxlength="200" placeholder="Tu email" autocomplete="email" aria-label="Tu email (opcional)"
          class="min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700" />
      </fieldset>

      <Turnstile bind:token bind:this={turnstileRef} />

      {#if errorMsg}
        <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{errorMsg}</p>
      {/if}

      <div class="flex gap-2">
        <button type="button" on:click={() => (open = false)}
          class="min-h-tap rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100">
          Cancelar
        </button>
        <button type="submit" disabled={submitting}
          class="min-h-tap flex flex-1 items-center justify-center rounded-lg bg-faro-900 px-4 py-3 font-semibold text-white transition hover:bg-faro-800 disabled:opacity-60">
          {submitting ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </form>
  {/if}
</section>
