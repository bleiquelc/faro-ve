/**
 * Faro Auxilio — punto de entrada del núcleo ESTÁTICO.
 *
 * Ensambla las categorías y reexporta tipos, fuentes y contactos. Todo es
 * estático (sin IA, sin red) → vive en el bundle del cliente y funciona offline.
 */
import { COLOR } from "$utils/colors";
import type { Category } from "./types";
import { FIRST_AID } from "./first-aid";
import { EARTHQUAKE } from "./survival";
import { EXPANSION_FIRST_AID, EXPANSION_SALUD } from "./expansion";

export type {
  Procedure,
  Category,
  Contact,
  Source,
  ContactTier,
  ContactType,
} from "./types";
export { SOURCES, getSource } from "./sources";
export { CONTACTS } from "./contacts";

export const CATEGORIES: Category[] = [
  {
    id: "primeros-auxilios",
    title: "Primeros auxilios",
    emoji: "🚑",
    accent: COLOR.medical,
    intro:
      "Qué hacer en los primeros minutos. Si puedes, pide que alguien llame al 911 mientras tú ayudas.",
    procedures: [...FIRST_AID, ...EXPANSION_FIRST_AID],
  },
  {
    id: "salud-prevencion",
    title: "Salud y prevención",
    emoji: "🩺",
    accent: COLOR.safe,
    intro:
      "Cuidar la salud y evitar enfermedades tras el desastre: rehidratación, heridas, higiene y mosquitos.",
    procedures: EXPANSION_SALUD,
  },
  {
    id: "sismo-supervivencia",
    title: "Sismo y supervivencia",
    emoji: "🌎",
    accent: COLOR.shelter,
    intro:
      "Qué hacer durante y después de un temblor, y cómo conseguir agua y comida seguras.",
    procedures: EARTHQUAKE,
  },
];

/** Aviso obligatorio mostrado de forma visible junto al contenido médico. */
export const DISCLAIMER =
  "Contenido en revisión. Es información general de fuentes oficiales (Cruz Roja/IFRC, AHA, OMS, CDC, FUNVISIS) y NO reemplaza la atención de un profesional de salud. Ante una emergencia, llama al 911.";

/** Total de procedimientos (para encabezados/conteos). */
export const PROCEDURE_COUNT = CATEGORIES.reduce(
  (n, c) => n + c.procedures.length,
  0,
);
