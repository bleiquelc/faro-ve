/**
 * Búsqueda LOCAL sobre las guías verificadas — sin red, sin IA, instantánea.
 *
 * Permite que el chat (y el buscador) respondan desde la biblioteca SIN llamar a
 * Anthropic para las preguntas comunes: si la pregunta coincide claramente con
 * una guía, se devuelve esa guía tal cual (contenido verificado). La IA queda
 * como respaldo solo para lo que esto no resuelve. Funciona offline.
 */
import { CATEGORIES } from "./index";
import type { Category, Procedure } from "./types";

export interface GuideHit {
  proc: Procedure;
  cat: Category;
  score: number;
}

/** Quita acentos y baja a minúsculas para comparar de forma tolerante. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sinónimos / términos coloquiales latinos → palabras que SÍ aparecen en las
 * guías. Expanden la consulta para que "culebra" encuentre "serpiente", etc.
 * Clave y valores ya normalizados (sin acentos).
 */
const SYNONYMS: Record<string, string> = {
  infarto: "corazon pecho rcp reanimacion",
  paro: "corazon rcp reanimacion no respira",
  "ataque al corazon": "corazon rcp reanimacion",
  reanimar: "rcp reanimacion",
  ahoga: "atragant",
  ahogando: "atragant",
  atorado: "atragant",
  atoro: "atragant",
  atora: "atragant",
  zafarrancho: "atragant",
  sangre: "sangrado hemorragia herida",
  sangra: "sangrado hemorragia",
  cortada: "sangrado herida corte",
  cortadura: "sangrado herida corte",
  hemorragia: "sangrado",
  torniquete: "torniquete sangrado brazo pierna",
  queme: "quemadura",
  quemo: "quemadura",
  fuego: "quemadura",
  hueso: "fractura",
  quebro: "fractura hueso",
  quebrado: "fractura hueso",
  roto: "fractura hueso",
  fractura: "fractura hueso",
  derrumbe: "aplastada atrapada escombros",
  escombros: "atrapada escombros aplastada",
  aplastado: "aplastada atrapada",
  atrapado: "atrapada escombros",
  desmayo: "desmayo inconsciente",
  desmayó: "desmayo inconsciente",
  inconsciente: "desmayo inconsciente no responde",
  convulsion: "convulsion ataque",
  convulsiona: "convulsion ataque",
  epilepsia: "convulsion ataque",
  convulsionando: "convulsion ataque",
  insolacion: "golpe de calor calor",
  calor: "golpe de calor",
  deshidratado: "deshidratacion suero diarrea calor",
  deshidratacion: "suero diarrea rehidratacion",
  diarrea: "suero rehidratacion deshidratacion",
  vomito: "suero rehidratacion intoxicacion",
  suero: "suero rehidratacion",
  electrico: "descarga electrica cable electrocucion",
  electrocutado: "descarga electrica electrocucion",
  corriente: "descarga electrica cable",
  cable: "descarga electrica cable",
  panico: "apoyo psicologico calmar angustia",
  ansiedad: "apoyo psicologico calmar",
  nervios: "apoyo psicologico calmar",
  angustia: "apoyo psicologico calmar",
  temblor: "sismo terremoto",
  terremoto: "sismo",
  replica: "sismo despues replicas",
  agua: "agua segura beber hervir cloro potabilizar",
  potabilizar: "agua segura hervir cloro",
  comida: "comida segura alimentos",
  alimento: "comida segura",
  alergia: "anafilaxia reaccion alergica",
  anafilaxia: "anafilaxia reaccion alergica grave",
  hinchazon: "anafilaxia reaccion alergica",
  veneno: "intoxicacion envenenamiento",
  trago: "intoxicacion envenenamiento",
  intoxicado: "intoxicacion envenenamiento",
  envenenado: "intoxicacion envenenamiento",
  culebra: "serpiente mordedura",
  serpiente: "serpiente mordedura",
  mordio: "mordedura serpiente",
  mordida: "mordedura serpiente",
  alacran: "alacran mordedura serpiente picadura",
  escorpion: "alacran picadura",
  clavado: "objeto clavado herida",
  empalado: "objeto clavado",
  cuchillo: "objeto clavado herida",
  varilla: "objeto clavado",
  cabeza: "golpe cabeza conmocion",
  conmocion: "golpe cabeza",
  nariz: "sangrado de nariz",
  humo: "inhalacion humo",
  infeccion: "cuidado heridas infeccion",
  pus: "infeccion herida",
  tetano: "cuidado heridas infeccion tetanos",
  higiene: "higiene prevencion lavar manos",
  mosquito: "mosquitos dengue prevencion",
  zancudo: "mosquitos dengue prevencion",
  dengue: "dengue mosquitos prevencion",
  malaria: "mosquitos prevencion paludismo",
  sol: "sodis agua solar",
  refugio: "refugio higiene",
};

function expand(query: string): string {
  const q = norm(query);
  const extra: string[] = [];
  for (const [term, syn] of Object.entries(SYNONYMS)) {
    if (q.includes(term)) extra.push(syn);
  }
  return (q + " " + extra.join(" ")).trim();
}

const STOP = new Set([
  "que",
  "como",
  "cual",
  "para",
  "por",
  "con",
  "una",
  "uno",
  "los",
  "las",
  "del",
  "que",
  "hago",
  "hacer",
  "hay",
  "tengo",
  "mi",
  "me",
  "se",
  "es",
  "la",
  "el",
  "de",
  "en",
  "un",
  "le",
  "lo",
  "si",
  "su",
  "al",
  "y",
  "o",
  "a",
  "ayuda",
  "persona",
  "alguien",
]);

/**
 * Devuelve las guías que mejor coinciden con la pregunta, ordenadas por score.
 * El score pondera coincidencias en título (alto), resumen (medio) y pasos (bajo).
 */
export function searchGuides(query: string, limit = 3): GuideHit[] {
  const expanded = expand(query);
  const words = [...new Set(expanded.split(" "))].filter(
    (w) => w.length >= 3 && !STOP.has(w),
  );
  if (words.length === 0) return [];

  const hits: GuideHit[] = [];
  for (const cat of CATEGORIES) {
    for (const proc of cat.procedures) {
      const title = norm(proc.title);
      const summary = norm(proc.summary ?? "");
      const body = norm(
        [
          ...proc.steps,
          ...(proc.dont ?? []),
          ...(proc.callEmergency ?? []),
        ].join(" "),
      );
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 5;
        if (summary.includes(w)) score += 3;
        if (body.includes(w)) score += 1;
      }
      if (score > 0) hits.push({ proc, cat, score });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/**
 * ¿La mejor coincidencia es lo bastante fuerte para responder SIN IA?
 * Exige una señal clara (coincidencia en título/resumen, no solo en el cuerpo).
 */
export function isConfidentHit(hits: GuideHit[]): boolean {
  return (
    hits.length > 0 &&
    hits[0].score >= 5 &&
    (hits.length === 1 || hits[0].score >= hits[1].score + 3)
  );
}
