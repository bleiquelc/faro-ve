<script lang="ts">
  import Turnstile from '$components/Turnstile.svelte';
  import FaroIcon from '$components/FaroIcon.svelte';
  import { tick } from 'svelte';

  /**
   * Mensaje al reportante vía relay anti-estafa (0032, función 4).
   * Solo se monta cuando la ficha tiene `relay_available` (hay email del
   * reportante + consentimiento). El email del remitente viaja cifrado y
   * NUNCA se muestra al reportante; la respuesta vuelve por reply_token.
   */
  export let personId: string;
  export let personName: string;

  let open = false;
  let senderName = '';
  let senderEmail = '';
  let body = '';
  let token = '';
  let submitting = false;
  let errorMsg = '';
  let done = false;
  let formEl: HTMLFormElement | null = null;

  $: who = personName?.trim() || 'esta persona';

  async function openForm(): Promise<void> {
    open = true;
    await tick();
    formEl?.querySelector('textarea')?.focus();
  }

  async function submit(): Promise<void> {
    errorMsg = '';
    if (body.trim().length < 10) {
      errorMsg = 'Cuenta un poco más (mínimo 10 caracteres).';
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(senderEmail.trim())) {
      errorMsg = 'Escribe un email válido para poder recibir la respuesta.';
      return;
    }
    submitting = true;
    try {
      const res = await fetch(`/api/persons/${personId}/message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sender_name: senderName.trim() || undefined,
          sender_email: senderEmail.trim().toLowerCase(),
          body: body.trim(),
          'cf-turnstile-response': token
        })
      });
      if (res.ok) {
        done = true;
      } else if (res.status === 429) {
        errorMsg = 'Ya enviaste varios mensajes hoy. Espera un poco e intenta de nuevo.';
      } else if (res.status === 403) {
        errorMsg = 'La verificación anti-bot no se completó. Recarga la página e intenta otra vez.';
      } else if (res.status === 409) {
        errorMsg = 'Esta ficha no tiene un canal de contacto disponible.';
      } else if (res.status === 503) {
        errorMsg = 'El envío de mensajes aún no está disponible. Intenta más tarde.';
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

<section class="mt-4">
  {#if done}
    <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p class="text-sm text-emerald-900">
        <strong>Mensaje enviado por el relay seguro.</strong> Si quien reportó a {who} responde, te
        llegará al email que dejaste — sin que ninguno de los dos vea el email del otro.
      </p>
    </div>
  {:else if !open}
    <button
      type="button"
      class="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg border-2 border-faro-700 px-4 py-3 font-semibold text-faro-800 transition hover:bg-faro-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700 focus:ring-offset-2"
      on:click={openForm}
    >
      <FaroIcon name="message" size={18} /> Escribir a quien reportó a {who}
    </button>
    <p class="mt-1.5 text-center text-xs text-gray-400">
      Mensaje privado por el relay de Faro: nadie ve el email de nadie.
    </p>
  {:else}
    <form bind:this={formEl} class="rounded-2xl border border-gray-200 p-4" on:submit|preventDefault={submit}>
      <h2 class="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <FaroIcon name="message" size={16} /> Mensaje para quien reportó a {who}
      </h2>
      <p class="mt-1 text-xs leading-relaxed text-gray-500">
        Va por el relay seguro: la persona NO verá tu email, y su respuesta te llegará sin que tú
        veas el suyo.
      </p>

      <div class="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
        <p class="text-xs leading-relaxed text-amber-900">
          ⚠️ <strong>Cuidado con estafas:</strong> nunca envíes dinero ni datos bancarios. Faro
          jamás pide pagos.
        </p>
      </div>

      <label class="mt-4 block text-sm font-medium text-gray-800" for="relay-body">Tu mensaje</label>
      <textarea
        id="relay-body"
        class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
        rows="4"
        maxlength="2000"
        placeholder="Ej.: Creo que vi a {who} en… / Tengo información sobre…"
        bind:value={body}
        required
      ></textarea>

      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label class="block text-sm font-medium text-gray-800" for="relay-name">Tu nombre (opcional)</label>
          <input
            id="relay-name"
            class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            maxlength="120"
            autocomplete="name"
            bind:value={senderName}
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-800" for="relay-email">Tu email</label>
          <input
            id="relay-email"
            class="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
            type="email"
            maxlength="254"
            autocomplete="email"
            placeholder="Para recibir la respuesta"
            bind:value={senderEmail}
            required
          />
          <p class="mt-1 text-xs text-gray-400">Se guarda cifrado; nunca se muestra.</p>
        </div>
      </div>

      <div class="mt-4">
        <Turnstile bind:token />
      </div>

      {#if errorMsg}
        <p class="mt-3 text-sm text-red-600" role="alert">{errorMsg}</p>
      {/if}

      <div class="mt-4 flex gap-2">
        <button
          type="submit"
          class="min-h-tap flex-1 rounded-xl bg-faro-700 px-4 py-3 font-semibold text-white transition disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Enviando…' : 'Enviar por el relay seguro'}
        </button>
        <button
          type="button"
          class="rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-600"
          on:click={() => (open = false)}
        >
          Cancelar
        </button>
      </div>
    </form>
  {/if}
</section>
