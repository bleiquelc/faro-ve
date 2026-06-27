<script lang="ts">
  /**
   * Respaldo SIN conexión. Aparece cuando una navegación falla por falta de red
   * y la ruta no está precacheada. Mensaje claro + lo que SÍ sirve offline
   * (Faro Auxilio) con un botón directo. Coherente con la marca (faro + cálido).
   */
  import FaroAuxilio from "$components/FaroAuxilio.svelte";

  function retry() {
    if (typeof location !== "undefined") location.reload();
  }
</script>

<svelte:head>
  <title>Sin conexión · Faro VE</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wrap">
  <div class="card">
    <div class="logo"><FaroAuxilio size={108} light animated={false} /></div>

    <p class="kick">Faro VE</p>
    <h1>Sin conexión</h1>
    <p class="lead">
      Ahora mismo no hay internet. El mapa y los reportes necesitan conexión,
      pero <strong>los primeros auxilios SÍ funcionan sin internet</strong>.
    </p>

    <a class="btn primary" href="/auxilio">
      <FaroAuxilio size={26} compact light animated={false} />
      <span>Abrir Faro Auxilio</span>
    </a>

    <button class="btn ghost" type="button" on:click={retry}>Reintentar</button>

    <p class="foot">
      Cuando vuelva la conexión, toca <strong>Reintentar</strong> para ver el
      mapa y los reportes más recientes.
    </p>
  </div>
</main>

<style>
  .wrap {
    min-height: 100svh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: radial-gradient(
      120% 70% at 50% 10%,
      #0e3a4f 0%,
      #06202b 60%,
      #04161e 100%
    );
    color: #fff;
  }
  .card {
    width: 100%;
    max-width: 420px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .logo {
    margin-bottom: 6px;
  }
  .kick {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #ffe39c;
  }
  h1 {
    margin: 0;
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.01em;
  }
  .lead {
    margin: 2px 0 8px;
    font-size: 1.05rem;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.9);
  }
  .lead strong {
    color: #fff;
  }
  .btn {
    width: 100%;
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 16px;
    font-size: 1.05rem;
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      background 0.2s ease;
  }
  .btn:active {
    transform: scale(0.98);
  }
  .btn.primary {
    background: #fff;
    color: #0b4f6c;
    border: none;
  }
  .btn.ghost {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.25);
  }
  .foot {
    margin: 8px 0 0;
    font-size: 0.9rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.72);
  }
  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }
  }
</style>
