<script lang="ts">
  /**
   * FaroAuxilio — marca de "Faro Auxilio": el faro con una CRUZ BLANCA
   * iluminada como luz del faro. Hereda el lenguaje del FaroLogo (torre azul,
   * glow cálido que respira) pero su haz es una cruz médica blanca.
   *
   *  - `compact` (default false): solo el faro de luz con la cruz — beacon
   *    circular limpio, legible a 24-32px (para el botón flotante).
   *  - completo: torre del faro + cruz iluminada arriba (para encabezados).
   *
   * Respeta prefers-reduced-motion (luz fija). Sin dependencias externas.
   */
  export let size = 64;
  export let animated = true;
  export let compact = false;
  export let light = false; // true = torre blanca (sobre fondo oscuro)

  $: stroke = light ? "#ffffff" : "#0B4F6C";
  $: band = light ? "rgba(255,255,255,0.55)" : "#52A9C9";
</script>

{#if compact}
  <!-- Beacon circular con cruz blanca — crisp a tamaño chico (botón flotante). -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    role="img"
    aria-label="Faro Auxilio"
    xmlns="http://www.w3.org/2000/svg"
    class:fa-anim={animated}
  >
    <defs>
      <radialGradient id="faGlowC" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF7D6" stop-opacity="0.95" />
        <stop offset="55%" stop-color="#FFE9A8" stop-opacity="0.45" />
        <stop offset="100%" stop-color="#FFE9A8" stop-opacity="0" />
      </radialGradient>
    </defs>
    <!-- glow cálido que respira -->
    <circle class="fa-glow" cx="24" cy="24" r="22" fill="url(#faGlowC)" />
    <!-- disco beacon -->
    <circle cx="24" cy="24" r="15" fill="#0B4F6C" />
    <circle
      cx="24"
      cy="24"
      r="15"
      fill="none"
      stroke="#FFE9A8"
      stroke-width="1.4"
      opacity="0.9"
    />
    <!-- cruz blanca iluminada -->
    <g class="fa-cross">
      <rect x="21" y="13.5" width="6" height="21" rx="2.4" fill="#ffffff" />
      <rect x="13.5" y="21" width="21" height="6" rx="2.4" fill="#ffffff" />
    </g>
  </svg>
{:else}
  <!-- Faro completo con cruz iluminada arriba (encabezados). -->
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    role="img"
    aria-label="Faro Auxilio"
    xmlns="http://www.w3.org/2000/svg"
    class:fa-anim={animated}
  >
    <defs>
      <radialGradient id="faGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFF7D6" stop-opacity="0.95" />
        <stop offset="45%" stop-color="#FFE9A8" stop-opacity="0.5" />
        <stop offset="100%" stop-color="#FFE9A8" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="faBeam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF7D6" stop-opacity="0.55" />
        <stop offset="100%" stop-color="#FFF7D6" stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- glow cálido que respira detrás de la cruz -->
    <circle class="fa-glow" cx="32" cy="15" r="15" fill="url(#faGlow)" />

    <!-- haces de luz muy tenues -->
    <g class="fa-beams" style="transform-origin:32px 15px">
      <path d="M32 15 L9 4 L11 11 Z" fill="url(#faBeam)" />
      <path d="M32 15 L55 4 L53 11 Z" fill="url(#faBeam)" />
    </g>

    <!-- cruz blanca iluminada (la luz del faro) -->
    <g class="fa-cross">
      <rect x="29" y="8.5" width="6" height="14" rx="2.2" fill="#ffffff" />
      <rect x="25" y="12.5" width="14" height="6" rx="2.2" fill="#ffffff" />
    </g>

    <!-- galería / sala de la lámpara -->
    <path
      d="M26.5 23 h11 l-1 3.5 h-9 z"
      fill={stroke}
      {stroke}
      stroke-width="0.5"
      stroke-linejoin="round"
    />
    <!-- torre cónica -->
    <path
      d="M27.2 26.5 h9.6 l2.6 21 h-14.8 z"
      fill={stroke}
      stroke-linejoin="round"
    />
    <!-- banda de acento -->
    <path d="M26.1 34 h11.8 l0.5 5 h-12.8 z" fill={band} />
    <!-- base -->
    <path
      d="M22.5 47.5 h19 l2.2 5 h-23.4 z"
      fill={stroke}
      stroke-linejoin="round"
    />
    <!-- suelo -->
    <line
      x1="16"
      y1="52.5"
      x2="48"
      y2="52.5"
      {stroke}
      stroke-width="2.4"
      stroke-linecap="round"
    />
  </svg>
{/if}

<style>
  .fa-glow {
    transform-origin: center;
    animation: fa-breathe 7s ease-in-out infinite;
  }
  .fa-cross {
    transform-origin: center;
    animation: fa-cross-pulse 4.5s ease-in-out infinite;
  }
  .fa-beams {
    animation: fa-beams-rot 20s ease-in-out infinite;
  }
  @keyframes fa-breathe {
    0%,
    100% {
      opacity: 0.7;
      transform: scale(0.96);
    }
    50% {
      opacity: 1;
      transform: scale(1.07);
    }
  }
  @keyframes fa-cross-pulse {
    0%,
    100% {
      filter: drop-shadow(0 0 1px rgba(255, 255, 255, 0.6));
    }
    50% {
      filter: drop-shadow(0 0 4px rgba(255, 247, 214, 0.95));
    }
  }
  @keyframes fa-beams-rot {
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
  svg:not(.fa-anim) .fa-glow,
  svg:not(.fa-anim) .fa-cross,
  svg:not(.fa-anim) .fa-beams {
    animation: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .fa-glow,
    .fa-cross,
    .fa-beams {
      animation: none !important;
    }
  }
</style>
