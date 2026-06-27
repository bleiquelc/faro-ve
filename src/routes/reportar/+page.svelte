<script lang="ts">
  import FaroIcon from "$components/FaroIcon.svelte";

  /**
   * Hub de "Reportar y ayudar" — punto único y coherente para todas las formas
   * de aporte. Cada una con su ícono propio estilo Faro. No duplica lógica: solo
   * enruta a los formularios existentes.
   */
  type Item = {
    href: string;
    icon:
      | "report"
      | "medical"
      | "sighting"
      | "safe"
      | "candle"
      | "aid"
      | "shelter";
    label: string;
    desc: string;
  };

  const PERSONAS: Item[] = [
    {
      href: "/reportar/desaparecido",
      icon: "report",
      label: "No encuentro a alguien",
      desc: "Reportar a una persona desaparecida.",
    },
    {
      href: "/reportar/condicion-medica",
      icon: "medical",
      label: "Necesita atención médica",
      desc: "Alguien que necesita medicación o atención urgente.",
    },
    {
      href: "/reportar/avistamiento",
      icon: "sighting",
      label: "Vi a alguien que buscan",
      desc: "Reportar un avistamiento de una persona reportada.",
    },
    {
      href: "/reportar/a-salvo",
      icon: "safe",
      label: "Estoy a salvo",
      desc: "Avisar que estás bien para que tu familia te encuentre.",
    },
    {
      href: "/reportar/cuerpo-nn",
      icon: "candle",
      label: "Persona fallecida sin identificar",
      desc: "Con respeto, para que su familia pueda hallarla.",
    },
  ];

  const LUGARES: Item[] = [
    {
      href: "/reportar/punto-ayuda",
      icon: "aid",
      label: "Punto de ayuda",
      desc: "Agua, comida, médico, carga, wifi, acopio…",
    },
    {
      href: "/reportar/refugio",
      icon: "shelter",
      label: "Refugio",
      desc: "Un lugar donde la gente puede resguardarse.",
    },
  ];
</script>

<svelte:head>
  <title>Reportar y ayudar — Faro VE</title>
</svelte:head>

<main
  class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]"
>
  <a
    href="/"
    class="min-h-tap -ml-1 mb-2 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Inicio
  </a>

  <h1 class="text-2xl font-bold text-gray-900">Reportar y ayudar</h1>
  <p class="mt-1.5 text-sm text-gray-600">
    Elige qué quieres reportar. Todo es gratuito y con privacidad por diseño.
  </p>

  <section class="mt-6">
    <h2
      class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500"
    >
      Sobre una persona
    </h2>
    <ul class="space-y-2">
      {#each PERSONAS as it (it.href)}
        <li>
          <a
            href={it.href}
            data-sveltekit-preload-data="hover"
            class="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-faro-300 active:scale-[0.99]"
          >
            <span class="text-faro-900" aria-hidden="true"
              ><FaroIcon name={it.icon} size={24} /></span
            >
            <span class="min-w-0 flex-1">
              <span class="block font-semibold text-slate-800">{it.label}</span>
              <span class="block text-xs text-slate-500">{it.desc}</span>
            </span>
            <span aria-hidden="true" class="text-slate-300">→</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <section class="mt-6">
    <h2
      class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500"
    >
      Lugares de ayuda
    </h2>
    <ul class="space-y-2">
      {#each LUGARES as it (it.href)}
        <li>
          <a
            href={it.href}
            data-sveltekit-preload-data="hover"
            class="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-faro-300 active:scale-[0.99]"
          >
            <span class="text-faro-900" aria-hidden="true"
              ><FaroIcon name={it.icon} size={24} /></span
            >
            <span class="min-w-0 flex-1">
              <span class="block font-semibold text-slate-800">{it.label}</span>
              <span class="block text-xs text-slate-500">{it.desc}</span>
            </span>
            <span aria-hidden="true" class="text-slate-300">→</span>
          </a>
        </li>
      {/each}
    </ul>
  </section>
</main>
