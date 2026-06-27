<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import FaroAuxilioButton from "$components/FaroAuxilioButton.svelte";

  // Registrar el service worker (offline). Es OPCIONAL y a prueba de fallos: si
  // algo sale mal, la app sigue funcionando online igual — nunca rompemos la
  // experiencia por el SW. En dev el módulo es un stub (no registra nada).
  onMount(async () => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      const { registerSW } = await import("virtual:pwa-register");
      registerSW({ immediate: true });
    } catch {
      // SW no disponible → seguir sin offline, sin romper nada.
    }
  });
</script>

<slot />

<!-- Botón flotante "Faro Auxilio" — siempre visible en toda la app. -->
<FaroAuxilioButton />
