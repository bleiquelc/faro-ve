/**
 * Faro Auxilio — modelo de datos del núcleo ESTÁTICO de primeros auxilios.
 *
 * Regla inmutable del proyecto: CERO invención. Cada procedimiento cita su
 * fuente oficial (ver `sources.ts`). Cada contacto declara su nivel de
 * verificación: un número de teléfono errado cuesta vidas, así que la UI
 * NUNCA ofrece "llamar" a un número no verificado.
 *
 * Todo este contenido es estático (sin IA, sin red): vive en el bundle del
 * cliente → funciona offline una vez instalada la PWA.
 */

/** Identificador de una fuente oficial registrada en `sources.ts`. */
export type SourceId = string;

/** Una fuente oficial citable (guía/organización + URL real verificada). */
export interface Source {
  id: SourceId;
  /** Organización emisora (ej. "American Heart Association"). */
  org: string;
  /** Título del documento/guía + año si aplica. */
  title: string;
  /** URL real verificada. */
  url: string;
}

/**
 * Un procedimiento de primeros auxilios o supervivencia, por PASOS.
 * Lenguaje español latino, simple, no técnico.
 */
export interface Procedure {
  /** id corto en kebab-case, estable (se usa en el ancla de la URL). */
  id: string;
  /** Título claro para cualquier persona. */
  title: string;
  /** Emoji opcional como marcador visual rápido. */
  emoji?: string;
  /** Una línea: "qué es / cuándo usar esto". */
  summary?: string;
  /** Pasos numerados — el orden importa. */
  steps: string[];
  /** Qué NO hacer (errores que dañan). */
  dont?: string[];
  /** Cuándo llamar a emergencias. */
  callEmergency?: string[];
  /** Fuente(s) oficial(es) de las que se curó este procedimiento. */
  sources: SourceId[];
}

/** Una categoría agrupa procedimientos afines (ej. "Sangrado y heridas"). */
export interface Category {
  id: string;
  title: string;
  emoji: string;
  /** Color semántico (token de `$utils/colors`) para el acento de la categoría. */
  accent: string;
  intro?: string;
  procedures: Procedure[];
}

/** Tipo de contacto de emergencia. */
export type ContactType =
  | "nacional-emergencia"
  | "bomberos"
  | "proteccion-civil"
  | "cruz-roja"
  | "sismologia"
  | "hospital";

/**
 * Nivel de verificación de un contacto.
 *  - 'verified'   → fuente oficial + corroboración cruzada. La UI ofrece llamar.
 *  - 'unverified' → solo directorios/terceros. La UI NO ofrece llamar; muestra
 *                   ubicación y remite al 911. El teléfono (si se conoce) se
 *                   muestra como "sin verificar", nunca como enlace de llamada.
 */
export type ContactTier = "verified" | "unverified";

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  /**
   * Teléfonos VERIFICADOS y marcables. Formato de marcado internacional
   * (+58…) salvo el código corto de emergencia (911). Vacío si no hay número
   * verificado.
   */
  dial: Array<{ label: string; tel: string }>;
  /**
   * Teléfono encontrado en directorios pero NO verificado contra fuente
   * oficial. Se muestra en texto apagado con etiqueta "sin verificar"; NUNCA
   * como enlace de llamada (un número errado cuesta vidas).
   */
  unverifiedPhone?: string;
  zone?: string;
  address?: string;
  /** Nota corta (ej. horario, alcance, "línea de personas desaparecidas"). */
  note?: string;
  tier: ContactTier;
  /** Marca la línea del CICR de búsqueda de personas (relevante para Faro VE). */
  searchPersons?: boolean;
  sourceId?: SourceId;
}
