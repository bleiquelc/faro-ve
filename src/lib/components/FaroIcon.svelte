<script lang="ts">
  /**
   * Iconografía propia de Faro VE — líneas limpias con el "punto de luz" cálido
   * del faro (#FFE39C) como firma de marca. Heredan el color del texto (stroke
   * currentColor) → blancas sobre los botones glassy.
   */
  export let name: 'map' | 'search' | 'report' | 'safe' | 'aid';
  export let size = 22;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.7"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === 'map'}
    <!-- Mapa plegado + un punto de luz (una persona en el mapa) -->
    <path d="M9 4 L3.6 6.2 V19.8 L9 17.6 L15 19.8 L20.4 17.6 V4 L15 6.2 L9 4 Z" />
    <path d="M9 4 V17.6 M15 6.2 V19.8" />
    <circle cx="12.8" cy="11" r="1.5" fill="#FFE39C" stroke="none" />
  {:else if name === 'search'}
    <!-- Lupa con luz en el lente -->
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M20 20 L15.2 15.2" />
    <circle cx="10.5" cy="10.5" r="2" fill="#FFE39C" stroke="none" opacity="0.9" />
  {:else if name === 'report'}
    <!-- Persona + señal de luz (alguien a quien se busca) -->
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.6 20 a6.4 6.4 0 0 1 12.8 0" />
    <circle cx="18.6" cy="5.8" r="1.4" fill="#FFE39C" stroke="none" />
  {:else if name === 'safe'}
    <!-- Corazón con tilde de luz (a salvo) -->
    <path
      d="M12 20.4 C7 17 4.6 13.6 4.6 10.3 A3.7 3.7 0 0 1 12 8.1 A3.7 3.7 0 0 1 19.4 10.3 C19.4 13.6 17 17 12 20.4 Z"
    />
    <path d="M9.4 11.4 l1.9 1.9 l3.3 -3.5" stroke="#FFE39C" />
  {:else if name === 'aid'}
    <!-- Pin con cruz de luz (punto de ayuda) -->
    <path d="M12 21 C16 16.5 18.4 13.3 18.4 10 A6.4 6.4 0 1 0 5.6 10 C5.6 13.3 8 16.5 12 21 Z" />
    <path d="M12 6.7 V12.4 M9.2 9.55 H14.8" stroke="#FFE39C" />
  {/if}
</svg>
