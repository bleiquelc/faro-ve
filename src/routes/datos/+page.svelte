<script lang="ts">
  /**
   * Datos abiertos / API de Faro VE — el contrato público para que cualquier app
   * o servicio consuma NUESTRA INFO PÚBLICA y se construya una red de datos
   * humanitarios conectados. Solo lectura, CORS abierto, sin secretos. Licencia
   * CC BY 4.0 + cláusula humanitaria de no-reidentificación.
   */
  const SITE = 'https://faro-ve.com';

  const ENDPOINTS = [
    {
      titulo: 'Personas — PFIF 1.4 (XML)',
      url: '/api/pfif?limit=200&offset=0',
      desc: 'Estándar Person Finder (Google PF, ICRC, Cruz Roja). Ubicación en TEXTO, nunca coordenadas. Cada record con expiry_date (retención 60d).'
    },
    {
      titulo: 'Personas — JSON',
      url: '/api/persons?q=nombre&limit=100',
      desc: 'Filtros: q (nombre), status, is_minor, medical_urgent, bbox, limit. Conteo exacto con ?count=exact. Incluye reportes sin ubicación (buscables por nombre).'
    },
    {
      titulo: 'Personas — GeoJSON',
      url: '/api/persons?format=geojson&bbox=-73.4,0.6,-59.8,12.3',
      desc: 'FeatureCollection RFC 7946 para mapas (Leaflet/Mapbox/QGIS). Coordenadas OFUSCADAS ~300m; los reportes sin ubicación van como Feature con geometry null.'
    },
    {
      titulo: 'Refugios y puntos de ayuda — JSON / GeoJSON',
      url: '/api/aid-points?format=geojson',
      desc: 'Lugares de servicio con coordenadas EXACTAS (la gente debe llegar). Filtros: type, q, bbox, limit. Props: nombre, tipo, insumos, horario, capacidad, dirección, cómo entrar.'
    },
    {
      titulo: 'Zonas y conteos',
      url: '/api/persons/clusters?bbox=-73.4,0.6,-59.8,12.3&zoom=6',
      desc: 'Burbujas agregadas por zona (conteo real) y /api/persons/stats (totales por categoría). Útil para dashboards.'
    }
  ];
</script>

<svelte:head>
  <title>Datos abiertos · API · Faro VE</title>
  <meta
    name="description"
    content="API pública y feeds (PFIF, GeoJSON, JSON) de Faro VE para una red de datos humanitarios conectados. CC BY 4.0 con no-reidentificación."
  />
</svelte:head>

<main
  class="mx-auto min-h-[100dvh] w-full max-w-2xl px-5 pb-20 pt-[calc(env(safe-area-inset-top)+1rem)]"
>
  <a
    href="/"
    data-sveltekit-preload-data="hover"
    class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Inicio
  </a>

  <h1 class="text-3xl font-bold text-gray-900">Datos abiertos</h1>
  <p class="mt-2 text-base leading-relaxed text-gray-700">
    La información <strong>pública</strong> de Faro VE está abierta para que otras aplicaciones y
    servicios la usen. La idea es simple: <strong>datos conectados</strong> entre todas las apps que
    ayudan, para que nadie quede sin posibilidad de ser ubicado. Todo es <strong>solo lectura</strong>,
    con <strong>CORS abierto</strong> (cualquier sitio puede consumirlo desde el navegador) y
    <strong>sin claves</strong>.
  </p>

  <!-- Endpoints -->
  <section class="mt-8">
    <h2 class="text-xl font-bold text-gray-900">Endpoints</h2>
    <ul class="mt-4 space-y-4">
      {#each ENDPOINTS as e}
        <li class="rounded-2xl border border-gray-200 bg-white p-4">
          <h3 class="text-sm font-bold text-faro-900">{e.titulo}</h3>
          <code
            class="mt-2 block overflow-x-auto rounded-lg bg-gray-900 px-3 py-2 text-[13px] text-gray-100 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >{SITE}{e.url}</code
          >
          <p class="mt-2 text-sm leading-relaxed text-gray-600">{e.desc}</p>
        </li>
      {/each}
    </ul>
    <p class="mt-3 text-xs text-gray-500">
      Respuestas cacheadas en el edge (15–300s). Sé considerado con la frecuencia; para sincronizar
      grandes volúmenes, escríbenos y coordinamos.
    </p>
  </section>

  <!-- Privacidad de los datos -->
  <section class="mt-8">
    <h2 class="text-xl font-bold text-gray-900">Privacidad de los datos</h2>
    <ul class="mt-3 space-y-2 text-sm leading-relaxed text-gray-700">
      <li>
        <strong>Personas:</strong> la ubicación se entrega <strong>siempre aproximada (~300m)</strong>
        y en texto — <strong>nunca la coordenada exacta</strong>. No se incluye ningún dato de quien
        reportó (correo/teléfono). La foto de un <strong>menor</strong> nunca se expone.
      </li>
      <li>
        <strong>Refugios y puntos de ayuda:</strong> coordenadas <strong>exactas</strong>, porque son
        lugares de servicio a los que la gente necesita llegar.
      </li>
      <li>
        Cada record lleva <code class="rounded bg-gray-100 px-1">source</code> y
        <code class="rounded bg-gray-100 px-1">source_url</code> (atribución a la fuente original) y un
        <code class="rounded bg-gray-100 px-1">expiry_date</code> (retención 60 días).
      </li>
    </ul>
  </section>

  <!-- Licencia -->
  <section class="mt-8 rounded-2xl border border-faro-200 bg-faro-50 p-5">
    <h2 class="text-xl font-bold text-faro-900">Licencia y condiciones de uso</h2>
    <p class="mt-2 text-sm leading-relaxed text-faro-900/90">
      Los datos públicos de Faro VE se ofrecen bajo
      <a
        href="https://creativecommons.org/licenses/by/4.0/deed.es"
        target="_blank"
        rel="noopener noreferrer"
        class="font-semibold underline">Creative Commons Atribución 4.0 (CC BY 4.0)</a
      >, con una <strong>cláusula humanitaria adicional</strong>:
    </p>
    <ul class="mt-3 space-y-2 text-sm leading-relaxed text-faro-900/90">
      <li>
        ✅ <strong>Podés</strong> usar, copiar, redistribuir y combinar estos datos —incluso en apps,
        mapas, dashboards o investigaciones— <strong>si nos atribuís</strong>: «Datos de
        <strong>Faro VE</strong> — faro-ve.com» con enlace, y conservando el <code
          class="rounded bg-white/60 px-1">source</code
        > de cada record.
      </li>
      <li>
        🚫 <strong>Prohibido</strong> intentar <strong>des-ofuscar</strong> las coordenadas,
        <strong>reidentificar</strong> o re-combinar los datos para ubicar a una persona en su punto
        exacto, o cualquier uso que ponga en riesgo a las personas reportadas.
      </li>
      <li>
        🔄 <strong>Respetá el opt-out:</strong> si una fila sale de nuestro feed (o pasa su
        <code class="rounded bg-white/60 px-1">expiry_date</code>), debés purgarla también de tu copia.
      </li>
    </ul>
  </section>

  <!-- Opt-out + contacto -->
  <section class="mt-8">
    <h2 class="text-xl font-bold text-gray-900">Opt-out y contacto</h2>
    <p class="mt-2 text-sm leading-relaxed text-gray-700">
      ¿Tu organización no quiere ser incluida, o querés que dejemos de ingerir tu fuente?
      <a href="mailto:opt-out@faro-ve.com" class="font-medium text-faro-800 underline"
        >opt-out@faro-ve.com</a
      > — SLA 24h para detener la ingesta y purgar.
    </p>
    <p class="mt-2 text-sm leading-relaxed text-gray-700">
      ¿Querés conectar tu app, intercambiar datos o federar (Person Finder, ICRC/Cruz Roja, HDX)?
      Escribinos a
      <a href="mailto:federacion@faro-ve.com" class="font-medium text-faro-800 underline"
        >federacion@faro-ve.com</a
      > y coordinamos.
    </p>
  </section>

  <p class="mt-10 border-t border-gray-100 pt-5 text-center text-xs leading-relaxed text-gray-500">
    Faro VE · Sin fines de lucro · Privacidad por diseño · Estándar de interoperabilidad
    <a href="http://zesty.ca/pfif/1.4/" target="_blank" rel="noopener noreferrer" class="underline"
      >PFIF v1.4</a
    >
  </p>
</main>
