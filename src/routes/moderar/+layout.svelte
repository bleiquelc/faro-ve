<script lang="ts">
  import type { LayoutData } from './$types';
  export let data: LayoutData;
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-[100dvh] bg-gray-50">
  <header class="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
    <div
      class="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
    >
      <a href="/moderar" class="flex items-center gap-2 font-bold text-faro-900">
        <span aria-hidden="true">🛡️</span> Moderación · Faro VE
      </a>
      {#if data.moderator}
        <div class="flex items-center gap-3 text-sm">
          <span class="hidden text-gray-500 sm:inline">{data.moderator.email}</span>
          <form method="POST" action="/moderar/auth/logout">
            <button
              class="min-h-tap rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-100"
            >
              Salir
            </button>
          </form>
        </div>
      {/if}
    </div>
  </header>

  <slot />
</div>
