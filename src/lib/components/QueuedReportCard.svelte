<script lang="ts">
  /**
   * Confirmación cuando un reporte se GUARDÓ sin conexión (se enviará al reabrir
   * con señal). Copy honesto (#24): sin BackgroundSync no se envía "solo" en
   * segundo plano — necesita que el usuario reabra Faro VE con señal. No muestra
   * PII. El banner global (OutboxBanner) deja enviarlo o borrarlo.
   */
</script>

<div class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
  <p class="text-4xl" aria-hidden="true">📨</p>
  <h1 class="mt-2 text-xl font-bold text-amber-900">Guardado en este teléfono</h1>
  <p class="mt-2 text-sm text-amber-900/90">
    No hay conexión ahora. Tu reporte quedó <strong>guardado en este teléfono</strong> y se
    enviará en cuanto vuelvas a abrir Faro VE con señal. Mantén la app instalada y no borres sus
    datos hasta entonces.
  </p>
  <p
    class="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-4 py-3 text-left text-sm text-amber-900 ring-1 ring-amber-200"
  >
    <span aria-hidden="true">📶</span>
    <span
      >Cuando tengas señal, abre Faro VE: verás abajo un aviso para
      <strong>enviarlo</strong> con un toque.</span
    >
  </p>
  <a
    href="/"
    data-sveltekit-reload
    class="min-h-tap mt-5 inline-flex items-center justify-center rounded-lg bg-faro-900 px-5 py-3 font-semibold text-white"
  >
    Entendido
  </a>
</div>
