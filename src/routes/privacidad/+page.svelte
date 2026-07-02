<script lang="ts">
  /**
   * Política de privacidad — honesta y clara (Habeas Data VE, Art. 28).
   *
   * Refleja lo que el founder pidió (2-jul): la información del MAPA proviene de
   * fuentes PÚBLICAS (se re-publica con atribución + opt-out), PERO mantenemos
   * protegido lo que NO es público: el contacto de quien reporta a través de Faro
   * y las fotos de menores. Y damos control real: cualquiera puede pedir el retiro
   * de su registro o el de un familiar fallecido (inmediato y reversible).
   */
</script>

<svelte:head>
  <title>Privacidad · Faro VE</title>
  <meta
    name="description"
    content="Cómo trata Faro VE la información: datos de fuentes públicas re-publicados con atribución y opt-out, contacto de reportantes protegido, y borrado self-service (Habeas Data VE)."
  />
</svelte:head>

<main
  class="mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-20 pt-[calc(env(safe-area-inset-top)+1rem)]"
>
  <a href="/" class="text-sm text-faro-700 underline">← Inicio</a>
  <h1 class="mt-3 text-2xl font-bold text-gray-900">Privacidad</h1>
  <p class="mt-1 text-sm text-gray-500">
    Faro VE es un servicio humanitario sin ánimo de lucro para ayudar a encontrar personas tras el
    terremoto del 24-jun-2026. Esta es, en lenguaje claro, cómo tratamos la información.
  </p>

  <!-- Retiro: lo más accionable, arriba del todo. -->
  <div class="mt-6 rounded-2xl border border-faro-200 bg-faro-50 p-4">
    <h2 class="text-base font-semibold text-gray-900">¿Quieres salir del mapa?</h2>
    <p class="mt-1 text-sm text-gray-700">
      Puedes pedir que retiremos tu propio registro, o el de un familiar que falleció. Sale del mapa
      de inmediato.
    </p>
    <a
      href="/privacidad/eliminar"
      class="mt-3 inline-block rounded-xl bg-faro-700 px-4 py-2 text-sm font-semibold text-white"
    >
      Retirar un registro del mapa
    </a>
  </div>

  <section class="prose prose-sm mt-8 max-w-none text-gray-800">
    <h2 class="text-lg font-semibold text-gray-900">De dónde viene la información del mapa</h2>
    <p>
      La mayoría de los registros que ves en Faro VE <strong>ya son públicos</strong>: provienen de
      registros abiertos de personas desaparecidas (como Venezuela Te Busca) y de reportes que
      familiares, testigos y voluntarios crean directamente aquí. No inventamos datos ni compramos
      bases privadas. Cada registro conserva su <strong>fuente y su enlace original</strong> (ver
      <a href="/atribucion" class="text-faro-700 underline">Atribución</a>).
    </p>

    <h2 class="mt-6 text-lg font-semibold text-gray-900">Qué mostramos y qué no</h2>
    <ul>
      <li>
        <strong>Ubicación aproximada, no exacta.</strong> Aunque el lugar sea público, en el mapa
        mostramos un punto <strong>ofuscado (~200–500&nbsp;m)</strong> sobre tierra, nunca la
        coordenada exacta. Republicar la posición precisa de personas vulnerables durante una
        emergencia crea riesgos que los datos dispersos no tienen. La única excepción es cuando la
        propia persona, en un auto-reporte «estoy a salvo», elige compartir su ubicación exacta.
      </li>
      <li>
        <strong>Contacto de quien reporta: privado.</strong> Si reportas a través de Faro, tu email
        o teléfono se usan solo para verificarte o para reenviar mensajes; se guardan cifrados y
        <strong>nunca se muestran</strong> ni se entregan a nadie.
      </li>
      <li>
        <strong>Fotos de menores: nunca públicas.</strong> Si un registro es de un menor de edad,
        su foto se oculta automáticamente.
      </li>
    </ul>

    <h2 class="mt-6 text-lg font-semibold text-gray-900">Tus derechos (Habeas Data, Art. 28)</h2>
    <ul>
      <li><strong>Retiro / borrado:</strong> pídelo en <a href="/privacidad/eliminar" class="text-faro-700 underline">Retirar un registro</a>. Sale del mapa de inmediato; es reversible 30 días (por si fue un error o un pedido malicioso) y luego los datos personales se eliminan por completo.</li>
      <li><strong>Rectificación:</strong> si algo está mal, escríbenos a <a href="mailto:contacto@faro-ve.com" class="text-faro-700 underline">contacto@faro-ve.com</a>.</li>
      <li>
        <strong>Opt-out de una fuente:</strong> si tu organización publica datos y no quieres que
        los incluyamos, escríbenos a
        <a href="mailto:opt-out@faro-ve.com" class="text-faro-700 underline">opt-out@faro-ve.com</a>
        — detenemos la ingesta y purgamos lo importado en 24&nbsp;h.
      </li>
    </ul>

    <h2 class="mt-6 text-lg font-semibold text-gray-900">En tu dispositivo</h2>
    <p>
      Si reportas sin conexión, tu reporte se guarda <strong>cifrado solo en tu teléfono</strong>
      hasta que reabras Faro VE con señal; se borra al enviarse y se purga a las 48&nbsp;horas. Es
      el único lugar donde guardamos datos personales localmente. Puedes borrarlos al instante con
      «Borrar mis datos de este teléfono».
    </p>

    <h2 class="mt-6 text-lg font-semibold text-gray-900">Datos abiertos</h2>
    <p>
      Para que otras iniciativas de búsqueda (Cruz Roja, Person Finder y demás) puedan ayudar,
      publicamos la información <strong>pública</strong> del mapa como datos abiertos, con ubicación
      aproximada y sin contacto de reportantes: <a href="/datos" class="text-faro-700 underline">/datos</a>
      y el feed <a href="/api/pfif" class="text-faro-700 underline" rel="nofollow">PFIF</a>. No hace
      falta ninguna clave para consumirlos.
    </p>

    <p class="mt-6 text-xs text-gray-400">
      ¿Dudas? <a href="mailto:contacto@faro-ve.com" class="underline">contacto@faro-ve.com</a>.
      Sin ánimo de lucro · privacidad por diseño.
    </p>
  </section>
</main>
