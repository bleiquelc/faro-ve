# Sesión 2026-06-26 — Panel /moderar (D3) + fix de ubicación (mar) — modo automático

> Sesión autónoma autorizada por el founder ("modo automático, si está correcto despliegas").
> Velocidad CON rigor: cada bloque con revisión adversarial multi-agente ANTES de prod.

## 1. Panel de moderación /moderar (D3) — ✅ LIVE

Lane elegida por el founder. Construido reusando todo lo existente (RPC `SECURITY DEFINER`→
`service_role`, auth `locals.moderator` ya cableada en hooks, patrón de auditoría de 0014).

- **Migración `0016`** (aplicada a prod): RPCs `moderation_queue` / `moderation_stats` /
  `moderate_person` (SECURITY DEFINER, solo service_role). Orden regla #20; coords EXACTAS solo
  al moderador (#1); cero PII de reportante en la cola (#2, solo nombre/relación/país +
  `has_reporter_contact`); `audit_log` atómico con actor=moderador; **supresión del audit-fantasma**
  del trigger genérico (flag `faro.skip_persons_audit`); seed del founder como admin.
- **Auth magic-link** Supabase: `/moderar/login` (fail-closed anti email-bombing, gate a moderador
  activo, respuesta genérica anti-enumeración), `/moderar/auth/callback` (PKCE + token_hash con
  `type` validado), `/moderar/auth/logout`. Gate `locals.moderator` en capa + página + RPC.
- **UI** mobile-first AAA: cola con badges (menor/médico/IA), foto firmada (menor etiquetado solo
  para moderación), decisión con motivo obligatorio salvo aprobar, feedback de sesión expirada, a11y.
- **Gate DB** por rollback (seguro contra prod): `scripts/verify-moderation.mjs` → 15/15 PASS.
- **Revisión adversarial** (workflow, 19 agentes): 3 confirmados + 1 crítico-completitud, **todos
  corregidos** (feedback 403, audit-fantasma, login fail-closed, a11y textarea, `type` del callback).
  0 críticos/altos en la frontera de autorización / PII / coords.
- Verificado live: `/moderar/login` 200, `/moderar` → 303 login, `moderation_queue` vía anon REST 401.

⚠️ **Pendiente founder (1 paso de dashboard)** para que el login funcione — ver handoff.

## 2. Fix de ubicación — personas sobre el mar — ✅ LIVE

Pedido del founder: en la costa salían reportes sobre el agua; los puntos de color difíciles de ver.

- **Causa raíz** (con datos): pueblos costeros reales de La Guaira (Tanaguarena, Caraballeda, Macuto)
  pegados al agua; la ofuscación obligatoria 200-500m (#1) empujaba **1229 puntos (8.9%)** al mar.
- **Migración `0017`** (aplicada): máscara de tierra `ve_land` (polígono geoBoundaries, 3201 vért.) +
  `obfuscate_point_on_land` (re-tira el offset hasta caer en tierra, **preserva ≥200m**; fail-safe
  sin máscara). Triggers persons/notes → versión land-aware (mismo change-guard anti-promediado).
  **Regla #1 inviolable**: si el snap quedara a <200m del exacto, se mantiene el punto offshore
  (privacidad > cosmético) — por eso quedan 23 puntos en el mar a propósito.
- **`scripts/load-ve-land.mjs`**: carga el polígono + backfill (**1229 → 23**) + avistamientos.
- **`Map.svelte`**: puntos de color aparecen antes (`ZOOM_POINTS` 13→12, `maxClusterRadius` 50→38)
  y más visibles (núcleo 13→15px, halo más denso; NN 16px por dignidad).
- **Revisión adversarial** (workflow, 12 agentes): 5 confirmados (incl. **1 high** de privacidad en
  el fallback de snap) **corregidos**. Verificado live: franja offshore La Guaira **100 → 0**,
  total intacto 13791.

## Commits
- `74b4e68` feat(moderar): panel de moderación D3
- `08370e6` fix(mapa): ofuscación consciente de la tierra + pines de color más visibles

## Migraciones aplicadas en prod: 0001–0017.

---

## Tanda 2 (autónoma) — Reconexión de doble vía + alcance

Founder en el trabajo; instrucción: "mejora todo lo que puedas que ayude a las personas, en automático,
revisa/verifica y si funciona despliega". Cada feature con su revisión adversarial antes de prod.

### 3. Compartir (ficha) — ✅ LIVE `e330b19`
ShareButton: Web Share API nativa + WhatsApp (dominante en VE) + copiar enlace. Mensaje "ayúdame a
encontrar" para personas buscadas. No expone nada nuevo (ficha ya pública, coords ofuscadas, foto de
menor oculta). Más alcance = más hallazgos.

### 4. Avistamientos / "Tengo información" — ✅ LIVE `5746129`
Doble vía: quien vio a una persona o tiene un dato lo aporta → moderación → aparece en la ficha.
- Migración 0018: create_note_report (cifra PII del autor, ofusca avistamiento land-aware, pending),
  notes_moderation_queue/stats, moderate_note (atómico + audit, approved/rejected). `/api/notes`, InfoForm
  en la ficha, visualización de aportes, sección de notas en `/moderar`. Gate verify-notes.mjs 24/24.
- Revisión adversarial (15 agentes): 10 confirmados + 1 crítico-completitud, corregidos.
  **CRÍTICO cerrado**: 0003 daba a anon INSERT directo a notes/persons por PostgREST (saltaba
  Turnstile/cifrado/whitelist de tipo) → revocado, toda alta pasa por las RPC SECURITY DEFINER.

### 5. Previews enriquecidos (Open Graph) — ✅ LIVE `0201dbe`
Al compartir una ficha: tarjeta rica con 'Ayúdame a encontrar a {nombre}' + edad/zona (solo datos
públicos). Genera el og-image.png branded que faltaba (la referencia global daba 404). OG por-página sin
duplicados (saca título/descripción de app.html). og:image absoluto + dimensiones.

### Tareas que solo el founder puede hacer (config externa)
1. Supabase Auth → redirect-URL del magic-link (login de /moderar). Ver HANDOFF #1.
2. `RESEND_API_KEY` en Pages → desbloquea relay. `ANTHROPIC_API_KEY` → desbloquea IA. Ver HANDOFF #2.
3. Email Routing contacto@/opt-out@. Decisiones: tapar-cara (A/B/C), re-ingesta (+8-9k personas).

### Migraciones en prod: 0001–0018. svelte-check 0 · 61 tests · builds limpios · todo verificado live.
