<script lang="ts">
  import "../app.css";
  import FaroAuxilioButton from "$components/FaroAuxilioButton.svelte";
</script>

<slot />

<!-- Botón flotante "Faro Auxilio" — siempre visible en toda la app. -->
<FaroAuxilioButton />
