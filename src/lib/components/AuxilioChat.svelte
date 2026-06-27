<script lang="ts">
  import { tick } from "svelte";
  import FaroIcon from "$components/FaroIcon.svelte";
  import FaroAuxilio from "$components/FaroAuxilio.svelte";
  import {
    searchGuides,
    isConfidentHit,
    type GuideHit,
  } from "$lib/data/auxilio/search";

  /**
   * Chat de Faro Auxilio. Responde LOCAL primero: busca en las guías
   * verificadas (sin red, sin IA, instantáneo) y, si una guía coincide claro,
   * la muestra tal cual. Solo si la búsqueda no resuelve, llama a la IA (Haiku)
   * como respaldo. Así la mayoría de las preguntas comunes se responden sin
   * gastar IA y funcionan offline. Si la IA no está, el estático nunca se cae.
   */
  type Msg = {
    role: "user" | "assistant";
    content: string;
    source?: "ia" | "guia";
    question?: string;
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

  // Respuesta de TEXTO PLANO armada desde una guía verificada (sin IA).
  function formatGuide(hit: GuideHit): string {
    const p = hit.proc;
    const out: string[] = [p.title.toUpperCase()];
    if (p.summary) out.push(p.summary);
    out.push("\nPASOS:");
    p.steps.forEach((s, i) => out.push(`${i + 1}. ${s}`));
    if (p.dont?.length) {
      out.push("\nQUÉ NO HACER:");
      p.dont.forEach((d) => out.push(`• ${d}`));
    }
    if (p.callEmergency?.length) {
      out.push("\nCUÁNDO LLAMAR AL 911:");
      p.callEmergency.forEach((c) => out.push(`• ${c}`));
    }
    return out.join("\n");
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    notice = "";
    messages = [...messages, { role: "user", content: q }];
    input = "";
    await scrollDown();

    // 1) LOCAL primero: si una guía coincide claro, responde sin red ni IA.
    const hits = searchGuides(q);
    if (isConfidentHit(hits)) {
      messages = [
        ...messages,
        {
          role: "assistant",
          content: formatGuide(hits[0]),
          source: "guia",
          question: q,
        },
      ];
      await scrollDown();
      return;
    }

    // 2) Respaldo IA (Anthropic) para lo que la búsqueda no resuelve.
    await askWithAI(q);
  }

  async function askWithAI(q: string) {
    loading = true;
    await scrollDown();
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (res.status === 429) {
        notice =
          "Llegaste al límite de preguntas con IA por hoy. Las guías siguen disponibles aquí abajo.";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        answer?: string;
        fallback?: boolean;
      };
      if (!res.ok || !data.answer) {
        notice =
          "No se pudo responder con IA ahora. Usa las guías (funcionan sin internet).";
        return;
      }
      messages = [
        ...messages,
        {
          role: "assistant",
          content: data.answer,
          source: "ia",
          fallback: data.fallback,
        },
      ];
      await scrollDown();
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
    Respuestas de las guías verificadas de Faro Auxilio (funcionan sin
    internet). No reemplazan la atención de un profesional.
    <span class="font-semibold">Ante una emergencia, llama al 911.</span>
  </p>

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
          <div class="max-w-[85%]">
            {#if m.source === "guia"}
              <span
                class="mb-1 inline-block rounded-full bg-faro-50 px-2 py-0.5 text-[10px] font-semibold text-faro-700 ring-1 ring-faro-100"
              >
                📖 De la guía · sin internet
              </span>
            {/if}
            <p
              class="whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-slate-200"
            >
              {m.content}
            </p>
            {#if m.source === "guia" && m.question}
              <button
                type="button"
                on:click={() => m.question && askWithAI(m.question)}
                disabled={loading}
                class="mt-1.5 text-[12px] font-medium text-faro-700 underline decoration-faro-200 underline-offset-2 hover:text-faro-900 disabled:opacity-50"
              >
                ¿Prefieres que la IA lo explique distinto?
              </button>
            {/if}
          </div>
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
