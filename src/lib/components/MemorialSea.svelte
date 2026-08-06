<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { cleanDisplayName, pickOffset, shuffled } from '$utils/memorial';

  /**
   * MemorialSea — el mar se vuelve un cielo de nombres (rediseño founder 6-ago).
   *
   * En toda la zona azul (el mar sobre la costa) flota un CAMPO de 15–20
   * nombres de quienes SEGUIMOS BUSCANDO, en ciclo de profundidad continuo
   * (founder 6-ago): cada nombre nace pequeño y tenue DESDE ATRÁS, sube muy
   * despacio acercándose (crece, gana presencia) y al llegar al frente se
   * desvanece — mientras, otros vienen llegando desde atrás. El campo se
   * puebla poco a poco al entrar. ARRIBA, fija y serena (founder 6-ago):
   * "Venezuela los sigue buscando".
   *
   * La LUZ DEL FARO los resalta a su paso: el haz de Map.svelte gira con fase
   * de RELOJ DE PARED (animation-delay negativo, período BEAM_PERIOD_S) y aquí
   * se calcula la misma fase — cuando el sector del haz cruza un nombre, este
   * se enciende suave un instante. Sin acople entre componentes: la convención
   * compartida es (período, sectores del conic-gradient, posición del faro).
   *
   * Dignidad y reglas: fundidos lentos jamás parpadeo; rAF capado a 30 fps
   * (#23); pausa con pestaña oculta; prefers-reduced-motion → nombres quietos
   * con fundido simple y sin resaltado; html.low-power → solo la línea
   * central. Decorativo: aria-hidden + párrafo sr-only estático.
   */

  /** Centro/zoom del mapa fijo del home (para proyectar el faro a pantalla). */
  export let center: [number, number] = [10.63, -66.9];
  export let zoom = 11;
  /** Total de desaparecidos (stats.missing) para rotar el lote entre TODOS. */
  export let totalMissing = 0;

  // ── Convención compartida con el faro de Map.svelte ──────────────────────
  const LIGHTHOUSE: [number, number] = [10.6035, -66.879]; // Macuto
  const LAMP_OFFSET_Y = 58; // px de la base a la lámpara (torre de 72 px)
  export const BEAM_PERIOD_S = 26;
  // Sectores brillantes del conic-gradient del haz (grados, sin rotar):
  const SECTORS: [number, number][] = [
    [10, 38],
    [188, 216]
  ];

  const BATCH = 120; // con 15–20 en pantalla, un lote dura ~3 min entre fetches
  const FRAME_MS = 1000 / 30;

  type FloatingName = {
    id: number;
    text: string;
    xFrac: number; // posición horizontal (fracción del ancho)
    y0: number; // px inicial (abajo de la zona azul)
    y1: number; // px final (arriba)
    born: number; // ms de nacimiento
    dur: number; // ms de vida
    depth: number; // 0 lejos … 1 cerca (tamaño/opacidad)
    // estado calculado por frame:
    y: number;
    scale: number;
    opacity: number;
    lit: boolean;
  };

  let names: string[] = [];
  let nameIdx = 0;
  let floating: FloatingName[] = [];
  let nextId = 1;
  let lastSpawn = 0;
  let raf = 0;
  let running = false;
  let alive = true;
  let last = 0;
  let host: HTMLDivElement | null = null;
  let lamp = { x: 0, y: 0 };
  let seaTop = 90;
  let seaBottom = 400;
  let maxConcurrent = 5;
  let spawnEvery = 4200;
  let lineY = 240;
  let lineLit = false;

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Proyección Web Mercator a pantalla para el mapa FIJO del home. */
  function project(lat: number, lng: number, w: number, h: number): { x: number; y: number } {
    const scale = 256 * Math.pow(2, zoom);
    const yOf = (la: number): number => {
      const s = Math.sin((la * Math.PI) / 180);
      return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
    };
    return {
      x: ((lng - center[1]) / 360) * scale + w / 2,
      y: (yOf(lat) - yOf(center[0])) * scale + h / 2
    };
  }

  function layout(): void {
    if (!host) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const base = project(LIGHTHOUSE[0], LIGHTHOUSE[1], w, h);
    lamp = { x: base.x, y: base.y - LAMP_OFFSET_Y };
    // Zona azul: del borde superior seguro hasta un poco por encima del faro
    // (la costa). Es el lienzo donde flotan los nombres.
    seaTop = Math.max(64, h * 0.075);
    // El campo baja casi hasta la costa (founder: "nacen desde más abajo").
    seaBottom = Math.min(base.y - 70, h * 0.56);
    if (seaBottom - seaTop < 140) seaBottom = seaTop + 140;
    // La línea vive ARRIBA del campo (founder): preside el mar de nombres.
    lineY = seaTop;
    // Campo de profundidad: 15–20 nombres conviviendo (founder). El campo se
    // llena poco a poco (un nacimiento cada ~1.5 s) y luego se auto-sostiene:
    // cada nombre que se despide al frente deja lugar al que viene de atrás.
    // Techo aspiracional 15/20 — el anti-solapamiento cede turnos cuando no
    // hay lugar LEGIBLE, así que la densidad real se autorregula a lo que el
    // ancho de pantalla permite leer (~8-11 en móvil, más en desktop).
    maxConcurrent = w < 640 ? 15 : 20;
    spawnEvery = reduce ? 0 : (w < 640 ? 1300 : 1000);
  }

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
    // Mismo origen primero; la API pública tiene CORS abierto para GET
    // (federación) → el memorial siempre usa el dato real.
    const data =
      (await tryFetch(`/api/persons?${qs}`)) ??
      (await tryFetch(`https://faro-ve.com/api/persons?${qs}`));
    const clean = (data?.persons ?? [])
      .map((p) => cleanDisplayName(p.full_name))
      .filter((n): n is string => n != null);
    if (clean.length) {
      names = shuffled(clean);
      nameIdx = 0;
    }
  }

  function nextName(): string | null {
    if (!names.length) return null;
    const n = names[nameIdx % names.length];
    nameIdx++;
    if (nameIdx >= names.length) void loadBatch(); // lote nuevo en segundo plano
    return n;
  }

  /** Ancho estimado del texto en px (incluye letter-spacing 0.07em). */
  function estWidth(text: string, scale: number): number {
    const fontPx = (host?.clientWidth ?? 390) < 640 ? 13 : 15;
    return text.length * fontPx * 0.74 * scale;
  }

  /** ¿El candidato (x,y) pisaría un nombre vivo? (founder: que se puedan LEER). */
  function collides(text: string, x: number, y: number): boolean {
    // El candidato CRECERÁ en su viaje → se reserva ya con su talla media alta.
    const w = estWidth(text, 1.1);
    const W = host?.clientWidth ?? 390;
    for (const f of floating) {
      const dy = Math.abs(f.y - y);
      if (dy > 40) continue; // franjas verticales distintas → conviven
      const gap = Math.abs(f.xFrac * W - x) - (w + estWidth(f.text, f.scale)) / 2;
      if (gap < 20) return true;
    }
    return false;
  }

  function spawn(now: number): void {
    const text = nextName();
    if (!text) return;
    const depth = Math.random(); // variación por nombre (qué tan al frente llega)
    const W = host?.clientWidth ?? 390;
    const fieldTop = seaTop + 42; // aire bajo la línea fija
    // Busca un LUGAR LIBRE: hasta 16 intentos de (x, y) — nacimiento sesgado
    // hacia abajo (r^0.6, founder: nacen cerca de la costa) y sin pisar a
    // nadie. Si el campo está lleno, este turno se cede (legibilidad > densidad).
    let xFrac = 0;
    let y0 = 0;
    let found = false;
    for (let i = 0; i < 16; i++) {
      xFrac = 0.08 + Math.random() * 0.84;
      y0 = fieldTop + 26 + Math.pow(Math.random(), 0.6) * (seaBottom - fieldTop - 50);
      if (!collides(text, xFrac * W, y0)) {
        found = true;
        break;
      }
    }
    if (!found) return;
    // Velocidad de ascenso CASI uniforme (2.6–3.8 px/s): así los nombres
    // mantienen sus distancias y no se alcanzan unos a otros en el viaje
    // (founder: que se puedan leer).
    const dur = 22_000 + Math.random() * 18_000;
    const rise = (2.6 + Math.random() * 1.2) * (dur / 1000);
    const y1 = Math.max(fieldTop, y0 - rise);
    floating = [
      ...floating,
      {
        id: nextId++,
        text,
        xFrac,
        y0,
        y1,
        born: now,
        dur,
        depth,
        y: y0,
        scale: 0.55,
        opacity: 0,
        lit: false
      }
    ];
  }

  /** Fase del haz en grados, por RELOJ DE PARED (misma fórmula que el CSS). */
  function beamAngle(): number {
    return (((Date.now() / 1000) % BEAM_PERIOD_S) / BEAM_PERIOD_S) * 360;
  }

  /** Ángulo pantalla→conic (0° = arriba, horario) desde la lámpara. */
  function angleFromLamp(x: number, y: number): number {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    return (Math.atan2(dx, -dy) * 180) / Math.PI + (dx < 0 && dy === 0 ? 360 : 0);
  }

  function inBeam(phi: number, theta: number): boolean {
    const d = (((phi - theta) % 360) + 360) % 360;
    return SECTORS.some(([a, b]) => d >= a - 4 && d <= b + 4);
  }

  function step(now: number): void {
    if (!floating.length && !names.length) return;
    const w = host?.clientWidth ?? 0;
    const theta = beamAngle();
    const out: FloatingName[] = [];
    for (const f of floating) {
      const t = (now - f.born) / f.dur;
      if (t >= 1) continue; // se despidió al frente — deja lugar al que viene
      // Sube con suavidad (smoothstep: se demora al nacer abajo y al
      // despedirse arriba — el campo queda repartido, no apiñado al tope)
      // mientras SE ACERCA: la profundidad es el propio viaje — nace atrás
      // (chico, tenue) y crece hacia el frente hasta despedirse.
      const ease = t * t * (3 - 2 * t);
      f.y = f.y0 + (f.y1 - f.y0) * ease;
      f.scale = 0.55 + t * (0.45 + f.depth * 0.25);
      // Envolvente de presencia: nace tenue atrás, gana cuerpo, se despide.
      const inF = Math.min(1, t / 0.25);
      const outF = Math.min(1, (1 - t) / 0.18);
      f.opacity = (0.24 + t * 0.34 + f.depth * 0.1) * inF * outF;
      f.lit = !reduce && inBeam(angleFromLamp(f.xFrac * w, f.y), theta);
      out.push(f);
    }
    floating = out;
    if (
      spawnEvery > 0 &&
      now - lastSpawn >= spawnEvery &&
      floating.length < maxConcurrent
    ) {
      lastSpawn = now;
      spawn(now);
    }
    lineLit = !reduce && inBeam(angleFromLamp((host?.clientWidth ?? 0) / 2, lineY), theta);
  }

  function frame(t: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (t - last < FRAME_MS) return; // cap 30 fps (#23)
    last = t;
    if (document.documentElement.classList.contains('low-power')) {
      if (floating.length) floating = [];
      return;
    }
    step(performance.now());
  }

  function onVisibility(): void {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (alive && !running && !reduce) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  // Reduced-motion: un campo QUIETO de 6 nombres con profundidades distintas
  // (el navegador ya congeló el haz; sin resaltado ni ascenso).
  function placeStatic(): void {
    const now = performance.now();
    const X = [0.2, 0.74, 0.32, 0.66, 0.14, 0.82];
    const Y = [0.16, 0.24, 0.44, 0.66, 0.78, 0.58];
    const S = [0.8, 1.0, 0.65, 0.9, 0.7, 0.6];
    floating = names.slice(0, 6).map((text, i) => ({
      id: nextId++,
      text,
      xFrac: X[i],
      y0: 0,
      y1: 0,
      born: now,
      dur: 1,
      depth: 0.6,
      y: seaTop + (seaBottom - seaTop) * Y[i],
      scale: S[i],
      opacity: 0.28 + S[i] * 0.24,
      lit: false
    }));
  }

  onMount(() => {
    layout();
    window.addEventListener('resize', layout, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    void loadBatch().then(() => {
      if (!alive) return;
      if (reduce) {
        placeStatic();
        return;
      }
      lastSpawn = -1e9; // primer nombre enseguida
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    });
  });

  onDestroy(() => {
    alive = false;
    running = false;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', layout);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  });
</script>

<!-- Texto real para lectores de pantalla (estático, sin ciclo que interrumpa). -->
<p class="sr-only">
  Lugar de memoria: Venezuela sigue buscando a miles de personas tras el
  terremoto del 24 de junio de 2026. En memoria de quienes ya no están.
</p>

<div class="sea" bind:this={host} aria-hidden="true">
  {#each floating as f (f.id)}
    <span
      class="sea-name"
      class:sea-lit={f.lit}
      style="left:{(f.xFrac * 100).toFixed(2)}%; top:{f.y.toFixed(1)}px; opacity:{f.opacity.toFixed(3)}; transform:translate(-50%,-50%) scale({f.scale.toFixed(3)});"
      >{f.text}</span
    >
  {/each}

  <p class="sea-line" class:sea-lit={lineLit} style="top:{lineY.toFixed(1)}px">
    Venezuela los sigue buscando
  </p>
</div>

<style>
  .sea {
    position: absolute;
    inset: 0;
    pointer-events: none;
    user-select: none;
    overflow: hidden;
  }
  .sea-name {
    position: absolute;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 300;
    letter-spacing: 0.07em;
    color: #f2ecdb;
    text-shadow:
      0 1px 8px rgba(0, 0, 0, 0.6),
      0 0 16px rgba(255, 227, 156, 0.22);
    transition:
      color 0.7s ease,
      text-shadow 0.7s ease;
    will-change: transform, opacity;
  }
  /* El beso de la luz del faro al pasar: se enciende suave, sin parpadeo. */
  .sea-name.sea-lit {
    color: #ffedbd;
    text-shadow:
      0 1px 8px rgba(0, 0, 0, 0.55),
      0 0 14px rgba(255, 227, 156, 0.75),
      0 0 34px rgba(255, 227, 156, 0.4);
  }
  .sea-line {
    position: absolute;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: rgba(247, 241, 223, 0.62);
    text-shadow:
      0 1px 10px rgba(0, 0, 0, 0.75),
      0 0 20px rgba(255, 227, 156, 0.25);
    transition:
      color 1s ease,
      text-shadow 1s ease;
  }
  .sea-line.sea-lit {
    color: rgba(255, 237, 189, 0.92);
    text-shadow:
      0 1px 10px rgba(0, 0, 0, 0.7),
      0 0 18px rgba(255, 227, 156, 0.7),
      0 0 40px rgba(255, 227, 156, 0.35);
  }
  @media (min-width: 640px) {
    .sea-name {
      font-size: 15px;
    }
    .sea-line {
      font-size: 13.5px;
    }
  }
  :global(html.low-power) .sea-name {
    display: none;
  }
</style>
