/**
 * Registro de fuentes oficiales — Faro Auxilio.
 *
 * Cada procedimiento del núcleo estático cita uno o más de estos ids. Las URLs
 * fueron verificadas durante la curación del contenido. Si una guía publica
 * una edición más nueva con las mismas cifras de consenso (ej. ILCOR), se
 * mantiene la URL citada y se actualiza el año.
 */
import type { Source } from "./types";

export const SOURCES: Record<string, Source> = {
  "ifrc-2020": {
    id: "ifrc-2020",
    org: "IFRC · Cruz Roja / Media Luna Roja",
    title:
      "Guías Internacionales de Primeros Auxilios, Reanimación y Educación 2020",
    url: "https://www.ifrc.org/sites/default/files/2022-02/EN_GFARC_GUIDELINES_2020.pdf",
  },
  "aha-cpr": {
    id: "aha-cpr",
    org: "American Heart Association (AHA)",
    title: "RCP solo con las manos (Hands-Only CPR) — Guías 2020",
    url: "https://cpr.heart.org/en/resources/what-is-cpr",
  },
  "redcross-choking-adult": {
    id: "redcross-choking-adult",
    org: "Cruz Roja Americana",
    title: "Atragantamiento en adultos y niños",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/adult-child-choking",
  },
  "redcross-choking-infant": {
    id: "redcross-choking-infant",
    org: "Cruz Roja Americana",
    title: "Atragantamiento en bebés",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/infant-choking",
  },
  "redcross-earthquake": {
    id: "redcross-earthquake",
    org: "Cruz Roja Americana",
    title: "Seguridad en terremotos",
    url: "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/earthquake.html",
  },
  "mayo-bleeding": {
    id: "mayo-bleeding",
    org: "Mayo Clinic",
    title: "Sangrado severo: primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-severe-bleeding/basics/art-20056661",
  },
  "mayo-burns": {
    id: "mayo-burns",
    org: "Mayo Clinic",
    title: "Quemaduras: primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-burns/basics/art-20056649",
  },
  "mayo-fractures": {
    id: "mayo-fractures",
    org: "Mayo Clinic",
    title: "Fracturas (huesos rotos): primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-fractures/basics/art-20056641",
  },
  "mayo-shock": {
    id: "mayo-shock",
    org: "Mayo Clinic",
    title: "Shock: primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-shock/basics/art-20056620",
  },
  "mayo-fainting": {
    id: "mayo-fainting",
    org: "Mayo Clinic",
    title: "Desmayo: primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-fainting/basics/art-20056606",
  },
  "mayo-spinal": {
    id: "mayo-spinal",
    org: "Mayo Clinic",
    title: "Lesión de columna: primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-spinal-injury/basics/art-20056677",
  },
  "mayo-heatstroke": {
    id: "mayo-heatstroke",
    org: "Mayo Clinic",
    title: "Golpe de calor: primeros auxilios (2024)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-heatstroke/basics/art-20056655",
  },
  "cdc-crush": {
    id: "cdc-crush",
    org: "CDC (EE.UU.)",
    title: "Lesiones por aplastamiento tras un terremoto",
    url: "https://stacks.cdc.gov/view/cdc/11904",
  },
  "sja-recovery": {
    id: "sja-recovery",
    org: "St John Ambulance",
    title: "Posición de recuperación",
    url: "https://www.sja.org.uk/first-aid-advice/recovery-position/",
  },
  shakeout: {
    id: "shakeout",
    org: "Great ShakeOut · Earthquake Country Alliance",
    title: "Agáchese, Cúbrase y Agárrese (Drop, Cover, Hold On)",
    url: "https://www.shakeout.org/dropcoverholdon/",
  },
  "pc-funvisis-ve": {
    id: "pc-funvisis-ve",
    org: "Protección Civil Venezuela · FUNVISIS",
    title: "Guía de tres fases: qué hacer antes, durante y después de un sismo",
    url: "https://www.mpprijp.gob.ve/prensa/reporte/conozca-la-guia-de-tres-fases-sobre-que-hacer-antes-durante-y-despues-de-un-sismo",
  },
  "cdc-earthquake": {
    id: "cdc-earthquake",
    org: "CDC (EE.UU.)",
    title: "Mantente seguro después de un terremoto (2024)",
    url: "https://www.cdc.gov/earthquakes/safety/stay-safe-after-an-earthquake.html",
  },
  "cdc-water": {
    id: "cdc-water",
    org: "CDC (EE.UU.)",
    title: "Cómo hacer que el agua sea segura en una emergencia",
    url: "https://www.cdc.gov/water-emergency/about/index.html",
  },
  "epa-water": {
    id: "epa-water",
    org: "US EPA",
    title: "Desinfección de emergencia del agua potable",
    url: "https://www.epa.gov/ground-water-and-drinking-water/emergency-disinfection-drinking-water",
  },
  "who-water": {
    id: "who-water",
    org: "OMS / WHO",
    title: "Métodos de tratamiento del agua y su desempeño",
    url: "https://www.who.int/teams/environment-climate-change-and-health/water-sanitation-and-health/water-safety-and-quality/drinking-water-quality-guidelines",
  },
  foodsafety: {
    id: "foodsafety",
    org: "FoodSafety.gov (HHS, EE.UU.)",
    title: "Seguridad de los alimentos durante un corte de luz",
    url: "https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage",
  },
  "cdc-food": {
    id: "cdc-food",
    org: "CDC (EE.UU.)",
    title: "Mantén los alimentos seguros tras un desastre o emergencia",
    url: "https://www.cdc.gov/food-safety/foods/keep-food-safe-after-emergency.html",
  },
  "ready-kit": {
    id: "ready-kit",
    org: "Ready.gov / FEMA (EE.UU.)",
    title: "Arma tu kit de emergencia (Build A Kit)",
    url: "https://www.ready.gov/kit",
  },
  // ── Fuentes de contactos ───────────────────────────────────────────────
  "ven911-oficial": {
    id: "ven911-oficial",
    org: "Ven 911 (oficial)",
    title: "Línea Única de Emergencia VEN 9-1-1",
    url: "https://ven911.gob.ve/",
  },
  "icrc-ve": {
    id: "icrc-ve",
    org: "CICR (Cruz Roja Internacional)",
    title: "Venezuela — Contáctanos / Sigamos en Contacto",
    url: "https://www.icrc.org/es/document/venezuela-contactanos-traves-de-nuestra-linea-de-atencion-telefonica",
  },
  "cruzroja-ve": {
    id: "cruzroja-ve",
    org: "Cruz Roja Venezolana",
    title: "Sede Nacional — Caracas",
    url: "https://cruzroja.ve/",
  },
};

/** Devuelve una fuente por id (o undefined si no existe). */
export function getSource(id: string): Source | undefined {
  return SOURCES[id];
}
