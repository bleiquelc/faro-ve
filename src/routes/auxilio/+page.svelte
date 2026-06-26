<script lang="ts">
  import FaroAuxilio from "$components/FaroAuxilio.svelte";
  import FaroIcon from "$components/FaroIcon.svelte";
  import {
    CATEGORIES,
    CONTACTS,
    SOURCES,
    DISCLAIMER,
    PROCEDURE_COUNT,
    type Procedure,
    type Contact,
    type ContactType,
  } from "$lib/data/auxilio";

  type View = "guia" | "contactos";
  let view: View = "guia";
  let q = "";

  // Filtro instantáneo (sin red): por título, resumen y texto de los pasos.
  function matches(p: Procedure, needle: string): boolean {
    if (!needle) return true;
    const hay = (
      p.title +
      " " +
      (p.summary ?? "") +
      " " +
      p.steps.join(" ") +
      " " +
      (p.dont ?? []).join(" ")
    ).toLowerCase();
    return needle
      .toLowerCase()
      .split(/\s+/)
      .every((w) => hay.includes(w));
  }

  $: filtered = CATEGORIES.map((c) => ({
    ...c,
    procedures: c.procedures.filter((p) => matches(p, q.trim())),
  })).filter((c) => c.procedures.length > 0);

  $: verified = CONTACTS.filter((c) => c.tier === "verified");
  $: others = CONTACTS.filter((c) => c.tier !== "verified");

  const TYPE_META: Record<ContactType, { emoji: string; label: string }> = {
    "nacional-emergencia": { emoji: "🚨", label: "Emergencia" },
    bomberos: { emoji: "🚒", label: "Bomberos" },
    "proteccion-civil": { emoji: "🛟", label: "Protección Civil" },
    "cruz-roja": { emoji: "➕", label: "Cruz Roja" },
    sismologia: { emoji: "📡", label: "Sismología" },
    hospital: { emoji: "🏥", label: "Hospital" },
  };

  function sourcesFor(p: Procedure) {
    return p.sources.map((id) => SOURCES[id]).filter(Boolean);
  }
</script>

<svelte:head>
  <title>Faro Auxilio — Primeros auxilios y emergencias · Faro VE</title>
  <meta
    name="description"
    content="Guía de primeros auxilios y supervivencia tras un sismo, con pasos claros de fuentes oficiales (Cruz Roja/IFRC, AHA, OMS, CDC, FUNVISIS) y contactos de emergencia verificados. Funciona sin internet."
  />
</svelte:head>

<div class="min-h-[100dvh] bg-slate-50 text-slate-900">
  <!-- Encabezado -->
  <header
    class="sticky top-0 z-20 bg-faro-900 text-white shadow-md pt-[env(safe-area-inset-top)]"
  >
    <div class="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
      <a
        href="/"
        data-sveltekit-preload-data="hover"
        aria-label="Volver al inicio"
        class="grid h-10 w-10 shrink-0 place-items-center rounded-full ring-1 ring-white/25 transition active:scale-95 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
      >
        <FaroIcon name="home" size={20} />
      </a>
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <FaroAuxilio compact size={34} />
        <div class="min-w-0 leading-tight">
          <h1 class="truncate text-lg font-bold">Faro Auxilio</h1>
          <p class="truncate text-[11px] text-white/75">
            {PROCEDURE_COUNT} guías · funciona sin internet
          </p>
        </div>
      </div>
    </div>
  </header>

  <main class="mx-auto max-w-2xl px-4 pb-24 pt-3">
    <!-- Aviso obligatorio "en revisión" -->
    <div
      class="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] leading-snug text-amber-900"
      role="note"
    >
      <span class="font-semibold">⚠️ En revisión.</span>
      {DISCLAIMER}
    </div>

    <!-- Llamada de emergencia, siempre arriba -->
    <a
      href="tel:911"
      class="mb-4 flex items-center justify-center gap-2.5 rounded-2xl bg-red-600 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-red-600/25 transition active:scale-[0.98] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
    >
      <FaroIcon name="phone" size={22} />
      <span>Emergencia — Llamar al 911</span>
    </a>

    <!-- Conmutador de vista -->
    <div
      class="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-200 p-1 text-sm font-semibold"
      role="tablist"
      aria-label="Secciones de Faro Auxilio"
    >
      <button
        type="button"
        role="tab"
        id="tab-guia"
        aria-controls="panel-guia"
        aria-selected={view === "guia"}
        on:click={() => (view = "guia")}
        class="rounded-lg px-3 py-2 transition {view === 'guia'
          ? 'bg-white text-faro-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900'}"
      >
        🚑 Primeros auxilios
      </button>
      <button
        type="button"
        role="tab"
        id="tab-contactos"
        aria-controls="panel-contactos"
        aria-selected={view === "contactos"}
        on:click={() => (view = "contactos")}
        class="rounded-lg px-3 py-2 transition {view === 'contactos'
          ? 'bg-white text-faro-900 shadow-sm'
          : 'text-slate-600 hover:text-slate-900'}"
      >
        📞 Contactos
      </button>
    </div>

    {#if view === "guia"}
      <div id="panel-guia" role="tabpanel" aria-labelledby="tab-guia">
        <!-- Buscador instantáneo -->
        <div
          class="mb-4 flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200"
        >
          <span aria-hidden="true">🔎</span>
          <input
            bind:value={q}
            type="text"
            inputmode="search"
            enterkeyhint="search"
            placeholder="Buscar (sangrado, RCP, sismo, agua…)"
            aria-label="Buscar en las guías de primeros auxilios"
            class="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          {#if q}
            <button
              type="button"
              on:click={() => (q = "")}
              aria-label="Borrar búsqueda"
              class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100 active:scale-95"
            >
              ✕
            </button>
          {/if}
        </div>

        {#if filtered.length === 0}
          <p
            class="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200"
          >
            No encontramos una guía con "{q}". Probá con otra palabra, o llamá
            al 911.
          </p>
        {/if}

        {#each filtered as cat (cat.id)}
          <section class="mb-6">
            <div class="mb-2 flex items-center gap-2">
              <span
                class="h-5 w-1.5 rounded-full"
                style="background:{cat.accent}"
                aria-hidden="true"
              ></span>
              <h2 class="text-base font-bold text-slate-800">
                <span aria-hidden="true">{cat.emoji}</span>
                {cat.title}
              </h2>
            </div>
            {#if cat.intro && !q}
              <p class="mb-2.5 text-[13px] leading-snug text-slate-500">
                {cat.intro}
              </p>
            {/if}

            <div class="space-y-2">
              {#each cat.procedures as p (p.id)}
                <details
                  id={p.id}
                  class="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 open:ring-slate-300"
                >
                  <summary
                    class="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"
                  >
                    <span class="text-xl" aria-hidden="true"
                      >{p.emoji ?? "•"}</span
                    >
                    <span class="min-w-0 flex-1">
                      <span
                        class="block font-semibold leading-tight text-slate-800"
                        >{p.title}</span
                      >
                      {#if p.summary}
                        <span
                          class="mt-0.5 block text-[12px] leading-snug text-slate-500"
                          >{p.summary}</span
                        >
                      {/if}
                    </span>
                    <span
                      class="chevron shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                      aria-hidden="true">▾</span
                    >
                  </summary>

                  <div
                    class="border-t border-slate-100 px-4 py-3 text-[14px] leading-relaxed"
                  >
                    <p
                      class="mb-1.5 text-xs font-bold uppercase tracking-wide text-faro-700"
                    >
                      Qué hacer
                    </p>
                    <ol
                      class="mb-3 list-decimal space-y-1.5 pl-5 text-slate-700 marker:font-semibold marker:text-faro-700"
                    >
                      {#each p.steps as step, i (i)}
                        <li>{step}</li>
                      {/each}
                    </ol>

                    {#if p.dont?.length}
                      <p
                        class="mb-1.5 text-xs font-bold uppercase tracking-wide text-red-700"
                      >
                        Qué NO hacer
                      </p>
                      <ul class="mb-3 space-y-1.5 text-slate-700">
                        {#each p.dont as d, i (i)}
                          <li class="flex gap-2">
                            <span
                              class="select-none text-red-600"
                              aria-hidden="true">✕</span
                            >
                            <span>{d}</span>
                          </li>
                        {/each}
                      </ul>
                    {/if}

                    {#if p.callEmergency?.length}
                      <div
                        class="mb-3 rounded-lg bg-red-50 px-3 py-2 ring-1 ring-red-100"
                      >
                        <p
                          class="mb-1 text-xs font-bold uppercase tracking-wide text-red-700"
                        >
                          Cuándo llamar al 911
                        </p>
                        <ul class="space-y-1 text-slate-700">
                          {#each p.callEmergency as c, i (i)}
                            <li class="flex gap-2">
                              <span class="select-none" aria-hidden="true"
                                >📞</span
                              ><span>{c}</span>
                            </li>
                          {/each}
                        </ul>
                        <a
                          href="tel:911"
                          class="mt-2 inline-flex items-center gap-2 rounded-full bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white transition active:scale-95 hover:bg-red-700"
                        >
                          <FaroIcon name="phone" size={16} /> Llamar al 911
                        </a>
                      </div>
                    {/if}

                    <p class="text-[11px] leading-snug text-slate-400">
                      Fuente:
                      {#each sourcesFor(p) as s, i}
                        {#if i > 0}<span aria-hidden="true"> · </span>{/if}<a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          class="underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
                          >{s.org}</a
                        >
                      {/each}
                    </p>
                  </div>
                </details>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {:else}
      <div id="panel-contactos" role="tabpanel" aria-labelledby="tab-contactos">
        <!-- CONTACTOS -->
        <section class="mb-6">
          <h2 class="mb-2 text-base font-bold text-slate-800">
            Contactos verificados
          </h2>
          <p class="mb-3 text-[13px] leading-snug text-slate-500">
            Números confirmados con fuentes oficiales. El 911 es tu primera
            opción en cualquier emergencia.
          </p>
          <div class="space-y-2.5">
            {#each verified as c (c.id)}
              <article
                class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div class="flex items-start gap-2">
                  <span class="text-xl" aria-hidden="true"
                    >{TYPE_META[c.type].emoji}</span
                  >
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold leading-tight text-slate-800">
                      {c.name}
                    </h3>
                    {#if c.zone}<p class="mt-0.5 text-[12px] text-slate-500">
                        {c.zone}
                      </p>{/if}
                  </div>
                  {#if c.searchPersons}
                    <span
                      class="shrink-0 rounded-full bg-faro-50 px-2 py-0.5 text-[10px] font-semibold text-faro-700 ring-1 ring-faro-100"
                    >
                      Personas desaparecidas
                    </span>
                  {/if}
                </div>
                {#if c.note}<p
                    class="mt-2 text-[13px] leading-snug text-slate-600"
                  >
                    {c.note}
                  </p>{/if}
                {#if c.address}<p
                    class="mt-1 text-[12px] leading-snug text-slate-500"
                  >
                    {c.address}
                  </p>{/if}
                {#if c.dial.length}
                  <div class="mt-3 flex flex-wrap gap-2">
                    {#each c.dial as d (d.tel)}
                      <a
                        href={"tel:" + d.tel}
                        class="inline-flex items-center gap-2 rounded-full bg-faro-900 px-4 py-2 text-sm font-semibold text-white transition active:scale-95 hover:bg-faro-800 focus:outline-none focus:ring-2 focus:ring-faro-400 focus:ring-offset-1"
                      >
                        <FaroIcon name="phone" size={16} />
                        {d.label}
                      </a>
                    {/each}
                  </div>
                {/if}
              </article>
            {/each}
          </div>
        </section>

        <section class="mb-6">
          <h2 class="mb-2 text-base font-bold text-slate-800">
            Hospitales y otros
          </h2>
          <p class="mb-3 text-[13px] leading-snug text-slate-500">
            Ubicaciones de referencia en Caracas. Sus teléfonos aún no están
            confirmados oficialmente, así que acude directo a Emergencia o marca
            el 911.
          </p>
          <div class="space-y-2.5">
            {#each others as c (c.id)}
              <article
                class="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
              >
                <div class="flex items-start gap-2">
                  <span class="text-xl" aria-hidden="true"
                    >{TYPE_META[c.type].emoji}</span
                  >
                  <div class="min-w-0 flex-1">
                    <h3 class="font-semibold leading-tight text-slate-800">
                      {c.name}
                    </h3>
                    {#if c.zone}<p class="mt-0.5 text-[12px] text-slate-500">
                        {c.zone}
                      </p>{/if}
                  </div>
                </div>
                {#if c.address}<p
                    class="mt-2 text-[13px] leading-snug text-slate-600"
                  >
                    {c.address}
                  </p>{/if}
                {#if c.note}<p
                    class="mt-1 text-[12px] leading-snug text-slate-500"
                  >
                    {c.note}
                  </p>{/if}
                {#if c.unverifiedPhone}
                  <p class="mt-2 text-[12px] text-slate-400">
                    Teléfono en directorios (sin verificar): {c.unverifiedPhone}
                  </p>
                {/if}
              </article>
            {/each}
          </div>
        </section>
      </div>
    {/if}

    <p class="mt-2 text-center text-[11px] leading-snug text-slate-400">
      Faro Auxilio · contenido en revisión, no reemplaza atención médica
      profesional. Curado de fuentes oficiales con cita por procedimiento.
    </p>
  </main>
</div>
