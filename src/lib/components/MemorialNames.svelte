<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    cleanDisplayName,
    pickOffset,
    shuffled,
    isTributeSlot,
    TRIBUTES
  } from '$utils/memorial';

  /**
   * MemorialNames — la franja de memoria del home.
   *
   * Sobre el mapa de luz aparecen, muy sutiles, los nombres de las personas que
   * SEGUIMOS BUSCANDO (dato ya público del mapa): cada nombre se enciende letra
   * a letra y se apaga letra a letra, lento y digno — como una vela. Cada
   * TRIBUTE_EVERY nombres, una frase honra a quienes ya no están (sin nominar:
   * decisión founder + precedente Guerrero, ver utils/memorial.ts).
   *
   * Dignidad (misma regla que PULSE_CLASS.deceased=null): fundidos lentos,
   * jamás parpadeo. prefers-reduced-motion → sin stagger por letra, solo un
   * fundido simple más largo. Decorativo → aria-hidden; el texto real para
   * lectores va en un párrafo sr-only fuera del bloque decorativo.
   */

  /** Total de desaparecidos (stats.missing) para rotar el lote entre TODOS. */
  export let totalMissing = 0;

  const BATCH = 60;
  const HOLD_MS = 3600; // nombre plenamente visible
  const GAP_MS = 1100; // silencio entre nombres

  type Slot = { text: string; tribute: boolean };

  let names: string[] = [];
  let current: Slot | null = null;
  let chars: string[] = [];
  let phase: 'pre' | 'in' | 'out' = 'pre';
  let shownCount = 0;
  let nameIdx = 0;
  let tributeIdx = 0;
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Stagger por letra (ms). Con reduced-motion: 0 → fundido de bloque.
  const IN_STAGGER = reduce ? 0 : 45;
  const OUT_STAGGER = reduce ? 0 : 85;
  const FADE_MS = reduce ? 500 : 1000;

  async function tryFetch(url: string): Promise<{ persons?: { full_name?: string | null }[] } | null> {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      return (await r.json()) as { persons?: { full_name?: string | null }[] };
    } catch {
      return null;
    }
  }

  async function loadBatch(): Promise<void> {
    const off = pickOffset(totalMissing, BATCH);
    const qs = `status=missing&limit=${BATCH}&offset=${off}`;
    // Mismo origen primero; si no hay API local (preview), la API pública de
    // federación tiene CORS abierto para GET — el memorial usa el dato real.
    const data =
      (await tryFetch(`/api/persons?${qs}`)) ??
      (await tryFetch(`https://faro-ve.com/api/persons?${qs}`));
    const clean = (data?.persons ?? [])
      .map((p) => cleanDisplayName(p.full_name))
      .filter((n): n is string => n != null);
    names = shuffled(clean);
    nameIdx = 0;
  }

  function schedule(ms: number, fn: () => void): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (alive) fn();
    }, ms);
  }

  function nextSlot(): Slot | null {
    if (isTributeSlot(shownCount) || names.length === 0) {
      const t = TRIBUTES[tributeIdx % TRIBUTES.length];
      tributeIdx++;
      return { text: t, tribute: true };
    }
    const n = names[nameIdx % names.length];
    nameIdx++;
    // Lote agotado → pedir otro distinto en segundo plano (sigue con tributos
    // y lo ya visto mientras llega).
    if (nameIdx >= names.length) void loadBatch();
    return n ? { text: n, tribute: false } : null;
  }

  function showNext(): void {
    const slot = nextSlot();
    if (!slot) {
      schedule(4000, showNext);
      return;
    }
    current = slot;
    chars = Array.from(slot.text);
    phase = 'pre';
    shownCount++;
    // Un frame en 'pre' (letras a opacity 0) → transición real al pasar a 'in'.
    schedule(40, () => {
      phase = 'in';
      const inDur = FADE_MS + IN_STAGGER * chars.length;
      schedule(inDur + HOLD_MS, () => {
        phase = 'out';
        const outDur = FADE_MS + OUT_STAGGER * chars.length;
        schedule(outDur + GAP_MS, showNext);
      });
    });
  }

  onMount(() => {
    void (async () => {
      await loadBatch();
      if (alive) showNext();
    })();
  });

  onDestroy(() => {
    alive = false;
    if (timer) clearTimeout(timer);
  });
</script>

<!-- Texto real para lectores de pantalla (estático, sin ciclo que interrumpa). -->
<p class="sr-only">
  Lugar de memoria: seguimos buscando a miles de personas tras el terremoto del
  24 de junio de 2026. En memoria de quienes ya no están.
</p>

<div class="mn-wrap" aria-hidden="true">
  {#if current}
    <span class="mn-label" class:mn-label-on={!current.tribute && phase !== 'pre'}>
      Seguimos buscando a
    </span>
    <p class="mn-name" class:mn-tribute={current.tribute} style="--fade:{FADE_MS}ms">
      {#each chars as ch, i (shownCount + '-' + i)}
        <span
          class="mn-ch"
          class:mn-on={phase === 'in'}
          style="transition-delay:{phase === 'out' ? i * OUT_STAGGER : i * IN_STAGGER}ms"
          >{ch === ' ' ? ' ' : ch}</span
        >
      {/each}
    </p>
  {/if}
</div>

<style>
  .mn-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
    pointer-events: none;
    user-select: none;
  }
  .mn-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(247, 241, 223, 0);
    transition: color 1.4s ease;
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.65);
  }
  .mn-label-on {
    color: rgba(247, 241, 223, 0.55);
  }
  .mn-name {
    margin: 0;
    max-width: 92vw;
    font-size: 1.15rem;
    font-weight: 300;
    letter-spacing: 0.06em;
    line-height: 1.35;
    color: #f7f1df;
    /* Halo cálido de vela — la firma de luz de Faro (#FFE39C). */
    text-shadow:
      0 1px 10px rgba(0, 0, 0, 0.75),
      0 0 22px rgba(255, 227, 156, 0.3);
  }
  .mn-tribute {
    font-style: italic;
    font-size: 1rem;
    color: rgba(247, 241, 223, 0.85);
  }
  .mn-ch {
    display: inline-block;
    opacity: 0;
    transition: opacity var(--fade, 1000ms) ease;
    will-change: opacity;
  }
  .mn-on {
    opacity: 1;
  }
  @media (min-width: 640px) {
    .mn-name {
      font-size: 1.35rem;
    }
  }
</style>
