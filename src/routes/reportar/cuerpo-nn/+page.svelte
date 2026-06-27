<script lang="ts">
  import Turnstile from "$components/Turnstile.svelte";
  import FaroIcon from "$components/FaroIcon.svelte";
  import QueuedReportCard from "$components/QueuedReportCard.svelte";
  import { uploadPhoto } from "$lib/client/photo";
  import { submitReport } from "$client/report-submit";
  import { online } from "$client/online";

  /**
   * "Reportar a una persona fallecida sin identificar" (cuerpo NN).
   * Reusa el mismo camino probado que el reporte de desaparecidos:
   * POST /api/persons con status='unidentified_body' (whitelisteado en la RPC
   * create_person_report y en el schema Zod). La ubicación de hallazgo se muestra
   * SIEMPRE ofuscada (~300m) en el mapa, igual que cualquier persona (regla 26).
   * La PII del reportante se cifra server-side; nunca es pública.
   *
   * Tono digno: el objetivo es que una familia encuentre e identifique a su ser
   * querido. No es una urgencia médica → sin campos médicos.
   */

  // Datos de la persona encontrada (no hay nombre: se envía 'NN' al backend).
  let sex = "unknown";
  let age = "";
  let found_location_text = "";
  let clothing_top = "";
  let clothing_bottom = "";
  let distinguishing_marks = "";
  let description = "";

  // Ubicación del hallazgo (opcional). Siempre se ofusca al mostrarse.
  let lat: number | null = null;
  let lng: number | null = null;
  let geoState: "idle" | "loading" | "ok" | "denied" = "idle";

  // Reportante (privado — por relay; nunca público).
  let reporter_relation = "witness";
  let reporter_name = "";
  let reporter_email = "";
  let reporter_phone = "";

  let token = "";
  let submitting = false;
  let errorMsg = "";
  let done = false;
  let queued = false;

  // Foto: se comprime + limpia EXIF y se sube en cuanto se elige.
  let photoState: "idle" | "uploading" | "ok" | "error" = "idle";
  let photoPath: string | null = null;
  let photoError = "";
  let photoPreview: string | null = null;

  async function onPhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    photoError = "";
    photoState = "uploading";
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = URL.createObjectURL(file);
    const r = await uploadPhoto(file);
    if (r.ok) {
      photoPath = r.path;
      photoState = "ok";
    } else {
      photoPath = null;
      photoError = r.error;
      photoState = "error";
      if (photoPreview) URL.revokeObjectURL(photoPreview);
      photoPreview = null;
    }
  }
  function removePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    photoPreview = null;
    photoPath = null;
    photoState = "idle";
    photoError = "";
  }

  function useLocation() {
    if (!("geolocation" in navigator)) {
      geoState = "denied";
      return;
    }
    geoState = "loading";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        geoState = "ok";
      },
      () => {
        geoState = "denied";
        lat = null;
        lng = null;
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  async function submit() {
    errorMsg = "";
    if (!found_location_text.trim()) {
      errorMsg =
        "Indica dónde fue encontrada — es lo que ayuda a una familia a ubicarla.";
      return;
    }
    if (!reporter_phone.trim()) {
      errorMsg =
        "Tu WhatsApp es necesario para verificar que el reporte es real.";
      return;
    }
    if (photoState === "uploading") {
      errorMsg = "La foto aún se está procesando, espera un momento.";
      return;
    }
    submitting = true;
    try {
      const body: Record<string, unknown> = {
        status: "unidentified_body",
        // No hay nombre: el backend exige given_name; "NN" es el término forense
        // estándar para "sin identificar".
        given_name: "NN",
        age: age ? Number(age) : undefined,
        sex,
        last_known_location_text: found_location_text.trim() || undefined,
        clothing_top: clothing_top.trim() || undefined,
        clothing_bottom: clothing_bottom.trim() || undefined,
        distinguishing_marks: distinguishing_marks.trim() || undefined,
        photo_url: photoPath || undefined,
        description: description.trim() || undefined,
        reporter_relation,
        reporter_name: reporter_name.trim() || undefined,
        reporter_email: reporter_email.trim() || undefined,
        reporter_phone: reporter_phone.trim() || undefined,
        "cf-turnstile-response": token,
      };
      if (lat != null && lng != null) {
        body.lat = lat;
        body.lng = lng;
      }

      const result = await submitReport("/api/persons", "cuerpo-nn", body);
      if (result.outcome === "sent") {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        done = true;
      } else if (result.outcome === "queued") {
        if (photoPreview) URL.revokeObjectURL(photoPreview);
        queued = true;
      } else if (result.outcome === "unsupported") {
        errorMsg =
          "No se pudo guardar el reporte sin conexión en este dispositivo. Intenta cuando tengas señal.";
      } else {
        errorMsg = result.message;
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Reportar persona fallecida sin identificar — Faro VE</title>
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

  {#if done}
    <div class="rounded-2xl border border-faro-200 bg-faro-50 p-6 text-center">
      <p
        class="mx-auto flex h-12 w-12 items-center justify-center text-faro-900"
        aria-hidden="true"
      >
        <FaroIcon name="candle" size={40} />
      </p>
      <h1 class="mt-2 text-xl font-bold text-faro-900">Reporte recibido</h1>
      <p class="mt-2 text-sm text-gray-700">
        Gracias por ayudar a que una familia encuentre a quien busca. La
        información aparecerá en el mapa con la ubicación aproximada, para que
        quien busca a un ser querido pueda reconocerla.
      </p>
      <p
        class="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-left text-sm text-faro-900 ring-1 ring-faro-200"
      >
        <span aria-hidden="true">🌐</span>
        <span
          >También se comparte con la <strong>red global de búsqueda</strong> (Cruz
          Roja · Person Finder).</span
        >
      </p>
      <a
        href="/mapa"
        class="min-h-tap mt-5 inline-flex items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white"
      >
        Ver el mapa
      </a>
    </div>
  {:else if queued}
    <QueuedReportCard />
  {:else}
    <div class="flex items-center gap-2.5">
      <span class="text-faro-900" aria-hidden="true"
        ><FaroIcon name="candle" size={26} /></span
      >
      <h1 class="text-2xl font-bold text-gray-900">
        Persona fallecida sin identificar
      </h1>
    </div>
    <p class="mt-1.5 text-sm text-gray-600">
      Con respeto: este reporte ayuda a que una familia que busca a un ser
      querido pueda reconocerlo. La ubicación se muestra siempre aproximada. Tus
      datos de contacto son privados.
    </p>

    <form class="mt-6 space-y-5" on:submit|preventDefault={submit}>
      <fieldset class="space-y-4">
        <legend class="text-sm font-semibold text-gray-900"
          >Sobre la persona encontrada</legend
        >

        <label class="block">
          <span class="text-sm font-medium text-gray-700"
            >¿Dónde fue encontrada? *</span
          >
          <input
            bind:value={found_location_text}
            required
            maxlength="300"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Sector, calle, referencia, o a qué morgue/hospital fue llevada"
          />
        </label>

        <button
          type="button"
          on:click={useLocation}
          aria-busy={geoState === "loading"}
          class="min-h-tap inline-flex items-center gap-2 rounded-lg border border-faro-900 px-4 py-2 text-sm font-medium text-faro-900 hover:bg-faro-50"
        >
          <span aria-hidden="true">📍</span>
          {geoState === "ok"
            ? "Ubicación añadida ✓ (se mostrará aproximada)"
            : "Usar mi ubicación actual"}
        </button>
        {#if geoState === "denied"}
          <p class="text-xs text-amber-700">
            No se pudo obtener la ubicación. Describe la zona arriba.
          </p>
        {/if}

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Sexo aparente</span>
            <select
              bind:value={sex}
              class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="unknown">Sin especificar</option>
              <option value="female">Femenino</option>
              <option value="male">Masculino</option>
              <option value="other">No está claro</option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700"
              >Edad aproximada</span
            >
            <input
              bind:value={age}
              type="number"
              min="0"
              max="130"
              inputmode="numeric"
              class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="años"
            />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700"
              >Vestía (arriba)</span
            >
            <input
              bind:value={clothing_top}
              maxlength="200"
              class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Camiseta roja"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Vestía (abajo)</span
            >
            <input
              bind:value={clothing_bottom}
              maxlength="200"
              class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Jean azul"
            />
          </label>
        </div>

        <label class="block">
          <span class="text-sm font-medium text-gray-700"
            >Señas particulares</span
          >
          <input
            bind:value={distinguishing_marks}
            maxlength="500"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Tatuajes, cicatrices, lunares, prótesis…"
          />
          <span class="mt-1 block text-xs text-gray-500"
            >Lo que ayuda a una familia a reconocer: tatuajes, cicatrices,
            lunares, anillos, dientes.</span
          >
        </label>

        <!-- Foto (opcional) — se comprime y se limpia la ubicación antes de subir -->
        <div class="rounded-xl border border-gray-200 p-4">
          <span class="text-sm font-medium text-gray-700">Foto (opcional)</span>
          {#if photoState === "ok" && photoPreview}
            <div class="mt-2 flex items-center gap-3">
              <img
                src={photoPreview}
                alt="Vista previa"
                class="h-16 w-16 rounded-lg object-cover"
              />
              <span class="text-sm text-green-700">Foto lista ✓</span>
              <button
                type="button"
                on:click={removePhoto}
                class="ml-auto text-sm text-gray-500 underline">Quitar</button
              >
            </div>
          {:else if !$online}
            <p
              class="mt-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
            >
              📷 Sin conexión no se puede adjuntar la foto. Podrás agregarla al
              reconectar.
            </p>
          {:else}
            <label
              class="mt-2 flex min-h-tap cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-faro-900 hover:bg-faro-50"
            >
              <span aria-hidden="true">📷</span>
              {photoState === "uploading" ? "Procesando…" : "Agregar foto"}
              <input
                type="file"
                accept="image/*"
                on:change={onPhoto}
                class="sr-only"
              />
            </label>
          {/if}
          {#if photoState === "error"}
            <p class="mt-2 text-xs text-red-600">{photoError}</p>
          {/if}
          <p class="mt-2 text-xs text-gray-500">
            Por respeto, fotografía señas que ayuden a identificar (ropa,
            tatuajes, objetos),
            <strong>no imágenes gráficas</strong>. Las fotos muy explícitas
            pueden ser ocultadas por moderación. Si la persona es menor de edad,
            su foto <strong>no se mostrará públicamente</strong>.
          </p>
        </div>

        <label class="block">
          <span class="text-sm font-medium text-gray-700">Más detalles</span>
          <textarea
            bind:value={description}
            maxlength="2000"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Estatura aproximada, contextura, cualquier dato que ayude a reconocerla."
          ></textarea>
        </label>
      </fieldset>

      <fieldset class="space-y-4 rounded-xl border border-gray-200 p-4">
        <legend class="px-1 text-sm font-semibold text-gray-900"
          >Tus datos (privados)</legend
        >
        <p class="text-xs text-gray-500">
          No se muestran en el mapa. Sirven para que una familia pueda
          contactarte por un mensaje seguro, sin revelar tu correo ni tu
          teléfono.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Tu relación</span>
            <select
              bind:value={reporter_relation}
              class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="witness">Testigo</option>
              <option value="volunteer">Voluntario/a o rescatista</option>
              <option value="authority">Autoridad / personal de salud</option>
              <option value="unknown">Otro</option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm font-medium text-gray-700">Tu nombre</span>
            <input
              bind:value={reporter_name}
              maxlength="120"
              class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            />
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
            Necesario para <strong>verificar que el reporte es real</strong>. No
            se muestra públicamente; queda cifrado.
          </span>
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700"
            >Tu email (opcional)</span
          >
          <input
            bind:value={reporter_email}
            type="email"
            maxlength="200"
            class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2"
            autocomplete="email"
          />
        </label>
      </fieldset>

      <Turnstile bind:token />

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
        {submitting ? "Enviando…" : "Enviar reporte"}
      </button>
    </form>
  {/if}
</main>
