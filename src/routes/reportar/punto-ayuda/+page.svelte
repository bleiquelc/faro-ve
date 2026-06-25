<script lang="ts">
  import Turnstile from '$components/Turnstile.svelte';
  import LocationPicker from '$components/LocationPicker.svelte';
  import { AID_TYPE, SUPPLY_OPTIONS, type AidType } from '$schemas/aid-point';
  import { AID_META } from '$utils/colors';

  /**
   * "Registrar un punto de ayuda" — lugar de servicio (acopio, refugio, agua,
   * comida, médico…). A DIFERENCIA de personas: los datos son PÚBLICOS y las
   * coords EXACTAS (la gente debe poder LLEGAR, #26). Visible al instante con
   * badge "sin verificar"; la comunidad lo confirma/reporta luego.
   */

  let type: AidType | '' = '';
  let name = '';
  let supplies: string[] = [];
  let schedule_text = '';
  let address_text = '';
  let landmark = '';
  let entrance_notes = '';
  let notes = '';
  let capacity_current = '';
  let capacity_max = '';

  // Coords EXACTAS (obligatorias). Las fija LocationPicker (mapa + GPS + manual).
  let lat: number | null = null;
  let lng: number | null = null;

  let token = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let turnstileComp: any = null;
  let submitting = false;
  let errorMsg = '';
  let done = false;
  let createdId: string | null = null;

  $: isShelter = type === 'shelter_temporary' || type === 'shelter_permanent';

  function toggleSupply(value: string) {
    supplies = supplies.includes(value)
      ? supplies.filter((s) => s !== value)
      : [...supplies, value];
  }

  async function submit() {
    errorMsg = '';
    if (!type) {
      errorMsg = 'Elige qué tipo de ayuda ofrece este lugar.';
      return;
    }
    if (!name.trim()) {
      errorMsg = 'Escribe el nombre del lugar.';
      return;
    }
    if (!address_text.trim()) {
      errorMsg = 'Escribe la dirección para que la gente pueda llegar.';
      return;
    }
    if (lat == null || lng == null) {
      errorMsg = 'Mueve el mapa para colocar el pin en el lugar exacto.';
      return;
    }
    submitting = true;
    try {
      const body: Record<string, unknown> = {
        type,
        name: name.trim(),
        supplies,
        schedule_text: schedule_text.trim() || undefined,
        address_text: address_text.trim(),
        landmark: landmark.trim() || undefined,
        entrance_notes: entrance_notes.trim() || undefined,
        notes: notes.trim() || undefined,
        lat,
        lng,
        'cf-turnstile-response': token
      };
      if (isShelter) {
        if (capacity_current) body.capacity_current = Number(capacity_current);
        if (capacity_max) body.capacity_max = Number(capacity_max);
      }

      const res = await fetch('/api/aid-points', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg = j.message || 'No se pudo registrar el punto. Verifica la conexión e intenta de nuevo.';
        return;
      }
      const j = (await res.json()) as { id?: string };
      createdId = j.id ?? null;
      done = true;
    } catch {
      errorMsg = 'No se pudo registrar el punto. Verifica la conexión e intenta de nuevo.';
    } finally {
      // Token Turnstile de un solo uso: refrescar para que un reintento no falle 403.
      turnstileComp?.reset?.();
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Registrar un punto de ayuda — Faro VE</title>
</svelte:head>

<main class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]">
  <a href="/mapa" class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline">
    <span aria-hidden="true">←</span> Volver al mapa
  </a>

  {#if done}
    <div class="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 text-center">
      <p class="text-4xl" aria-hidden="true">🤝</p>
      <h1 class="mt-2 text-xl font-bold text-cyan-900">Punto registrado</h1>
      <p class="mt-2 text-sm text-cyan-800">
        Ya aparece en el mapa con la etiqueta <strong>"sin verificar"</strong>. La comunidad puede
        confirmar que sigue activo. ¡Gracias por ayudar a que la gente lo encuentre!
      </p>
      <div class="mt-5 flex flex-col gap-2">
        {#if createdId}
          <a href={`/punto/${createdId}`} class="min-h-tap inline-flex items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white">
            Ver el punto
          </a>
        {/if}
        <a href="/mapa?aid=1" class="min-h-tap inline-flex items-center justify-center rounded-lg border border-faro-900 px-5 py-3 font-semibold text-faro-900">
          Ver el mapa de ayuda
        </a>
      </div>
    </div>
  {:else}
    <h1 class="text-2xl font-bold text-gray-900">Registrar un punto de ayuda</h1>

    <div class="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
      <p class="text-sm text-cyan-900">
        📍 <strong>Estos datos son PÚBLICOS.</strong> Sirven para que la gente llegue al lugar:
        dirección exacta, qué ofrece y cómo entrar. No pongas datos privados de nadie.
      </p>
    </div>

    <form class="mt-6 space-y-6" on:submit|preventDefault={submit}>
      <!-- Tipo -->
      <fieldset>
        <legend class="text-sm font-semibold text-gray-900">¿Qué ofrece este lugar? *</legend>
        <div class="mt-2 grid grid-cols-2 gap-2">
          {#each AID_TYPE as t}
            <button
              type="button"
              on:click={() => (type = t)}
              aria-pressed={type === t}
              class="min-h-tap flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition {type === t
                ? 'border-faro-900 bg-faro-900 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-faro-300'}"
            >
              <span aria-hidden="true">{AID_META[t].emoji}</span>
              <span>{AID_META[t].label}</span>
            </button>
          {/each}
        </div>
      </fieldset>

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Nombre del lugar *</span>
        <input
          bind:value={name}
          required
          maxlength="160"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Ej: Centro de acopio Parroquia La Vega"
        />
      </label>

      <!-- Insumos -->
      <fieldset>
        <legend class="text-sm font-semibold text-gray-900">¿Qué hay disponible? (opcional)</legend>
        <div class="mt-2 grid grid-cols-2 gap-2">
          {#each SUPPLY_OPTIONS as s}
            <label class="flex min-h-tap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={supplies.includes(s.value)}
                on:change={() => toggleSupply(s.value)}
                class="h-5 w-5 shrink-0"
              />
              <span>{s.label}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      {#if isShelter}
        <div class="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-4">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Personas ahora</span>
            <input bind:value={capacity_current} type="number" min="0" inputmode="numeric" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Capacidad máxima</span>
            <input bind:value={capacity_max} type="number" min="0" inputmode="numeric" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>
      {/if}

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Horario (opcional)</span>
        <input bind:value={schedule_text} maxlength="280" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Ej: lunes a viernes 8am–5pm" />
      </label>

      <!-- Ubicación EXACTA -->
      <div class="rounded-xl border border-gray-200 p-4">
        <p class="text-sm font-semibold text-gray-900">Ubicación exacta *</p>
        <p class="mt-1 text-xs text-gray-500">
          A diferencia de las personas, los lugares de servicio se muestran en su
          <strong>ubicación exacta</strong> para que la gente pueda llegar.
        </p>

        <div class="mt-3">
          <LocationPicker bind:lat bind:lng />
        </div>

        <label class="mt-4 block">
          <span class="text-sm font-medium text-gray-700">Dirección *</span>
          <input bind:value={address_text} required maxlength="300" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Calle, número, sector" />
        </label>
        <label class="mt-3 block">
          <span class="text-sm font-medium text-gray-700">Punto de referencia (opcional)</span>
          <input bind:value={landmark} maxlength="200" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Frente a la plaza Bolívar" />
        </label>
        <label class="mt-3 block">
          <span class="text-sm font-medium text-gray-700">Cómo entrar (opcional)</span>
          <input bind:value={entrance_notes} maxlength="300" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Entrada lateral, preguntar por María" />
        </label>
      </div>

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Notas (opcional)</span>
        <textarea bind:value={notes} maxlength="500" rows="2" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Cualquier detalle útil para quien llega"></textarea>
      </label>

      <Turnstile bind:this={turnstileComp} bind:token />

      {#if errorMsg}
        <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{errorMsg}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="min-h-tap flex w-full items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white transition hover:bg-faro-800 disabled:opacity-60"
      >
        {submitting ? 'Registrando…' : 'Registrar punto de ayuda'}
      </button>
    </form>
  {/if}
</main>
