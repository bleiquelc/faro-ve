<script lang="ts">
  import { page } from '$app/stores';
  import Turnstile from '$components/Turnstile.svelte';
  import type { PageData } from './$types';

  /**
   * Respuesta del relay anti-estafa (0032). El reportante responde UNA vez;
   * su respuesta viaja al email cifrado del remitente sin que ninguno vea el
   * email del otro. Copy honesto: el hilo se cierra al responder.
   */
  export let data: PageData;

  let body = '';
  let token = '';
  let submitting = false;
  let errorMsg = '';
  let done = false;

  async function submit() {
    errorMsg = '';
    if (body.trim().length < 5) {
      errorMsg = 'Escribe una respuesta un poco más larga.';
      return;
    }
    submitting = true;
    try {
      const res = await fetch('/api/relay/reply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: $page.params.token,
          body: body.trim(),
          'cf-turnstile-response': token
        })
      });
      if (res.ok) {
        done = true;
      } else if (res.status === 410) {
        errorMsg = 'Este enlace ya fue usado o expiró. El hilo seguro está cerrado.';
      } else if (res.status === 429) {
        errorMsg = 'Demasiados intentos desde tu conexión. Espera un rato e intenta de nuevo.';
      } else if (res.status === 403) {
        errorMsg = 'La verificación anti-bot no se completó. Recarga la página e intenta otra vez.';
      } else {
        const j = (await res.json().catch(() => ({}))) as { message?: string };
        errorMsg = j.message || 'No se pudo enviar. Intenta de nuevo en unos minutos.';
      }
    } catch {
      errorMsg = 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.';
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Responder mensaje · Faro VE</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="mx-auto max-w-lg px-4 py-8">
  <a href="/" class="text-sm text-faro-700 underline">← Faro VE</a>

  {#if !data.valid}
    <h1 class="mt-3 text-xl font-bold text-gray-900">Este enlace ya no está activo</h1>
    <p class="mt-3 text-sm leading-relaxed text-gray-600">
      Los enlaces de respuesta valen 14 días y admiten una sola respuesta, para proteger a las dos
      personas. Si necesitas contactar de nuevo, la otra persona puede escribirte otra vez desde la
      ficha en el mapa.
    </p>
  {:else if done}
    <div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <p class="text-emerald-900"><strong>Respuesta enviada.</strong></p>
      <p class="mt-2 text-sm text-emerald-800">
        Tu respuesta viajó por el relay seguro de Faro: tu email no se compartió. Este hilo queda
        cerrado; si esa persona necesita seguir en contacto, puede escribirte de nuevo desde la
        ficha.
      </p>
      <a href="/" class="mt-4 inline-block rounded-xl bg-faro-700 px-4 py-2 text-sm font-semibold text-white">
        Volver al inicio
      </a>
    </div>
  {:else}
    <h1 class="mt-3 text-xl font-bold text-gray-900">Responder de forma segura</h1>
    <p class="mt-2 text-sm leading-relaxed text-gray-600">
      Alguien te escribió sobre la ficha de <strong>{data.personName}</strong>
      {#if data.sentAt}
        el {new Date(data.sentAt).toLocaleDateString('es-VE', { day: 'numeric', month: 'long' })}{/if}.
      Tu respuesta viaja por el relay de Faro: <strong>nadie ve tu email</strong> y este enlace
      admite una sola respuesta.
    </p>

    <div class="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p class="text-xs leading-relaxed text-amber-900">
        ⚠️ <strong>Cuidado con estafas:</strong> nunca envíes dinero ni datos bancarios a nadie que
        diga tener información. Faro jamás pide pagos.
      </p>
    </div>

    <label class="mt-5 block text-sm font-medium text-gray-800" for="body">Tu respuesta</label>
    <textarea
      id="body"
      class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
      rows="5"
      maxlength="2000"
      placeholder="Escribe tu respuesta…"
      bind:value={body}
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
      {submitting ? 'Enviando…' : 'Enviar respuesta segura'}
    </button>
  {/if}
</main>
