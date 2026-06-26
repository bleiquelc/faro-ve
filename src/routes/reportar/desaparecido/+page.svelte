<script lang="ts">
  import Turnstile from '$components/Turnstile.svelte';
  import { uploadPhoto } from '$lib/client/photo';

  /**
   * "Reportar a alguien que no encuentro" — reporte de un tercero desaparecido.
   * La ubicación (último lugar visto) se muestra SIEMPRE ofuscada (~300m) en el
   * mapa. La PII del reportante (email/phone) se cifra server-side y solo se usa
   * por relay anti-PII; NUNCA se hace pública.
   */

  const MEDICAL_OPTS: { value: string; label: string }[] = [
    { value: 'chronic_disease', label: 'Enfermedad crónica' },
    { value: 'dialysis', label: 'Diálisis' },
    { value: 'oxygen_dependent', label: 'Depende de oxígeno' },
    { value: 'insulin_dependent', label: 'Depende de insulina' },
    { value: 'pregnancy', label: 'Embarazo' },
    { value: 'pediatric_critical', label: 'Pediátrico crítico' },
    { value: 'mental_health', label: 'Salud mental' },
    { value: 'mobility_impaired', label: 'Movilidad reducida' },
    { value: 'other', label: 'Otra' }
  ];

  let given_name = '';
  let family_name = '';
  let age = '';
  let sex = 'unknown';
  let last_known_location_text = '';
  let clothing_top = '';
  let clothing_bottom = '';
  let distinguishing_marks = '';
  let description = '';

  let medical_urgent = false;
  let medical_category = '';

  // Ubicación del último avistamiento (opcional). Siempre se ofusca al mostrarse.
  let lat: number | null = null;
  let lng: number | null = null;
  let geoState: 'idle' | 'loading' | 'ok' | 'denied' = 'idle';

  // Reportante (privado — por relay; nunca público).
  let reporter_relation = 'family';
  let reporter_name = '';
  let reporter_email = '';
  let reporter_phone = '';

  let token = '';
  let submitting = false;
  let errorMsg = '';
  let done = false;

  // Foto: se comprime + limpia EXIF y se sube en cuanto se elige (no bloquea el envío).
  let photoState: 'idle' | 'uploading' | 'ok' | 'error' = 'idle';
  let photoPath: string | null = null;
  let photoError = '';
  let photoPreview: string | null = null;

  async function onPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    photoError = '';
    photoState = 'uploading';
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = URL.createObjectURL(file);
    const r = await uploadPhoto(file);
    if (r.ok) {
      photoPath = r.path;
      photoState = 'ok';
    } else {
      photoPath = null;
      photoError = r.error;
      photoState = 'error';
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      photoPreview = null;
    }
  }
  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = null;
    photoPath = null;
    photoState = 'idle';
    photoError = '';
  }

  function useLocation() {
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

  $: if (!medical_urgent) medical_category = '';

  async function submit() {
    errorMsg = '';
    if (!given_name.trim()) {
      errorMsg = 'Escribe al menos el nombre de la persona.';
      return;
    }
    if (!reporter_phone.trim()) {
      errorMsg = 'Tu WhatsApp es necesario para verificar que el reporte es real.';
      return;
    }
    if (photoState === 'uploading') {
      errorMsg = 'La foto aún se está procesando, espera un momento.';
      return;
    }
    submitting = true;
    try {
      const body: Record<string, unknown> = {
        status: 'missing',
        given_name: given_name.trim(),
        family_name: family_name.trim() || undefined,
        age: age ? Number(age) : undefined,
        sex,
        last_known_location_text: last_known_location_text.trim() || undefined,
        clothing_top: clothing_top.trim() || undefined,
        clothing_bottom: clothing_bottom.trim() || undefined,
        distinguishing_marks: distinguishing_marks.trim() || undefined,
        photo_url: photoPath || undefined,
        description: description.trim() || undefined,
        medical_urgent,
        medical_category: medical_urgent && medical_category ? medical_category : undefined,
        reporter_relation,
        reporter_name: reporter_name.trim() || undefined,
        reporter_email: reporter_email.trim() || undefined,
        reporter_phone: reporter_phone.trim() || undefined,
        'cf-turnstile-response': token
      };
      if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
      }

      const res = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg = j.message || 'No se pudo enviar el reporte. Verifica la conexión e intenta de nuevo.';
        return;
      }
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      done = true;
    } catch {
      errorMsg = 'No se pudo enviar el reporte. Verifica la conexión e intenta de nuevo.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Reportar a alguien — Faro VE</title>
</svelte:head>

<main class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]">
  <a href="/" class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline">
    <span aria-hidden="true">←</span> Inicio
  </a>

  {#if done}
    <div class="rounded-2xl border border-faro-200 bg-faro-50 p-6 text-center">
      <p class="text-4xl" aria-hidden="true">🕯️</p>
      <h1 class="mt-2 text-xl font-bold text-faro-900">Reporte recibido</h1>
      <p class="mt-2 text-sm text-gray-700">
        Gracias. Un moderador revisará el reporte antes de publicarlo en el mapa, para proteger a la
        persona y evitar abusos.
      </p>
      <p class="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-left text-sm text-faro-900 ring-1 ring-faro-200">
        <span aria-hidden="true">🌐</span>
        <span
          >Una vez publicado, tu reporte también se compartirá con la <strong>red global de
          búsqueda</strong> (Cruz Roja · Person Finder) — más personas buscándolo.</span
        >
      </p>
      <a href="/mapa" class="min-h-tap mt-5 inline-flex items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white">
        Ver el mapa
      </a>
    </div>
  {:else}
    <h1 class="text-2xl font-bold text-gray-900">Reportar a alguien que no encuentro</h1>
    <p class="mt-1 text-sm text-gray-600">
      La ubicación se muestra siempre aproximada por seguridad. Tus datos de contacto son privados y
      solo sirven para que te avisen si hay información.
    </p>

    <form class="mt-6 space-y-5" on:submit|preventDefault={submit}>
      <fieldset class="space-y-4">
        <legend class="text-sm font-semibold text-gray-900">Sobre la persona</legend>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Nombre *</span>
            <input bind:value={given_name} required maxlength="120" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Apellido</span>
            <input bind:value={family_name} maxlength="120" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Edad</span>
            <input bind:value={age} type="number" min="0" max="130" inputmode="numeric" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Sexo</span>
            <select bind:value={sex} class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="unknown">Sin especificar</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">Otro</option>
            </select>
          </label>
        </div>

        <label class="block">
          <span class="text-sm font-medium text-gray-700">¿Dónde se le vio por última vez?</span>
          <input bind:value={last_known_location_text} maxlength="300" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Sector, calle, referencia…" />
        </label>

        <button
          type="button"
          on:click={useLocation}
          class="min-h-tap inline-flex items-center gap-2 rounded-lg border border-faro-900 px-4 py-2 text-sm font-medium text-faro-900 hover:bg-faro-50"
        >
          <span aria-hidden="true">📍</span>
          {geoState === 'ok' ? 'Ubicación añadida ✓ (se mostrará aproximada)' : 'Usar mi ubicación actual'}
        </button>
        {#if geoState === 'denied'}
          <p class="text-xs text-amber-700">No se pudo obtener la ubicación. Describe la zona arriba.</p>
        {/if}

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Vestía (arriba)</span>
            <input bind:value={clothing_top} maxlength="200" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Camiseta roja" />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Vestía (abajo)</span>
            <input bind:value={clothing_bottom} maxlength="200" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Jean azul" />
          </label>
        </div>

        <label class="block">
          <span class="text-sm font-medium text-gray-700">Señas particulares</span>
          <input bind:value={distinguishing_marks} maxlength="500" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Cicatriz, tatuaje, lentes…" />
        </label>

        <!-- Foto (opcional) — se comprime y se limpia la ubicación antes de subir -->
        <div class="rounded-xl border border-gray-200 p-4">
          <span class="text-sm font-medium text-gray-700">Foto (opcional)</span>
          {#if photoState === 'ok' && photoPreview}
            <div class="mt-2 flex items-center gap-3">
              <img src={photoPreview} alt="Vista previa" class="h-16 w-16 rounded-lg object-cover" />
              <span class="text-sm text-green-700">Foto lista ✓</span>
              <button type="button" on:click={removePhoto} class="ml-auto text-sm text-gray-500 underline">Quitar</button>
            </div>
          {:else}
            <label class="mt-2 flex min-h-tap cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-faro-900 hover:bg-faro-50">
              <span aria-hidden="true">📷</span>
              {photoState === 'uploading' ? 'Procesando…' : 'Agregar foto'}
              <input type="file" accept="image/*" capture="environment" on:change={onPhoto} class="sr-only" />
            </label>
          {/if}
          {#if photoState === 'error'}
            <p class="mt-2 text-xs text-red-600">{photoError}</p>
          {/if}
          <p class="mt-2 text-xs text-gray-500">
            La foto se comprime y se le borra la ubicación automáticamente. Si la persona es menor de
            edad, su foto <strong>no se mostrará públicamente</strong>.
          </p>
        </div>

        <label class="flex items-start gap-3">
          <input type="checkbox" bind:checked={medical_urgent} class="mt-1 h-5 w-5 shrink-0" />
          <span class="text-sm text-gray-700"><strong>Tiene una urgencia médica</strong> (necesita medicación o atención)</span>
        </label>
        {#if medical_urgent}
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Tipo de urgencia</span>
            <select bind:value={medical_category} class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Selecciona…</option>
              {#each MEDICAL_OPTS as o}
                <option value={o.value}>{o.label}</option>
              {/each}
            </select>
          </label>
        {/if}

        <label class="block">
          <span class="text-sm font-medium text-gray-700">Más detalles</span>
          <textarea bind:value={description} maxlength="2000" rows="3" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"></textarea>
        </label>
      </fieldset>

      <fieldset class="space-y-4 rounded-xl border border-gray-200 p-4">
        <legend class="px-1 text-sm font-semibold text-gray-900">Tus datos (privados)</legend>
        <p class="text-xs text-gray-500">
          No se muestran en el mapa. Si alguien tiene información, te llega por un mensaje seguro sin
          revelar tu correo ni tu teléfono.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Tu relación</span>
            <select bind:value={reporter_relation} class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="family">Familiar</option>
              <option value="friend">Amigo/a</option>
              <option value="witness">Testigo</option>
              <option value="volunteer">Voluntario/a</option>
              <option value="unknown">Otro</option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Tu nombre</span>
            <input bind:value={reporter_name} maxlength="120" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Tu WhatsApp *</span>
          <input
            bind:value={reporter_phone}
            type="tel"
            required
            maxlength="40"
            placeholder="+58 412 1234567"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            autocomplete="tel"
          />
          <span class="mt-1 block text-xs text-gray-500">
            Necesario para <strong>verificar que el reporte es real</strong>. No se muestra
            públicamente; queda cifrado.
          </span>
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Tu email (opcional)</span>
          <input bind:value={reporter_email} type="email" maxlength="200" class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2" autocomplete="email" />
        </label>
      </fieldset>

      <Turnstile bind:token />

      {#if errorMsg}
        <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{errorMsg}</p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="min-h-tap flex w-full items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white transition hover:bg-faro-800 disabled:opacity-60"
      >
        {submitting ? 'Enviando…' : 'Enviar reporte'}
      </button>
    </form>
  {/if}
</main>
