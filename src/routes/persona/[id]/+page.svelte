<script lang="ts">
  import NavigateButton from '$components/NavigateButton.svelte';
  import { COLOR, COLOR_ON, LABEL_ES, categoryForPerson } from '$utils/colors';
  import type { PageData } from './$types';

  export let data: PageData;
  $: p = data.person;
  $: cat = categoryForPerson(p);

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
  $: clothes = [p.clothing_top, p.clothing_bottom].filter(Boolean).join(', ');
  $: age = p.age != null ? `, ${p.age} años` : '';

  // "Tengo información": el relay anti-PII (/mensaje/[id]) llega en D3. Interino:
  // canalizamos al inbox de Faro (NO al reportante) — nunca expone PII de terceros.
  $: infoHref = `mailto:contacto@faro-ve.com?subject=${encodeURIComponent(
    `Información sobre ${p.full_name || 'persona'} (${p.id})`
  )}`;
</script>

<svelte:head>
  <title>{p.full_name || 'Persona'} — Faro VE</title>
  <meta name="robots" content="noindex" />
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

  {#if p.photo_url}
    <img
      src={p.photo_url}
      alt="Foto de {p.full_name || 'la persona'}"
      class="mt-4 max-h-72 w-full rounded-xl object-cover"
      loading="lazy"
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
    {:else}
      <p class="text-sm text-gray-700">
        <span aria-hidden="true">📍</span>
        Ubicación aproximada <strong>(~300m por privacidad)</strong>.
      </p>
      <p class="mt-1 text-xs text-gray-500">Última zona conocida: {sector}</p>
    {/if}
  </section>

  <!-- Contacto -->
  <section class="mt-4 space-y-2">
    {#if phone && telHref}
      <a
        href={telHref}
        class="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg bg-faro-900 px-4 py-3 font-semibold text-white transition hover:bg-faro-800 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700 focus:ring-offset-2"
      >
        <span aria-hidden="true">📞</span> Llamar a {p.full_name || 'esta persona'}
      </a>
    {/if}

    {#if p.status !== 'safe_self_report'}
      <a
        href={infoHref}
        class="min-h-tap flex w-full items-center justify-center gap-2 rounded-lg border border-faro-900 px-4 py-3 font-semibold text-faro-900 transition hover:bg-faro-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-faro-700"
      >
        <span aria-hidden="true">✉️</span> Tengo información
      </a>
      <p class="text-center text-xs text-gray-500">
        Tu mensaje llega al equipo de Faro VE, que lo hace seguir sin exponer datos de nadie.
      </p>
    {/if}
  </section>

  {#if p.source && p.source !== 'faro-ve'}
    <p class="mt-6 text-center text-xs text-gray-500">
      Fuente: {p.source}
      {#if p.source_url && /^https?:\/\//i.test(p.source_url)}
        · <a href={p.source_url} target="_blank" rel="noopener noreferrer" class="underline">ver original</a>
      {/if}
    </p>
  {/if}
</main>
