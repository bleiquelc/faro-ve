<script lang="ts">
  /**
   * FaroLogo — logo del faro con luz animada. Minimalista, estilo Apple.
   *
   * La lámpara emite un glow cálido que respira suave + dos haces tenues que
   * giran imperceptiblemente. Respeta prefers-reduced-motion (luz fija).
   *
   * Variante por defecto: azul-faro sobre transparente (para fondos claros).
   * Pasa `light` para la versión blanca (sobre fondos oscuros).
   */
  export let size = 72;
  export let animated = true;
  export let light = false; // true = trazo blanco (sobre fondo oscuro)

  $: stroke = light ? '#ffffff' : '#0B4F6C';
  $: band = light ? 'rgba(255,255,255,0.55)' : '#52A9C9';
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 64 64"
  fill="none"
  role="img"
  aria-label="Faro VE"
  xmlns="http://www.w3.org/2000/svg"
  class:faro-anim={animated}
>
  <defs>
    <radialGradient id="faroLampGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFF7D6" stop-opacity="0.95" />
      <stop offset="45%" stop-color="#FFE9A8" stop-opacity="0.5" />
      <stop offset="100%" stop-color="#FFE9A8" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="faroBeam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFF7D6" stop-opacity="0.55" />
      <stop offset="100%" stop-color="#FFF7D6" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- glow cálido que respira detrás de la lámpara -->
  <circle class="faro-glow-anim" cx="32" cy="16" r="15" fill="url(#faroLampGlow)" />

  <!-- haces de luz, muy tenues -->
  <g class="faro-beams-anim" style="transform-origin:32px 16px">
    <path d="M32 16 L9 5 L11 12 Z" fill="url(#faroBeam)" />
    <path d="M32 16 L55 5 L53 12 Z" fill="url(#faroBeam)" />
  </g>

  <!-- lámpara (núcleo de luz) -->
  <circle cx="32" cy="16" r="4" fill="#FFE9A8" stroke="#FFF7D6" stroke-width="1" />

  <!-- galería / sala de la lámpara -->
  <path
    d="M26.5 20.5 h11 l-1 3.5 h-9 z"
    fill={stroke}
    stroke={stroke}
    stroke-width="0.5"
    stroke-linejoin="round"
  />

  <!-- torre cónica -->
  <path
    d="M27.2 24 h9.6 l2.6 23 h-14.8 z"
    fill={stroke}
    stroke-linejoin="round"
  />

  <!-- banda de acento -->
  <path d="M25.9 33 h12.2 l0.5 5 h-13.2 z" fill={band} />

  <!-- base -->
  <path d="M22.5 47 h19 l2.2 5.5 h-23.4 z" fill={stroke} stroke-linejoin="round" />

  <!-- suelo -->
  <line x1="16" y1="52.5" x2="48" y2="52.5" stroke={stroke} stroke-width="2.4" stroke-linecap="round" />
</svg>

<style>
  .faro-glow-anim {
    transform-origin: 32px 16px;
    /* Respiración de la lámpara: lenta y suave (bienvenida del faro). */
    animation: faro-lamp-breathe 4.8s ease-in-out infinite;
  }
  .faro-beams-anim {
    /* Haces girando muy lento → la luz se mueve suave, sin tirones. */
    animation: faro-beams-rot 13s ease-in-out infinite;
  }
  @keyframes faro-lamp-breathe {
    0%,
    100% {
      opacity: 0.7;
      transform: scale(0.96);
    }
    50% {
      opacity: 1;
      transform: scale(1.06);
    }
  }
  @keyframes faro-beams-rot {
    0%,
    100% {
      opacity: 0.5;
      transform: rotate(-4deg);
    }
    50% {
      opacity: 0.85;
      transform: rotate(4deg);
    }
  }
  /* sin animación: faro estático, luz fija y legible */
  svg:not(.faro-anim) .faro-glow-anim,
  svg:not(.faro-anim) .faro-beams-anim {
    animation: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .faro-glow-anim,
    .faro-beams-anim {
      animation: none !important;
    }
  }
</style>
