<script lang="ts">
  import NavigateButton from '$components/NavigateButton.svelte';
  import ShareButton from '$components/ShareButton.svelte';
  import InfoForm from '$components/InfoForm.svelte';
  import FaroIcon from '$components/FaroIcon.svelte';
  import ReportPersonButton from '$components/ReportPersonButton.svelte';
  import { COLOR, COLOR_ON, LABEL_ES, categoryForPerson } from '$utils/colors';
  import type { PageData } from './$types';

  export let data: PageData;
  $: p = data.person;
  $: photoUrl = data.photoUrl;
  $: cat = categoryForPerson(p);

  // Si la foto no carga (p.ej. URL rota de la fuente), se oculta limpio en vez de
  // mostrar el ícono de imagen rota. Se reinicia al cambiar de ficha.
  let photoFailed = false;
  $: photoUrl, (photoFailed = false);
  // ¿Persona buscada? (ajusta el mensaje de compartir: "ayúdame a encontrar").
  $: searching = p.status === 'missing' || p.status === 'unidentified_body';

  // Opt-in del propio sujeto (CLAUDE #26 ⚠️): un auto-reporte "a salvo" puede
  // compartir su ubicación exacta y/o teléfono para que lo encuentren. Es la
  // ÚNICA excepción en la que una persona (no un lugar de servicio) muestra
  // navegación. Default OFF; la vista persons_public enmascara si no hubo opt-in.
  $: safeOptInLocation =
    p.status === 'safe_self_report' &&
    p.share_exact_location_with_searchers === true &&
    p.lat_exact_optional != null &&
    p.lng_exact_optional != null;

  // Teléfono público SOLO bajo el mismo opt-in estricto que la coord exacta
  // (defensa en profundidad #2: no confiamos solo en que la vista lo enmascare).
  $: phone =
    p.status === 'safe_self_report' && p.share_exact_location_with_searchers
      ? (p.contact_phone_optional ?? null)
      : null;
  $: telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;

  $: sector = p.home_neighborhood || p.home_city || p.last_known_location_text || 'Zona desconocida';
  // Zona en TEXTO sin el fallback "desconocida" (para los reportes sin coords).
  $: rawZone = p.home_neighborhood || p.home_city || p.last_known_location_text || null;
  $: clothes = [p.clothing_top, p.clothing_bottom].filter(Boolean).join(', ');
  $: age = p.age != null ? `, ${p.age} años` : '';

  // Open Graph por-persona: previsualización rica al compartir (WhatsApp/redes).
  // Solo datos públicos (nombre, zona aproximada, vestimenta); nunca PII ni coord.
  $: ogTitle = searching
    ? `Ayúdame a encontrar a ${p.full_name || 'esta persona'}`
    : `${p.full_name || 'Persona'} — Faro VE`;
  $: ogDesc = (() => {
    const head = [p.age != null ? `${p.age} años` : null, sector].filter(Boolean).join(' · ');
    const clothes2 = [p.clothing_top, p.clothing_bottom].filter(Boolean).join(', ');
    const tail = clothes2 ? ` Vestía: ${clothes2}.` : '';
    return `${head}.${tail} Si la has visto, ayuda en Faro VE.`.trim();
  })();

  // Aportes de la comunidad ya aprobados (avistamientos / info).
  $: notes = data.notes ?? [];

  function noteWhen(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-VE', { dateStyle: 'medium' });
  }
</script>

<svelte:head>
  <title>{p.full_name || 'Persona'} — Faro VE</title>
  <meta name="robots" content="noindex" />
  <!-- Previsualización rica al compartir (override por-persona, sin duplicar). -->
  <meta property="og:title" content={ogTitle} />
  <meta property="og:description" content={ogDesc} />
  <meta name="twitter:title" content={ogTitle} />
  <meta name="twitter:description" content={ogDesc} />
  {#if data.shareUrl}<meta property="og:url" content={data.shareUrl} />{/if}
</svelte:head>

<main class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]">
  <a
    href="/mapa"
    data-sveltekit-preload-data="hover"
    class="min-h-tap mb-2 -ml-1 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Volver al mapa
  </a>

  <header class="space-y-2">
    <span
      class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style="background:{COLOR[cat]};color:{COLOR_ON[cat]}">{LABEL_ES[cat]}</span
    >
    <h1 class="text-2xl font-bold text-gray-900">{p.full_name || 'Sin nombre'}{age}</h1>
  </header>

  {#if photoUrl && !photoFailed}
    <img
      src={photoUrl}
      alt="Foto de {p.full_name || 'la persona'}"
      class="mt-4 max-h-72 w-full rounded-xl object-cover"
      loading="lazy"
      on:error={() => (photoFailed = true)}
    />
  {:else if p.is_minor}
    <p class="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      🔒 Por ser menor de edad, su foto no se muestra públicamente. Las autoridades y moderadores
      pueden verla — contacta a moderación.
    </p>
  {/if}

  <dl class="mt-5 space-y-3 text-sm">
    {#if clothes}
      <div><dt class="font-medium text-gray-500">Vestía</dt><dd class="text-gray-900">{clothes}</dd></div>
    {/if}
    {#if p.distinguishing_marks}
      <div>
        <dt class="font-medium text-gray-500">Señas particulares</dt>
        <dd class="text-gray-900">{p.distinguishing_marks}</dd>
      </div>
    {/if}
    {#if p.description}
      <div><dt class="font-medium text-gray-500">Descripción</dt><dd class="text-gray-900">{p.description}</dd></div>
    {/if}
  </dl>

  <!-- Ubicación -->
  <section class="mt-6 rounded-xl border border-gray-200 p-4">
    {#if safeOptInLocation}
      <p class="text-sm text-gray-700">
        <span aria-hidden="true">📍</span>
        Esta persona <strong>compartió su ubicación exacta</strong> para que la encuentren.
      </p>
      <p class="mt-1 text-xs text-gray-500">{sector}</p>
      <div class="mt-3">
        <!-- NavigateButton (componente único, regla #27). Permitido aquí porque es
             opt-in del propio sujeto de un auto-reporte "a salvo" (#26 ⚠️). -->
        <NavigateButton
          lat={p.lat_exact_optional as number}
          lng={p.lng_exact_optional as number}
          name={p.full_name || 'esta persona'}
          address={p.last_known_location_text || sector}
        />
      </div>
    {:else if p.lat != null}
      <p class="text-sm text-gray-700">
        <span aria-hidden="true">📍</span>
        Ubicación aproximada <strong>(~300m por privacidad)</strong>.
      </p>
      <p class="mt-1 text-xs text-gray-500">Última zona conocida: {sector}</p>
    {:else}
      <!-- Sin localización geocodificable: la persona está registrada y es buscable
           por nombre, solo que no se pudo ubicar en el mapa (comentario claro). -->
      <p class="text-sm text-gray-700">
        <span aria-hidden="true">📍</span>
        <strong>Sin localización en el mapa.</strong> Esta persona está registrada y se puede buscar
        por nombre; su última ubicación no pudo ubicarse en el mapa.
      </p>
      {#if rawZone}
        <p class="mt-1 text-xs text-gray-500">Última zona indicada (en texto): {rawZone}</p>
      {/if}
    {/if}
  </section>

  <!-- Contacto -->
  <section class="mt-4 space-y-2">
    {#if phone && telHref}
      <a
        href={telHref}
        class="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg bg-faro-900 px-4 py-3 font-semibold text-white transition hover:bg-faro-800 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700 focus:ring-offset-2"
      >
<FaroIcon name="phone" size={18} /> Llamar a {p.full_name || 'esta persona'}
      </a>
    {/if}

  </section>

  <!-- Aportar información / avistamiento (va a moderación antes de publicarse). -->
  {#if p.status !== 'safe_self_report'}
    <InfoForm personId={p.id} personName={p.full_name || 'esta persona'} />
  {/if}

  <!-- Compartir: más ojos sobre el caso = más posibilidades de hallazgo. -->
  {#if data.shareUrl}
    <ShareButton name={p.full_name || 'esta persona'} url={data.shareUrl} {searching} />
  {/if}

  <!-- Autorregulación comunitaria (publish-first): reportar un perfil falso →
       si varios lo reportan, se auto-oculta para revisión. -->
  <ReportPersonButton personId={p.id} />

  <!-- Aportes de la comunidad ya aprobados (avistamientos / info). -->
  {#if notes.length}
    <section class="mt-6">
      <h2 class="text-sm font-semibold text-gray-900">Información de la comunidad</h2>
      <ul class="mt-2 space-y-3">
        {#each notes as n (n.id)}
          <li class="rounded-xl border border-gray-200 p-3">
            <div class="flex items-center gap-2 text-xs text-gray-500">
              <span class="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                {n.type === 'sighting' ? '👁 Avistamiento' : '💬 Información'}
              </span>
              {#if n.created_at}<span>{noteWhen(n.created_at)}</span>{/if}
            </div>
            <p class="mt-1.5 whitespace-pre-line text-sm text-gray-800">{n.text}</p>
            {#if n.sighting_location_text}
              <p class="mt-1 text-xs text-gray-500">📍 {n.sighting_location_text} <span class="text-gray-400">(zona aproximada)</span></p>
            {/if}
          </li>
        {/each}
      </ul>
      <p class="mt-2 text-xs text-gray-400">
        Aportes revisados por moderación. Las ubicaciones se muestran aproximadas por privacidad.
      </p>
    </section>
  {/if}

  {#if p.source && p.source !== 'faro-ve'}
    <p class="mt-6 text-center text-xs text-gray-500">
      Fuente: {p.source}
      {#if p.source_url && /^https?:\/\//i.test(p.source_url)}
        · <a href={p.source_url} target="_blank" rel="noopener noreferrer" class="underline">ver original</a>
      {/if}
    </p>
  {/if}
</main>
