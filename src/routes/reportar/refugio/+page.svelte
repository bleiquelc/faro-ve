<script lang="ts">
  import Turnstile from "$components/Turnstile.svelte";
  import LocationPicker from "$components/LocationPicker.svelte";
  import FaroIcon from "$components/FaroIcon.svelte";
  import { SUPPLY_OPTIONS } from "$schemas/aid-point";

  /**
   * "Registrar un refugio" — lugar de servicio (shelter). Reusa el camino probado
   * POST /api/aid-points con type='shelter_temporary'|'shelter_permanent'. Como es
   * un LUGAR de servicio (regla 26): datos PÚBLICOS, coords EXACTAS para que la
   * gente pueda LLEGAR (LocationPicker) + dirección/referencia/cómo entrar.
   */

  let type: "shelter_temporary" | "shelter_permanent" = "shelter_temporary";
  let name = "";
  let supplies: string[] = [];
  let capacity_current = "";
  let capacity_max = "";
  let schedule_text = "";
  let address_text = "";
  let landmark = "";
  let entrance_notes = "";
  let notes = "";

  // Coords EXACTAS (obligatorias). Las fija LocationPicker (mapa + GPS + manual).
  let lat: number | null = null;
  let lng: number | null = null;

  let token = "";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let turnstileComp: any = null;
  let submitting = false;
  let errorMsg = "";
  let done = false;
  let createdId: string | null = null;

  function toggleSupply(value: string) {
    supplies = supplies.includes(value)
      ? supplies.filter((s) => s !== value)
      : [...supplies, value];
  }

  async function submit() {
    errorMsg = "";
    if (!name.trim()) {
      errorMsg = "Escribe el nombre del refugio.";
      return;
    }
    if (!address_text.trim()) {
      errorMsg = "Escribe la dirección para que la gente pueda llegar.";
      return;
    }
    if (lat == null || lng == null) {
      errorMsg = "Mueve el mapa para colocar el pin en el lugar exacto.";
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
        "cf-turnstile-response": token,
      };
      if (capacity_current) body.capacity_current = Number(capacity_current);
      if (capacity_max) body.capacity_max = Number(capacity_max);

      const res = await fetch("/api/aid-points", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg =
          j.message ||
          "No se pudo registrar el refugio. Verifica la conexión e intenta de nuevo.";
        return;
      }
      const j = (await res.json()) as { id?: string };
      createdId = j.id ?? null;
      done = true;
    } catch {
      errorMsg =
        "No se pudo registrar el refugio. Verifica la conexión e intenta de nuevo.";
    } finally {
      turnstileComp?.reset?.();
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Registrar un refugio — Faro VE</title>
</svelte:head>

<main
  class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]"
>
  <a
    href="/mapa?aid=1"
    class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Volver al mapa
  </a>

  {#if done}
    <div class="rounded-2xl border border-faro-200 bg-faro-50 p-6 text-center">
      <p
        class="mx-auto flex h-12 w-12 items-center justify-center text-shelter"
        aria-hidden="true"
      >
        <FaroIcon name="shelter" size={40} />
      </p>
      <h1 class="mt-2 text-xl font-bold text-faro-900">Refugio registrado</h1>
      <p class="mt-2 text-sm text-gray-700">
        Ya aparece en el mapa con su ubicación exacta y la etiqueta
        <strong>"sin verificar"</strong>, para que la gente pueda llegar. La
        comunidad puede confirmar que sigue activo.
      </p>
      <div class="mt-5 flex flex-col gap-2">
        {#if createdId}
          <a
            href={`/punto/${createdId}`}
            class="min-h-tap inline-flex items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white"
          >
            Ver el refugio
          </a>
        {/if}
        <a
          href="/mapa?aid=1"
          class="min-h-tap inline-flex items-center justify-center rounded-lg border border-faro-900 px-5 py-3 font-semibold text-faro-900"
        >
          Ver el mapa de ayuda
        </a>
      </div>
    </div>
  {:else}
    <div class="flex items-center gap-2.5">
      <span class="text-shelter" aria-hidden="true"
        ><FaroIcon name="shelter" size={26} /></span
      >
      <h1 class="text-2xl font-bold text-gray-900">Registrar un refugio</h1>
    </div>

    <div class="mt-3 rounded-xl border border-faro-200 bg-faro-50 px-4 py-3">
      <p class="text-sm text-faro-900">
        📍 <strong>Estos datos son PÚBLICOS.</strong> Sirven para que la gente llegue:
        dirección exacta, capacidad y cómo entrar. No pongas datos privados de nadie.
      </p>
    </div>

    <form class="mt-6 space-y-6" on:submit|preventDefault={submit}>
      <fieldset>
        <legend class="text-sm font-semibold text-gray-900"
          >Tipo de refugio</legend
        >
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            on:click={() => (type = "shelter_temporary")}
            aria-pressed={type === "shelter_temporary"}
            class="min-h-tap rounded-lg border px-3 py-2 text-sm transition {type ===
            'shelter_temporary'
              ? 'border-faro-900 bg-faro-900 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-faro-300'}"
          >
            ⛺ Temporal
          </button>
          <button
            type="button"
            on:click={() => (type = "shelter_permanent")}
            aria-pressed={type === "shelter_permanent"}
            class="min-h-tap rounded-lg border px-3 py-2 text-sm transition {type ===
            'shelter_permanent'
              ? 'border-faro-900 bg-faro-900 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-faro-300'}"
          >
            🏠 Permanente
          </button>
        </div>
      </fieldset>

      <label class="block">
        <span class="text-sm font-medium text-gray-700"
          >Nombre del refugio *</span
        >
        <input
          bind:value={name}
          required
          maxlength="160"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Ej: Escuela Bolivariana La Vega"
        />
      </label>

      <div class="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 p-4">
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Personas ahora</span>
          <input
            bind:value={capacity_current}
            type="number"
            min="0"
            inputmode="numeric"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Capacidad máxima</span
          >
          <input
            bind:value={capacity_max}
            type="number"
            min="0"
            inputmode="numeric"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </label>
      </div>

      <fieldset>
        <legend class="text-sm font-semibold text-gray-900">
          ¿Qué hay disponible? (opcional)
        </legend>
        <div class="mt-2 grid grid-cols-2 gap-2">
          {#each SUPPLY_OPTIONS as s}
            <label
              class="flex min-h-tap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
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

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Horario (opcional)</span
        >
        <input
          bind:value={schedule_text}
          maxlength="280"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Ej: abierto 24 horas"
        />
      </label>

      <div class="rounded-xl border border-gray-200 p-4">
        <p class="text-sm font-semibold text-gray-900">Ubicación exacta *</p>
        <p class="mt-1 text-xs text-gray-500">
          A diferencia de las personas, los refugios se muestran en su
          <strong>ubicación exacta</strong> para que la gente pueda llegar.
        </p>

        <div class="mt-3">
          <LocationPicker bind:lat bind:lng />
        </div>

        <label class="mt-4 block">
          <span class="text-sm font-medium text-gray-700">Dirección *</span>
          <input
            bind:value={address_text}
            required
            maxlength="300"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Calle, número, sector"
          />
        </label>
        <label class="mt-3 block">
          <span class="text-sm font-medium text-gray-700"
            >Punto de referencia (opcional)</span
          >
          <input
            bind:value={landmark}
            maxlength="200"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Frente a la plaza Bolívar"
          />
        </label>
        <label class="mt-3 block">
          <span class="text-sm font-medium text-gray-700"
            >Cómo entrar (opcional)</span
          >
          <input
            bind:value={entrance_notes}
            maxlength="300"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Entrada por el portón lateral"
          />
        </label>
      </div>

      <label class="block">
        <span class="text-sm font-medium text-gray-700">Notas (opcional)</span>
        <textarea
          bind:value={notes}
          maxlength="500"
          rows="2"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          placeholder="Cualquier detalle útil para quien llega (ej: aceptan mascotas)"
        ></textarea>
      </label>

      <Turnstile bind:this={turnstileComp} bind:token />

      {#if errorMsg}
        <p
          class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
          role="alert"
        >
          {errorMsg}
        </p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="min-h-tap flex w-full items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white transition hover:bg-faro-800 disabled:opacity-60"
      >
        {submitting ? "Registrando…" : "Registrar refugio"}
      </button>
    </form>
  {/if}
</main>
