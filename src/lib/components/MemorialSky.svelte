<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  /**
   * MemorialSky — guacamayas sobrevolando el mapa de luz del home.
   *
   * La imagen más querida del cielo de Caracas: guacamayas cruzando al
   * atardecer. Aquí vuelan lento, en silencio, gravitando hacia las ZONAS MÁS
   * AFECTADAS en general (agregado a nivel ciudad de TODOS los reportes — dato
   * ya público vía /api/persons/clusters). Decisión founder 5-ago-2026: NUNCA
   * concentrarlas por celdas finas ni por estado "fallecido" — eso dibujaría
   * un mapa de mortalidad por edificio que la ofuscación (#1) existe para evitar.
   *
   * Rendimiento (regla #23): canvas 2D con rAF CAPADO a 30fps, pausa con la
   * pestaña oculta, se apaga con prefers-reduced-motion y con html.low-power.
   * Decorativo puro: pointer-events none + aria-hidden.
   */

  /** Centro/zoom del mapa del home (fijo, no interactivo) para proyectar zonas. */
  export let center: [number, number] = [10.63, -66.9];
  export let zoom = 11;

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let running = false;
  let alive = true;
  let last = 0;

  const FRAME_MS = 1000 / 30; // cap 30fps (regla #23)

  type Pt = { x: number; y: number };
  type Attractor = Pt & { w: number };
  type Bird = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    target: Pt;
    speed: number;
    size: number;
    flap: number;
    flapRate: number;
    glideLeft: number;
    flapLeft: number;
    retargetLeft: number;
    palette: number;
  };

  let attractors: Attractor[] = [];
  let birds: Bird[] = [];

  // Paletas guacamaya DESATURADAS (decisión founder: color venezolano tenue).
  const PALETTES = [
    // roja (bandera roja + ala azul)
    { body: '#a95a50', wing: '#4d6b86', wingTip: '#3c576f', tailA: '#9c4f47', tailB: '#46627c', cheek: '#d6c9ae', beak: '#2b2b33' },
    // azul-amarilla
    { body: '#b0964f', wing: '#48688a', wingTip: '#3a5a7c', tailA: '#a08749', tailB: '#416080', cheek: '#d9d0b8', beak: '#2b2b33' }
  ] as const;

  // Respaldo si la carga de zonas falla: las zonas golpeadas conocidas del
  // viewport del home (costa de La Guaira + valle de Caracas). Solo ciudades.
  const FALLBACK_GEO: { lat: number; lng: number; w: number }[] = [
    { lat: 10.6, lng: -66.936, w: 3 }, // La Guaira
    { lat: 10.603, lng: -66.879, w: 3 }, // Macuto
    { lat: 10.618, lng: -66.851, w: 2 }, // Caraballeda
    { lat: 10.6, lng: -66.99, w: 2 }, // Catia La Mar
    { lat: 10.49, lng: -66.88, w: 2 } // Caracas
  ];

  /** Proyección Web Mercator a coords de pantalla para el mapa FIJO del home. */
  function project(lat: number, lng: number, w: number, h: number): Pt {
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

  async function loadAttractors(): Promise<void> {
    const w = canvas?.clientWidth ?? window.innerWidth;
    const h = canvas?.clientHeight ?? window.innerHeight;
    let cells: { lat: number; lng: number; n: number }[] = [];
    // Agregado grueso (zoom 9 → celdas ~4 km: nivel ciudad, jamás edificio).
    const qs = 'bbox=-67.6,10.2,-66.2,11.1&zoom=9';
    for (const base of ['/api/persons/clusters', 'https://faro-ve.com/api/persons/clusters']) {
      try {
        const r = await fetch(`${base}?${qs}`);
        if (!r.ok) continue;
        const d = (await r.json()) as { clusters?: { lat: number; lng: number; n: number }[] };
        if (d.clusters?.length) {
          cells = d.clusters;
          break;
        }
      } catch {
        /* siguiente base */
      }
    }
    const src = cells.length
      ? cells
          .sort((a, b) => b.n - a.n)
          .slice(0, 8)
          .map((c) => ({ lat: c.lat, lng: c.lng, w: Math.max(1, Math.log10(c.n + 1)) }))
      : FALLBACK_GEO;
    const projected = src
      .map((s) => ({ ...project(s.lat, s.lng, w, h), w: s.w }))
      .filter((p) => p.x > -w * 0.2 && p.x < w * 1.2 && p.y > -h * 0.2 && p.y < h * 1.2);
    attractors = projected.length >= 2 ? projected : FALLBACK_GEO.map((s) => ({ ...project(s.lat, s.lng, w, h), w: s.w }));
  }

  function pickTarget(): Pt {
    const total = attractors.reduce((s, a) => s + a.w, 0);
    let r = Math.random() * total;
    let a = attractors[0];
    for (const c of attractors) {
      r -= c.w;
      if (r <= 0) {
        a = c;
        break;
      }
    }
    const ang = Math.random() * Math.PI * 2;
    const rad = 60 + Math.random() * 130;
    return { x: a.x + Math.cos(ang) * rad, y: a.y + Math.sin(ang) * rad };
  }

  function spawnBirds(w: number, h: number): void {
    const n = w < 640 ? 4 : 6;
    birds = Array.from({ length: n }, (_, i) => {
      const t = pickTarget();
      return {
        x: Math.random() * w,
        y: Math.random() * h * 0.7,
        vx: 0,
        vy: 0,
        target: t,
        speed: 22 + Math.random() * 16, // px/s — vuelo sereno
        size: 15 + Math.random() * 9,
        flap: Math.random() * Math.PI * 2,
        flapRate: 5.5 + Math.random() * 2, // rad/s
        glideLeft: 0,
        flapLeft: 1 + Math.random() * 2,
        retargetLeft: 14 + Math.random() * 10,
        palette: i % PALETTES.length
      };
    });
  }

  function step(dt: number): void {
    const s = dt / 1000;
    for (const b of birds) {
      b.retargetLeft -= s;
      const dx = b.target.x - b.x;
      const dy = b.target.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 34 || b.retargetLeft <= 0) {
        b.target = pickTarget();
        b.retargetLeft = 14 + Math.random() * 10;
      }
      // Giro suave hacia el objetivo (nada brusco: es un memorial).
      const desx = (dx / (dist || 1)) * b.speed;
      const desy = (dy / (dist || 1)) * b.speed;
      const k = Math.min(1, s * 0.9);
      b.vx += (desx - b.vx) * k;
      b.vy += (desy - b.vy) * k;
      b.x += b.vx * s;
      b.y += b.vy * s + Math.sin(b.flap * 0.5) * 0.18; // leve ondulación

      // Aleteo con planeos: ráfagas de aleteo y descansos con alas extendidas.
      if (b.glideLeft > 0) {
        b.glideLeft -= s;
        if (b.glideLeft <= 0) b.flapLeft = 1.2 + Math.random() * 2.2;
      } else {
        b.flap += b.flapRate * s;
        b.flapLeft -= s;
        if (b.flapLeft <= 0) b.glideLeft = 0.8 + Math.random() * 1.6;
      }
    }
  }

  function drawBird(c: CanvasRenderingContext2D, b: Bird): void {
    const p = PALETTES[b.palette];
    const s = b.size;
    const dir = b.vx >= 0 ? 1 : -1;
    const wing = b.glideLeft > 0 ? 0.16 : Math.sin(b.flap) * 0.8;
    c.save();
    c.translate(b.x, b.y);
    c.scale(dir, 1);
    c.rotate(Math.atan2(b.vy, Math.abs(b.vx) || 1) * 0.35 * dir);
    // Halo cálido de vela — que la bandada también sea luz.
    c.shadowColor = 'rgba(255, 224, 150, 0.35)';
    c.shadowBlur = 10;

    // Cola larga de guacamaya (dos plumas, roja sobre azul).
    c.fillStyle = p.tailA;
    c.beginPath();
    c.moveTo(-s * 0.22, -s * 0.02);
    c.quadraticCurveTo(-s * 0.9, s * 0.02, -s * 1.5, s * 0.2);
    c.quadraticCurveTo(-s * 0.85, s * 0.14, -s * 0.2, s * 0.1);
    c.closePath();
    c.fill();
    c.fillStyle = p.tailB;
    c.beginPath();
    c.moveTo(-s * 0.2, s * 0.06);
    c.quadraticCurveTo(-s * 0.8, s * 0.14, -s * 1.32, s * 0.34);
    c.quadraticCurveTo(-s * 0.75, s * 0.22, -s * 0.16, s * 0.16);
    c.closePath();
    c.fill();

    // Ala lejana (detrás, más oscura, contra-fase).
    c.save();
    c.translate(-s * 0.02, -s * 0.06);
    c.rotate(wing * 0.7 + 0.25);
    c.fillStyle = p.wingTip;
    c.globalAlpha = 0.75;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-s * 0.45, -s * 0.5, -s * 0.95, -s * 0.42);
    c.quadraticCurveTo(-s * 0.42, -s * 0.08, 0, s * 0.05);
    c.closePath();
    c.fill();
    c.restore();

    // Cuerpo.
    c.globalAlpha = 1;
    c.fillStyle = p.body;
    c.beginPath();
    c.ellipse(0, 0, s * 0.52, s * 0.24, -0.1, 0, Math.PI * 2);
    c.fill();

    // Cabeza + mejilla + pico curvo.
    c.beginPath();
    c.arc(s * 0.46, -s * 0.13, s * 0.17, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.cheek;
    c.beginPath();
    c.arc(s * 0.52, -s * 0.09, s * 0.08, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.beak;
    c.beginPath();
    c.moveTo(s * 0.58, -s * 0.26);
    c.quadraticCurveTo(s * 0.82, -s * 0.18, s * 0.62, -s * 0.02);
    c.quadraticCurveTo(s * 0.58, -s * 0.12, s * 0.54, -s * 0.14);
    c.closePath();
    c.fill();

    // Ala cercana.
    c.save();
    c.translate(-s * 0.05, -s * 0.08);
    c.rotate(-wing);
    const grad = c.createLinearGradient(0, 0, -s * 1.1, -s * 0.4);
    grad.addColorStop(0, p.wing);
    grad.addColorStop(1, p.wingTip);
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(-s * 0.5, -s * 0.62, -s * 1.12, -s * 0.5);
    c.quadraticCurveTo(-s * 0.5, -s * 0.1, 0, s * 0.07);
    c.closePath();
    c.fill();
    c.restore();

    c.restore();
  }

  function draw(): void {
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    for (const b of birds) drawBird(ctx, b);
    ctx.restore();
  }

  function frame(t: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (t - last < FRAME_MS) return; // cap 30fps
    const dt = Math.min(t - last, 120);
    last = t;
    if (document.documentElement.classList.contains('low-power')) return;
    step(dt);
    draw();
  }

  function resize(): void {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
  }

  function onVisibility(): void {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else if (alive && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  onMount(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // sin movimiento: el memorial son las luces y los nombres

    ctx = canvas.getContext('2d');
    if (!ctx) return;
    resize();
    void loadAttractors().then(() => {
      if (!alive) return;
      if (!attractors.length) return;
      spawnBirds(canvas.clientWidth, canvas.clientHeight);
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    });
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
  });

  onDestroy(() => {
    alive = false;
    running = false;
    if (typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  });
</script>

<canvas bind:this={canvas} class="memorial-sky" aria-hidden="true"></canvas>

<style>
  .memorial-sky {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
