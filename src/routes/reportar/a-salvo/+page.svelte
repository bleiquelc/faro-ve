<script lang="ts">
  import Turnstile from '$components/Turnstile.svelte';
  import QueuedReportCard from '$components/QueuedReportCard.svelte';
  import { submitReport } from '$client/report-submit';

  /**
   * "Estoy a salvo" — auto-reporte. El sujeto avisa que está bien y, si quiere,
   * comparte su ubicación EXACTA y/o su teléfono para que quienes lo buscan lo
   * encuentren. Ambos opt-in son DEFAULT OFF y explícitos (CLAUDE #26 ⚠️, #2).
   */

  let given_name = '';
  let family_name = '';
  let age: string = '';
  let description = '';
  let last_known_location_text = '';

  // Ubicación (geolocalización del navegador). El mapa SIEMPRE muestra el pin
  // ofuscado; el opt-in solo añade la coord exacta + navegación.
  let lat: number | null = null;
  let lng: number | null = null;
  let geoState: 'idle' | 'loading' | 'ok' | 'denied' = 'idle';

  // Opt-in estrictos (default OFF).
  let shareExact = false;
  let contact_phone_public = '';

  // Privado (solo para poder editar/retirar luego; nunca público).
  let reporter_email = '';

  let token = '';
  let submitting = false;
  let errorMsg = '';
  let done = false;
  let queued = false;

  function useMyLocation() {
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
        shareExact = false;
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  // Si no hay ubicación capturada, no se puede compartir "exacta".
  $: if (lat == null || lng == null) shareExact = false;

  async function submit() {
    errorMsg = '';
    if (!given_name.trim()) {
      errorMsg = 'Por favor escribe al menos tu nombre.';
      return;
    }
    submitting = true;
    try {
      const body: Record<string, unknown> = {
        status: 'safe_self_report',
        given_name: given_name.trim(),
        family_name: family_name.trim() || undefined,
        age: age ? Number(age) : undefined,
        description: description.trim() || undefined,
        last_known_location_text: last_known_location_text.trim() || undefined,
        reporter_relation: 'self',
        reporter_email: reporter_email.trim() || undefined,
        share_exact_location_with_searchers: shareExact,
        contact_phone_public: contact_phone_public.trim() || undefined,
        'cf-turnstile-response': token
      };
      if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
      }

      const result = await submitReport('/api/persons', 'a-salvo', body);
      if (result.outcome === 'sent') {
        done = true;
      } else if (result.outcome === 'queued') {
        queued = true;
      } else if (result.outcome === 'unsupported') {
        errorMsg =
          'No se pudo guardar tu aviso sin conexión en este dispositivo. Intenta cuando tengas señal.';
      } else {
        errorMsg = result.message;
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Estoy a salvo — Faro VE</title>
</svelte:head>

<main class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]">
  <a href="/" class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline">
    <span aria-hidden="true">←</span> Inicio
  </a>

  {#if done}
    <div class="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
      <p class="text-4xl" aria-hidden="true">💚</p>
      <h1 class="mt-2 text-xl font-bold text-green-900">Tu aviso se registró</h1>
      <p class="mt-2 text-sm text-green-800">
        Gracias por avisar que estás bien. Tu reporte pasará por una revisión rápida antes de
        aparecer en el mapa.
      </p>
      <p class="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-left text-sm text-green-900 ring-1 ring-green-200">
        <span aria-hidden="true">🌐</span>
        <span
          >Una vez publicado, tu aviso también se compartirá con la <strong>red global de
          búsqueda</strong> (Cruz Roja · Person Finder) — así, si alguien te busca allí, sabrá que
          estás bien.</span
        >
      </p>
      <a href="/mapa" class="min-h-tap mt-5 inline-flex items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white">
        Ver el mapa
      </a>
    </div>
  {:else if queued}
    <QueuedReportCard />
  {:else}
    <h1 class="text-2xl font-bold text-gray-900">Estoy a salvo</h1>
    <p class="mt-1 text-sm text-gray-600">
      Avisa que estás bien. Tú decides cuánto compartir: por defecto, nada de tu ubicación exacta ni
      tu teléfono se hace público.
    </p>

    <form class="mt-6 space-y-5" on:submit|preventDefault={submit}>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Nombre *</span>
          <input
            bind:value={given_name}
            required
            maxlength="120"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            autocomplete="given-name"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Apellido</span>
          <input
            bind:value={family_name}
            maxlength="120"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            autocomplete="family-name"
          />
        </label>
      </div>

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Edad (opcional)</span>
        <input
          bind:value={age}
          type="number"
          min="0"
          max="130"
          inputmode="numeric"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </label>

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Mensaje (opcional)</span>
        <textarea
          bind:value={description}
          maxlength="2000"
          rows="3"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Estoy bien, me refugié en…"
        ></textarea>
      </label>

      <!-- Ubicación -->
      <div class="rounded-xl border border-gray-200 p-4">
        <p class="text-sm font-medium text-gray-700">Tu ubicación (opcional)</p>
        <p class="mt-1 text-xs text-gray-500">
          En el mapa tu pin se muestra <strong>aproximado (~300m)</strong> por tu seguridad.
        </p>

        <button
          type="button"
          on:click={useMyLocation}
          class="min-h-tap mt-3 inline-flex items-center gap-2 rounded-lg border border-faro-900 px-4 py-2 text-sm font-medium text-faro-900 hover:bg-faro-50"
        >
          <span aria-hidden="true">📍</span>
          {geoState === 'ok' ? 'Ubicación capturada ✓' : 'Usar mi ubicación'}
        </button>
        {#if geoState === 'loading'}
          <p class="mt-2 text-xs text-gray-500">Obteniendo tu ubicación…</p>
        {/if}
        {#if geoState === 'denied'}
          <p class="mt-2 text-xs text-amber-700">
            No pudimos obtener tu ubicación. Puedes describir tu zona en el mensaje.
          </p>
        {/if}

        {#if geoState === 'ok'}
          <label class="mt-4 flex items-start gap-3">
            <input type="checkbox" bind:checked={shareExact} class="mt-1 h-5 w-5 shrink-0" />
            <span class="text-sm text-gray-700">
              <strong>Mostrar mi ubicación exacta</strong> a quienes me buscan (con botón para llegar).
              <span class="block text-xs text-gray-500">
                Solo actívalo si quieres que te encuentren en el lugar exacto. Por defecto está
                desactivado.
              </span>
            </span>
          </label>
        {/if}
      </div>

      <!-- Teléfono público opt-in -->
      <label class="block rounded-xl border border-gray-200 p-4">
        <span class="text-sm font-medium text-gray-700">Teléfono para que me llamen (opcional)</span>
        <input
          bind:value={contact_phone_public}
          type="tel"
          maxlength="40"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="+58 412 1234567"
          autocomplete="tel"
        />
        <span class="mt-1 block text-xs text-amber-700">
          ⚠️ Si lo escribes, este teléfono será <strong>público</strong> en tu ficha. Déjalo vacío
          si no quieres mostrarlo.
        </span>
      </label>

      <!-- Email privado -->
      <label class="block">
        <span class="text-sm font-medium text-gray-700">Tu email (privado, opcional)</span>
        <input
          bind:value={reporter_email}
          type="email"
          maxlength="200"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          autocomplete="email"
        />
        <span class="mt-1 block text-xs text-gray-500">
          No se muestra a nadie. Sirve solo para que puedas editar o retirar tu aviso.
        </span>
      </label>

      <Turnstile bind:token />

      {#if errorMsg}
        <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{errorMsg}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="min-h-tap flex w-full items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white transition hover:bg-faro-800 disabled:opacity-60"
      >
        {submitting ? 'Enviando…' : 'Avisar que estoy a salvo'}
      </button>
    </form>
  {/if}
</main>
