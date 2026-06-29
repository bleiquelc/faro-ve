# Runbook — Auto-publicador Instagram (@farovenmap) + Reencuentros

> Sistema que publica fichas de personas buscadas en Instagram y detecta "reencuentros"
> (gente buscada en una plataforma pero reportada A SALVO en otra). Construido 28-29 jun 2026.
> Cuenta: **@farovenmap** (IG Business, conectada a Buffer). Todo el código en `scripts/buffer/`.

---

## 1. Qué hace (visión)

Un solo trabajo por corrida del cruce de datos:
1. **Unifica** los datos de una persona desde Faro + Venezuela Reporta (+ Venezuela Te Busca), con match difuso de nombres.
2. **Verifica** (IA) que sea la MISMA persona antes de usar foto/datos de otra plataforma.
3. **Enriquece** la base de Faro (rellena faltantes, sin pisar lo bueno ni tocar PII) — *requiere 0029 + ENRICH_TOKEN*.
4. **Reconcilia**: si figura a salvo en otra fuente → NO la publica como desaparecida; la suma al documento del día + a la lista pública `/reencuentros`.
5. **Publica**: si no, pasa la foto por el filtro IA y **solo publica con foto limpia** (ficha retrato) en @farovenmap.

---

## 2. Arquitectura / scripts (`scripts/buffer/`)

| Script | Qué hace |
|---|---|
| `cron-ig.mjs` | **Orquestador horario.** Elige 1 buscada no-posteada → unifica → reconcilia → filtro foto → render → host → publica. Estado, kill-switch, dedup. |
| `photo-filter.mjs` | **Filtro IA (Haiku visión).** `classifyPhoto(url)` → rechaza flyers/carteles, texto sobreimpreso, **cédulas/teléfonos**, screenshots, grupos, menores. Detecta formato por magic-bytes. |
| `found-detector.mjs` | `confirmReunification` (IA confirma misma-persona + a salvo + evidencia), `nameOverlap` difuso (Levenshtein, tolera tipeos), `isFoundStatus`. |
| `render-ficha.mjs` | Ficha retrato JPEG 1080×1350 (foto dominante + datos limpios + género). Overrides: `NAME/LOC/SEX/AGE/EXTRA_DESC/PHOTO_URL/NO_PHOTO`. |
| `reconcile.mjs` | Cruza Faro ↔ Venezuela Reporta → documento del día `~/Desktop/faro-reencuentros/reencuentros-FECHA.md` + `.json`. |
| `render-reencuentros-carousel.mjs` | Carrusel IG foto-dominante (foto + ✅ FIGURA A SALVO + pie titulado). Filtra fotos con la IA. |
| `post.mjs` | Publica vía Buffer GraphQL. `IMG_URL` (1 foto) o `IMG_URLS` (coma-separadas = carrusel). `WHEN_MIN=N` → programa en N min; si no, cola. |
| `buffer-ids.mjs` / `buffer-test-post.mjs` | Utilidades: sacar org/channelId; probar 1 post. |

**Endpoint + página (en la app):** `src/routes/api/enrich/+server.ts` (escribe a la DB con token) · `src/routes/reencuentros/+page.{server.ts,svelte}` (lista pública).
**Migración:** `supabase/migrations/0029_enrich_and_reencuentros.sql` (tabla `person_found_signals`, RPC `enrich_person`, vista `reencuentros_public`).

---

## 3. Credenciales (en `~/.secrets/faro-ve/`, chmod 600, NUNCA en repo/chat)

- `buffer-key.txt` — API key de Buffer (GraphQL nueva). Endpoint `https://api.buffer.com`, header `Authorization: Bearer`. Se crea en https://publish.buffer.com/settings/api (copiar con el botón Copy).
- `anthropic-key.txt` — para el filtro de fotos + confirmación de reencuentro (Haiku `claude-haiku-4-5-20251001`).
- `enrich-token.txt` — token compartido con el Pages secret `ENRICH_TOKEN` (para escribir a la DB de Faro).

**IDs Buffer:** organizationId `6a418e4ed0bf4334f8959146` · IG channelId **`6a4190975ab6d2f106819d3d`** (@farovenmap).

---

## 4. El cron (launchd) — está LIVE

- Agente: `~/Library/LaunchAgents/com.farove.ig.plist` (Label `com.farove.ig`, `StartInterval 3600` = 1/hora).
- Corre `node scripts/buffer/cron-ig.mjs`. Publica máx **1 ficha/corrida** (ritmo seguro anti-baneo).
- Logs: `~/.faro-ig/cron.log` y `~/.faro-ig/cron.err.log`.
- Estado: `~/.faro-ig/state.json` (`posted` / `skipped` con TTL 3d / `reencuentros`).

### Operación
```bash
# Pausar / reanudar (kill-switch suave)
touch ~/.faro-ig/paused        # ⛔ pausa
rm ~/.faro-ig/paused           # ▶️ reanuda

# Cargar / descargar el agente
launchctl unload ~/Library/LaunchAgents/com.farove.ig.plist
launchctl load -w ~/Library/LaunchAgents/com.farove.ig.plist
launchctl list | grep farove   # ver estado

# Corrida manual (publica 1, programada +4 min)
cd ~/Desktop/faro-ve && WHEN_MIN=4 node scripts/buffer/cron-ig.mjs

# Ensayo SIN publicar (ver a quién elegiría)
cd ~/Desktop/faro-ve && DRY=1 node scripts/buffer/cron-ig.mjs

# Ver el log en vivo
tail -f ~/.faro-ig/cron.log
```

---

## 5. Reencuentros (documento + carrusel + lista pública)

```bash
# Generar el documento del día + JSON (cruza Faro ↔ Venezuela Reporta)
cd ~/Desktop/faro-ve && LIMIT=50 node scripts/buffer/reconcile.mjs
#   → ~/Desktop/faro-reencuentros/reencuentros-FECHA.md  (para avisar a familias)
#   → ~/Desktop/faro-reencuentros/reencuentros-FECHA.json (datos)

# Renderizar el carrusel (foto-dominante, filtra fotos con IA)
MAX_CASES=9 node scripts/buffer/render-reencuentros-carousel.mjs
#   → ~/Desktop/faro-reencuentros/carrusel/slide-*.jpg + caption.txt

# Publicar el carrusel (hospeda slides en rama fichas-cdn → raw → Buffer)
#   (ver el bloque de hosting abajo; luego:)
#   IMG_URLS="url1,url2,...,url10" TEXT_FILE=".../caption.txt" node scripts/buffer/post.mjs
```
La página pública **`/reencuentros`** lee la vista `reencuentros_public` (solo confianza ALTA o confirmadas) → los que buscan encuentran a quienes aparecen. Lenguaje siempre "posiblemente / verificá en la fuente".

---

## 6. Hosting de imágenes

Buffer exige una **URL pública** de la imagen. Hoy: **git worktree** `~/.faro-ig/cdn` sobre la rama **`fichas-cdn`** → `https://raw.githubusercontent.com/bleiquelc/faro-ve/fichas-cdn/...`.
```bash
git worktree add -B fichas-cdn ~/.faro-ig/cdn   # una vez
# (el cron lo hace solo en hostImage())
```
⚠️ **Riesgo:** el `git push` desde launchd puede fallar por credenciales (keychain). Si `cron.err.log` muestra error de push → **migrar a Supabase Storage** (bucket público + subir vía REST con service_role) o Cloudflare R2. Roadmap.

---

## 7. ENRICH_TOKEN — escribir a la DB de Faro (un solo trabajo)

El cron llama `POST /api/enrich` con `x-enrich-token`. El endpoint valida contra el Pages secret `ENRICH_TOKEN` y corre la RPC `enrich_person` (service_role).
```bash
# 1) (ya hecho) token en ~/.secrets/faro-ve/enrich-token.txt — el cron lo lee de ahí.
# 2) Setear el MISMO valor como secreto de Pages:
cat ~/.secrets/faro-ve/enrich-token.txt | wrangler pages secret put ENRICH_TOKEN --project-name faro-ve
# 3) Aplicar migración 0029 (SQL Editor) + git push + deploy.
# Rotar: regenerar el archivo (openssl rand -hex 24) y repetir el paso 2.
```
Sin token, `enrichDB` se salta (`skip(no-token)`) y el cron igual publica + reconcilia.

---

## 8. Guardarraíles (privacidad por diseño — innegociables)

- **Solo se publica CON foto limpia** (decisión founder). Sin foto limpia → se salta (reintenta en 3d).
- **Nunca**: cédulas/teléfonos (PII), flyers ajenos, screenshots, fotos de grupo, **foto de menores** (regla #3 + filtro).
- **Misma-persona confirmada por IA** antes de usar foto/datos de otra plataforma (anti-homónimo — nombres mal escritos).
- Ubicación pública ofuscada; reencuentros con lenguaje "posiblemente / verificá en la fuente" (no falsa esperanza).
- Atribución obligatoria a las fuentes (Venezuela Reporta — venezuelareporta.org).
- **2 catches reales que validaron esto:** un homónimo (foto de otra persona) y un flyer con cédula+teléfono — ambos frenados antes de publicar.

---

## 9. Pendiente del founder

1. **Aplicar migración 0029** (SQL Editor).
2. **`wrangler pages secret put ENRICH_TOKEN`** (valor = el del archivo).
3. **`git push`** (commits de atribución + ig) + deploy → `/reencuentros` y `/api/enrich` live.

Sin estos 3, el cron **igual** publica fichas + detecta reencuentros + genera el documento del día. Faltaría solo la escritura a la DB y la página pública.

---

## 10. Troubleshooting

- **No publica nada / "Sin foto limpia" en todos:** normal — la mayoría de las fotos de origen son flyers/cédulas/grupos. El cron publica pocas a propósito.
- **`post.mjs` exit 1:** falta `BUFFER_API_KEY` (el cron lo lee de `~/.secrets/faro-ve/buffer-key.txt`).
- **"Access token is not valid" (Buffer):** la key no es de la API nueva o se copió mal → regenerar en publish.buffer.com/settings/api.
- **El cron no corre:** `launchctl list | grep farove`; revisar `~/.faro-ig/cron.err.log`; node en `/usr/local/bin/node`.
- **Push falla en launchd:** ver §6 (migrar hosting).
- **Filtro probar una foto:** `PHOTO_URL="..." node scripts/buffer/photo-filter.mjs`.
