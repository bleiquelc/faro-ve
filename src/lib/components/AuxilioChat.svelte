<script lang="ts">
  import { tick } from "svelte";
  import FaroIcon from "$components/FaroIcon.svelte";
  import FaroAuxilio from "$components/FaroAuxilio.svelte";

  /**
   * Chat de Faro Auxilio — IA acotada (Haiku 4.5) que se apoya en las guías
   * verificadas. Si la IA no está disponible (sin key, budget topado, sin red),
   * el endpoint responde con `fallback` y el chat sugiere usar las guías. El
   * núcleo estático (tabs Guía/Contactos) sigue funcionando siempre.
   */
  type Msg = {
    role: "user" | "assistant";
    content: string;
    fallback?: boolean;
  };

  let messages: Msg[] = [];
  let input = "";
  let loading = false;
  let notice = "";
  let listEl: HTMLDivElement | null = null;

  const SUGGESTIONS = [
    "¿Cómo hago RCP a un adulto?",
    "¿Qué hago si alguien se atraganta?",
    "¿Cómo detengo un sangrado fuerte?",
    "¿Cómo dejo el agua segura para beber?",
  ];

  async function scrollDown() {
    await tick();
    listEl?.scrollTo({ top: listEl.scrollHeight, behavior: "smooth" });
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    notice = "";
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    messages = [...messages, { role: "user", content: q }];
    input = "";
    loading = true;
    scrollDown();
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      if (res.status === 429) {
        notice =
          "Llegaste al límite de preguntas por hoy. Las guías de abajo siguen disponibles.";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        answer?: string;
        fallback?: boolean;
      };
      if (!res.ok || !data.answer) {
        notice =
          "No se pudo responder ahora. Usa las guías (funcionan sin internet).";
        return;
      }
      messages = [
        ...messages,
        { role: "assistant", content: data.answer, fallback: data.fallback },
      ];
      scrollDown();
    } catch {
      notice =
        "Sin conexión. Las guías de Faro Auxilio funcionan sin internet — úsalas.";
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col">
  <p
    class="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-[12px] leading-snug text-slate-600"
  >
    Respuestas guiadas por las guías verificadas de Faro Auxilio. No reemplazan
    la atención de un profesional. <span class="font-semibold"
      >Ante una emergencia, llama al 911.</span
    >
  </p>

  <!-- Conversación -->
  <div bind:this={listEl} class="max-h-[52vh] space-y-3 overflow-y-auto">
    {#if messages.length === 0}
      <div class="py-2">
        <p class="mb-2 text-sm text-slate-500">
          Pregúntale a Faro Auxilio. Por ejemplo:
        </p>
        <div class="flex flex-wrap gap-2">
          {#each SUGGESTIONS as s (s)}
            <button
              type="button"
              on:click={() => send(s)}
              class="min-h-tap rounded-full bg-white px-3 py-2 text-left text-[13px] text-faro-900 shadow-sm ring-1 ring-slate-200 transition hover:ring-faro-300 active:scale-[0.98]"
            >
              {s}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#each messages as m, i (i)}
      {#if m.role === "user"}
        <div class="flex justify-end">
          <p
            class="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-faro-900 px-3.5 py-2 text-sm text-white"
          >
            {m.content}
          </p>
        </div>
      {:else}
        <div class="flex items-start gap-2">
          <span class="mt-0.5 shrink-0" aria-hidden="true"
            ><FaroAuxilio compact size={24} /></span
          >
          <p
            class="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200"
          >
            {m.content}
          </p>
        </div>
      {/if}
    {/each}

    {#if loading}
      <div class="flex items-center gap-2 text-sm text-slate-500">
        <span class="shrink-0" aria-hidden="true"
          ><FaroAuxilio compact size={22} /></span
        >
        <span class="fa-typing">Pensando…</span>
      </div>
    {/if}
  </div>

  {#if notice}
    <p
      class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900"
      role="status"
    >
      {notice}
    </p>
  {/if}

  <!-- Entrada -->
  <form
    class="mt-3 flex items-center gap-2"
    on:submit|preventDefault={() => send()}
  >
    <input
      bind:value={input}
      type="text"
      enterkeyhint="send"
      maxlength="1000"
      placeholder="Escribe tu pregunta…"
      aria-label="Escribe tu pregunta a Faro Auxilio"
      class="min-h-tap w-full rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none focus:border-faro-700 focus:ring-2 focus:ring-faro-700"
    />
    <button
      type="submit"
      disabled={loading || !input.trim()}
      aria-label="Enviar pregunta"
      class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-faro-900 text-white transition active:scale-95 hover:bg-faro-800 disabled:opacity-50"
    >
      <FaroIcon name="navigate" size={20} />
    </button>
  </form>
</div>

<style>
  .fa-typing {
    animation: fa-blink 1.4s ease-in-out infinite;
  }
  @keyframes fa-blink {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fa-typing {
      animation: none;
    }
  }
</style>
