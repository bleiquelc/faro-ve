<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  let submitting = false;
</script>

<svelte:head>
  <title>Entrar · Moderación Faro VE</title>
</svelte:head>

<main class="mx-auto w-full max-w-sm px-5 py-16">
  <h1 class="text-xl font-bold text-gray-900">Acceso de moderación</h1>
  <p class="mt-2 text-sm text-gray-600">
    Te enviamos un enlace de acceso a tu correo. Es solo para moderadores autorizados de Faro VE.
  </p>

  {#if form?.sent}
    <div class="mt-6 rounded-xl bg-green-50 px-4 py-4 text-sm text-green-900">
      ✅ Si tu correo está autorizado, te enviamos un enlace de acceso. Revisa tu bandeja de entrada
      (y la carpeta de spam). El enlace caduca pronto por seguridad.
    </div>
  {:else}
    <form
      method="POST"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update();
          submitting = false;
        };
      }}
      class="mt-6 space-y-4"
    >
      <label class="block">
        <span class="text-sm font-medium text-gray-700">Tu correo</span>
        <input
          name="email"
          type="email"
          required
          autocomplete="email"
          inputmode="email"
          placeholder="tu@correo.com"
          class="mt-1 min-h-tap w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-faro-700 focus:outline-none focus:ring-2 focus:ring-faro-700"
        />
      </label>

      {#if form?.error}
        <p class="text-sm text-red-700" role="alert">{form.error}</p>
      {/if}
      {#if data.error}
        <p class="text-sm text-red-700" role="alert">
          El enlace no es válido o ya caducó. Solicita uno nuevo.
        </p>
      {/if}

      <button
        type="submit"
        disabled={submitting}
        class="min-h-tap w-full rounded-lg bg-faro-900 px-4 py-3 font-semibold text-white transition hover:bg-faro-800 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700 focus:ring-offset-2 disabled:opacity-60"
      >
        {submitting ? 'Enviando…' : 'Enviar enlace de acceso'}
      </button>
    </form>
  {/if}

  <p class="mt-8 text-center text-xs text-gray-400">
    <a href="/" class="hover:underline">← Volver a Faro VE</a>
  </p>
</main>
