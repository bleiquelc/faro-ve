<script lang="ts">
  /**
   * Atribución y fuentes — de dónde viene la información que muestra Faro VE.
   * Transparencia obligatoria (regla #7), opt-out canónico (regla #8) y atribución
   * por record con source + source_url (regla #9). Espeja el estilo de /datos.
   */
  import { onMount } from 'svelte';

  const SITE = 'https://faro-ve.com';

  // Fuentes REALES (consistentes con lo que guarda cada record: source/source_url).
  const SOURCES = [
    {
      nombre: 'Venezuela Te Busca',
      rol: 'Fuente externa',
      externa: true,
      url: 'https://venezuelatebusca.com',
      desc: 'Registro público de personas desaparecidas tras el terremoto. La mayor parte de los reportes que ves en Faro VE provienen de aquí; cada uno conserva su enlace a la fuente original. La ingesta es ética: respetamos robots.txt, nos identificamos (FaroVE-IngestBot) y limitamos el ritmo (1 cada 2s).'
    },
    {
      nombre: 'Faro VE — reportes de la comunidad',
      rol: 'Propio',
      externa: false,
      url: '/reportar',
      desc: 'Reportes creados directamente en faro-ve.com por familiares, testigos y voluntarios. Pasan por moderación (o se publican al instante en una emergencia) y llevan el origen «faro-ve».'
    }
  ];

  let total: number | null = null;
  onMount(async () => {
    // Mejora progresiva: el conteo en vivo da contexto, pero la página ya informa
    // sin él (offline / si la API no responde no se rompe nada).
    try {
      const r = await fetch('/api/persons?count=exact');
      if (r.ok) {
        const j = (await r.json()) as { total?: number };
        if (typeof j.total === 'number') total = j.total;
      }
    } catch {
      /* sin conexión: el contenido estático ya explica las fuentes */
    }
  });
</script>

<svelte:head>
  <title>Atribución y fuentes · Faro VE</title>
  <meta
    name="description"
    content="De dónde vienen los datos que muestra Faro VE, cómo atribuimos cada reporte y cómo pedir opt-out (opt-out@faro-ve.com, SLA 24h)."
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

  <h1 class="text-3xl font-bold text-gray-900">Atribución y fuentes</h1>
  <p class="mt-2 text-base leading-relaxed text-gray-700">
    Faro VE reúne reportes <strong>propios</strong> de su comunidad y de
    <strong>fuentes externas públicas</strong>, para que nadie quede sin posibilidad de ser ubicado.
    Somos transparentes sobre <strong>de dónde viene cada dato</strong>: cada registro conserva su
    fuente y un enlace al origen.
    {#if total !== null}
      Hoy hay <strong>{total.toLocaleString('es-VE')}</strong> reportes en el mapa.
    {/if}
  </p>

  <!-- Fuentes -->
  <section class="mt-8">
    <h2 class="text-xl font-bold text-gray-900">Fuentes de datos</h2>
    <ul class="mt-4 space-y-4">
      {#each SOURCES as s}
        <li class="rounded-2xl border border-gray-200 bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-bold text-faro-900">{s.nombre}</h3>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium {s.externa
                ? 'bg-faro-50 text-faro-900'
                : 'bg-gray-100 text-gray-600'}">{s.rol}</span
            >
          </div>
          <a
            href={s.url}
            target={s.externa ? '_blank' : undefined}
            rel={s.externa ? 'noopener noreferrer' : undefined}
            class="mt-2 inline-block break-all text-[13px] font-medium text-faro-800 underline"
            >{s.externa ? s.url : `${SITE}${s.url}`}</a
          >
          <p class="mt-2 text-sm leading-relaxed text-gray-600">{s.desc}</p>
        </li>
      {/each}
    </ul>
  </section>

  <!-- Atribución por record -->
  <section class="mt-8">
    <h2 class="text-xl font-bold text-gray-900">Cómo atribuimos cada reporte</h2>
    <p class="mt-2 text-sm leading-relaxed text-gray-700">
      Cada reporte importado lleva su
      <code class="rounded bg-gray-100 px-1">source</code> y un
      <code class="rounded bg-gray-100 px-1">source_url</code> clickeable hacia el origen — lo verás
      como una etiqueta en la ficha de cada persona. Si reutilizás nuestros datos abiertos, debés
      conservar ese origen.
    </p>
  </section>

  <!-- Opt-out (regla #8) -->
  <section class="mt-8 rounded-2xl border border-faro-200 bg-faro-50 p-5">
    <h2 class="text-xl font-bold text-faro-900">Opt-out — detener la ingesta</h2>
    <p class="mt-2 text-sm leading-relaxed text-faro-900/90">
      ¿Sos una de estas fuentes (o tu organización) y <strong>no querés</strong> que ingiramos tu
      información? Escribinos a
      <a href="mailto:opt-out@faro-ve.com" class="font-semibold underline">opt-out@faro-ve.com</a> —
      tenemos un <strong>SLA público de 24 horas</strong> para <strong>detener la ingesta</strong> de
      esa fuente y <strong>purgar</strong> sus registros de Faro VE.
    </p>
    <p class="mt-3 text-sm leading-relaxed text-faro-900/90">
      ¿Sos la persona reportada o un familiar y querés retirar un reporte puntual? Podés hacerlo desde
      la propia ficha, o escribirnos al mismo correo y lo resolvemos.
    </p>
  </section>

  <!-- Uso de los datos -->
  <section class="mt-8">
    <h2 class="text-xl font-bold text-gray-900">Uso de los datos</h2>
    <p class="mt-2 text-sm leading-relaxed text-gray-700">
      Nuestra información pública está abierta para construir una red de datos humanitarios conectados.
      Las condiciones, los formatos (PFIF, GeoJSON, JSON) y la licencia (CC BY 4.0 con cláusula de
      no-reidentificación) están en
      <a href="/datos" data-sveltekit-preload-data="hover" class="font-medium text-faro-800 underline"
        >Datos abiertos</a
      >.
    </p>
  </section>

  <p class="mt-10 border-t border-gray-100 pt-5 text-center text-xs leading-relaxed text-gray-500">
    Faro VE · Sin fines de lucro · Privacidad por diseño · Atribución obligatoria · opt-out 24h
  </p>
</main>
