<script lang="ts">
  /**
   * Iconografía propia de "Faro Auxilio" — glifos de línea limpia con el "punto
   * de luz" cálido del faro (#FFE39C) como firma de marca, igual que FaroIcon.
   * Uno por cada guía (keyed por su id) + por categoría. Heredan currentColor.
   *
   * Cada ícono va SIEMPRE junto a su título, así que no necesita ser
   * identificable en aislamiento: es un acento visual coherente con la app.
   */
  export let name: string;
  export let size = 26;
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
  {#if name === "primeros-auxilios"}
    <!-- Botiquín con cruz de luz -->
    <rect x="3.5" y="7.5" width="17" height="11.5" rx="2.2" />
    <path
      d="M9 7.5 V6 A1.6 1.6 0 0 1 10.6 4.4 H13.4 A1.6 1.6 0 0 1 15 6 V7.5"
    />
    <path d="M12 10.6 V16 M9.3 13.3 H14.7" stroke="#FFE39C" />
  {:else if name === "sismo-supervivencia"}
    <!-- Línea de sismógrafo con destello de luz -->
    <path d="M2.5 12 H6 L8 6.5 L11 17.5 L13.2 9.5 L15 14 H21.5" />
    <circle cx="11" cy="17.5" r="1.2" fill="#FFE39C" stroke="none" />
  {:else if name === "sangrado-abundante"}
    <!-- Gota de sangre con brillo -->
    <path
      d="M12 3.5 C12 3.5 6 11 6 15 A6 6 0 0 0 18 15 C18 11 12 3.5 12 3.5 Z"
    />
    <circle cx="9.6" cy="14.4" r="1.4" fill="#FFE39C" stroke="none" />
  {:else if name === "hemorragia-masiva-torniquete"}
    <!-- Extremidad con banda y torsión (la manija = luz) -->
    <rect x="2.5" y="10" width="19" height="4.6" rx="2.3" />
    <rect x="10.4" y="7.5" width="3.2" height="9.6" rx="1.1" />
    <path d="M12 7.5 V4.4" />
    <circle cx="12" cy="4.2" r="1.5" fill="#FFE39C" stroke="none" />
  {:else if name === "rcp-adulto"}
    <!-- Corazón con latido de luz -->
    <path
      d="M12 20 C7 16.5 4.6 13 4.6 9.9 A3.6 3.6 0 0 1 12 7.8 A3.6 3.6 0 0 1 19.4 9.9 C19.4 13 17 16.5 12 20 Z"
    />
    <path
      d="M7.5 12.3 H10 L11.3 9.8 L12.8 14.5 L14 12.3 H16.5"
      stroke="#FFE39C"
    />
  {:else if name === "rcp-nino-bebe"}
    <!-- Corazón con dos puntos de luz (compresión a dos pulgares) -->
    <path
      d="M12 19.5 C7.6 16.4 5.5 13.2 5.5 10.4 A3.2 3.2 0 0 1 12 8.5 A3.2 3.2 0 0 1 18.5 10.4 C18.5 13.2 16.4 16.4 12 19.5 Z"
    />
    <circle cx="10.4" cy="11.6" r="1.15" fill="#FFE39C" stroke="none" />
    <circle cx="13.6" cy="11.6" r="1.15" fill="#FFE39C" stroke="none" />
  {:else if name === "atragantamiento-adulto"}
    <!-- Cabeza con manos al cuello + objeto atascado (luz) -->
    <circle cx="12" cy="6" r="3" />
    <path
      d="M8.5 11.5 C9.5 10.4 10.6 10.2 11.5 10.7 M15.5 11.5 C14.5 10.4 13.4 10.2 12.5 10.7"
    />
    <path d="M7.5 19 a4.5 4.5 0 0 1 9 0" />
    <circle cx="12" cy="11.6" r="1" fill="#FFE39C" stroke="none" />
  {:else if name === "atragantamiento-bebe"}
    <!-- Bebé boca abajo sobre el antebrazo + golpe en la espalda (luz) -->
    <path d="M3.5 15 H20.5" />
    <circle cx="7.5" cy="11.2" r="2.1" />
    <path d="M9.5 12.2 C12.5 13.2 15 13.8 17.5 13.8" />
    <circle cx="12.6" cy="11.6" r="1" fill="#FFE39C" stroke="none" />
  {:else if name === "quemaduras"}
    <!-- Llama con núcleo de luz -->
    <path
      d="M12.6 2.5 C12.6 6.3 8.6 8.2 8.6 12.6 A4.6 4.6 0 0 0 17.6 12.8 C17.6 10.4 16.3 9 15.1 7.8 C14.9 9 14.1 9.6 13.3 9.4 C14.5 7.6 13.9 5 12.6 2.5 Z"
    />
    <path
      d="M12.4 19.4 A2.4 2.4 0 0 1 10 17 C10 15.5 11.4 14.9 11.6 13.5 C12.4 14.6 14.4 15.4 14.4 17.1 A2 2 0 0 1 12.4 19.4 Z"
      fill="#FFE39C"
      stroke="none"
    />
  {:else if name === "fracturas"}
    <!-- Hueso con grieta de luz -->
    <path
      d="M6.5 6 a1.7 1.7 0 1 0 1.7 1.7 a1.7 1.7 0 1 0 1.7 1.7 L14 13.6 a1.7 1.7 0 1 0 1.7 1.7 a1.7 1.7 0 1 0 1.7 1.7"
    />
    <path d="M10.3 13 L11.5 11.5 L13 12.6" stroke="#FFE39C" />
  {:else if name === "aplastamiento"}
    <!-- Losa caída sobre una mano que asoma (luz) -->
    <path d="M4 12.5 L20 12.5 L18 8 L6 8 Z" />
    <path d="M3 16.5 H21" />
    <path d="M9 16.5 V13.5 M12 16.5 V13.5" stroke="#FFE39C" />
  {:else if name === "shock"}
    <!-- Persona acostada con las piernas en alto (posición de shock) -->
    <path d="M3 17.5 H21" />
    <circle cx="4.9" cy="14.8" r="1.7" />
    <path d="M6.6 15.4 H12.6 L16 11.3" />
    <path d="M16 11.3 H18.9" stroke="#FFE39C" />
  {:else if name === "desmayo-inconsciencia"}
    <!-- Posición de recuperación (de costado, con la rodilla flexionada) -->
    <path d="M2.5 18 H21.5" />
    <circle cx="5" cy="13" r="2" />
    <path d="M7 13.6 C10 14.6 12.6 14.2 14.6 15.6 L16.4 12.6 L18.8 14.2" />
    <circle cx="16.4" cy="12.6" r="1.1" fill="#FFE39C" stroke="none" />
  {:else if name === "golpe-de-calor"}
    <!-- Sol (calor) con centro de luz -->
    <circle cx="12" cy="12" r="3.8" />
    <path
      d="M12 3.2 V5.4 M12 18.6 V20.8 M3.2 12 H5.4 M18.6 12 H20.8 M5.8 5.8 L7.3 7.3 M16.7 16.7 L18.2 18.2 M18.2 5.8 L16.7 7.3 M7.3 16.7 L5.8 18.2"
    />
    <circle cx="12" cy="12" r="1.6" fill="#FFE39C" stroke="none" />
  {:else if name === "convulsiones"}
    <!-- Cabeza con actividad eléctrica errática (luz) -->
    <circle cx="12" cy="12" r="7.2" />
    <path
      d="M8.8 12 L10.6 8.6 L11.4 13 L13.4 9.4 L14.8 13.4"
      stroke="#FFE39C"
    />
  {:else if name === "electrocucion"}
    <!-- Rayo eléctrico -->
    <path d="M13 3 L6 13.2 H10.8 L10 21 L18 10.4 H12.6 Z" />
    <path
      d="M13 3 L6 13.2 H10.8 L10 21 L18 10.4 H12.6 Z"
      fill="#FFE39C"
      stroke="none"
      opacity="0.18"
    />
  {:else if name === "apoyo-psicologico"}
    <!-- Dos personas juntas + corazón de luz (acompañar) -->
    <circle cx="8" cy="9.5" r="2.2" />
    <circle cx="16" cy="9.5" r="2.2" />
    <path d="M4.5 19 a3.5 3.5 0 0 1 7 0 M12.5 19 a3.5 3.5 0 0 1 7 0" />
    <path
      d="M12 5.6 C12.6 4.9 13.7 4.9 14 5.7 C14.3 4.9 15.4 4.9 16 5.6 C16.6 6.3 16 7.2 14 8.4 C12 7.2 11.4 6.3 12 5.6 Z"
      fill="#FFE39C"
      stroke="none"
    />
  {:else if name === "durante-sismo-dentro"}
    <!-- Cúbrete bajo una mesa firme -->
    <path d="M3.5 9.5 H20.5" />
    <path d="M5.5 9.5 V18 M18.5 9.5 V18" />
    <circle cx="12" cy="13.5" r="2" />
    <path d="M12 9.5 V5.5" stroke="#FFE39C" />
  {:else if name === "durante-sismo-afuera"}
    <!-- Aléjate del edificio (flecha de luz hacia un espacio abierto) -->
    <path d="M4 6.5 H10 V19 H4 Z" />
    <path d="M6 9.5 H8 M6 12.5 H8 M6 15.5 H8" />
    <path d="M13 12.5 H20 M17 9.5 L20 12.5 L17 15.5" stroke="#FFE39C" />
  {:else if name === "despues-sismo"}
    <!-- Edificio agrietado (después del sismo) -->
    <path d="M5.5 20 V5 A1 1 0 0 1 6.5 4 H17.5 A1 1 0 0 1 18.5 5 V20" />
    <path d="M3.5 20 H20.5" />
    <path d="M12 4 L10 9 L13 12.5 L11 16.5 L12.5 20" stroke="#FFE39C" />
  {:else if name === "atrapado-escombros"}
    <!-- Silbato para pedir ayuda -->
    <path d="M3 9.5 H12.5 A4.2 4.2 0 1 1 8.3 14 V12 H3 Z" />
    <path d="M3 9.5 V12" />
    <circle cx="8.3" cy="13.7" r="1.1" fill="#FFE39C" stroke="none" />
  {:else if name === "agua-segura-hervir"}
    <!-- Olla con vapor (hervir) -->
    <path
      d="M4.5 11 H19.5 V15.5 A3 3 0 0 1 16.5 18.5 H7.5 A3 3 0 0 1 4.5 15.5 Z"
    />
    <path d="M2.8 11 H21.2" />
    <path
      d="M9 8.5 C9 7 10 7 10 5.5 M14 8.5 C14 7 15 7 15 5.5"
      stroke="#FFE39C"
    />
  {:else if name === "agua-segura-cloro"}
    <!-- Gota de agua con cruz (tratada) -->
    <path
      d="M12 3.5 C12 3.5 6.5 10.5 6.5 14.5 A5.5 5.5 0 0 0 17.5 14.5 C17.5 10.5 12 3.5 12 3.5 Z"
    />
    <path d="M12 12 V17 M9.5 14.5 H14.5" stroke="#FFE39C" />
  {:else if name === "comida-segura"}
    <!-- Lata de comida -->
    <rect x="6.5" y="6.5" width="11" height="13" rx="1.4" />
    <path d="M6.5 9.5 H17.5" />
    <path d="M9 4.5 L11 6.5 M13 4.5 L15 6.5" />
    <circle cx="12" cy="14" r="1.3" fill="#FFE39C" stroke="none" />
  {:else if name === "kit-emergencia"}
    <!-- Mochila de emergencia con cruz de luz -->
    <path d="M6.5 9 A5.5 5.5 0 0 1 17.5 9 V19.5 H6.5 Z" />
    <path
      d="M9.5 7.2 V5.6 A1.4 1.4 0 0 1 10.9 4.2 H13.1 A1.4 1.4 0 0 1 14.5 5.6 V7.2"
    />
    <path d="M6.5 13 H17.5" />
    <path d="M12 14.5 V18 M10.3 16.2 H13.7" stroke="#FFE39C" />
  {:else if name === "nacional-emergencia"}
    <!-- Emergencias 911: baliza de luz -->
    <path d="M7.5 19.5 H16.5" />
    <path d="M9 19.5 V13.5 a3 3 0 0 1 6 0 V19.5" />
    <circle cx="12" cy="9.8" r="2" fill="#FFE39C" stroke="none" />
    <path
      d="M12 5.4 V7 M7.4 7.2 L8.7 8.2 M16.6 7.2 L15.3 8.2"
      stroke="#FFE39C"
    />
  {:else if name === "bomberos"}
    <!-- Bomberos: casco -->
    <path d="M4 17 C4 11 7.5 8 12 8 C16.5 8 20 11 20 17 Z" />
    <path d="M2.8 17 H21.2" />
    <path d="M12 8 V12" stroke="#FFE39C" />
    <circle cx="12" cy="13.6" r="1.1" fill="#FFE39C" stroke="none" />
  {:else if name === "proteccion-civil"}
    <!-- Protección Civil: escudo -->
    <path d="M12 3 L19 6 V11 C19 16 15.8 19.4 12 21 C8.2 19.4 5 16 5 11 V6 Z" />
    <path d="M9.4 12 L11.2 13.8 L15 10" stroke="#FFE39C" />
  {:else if name === "cruz-roja"}
    <!-- Cruz Roja: cruz -->
    <path d="M9.7 4 H14.3 V9.7 H20 V14.3 H14.3 V20 H9.7 V14.3 H4 V9.7 H9.7 Z" />
    <circle cx="12" cy="12" r="1.4" fill="#FFE39C" stroke="none" />
  {:else if name === "sismologia"}
    <!-- Sismología: lectura de sismógrafo -->
    <rect x="3.5" y="6.5" width="17" height="11" rx="1.5" />
    <path
      d="M5.5 12 H8 L9.5 8.5 L11.5 15 L13 11 L14.5 13 H18.5"
      stroke="#FFE39C"
    />
  {:else if name === "hospital"}
    <!-- Hospital: edificio con cruz -->
    <path d="M5 20 V7 a1 1 0 0 1 1 -1 H18 a1 1 0 0 1 1 1 V20" />
    <path d="M3.5 20 H20.5" />
    <path d="M12 9 V13 M10 11 H14" stroke="#FFE39C" />
    <path d="M10.5 20 V16.5 H13.5 V20" />
  {:else}
    <!-- Fallback: punto de luz -->
    <circle cx="12" cy="12" r="3" fill="#FFE39C" stroke="none" />
  {/if}
</svg>
