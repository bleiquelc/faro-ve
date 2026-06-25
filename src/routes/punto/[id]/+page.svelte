<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import NavigateButton from '$components/NavigateButton.svelte';
  import Turnstile from '$components/Turnstile.svelte';
  import { AID_META } from '$utils/colors';
  import { SUPPLY_OPTIONS, type AidPointDetail } from '$schemas/aid-point';
  import type { PageData } from './$types';

  export let data: PageData;
  $: aid = data.aid as AidPointDetail;

  const SUPPLY_LABEL = new Map(SUPPLY_OPTIONS.map((s) => [s.value, s.label]));

  $: meta = AID_META[aid.type] ?? AID_META.other;
  $: tags = Array.isArray((aid.supplies_available as { tags?: string[] } | null)?.tags)
    ? ((aid.supplies_available as { tags?: string[] }).tags as string[])
    : [];
  $: scheduleText = (aid.schedule as { text?: string } | null)?.text ?? '';

  // Conteos locales (se actualizan tras votar) — fuente inicial: la ficha cargada.
  let confirms = 0;
  let reports = 0;
  let hiddenNow = false;
  $: {
    confirms = aid.confirm_count;
    reports = aid.report_count;
    hiddenNow = aid.auto_hidden;
  }

  // Turnstile (token de un solo uso → reset() tras cada acción).
  let token = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let turnstileComp: any = null;

  let voteBusy = false;
  let voteMsg = '';
  let reactivating = false;
  let reactivatePhone = '';
  let reactivateMsg = '';

  function agoLabel(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '';
    const h = Math.floor(ms / 3_600_000);
    if (h < 1) return 'hace menos de 1 hora';
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return `hace ${d} día${d > 1 ? 's' : ''}`;
  }

  async function vote(kind: 'confirm' | 'report') {
    voteMsg = '';
    if (!token) {
      voteMsg = 'Completa la verificación anti-bot para votar.';
      return;
    }
    voteBusy = true;
    try {
      const res = await fetch(`/api/aid-points/${aid.id}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote: kind, 'cf-turnstile-response': token })
      });
      const j = (await res.json().catch(() => ({}))) as {
        message?: string;
        confirms?: number;
        reports?: number;
        auto_hidden?: boolean;
      };
      if (!res.ok) {
        voteMsg = j.message || 'No se pudo registrar tu voto. Intenta de nuevo.';
        return;
      }
      if (typeof j.confirms === 'number') confirms = j.confirms;
      if (typeof j.reports === 'number') reports = j.reports;
      if (j.auto_hidden) {
        hiddenNow = true;
        voteMsg = 'Gracias. Con suficientes reportes, este punto se ocultó para revisión.';
      } else {
        voteMsg = kind === 'confirm' ? '¡Gracias! Confirmaste que sigue activo.' : 'Gracias por avisar.';
      }
    } catch {
      voteMsg = 'No se pudo registrar tu voto. Verifica la conexión.';
    } finally {
      turnstileComp?.reset?.();
      voteBusy = false;
    }
  }

  async function reactivate() {
    reactivateMsg = '';
    if (!reactivatePhone.trim()) {
      reactivateMsg = 'Escribe tu WhatsApp para reactivar (queda privado).';
      return;
    }
    if (!token) {
      reactivateMsg = 'Completa la verificación anti-bot.';
      return;
    }
    reactivating = true;
    try {
      const res = await fetch(`/api/aid-points/${aid.id}/reactivate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: reactivatePhone.trim(), 'cf-turnstile-response': token })
      });
      const j = (await res.json().catch(() => ({}))) as { message?: string; ok?: boolean };
      if (!res.ok) {
        reactivateMsg = j.message || 'No se pudo reactivar. Intenta de nuevo.';
        return;
      }
      // Recargar la ficha → ahora aparece activa.
      await invalidateAll();
      reactivatePhone = '';
      reactivateMsg = '';
    } catch {
      reactivateMsg = 'No se pudo reactivar. Verifica la conexión.';
    } finally {
      turnstileComp?.reset?.();
      reactivating = false;
    }
  }
</script>

<svelte:head>
  <title>{aid.name} — Faro VE</title>
</svelte:head>

<main class="mx-auto min-h-[100dvh] w-full max-w-lg px-5 pb-16 pt-[calc(env(safe-area-inset-top)+1rem)]">
  <a
    href="/mapa?aid=1"
    data-sveltekit-preload-data="hover"
    class="min-h-tap mb-2 -ml-1 inline-flex items-center gap-1.5 px-1 text-sm text-faro-900 hover:underline"
  >
    <span aria-hidden="true">←</span> Volver al mapa
  </a>

  <header class="space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-900">
        <span aria-hidden="true">{meta.emoji}</span> {meta.label}
      </span>
      {#if aid.verified}
        <span class="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">✓ Verificado</span>
      {:else}
        <span class="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Sin verificar</span>
      {/if}
      {#if aid.organization_name}
        <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{aid.organization_name}</span>
      {/if}
    </div>
    <h1 class="text-2xl font-bold text-gray-900">{aid.name}</h1>
    {#if aid.last_updated_at}
      <p class="text-xs text-gray-500">Última actualización {agoLabel(aid.last_updated_at)}</p>
    {/if}
  </header>

  {#if hiddenNow}
    <!-- Auto-ocultado por la comunidad → reactivación con responsable (WhatsApp). -->
    <section class="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <h2 class="text-base font-bold text-amber-900">La comunidad reportó que este punto ya no está</h2>
      <p class="mt-1 text-sm text-amber-800">
        Se ocultó del mapa porque varias personas avisaron que ya no funciona. Si sabes que
        <strong>sigue activo</strong>, puedes reactivarlo. Para evitar abusos, deja tu WhatsApp: se
        guarda <strong>cifrado y privado</strong>, solo para que el equipo verifique.
      </p>

      <div class="mt-4 space-y-3">
        <label class="block">
          <span class="text-sm font-medium text-amber-900">Tu WhatsApp *</span>
          <input
            bind:value={reactivatePhone}
            type="tel"
            maxlength="40"
            placeholder="+58 412 1234567"
            class="mt-1 min-h-tap w-full rounded-lg border border-amber-300 px-3 py-2"
            autocomplete="tel"
          />
          <span class="mt-1 block text-xs text-amber-700">No se muestra a nadie. Queda cifrado.</span>
        </label>

        <Turnstile bind:this={turnstileComp} bind:token />

        {#if reactivateMsg}
          <p class="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{reactivateMsg}</p>
        {/if}

        <button
          type="button"
          on:click={reactivate}
          disabled={reactivating}
          class="min-h-tap flex w-full items-center justify-center rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white transition hover:bg-amber-800 disabled:opacity-60"
        >
          {reactivating ? 'Reactivando…' : 'Sé que sigue activo — reactivar'}
        </button>
      </div>
    </section>
  {:else if aid.is_expired}
    <section class="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p class="text-sm text-gray-700">
        ⌛ Este punto caducó (no se actualizó en más de 7 días). Si sigue activo, regístralo de nuevo.
      </p>
      <a href="/reportar/punto-ayuda" class="min-h-tap mt-3 inline-flex items-center justify-center rounded-lg border border-faro-900 px-4 py-2 text-sm font-semibold text-faro-900">
        Registrar de nuevo
      </a>
    </section>
  {:else}
    <!-- Punto activo → insumos, ubicación exacta + navegación, votación. -->
    {#if tags.length}
      <section class="mt-5">
        <h2 class="text-sm font-semibold text-gray-900">Disponible</h2>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each tags as t}
            <span class="rounded-full bg-cyan-50 px-3 py-1 text-sm text-cyan-900">{SUPPLY_LABEL.get(t) ?? t}</span>
          {/each}
        </div>
      </section>
    {/if}

    {#if scheduleText}
      <p class="mt-4 text-sm text-gray-700"><span class="font-medium text-gray-500">Horario:</span> {scheduleText}</p>
    {/if}

    {#if aid.capacity_max != null}
      <p class="mt-2 text-sm text-gray-700">
        <span class="font-medium text-gray-500">Capacidad:</span>
        {aid.capacity_current ?? '—'} / {aid.capacity_max}
      </p>
    {/if}

    <section class="mt-6 rounded-xl border border-gray-200 p-4">
      <p class="text-sm text-gray-700">📍 <strong>Ubicación exacta</strong></p>
      <p class="mt-1 text-sm text-gray-900">{aid.address_text}</p>
      {#if aid.landmark}<p class="mt-1 text-xs text-gray-500">Referencia: {aid.landmark}</p>{/if}
      {#if aid.entrance_notes}<p class="mt-0.5 text-xs text-gray-500">Entrada: {aid.entrance_notes}</p>{/if}
      <div class="mt-3">
        <!-- NavigateButton: componente único (regla #27). Permitido: es un LUGAR
             de servicio (#26), no una persona. Incluye "Copiar dirección". -->
        <NavigateButton
          lat={aid.lat}
          lng={aid.lng}
          name={aid.name}
          address={aid.address_text}
          landmark={aid.landmark}
          entrance_notes={aid.entrance_notes}
        />
      </div>
    </section>

    <!-- Autorregulación comunitaria: ¿sigue aquí? -->
    <section class="mt-6 rounded-xl border border-gray-200 p-4">
      <h2 class="text-sm font-semibold text-gray-900">¿Este punto sigue activo?</h2>
      <p class="mt-1 text-xs text-gray-500">
        Tu voto ayuda a mantener el mapa al día. 1 voto por persona (puedes cambiarlo).
      </p>
      <p class="mt-2 text-sm text-gray-700">
        👍 {confirms} confirmaron · ⚠️ {reports} reportaron que ya no está
      </p>

      <div class="mt-3">
        <Turnstile bind:this={turnstileComp} bind:token />
      </div>

      {#if voteMsg}
        <p class="mt-2 rounded-lg bg-gray-50 px-4 py-2 text-sm text-gray-700" role="status">{voteMsg}</p>
      {/if}

      <div class="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          on:click={() => vote('confirm')}
          disabled={voteBusy}
          class="min-h-tap flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
        >
          ✅ Sí, sigue aquí
        </button>
        <button
          type="button"
          on:click={() => vote('report')}
          disabled={voteBusy}
          class="min-h-tap flex items-center justify-center gap-1.5 rounded-lg border border-amber-600 px-4 py-3 font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-60"
        >
          ⚠️ Ya no está
        </button>
      </div>
    </section>
  {/if}

  <p class="mt-6 text-center text-xs text-gray-400">
    Lugar de servicio registrado por la comunidad. Si hay un error, repórtalo arriba.
  </p>
</main>
