<script lang="ts">
  import FaroIcon from '$components/FaroIcon.svelte';
  /**
   * Compartir una ficha — más ojos sobre un caso = más posibilidades de hallazgo.
   * Web Share API nativa (ideal en celular) con fallback a WhatsApp (dominante en
   * VE) + copiar enlace. No expone nada nuevo: la ficha pública ya está indexada,
   * con coords ofuscadas y, si es menor, sin foto.
   */
  export let name: string;
  export let url: string; // URL absoluta de la ficha
  // ¿La persona está siendo buscada? Ajusta el mensaje (buscar vs. compartir).
  export let searching: boolean = true;

  let copied = false;
  let canNativeShare = false;

  // navigator.share solo existe en el cliente (y no en todos los navegadores).
  import { onMount } from 'svelte';
  onMount(() => {
    canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  });

  $: who = name?.trim() ? name.trim() : 'esta persona';
  $: message = searching
    ? `🔦 Ayúdame a encontrar a ${who}. Si la has visto o tienes información, entra a Faro VE:`
    : `🔦 ${who} en Faro VE — Mapa de Esperanza Venezuela:`;
  $: whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;

  async function nativeShare(): Promise<void> {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${who} — Faro VE`, text: message, url });
      } catch {
        /* el usuario canceló — no es error */
      }
    } else {
      await copyLink();
    }
  }

  async function copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 2200);
    } catch {
      /* portapapeles no disponible: el enlace de WhatsApp sigue sirviendo */
    }
  }
</script>

<section class="mt-4" aria-label="Compartir">
  <div class="flex flex-wrap gap-2">
    {#if canNativeShare}
      <button
        type="button"
        on:click={nativeShare}
        class="min-h-tap flex flex-1 items-center justify-center gap-2 rounded-lg bg-faro-900 px-4 py-3 font-semibold text-white transition hover:bg-faro-800 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700 focus:ring-offset-2"
      >
<FaroIcon name="share" size={18} /> Compartir
      </button>
    {/if}

    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      class="min-h-tap flex flex-1 items-center justify-center gap-2 rounded-lg border border-faro-900 px-4 py-3 font-semibold text-faro-900 transition hover:bg-faro-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700"
    >
<FaroIcon name="message" size={18} /> WhatsApp
    </a>

    <button
      type="button"
      on:click={copyLink}
      class="min-h-tap flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-100 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700"
      aria-live="polite"
    >
<FaroIcon name="copy" size={18} />
      {copied ? '¡Copiado!' : 'Copiar enlace'}
    </button>
  </div>
  <p class="mt-1.5 text-center text-xs text-gray-500">
    Compartir suma ojos. Cuanta más gente lo vea, más fácil es encontrar a {who}.
  </p>
</section>
