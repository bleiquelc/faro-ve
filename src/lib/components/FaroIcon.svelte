<script lang="ts">
  /**
   * Iconografía propia de Faro VE — líneas limpias con el "punto de luz" cálido
   * del faro (#FFE39C) como firma de marca. Heredan el color del texto (stroke
   * currentColor) → blancas sobre los botones glassy.
   */
  export let name:
    | "map"
    | "search"
    | "report"
    | "safe"
    | "aid"
    | "home"
    | "refresh"
    | "share"
    | "message"
    | "copy"
    | "phone"
    | "navigate"
    | "candle"
    | "sighting"
    | "medical"
    | "shelter"
    | "info";
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
  {#if name === "map"}
    <!-- Mapa plegado + un punto de luz (una persona en el mapa) -->
    <path
      d="M9 4 L3.6 6.2 V19.8 L9 17.6 L15 19.8 L20.4 17.6 V4 L15 6.2 L9 4 Z"
    />
    <path d="M9 4 V17.6 M15 6.2 V19.8" />
    <circle cx="12.8" cy="11" r="1.5" fill="#FFE39C" stroke="none" />
  {:else if name === "search"}
    <!-- Lupa con luz en el lente -->
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M20 20 L15.2 15.2" />
    <circle
      cx="10.5"
      cy="10.5"
      r="2"
      fill="#FFE39C"
      stroke="none"
      opacity="0.9"
    />
  {:else if name === "report"}
    <!-- Persona + señal de luz (alguien a quien se busca) -->
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.6 20 a6.4 6.4 0 0 1 12.8 0" />
    <circle cx="18.6" cy="5.8" r="1.4" fill="#FFE39C" stroke="none" />
  {:else if name === "safe"}
    <!-- Corazón con tilde de luz (a salvo) -->
    <path
      d="M12 20.4 C7 17 4.6 13.6 4.6 10.3 A3.7 3.7 0 0 1 12 8.1 A3.7 3.7 0 0 1 19.4 10.3 C19.4 13.6 17 17 12 20.4 Z"
    />
    <path d="M9.4 11.4 l1.9 1.9 l3.3 -3.5" stroke="#FFE39C" />
  {:else if name === "aid"}
    <!-- Pin con cruz de luz (punto de ayuda) -->
    <path
      d="M12 21 C16 16.5 18.4 13.3 18.4 10 A6.4 6.4 0 1 0 5.6 10 C5.6 13.3 8 16.5 12 21 Z"
    />
    <path d="M12 6.7 V12.4 M9.2 9.55 H14.8" stroke="#FFE39C" />
  {:else if name === "home"}
    <!-- Casa con ventana encendida (inicio) -->
    <path d="M3.6 11.4 L12 4 L20.4 11.4" />
    <path d="M5.6 9.8 V20 H18.4 V9.8" />
    <circle cx="12" cy="14.2" r="1.7" fill="#FFE39C" stroke="none" />
  {:else if name === "refresh"}
    <!-- Actualizar (dos arcos con flechas) -->
    <path d="M4 12 A8 8 0 0 1 17.8 6.5" />
    <path d="M18.4 3 V6.8 H14.6" />
    <path d="M20 12 A8 8 0 0 1 6.2 17.5" />
    <path d="M5.6 21 V17.2 H9.4" />
  {:else if name === "share"}
    <!-- Compartir (nodos conectados, con luz) -->
    <circle cx="6.5" cy="12" r="2.3" />
    <circle cx="17" cy="6.2" r="2.3" />
    <circle cx="17" cy="17.8" r="2.3" />
    <path d="M8.6 11 L14.9 7.2 M8.6 13 L14.9 16.8" />
    <circle cx="17" cy="6.2" r="1" fill="#FFE39C" stroke="none" />
  {:else if name === "message"}
    <!-- Mensaje / WhatsApp (burbuja con luz) -->
    <path
      d="M4.5 5 H19.5 A1.5 1.5 0 0 1 21 6.5 V14.5 A1.5 1.5 0 0 1 19.5 16 H10 L5.5 19.5 V6.5 A1.5 1.5 0 0 1 4.5 5 Z"
    />
    <circle cx="9" cy="10.5" r="0.95" fill="#FFE39C" stroke="none" />
    <circle cx="12" cy="10.5" r="0.95" fill="#FFE39C" stroke="none" />
    <circle cx="15" cy="10.5" r="0.95" fill="#FFE39C" stroke="none" />
  {:else if name === "copy"}
    <!-- Copiar -->
    <rect x="8.6" y="8.6" width="11" height="11" rx="2.2" />
    <path
      d="M15.4 8.6 V5 A1.6 1.6 0 0 0 13.8 3.4 H5 A1.6 1.6 0 0 0 3.4 5 V13.8 A1.6 1.6 0 0 0 5 15.4 H8.6"
    />
  {:else if name === "phone"}
    <!-- Llamar -->
    <path
      d="M6.8 3.6 H9.2 L10.7 7.4 L8.6 8.8 A10.4 10.4 0 0 0 13.4 13.6 L14.8 11.5 L18.6 13 V15.4 A1.8 1.8 0 0 1 16.6 17.1 A14 14 0 0 1 5 5.5 A1.8 1.8 0 0 1 6.8 3.6 Z"
    />
  {:else if name === "navigate"}
    <!-- Navegar (flecha de rumbo, con luz) -->
    <path d="M3.4 11 L20.6 4 L13.6 20.6 L11.3 12.8 Z" />
    <circle cx="12.4" cy="11.6" r="1.1" fill="#FFE39C" stroke="none" />
  {:else if name === "info"}
    <!-- Tengo información (bombilla / se enciende una luz) -->
    <path
      d="M12 3 A6 6 0 0 0 8 13.4 C8.7 14 9 14.7 9 15.5 H15 C15 14.7 15.3 14 16 13.4 A6 6 0 0 0 12 3 Z"
    />
    <path d="M9.6 18.4 H14.4 M10.6 21 H13.4" />
    <circle
      cx="12"
      cy="9.2"
      r="2.1"
      fill="#FFE39C"
      stroke="none"
      opacity="0.85"
    />
  {:else if name === "candle"}
    <!-- Cuerpo no identificado: una vela cuya llama es el punto de luz cálido del
         faro — encender una luz para que una familia encuentre a quien busca. -->
    <path d="M9.7 10.7 h4.6 v8.9 h-4.6 z" />
    <path d="M7.8 19.9 h8.4" />
    <path d="M12 10.7 V8.9" />
    <path
      d="M12 2.9 C13.4 4.6 14.2 5.9 14.2 7.1 A2.2 2.2 0 0 1 9.8 7.1 C9.8 5.9 10.6 4.6 12 2.9 Z"
      fill="#FFE39C"
      stroke="none"
    />
  {:else if name === "sighting"}
    <!-- Avistamiento: un ojo con la pupila como punto de luz cálido (lo vi). -->
    <path
      d="M2.5 12 C5 7.5 8.4 5.5 12 5.5 C15.6 5.5 19 7.5 21.5 12 C19 16.5 15.6 18.5 12 18.5 C8.4 18.5 5 16.5 2.5 12 Z"
    />
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="12" r="1.5" fill="#FFE39C" stroke="none" />
  {:else if name === "medical"}
    <!-- Condición médica urgente: latido (ECG) con un destello de luz en el pico. -->
    <path d="M2.5 13 H7.5 L9.6 7 L12.6 17 L14.6 13 H21.5" />
    <circle cx="9.6" cy="7" r="1.3" fill="#FFE39C" stroke="none" />
  {:else if name === "shelter"}
    <!-- Refugio: una carpa con su entrada y una luz cálida adentro (cobijo). -->
    <path d="M12 4.5 L20.5 19 H3.5 Z" />
    <path d="M12 12.4 L9.2 19 H14.8 Z" />
    <circle cx="12" cy="9.2" r="1.3" fill="#FFE39C" stroke="none" />
  {/if}
</svg>
