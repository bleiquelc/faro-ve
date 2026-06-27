<script lang="ts">
  /**
   * Banner de la cola de reportes OFFLINE. Visible solo si hay reportes guardados
   * sin enviar. Muestra SOLO metadatos (conteo, antigüedad, estado) — NUNCA PII
   * (nombre/teléfono/email viven cifrados en IndexedDB y jamás se renderizan).
   *
   * Dexie/replay se importan de forma DIFERIDA (solo cuando hay cola) → no entran
   * al bundle inicial (#21). Copy honesto (#24): sin BackgroundSync, el envío
   * ocurre al reabrir la app con señal, no "solo".
   */
  import { onMount } from "svelte";
  import { outboxSummary } from "$client/outbox-store";
  import { online } from "$client/online";

  let sending = false;
  let wiping = false;
  let confirmWipe = false;
  let needsTap = false;
  let turnstileHost: HTMLDivElement;
  let engineStarted = false;

  $: summary = $outboxSummary;
  $: hasItems = summary.count > 0;
  $: alertish = summary.worst === "failed" || summary.worst === "needs_attention";

  async function ensureEngine() {
    if (engineStarted || !hasItems) return;
    engineStarted = true;
    try {
      const { startReplayEngine } = await import("$client/replay");
      await startReplayEngine();
    } catch {
      engineStarted = false;
    }
  }

  onMount(ensureEngine);
  $: if (hasItems) void ensureEngine();

  async function sendNow() {
    if (sending) return;
    sending = true;
    needsTap = false;
    try {
      // Revive entradas atascadas (needs_attention) para que "Enviar ahora"
      // siempre haga algo, no solo cuando hay pendientes con reintentos vivos.
      const { reviveStuck } = await import("$client/outbox");
      await reviveStuck();
      const replay = await import("$client/replay");
      // Path interactivo: ESPERA el lock y devuelve el resultado real (no miente
      // si otra pestaña estaba drenando — ese caso ya no apaga el spinner como éxito).
      const res = await replay.drain({ interactive: true, container: turnstileHost });
      needsTap = res.needsInteraction;
    } catch {
      needsTap = true;
    } finally {
      sending = false;
    }
  }

  async function wipe() {
    wiping = true;
    try {
      const { wipeAll } = await import("$client/outbox");
      await wipeAll();
      confirmWipe = false;
    } finally {
      wiping = false;
    }
  }

  function ageLabel(oldestAt: number | null): string {
    if (!oldestAt) return "";
    const mins = Math.max(0, Math.round((Date.now() - oldestAt) / 60000));
    if (mins < 1) return "hace un momento";
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.round(mins / 60);
    return `hace ${hrs} h`;
  }
</script>

{#if hasItems}
  <div
    class="ob-wrap fixed inset-x-0 bottom-0 z-[1050] px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2"
  >
    <div
      class="mx-auto max-w-md rounded-2xl bg-faro-900 px-4 py-3 text-white shadow-xl shadow-black/40 ring-1 ring-white/20"
      role={alertish ? "alert" : undefined}
    >
      <div class="flex items-start gap-3">
        <span class="mt-0.5 text-lg" aria-hidden="true">📨</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold leading-snug" aria-live="polite">
            {summary.count}
            {summary.count === 1 ? "reporte guardado" : "reportes guardados"} en este
            teléfono
          </p>
          <p class="mt-0.5 text-xs leading-snug text-white/80">
            {#if alertish}
              Un reporte necesita tu atención. Toca <strong>Enviar ahora</strong>.
            {:else if needsTap}
              Toca <strong>Enviar ahora</strong> para completar la verificación.
            {:else if $online}
              Se enviar{summary.count === 1 ? "á" : "án"} ahora que tienes señal. {ageLabel(
                summary.oldestAt,
              )}
            {:else}
              Se enviar{summary.count === 1 ? "á" : "án"} al reabrir Faro VE con señal. {ageLabel(
                summary.oldestAt,
              )}
            {/if}
          </p>

          <div class="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              on:click={sendNow}
              disabled={sending}
              class="min-h-tap inline-flex items-center justify-center rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-faro-900 transition active:scale-95 disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Enviar ahora"}
            </button>

            {#if !confirmWipe}
              <button
                type="button"
                on:click={() => (confirmWipe = true)}
                class="min-h-tap inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-medium text-white/85 underline decoration-white/40 underline-offset-2 hover:text-white"
              >
                Borrar mis datos de este teléfono
              </button>
            {:else}
              <span class="text-xs text-white/90">¿Seguro?</span>
              <button
                type="button"
                on:click={wipe}
                disabled={wiping}
                class="min-h-tap inline-flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                {wiping ? "Borrando…" : "Sí, borrar"}
              </button>
              <button
                type="button"
                on:click={() => (confirmWipe = false)}
                class="min-h-tap inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-xs text-white/85"
              >
                Cancelar
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Contenedor para el widget Turnstile visible si hace falta challenge. -->
      <div bind:this={turnstileHost} class="mt-2 empty:mt-0"></div>
    </div>
  </div>
{/if}

<style>
  .ob-wrap {
    animation: ob-rise 0.35s ease-out;
  }
  @keyframes ob-rise {
    from {
      transform: translateY(8px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .ob-wrap {
      animation: none;
    }
  }
</style>
