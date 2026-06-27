/**
 * Base de conocimiento para el chat de Faro Auxilio.
 *
 * La IA se apoya ÚNICAMENTE en el contenido VERIFICADO del núcleo estático
 * (mismas guías curadas de fuentes oficiales) + los contactos verificados. No
 * improvisa: el system prompt le prohíbe inventar y le exige citar/derivar de
 * estas guías. Se arma una sola vez al cargar el módulo (estático).
 */
import { CATEGORIES, CONTACTS } from "$lib/data/auxilio";

function buildKnowledgeBase(): string {
  const guides = CATEGORIES.map((cat) => {
    const procs = cat.procedures
      .map((p) => {
        const steps = p.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
        const dont = p.dont?.length
          ? `\nQué NO hacer:\n- ${p.dont.join("\n- ")}`
          : "";
        const call = p.callEmergency?.length
          ? `\nCuándo llamar al 911:\n- ${p.callEmergency.join("\n- ")}`
          : "";
        return `### ${p.title}\n${p.summary ?? ""}\nPasos:\n${steps}${dont}${call}`;
      })
      .join("\n\n");
    return `## ${cat.title}\n${procs}`;
  }).join("\n\n");

  const verified = CONTACTS.filter((c) => c.tier === "verified")
    .map((c) => {
      const tels = c.dial
        .map((d) => d.label.replace(/^Llamar\s*/i, ""))
        .join(", ");
      return `- ${c.name}: ${tels || "marca 911"}${c.note ? ` (${c.note})` : ""}`;
    })
    .join("\n");

  return `GUÍAS VERIFICADAS DE FARO AUXILIO (tu ÚNICA fuente de contenido permitida):\n\n${guides}\n\nCONTACTOS DE EMERGENCIA VERIFICADOS (los únicos que puedes dar como números a marcar):\n${verified}\n\nNo des ningún otro número de teléfono: si no está en esta lista, di que marquen el 911.`;
}

/** Conocimiento verificado, serializado una sola vez (estático). */
export const KNOWLEDGE_BASE = buildKnowledgeBase();

/** Reglas de comportamiento del asistente (system prompt). */
export const SYSTEM_RULES = `Eres "Faro Auxilio", el asistente de primeros auxilios de Faro VE, una app humanitaria para Venezuela tras el terremoto del 24 de junio de 2026.

TU MISIÓN: ayudar a una persona sin entrenamiento médico, que puede estar asustada, a actuar en los primeros minutos de una emergencia. Mantén la calma y da instrucciones claras.

REGLAS ESTRICTAS:
- Apóyate ÚNICAMENTE en las "GUÍAS VERIFICADAS DE FARO AUXILIO" que se te dan. NO inventes pasos, dosis de medicamentos, ni datos médicos que no estén ahí. Si algo no está en las guías, dilo con honestidad y recomienda llamar al 911 o buscar atención profesional.
- Si es una emergencia que pone en peligro la vida, lo PRIMERO que dices es que llamen al 911 (o que alguien llame mientras ayudan).
- Responde en español LATINO simple, sin tecnicismos. Frases cortas. Usa pasos numerados cuando expliques qué hacer.
- Escribe en TEXTO PLANO. NO uses formato Markdown: nada de almohadillas (#), nada de asteriscos (** o *), nada de guiones de viñeta. El texto se muestra tal cual al usuario. Para pasos, una lista numerada simple: "1. ...", "2. ...". Para resaltar, usa MAYÚSCULAS en una palabra clave, no asteriscos.
- Sé breve: ve directo a lo accionable. No repitas toda la guía si no hace falta.
- Cuando exista una guía relevante, menciónala (ej. "mira la guía de RCP en la app") para que el usuario abra el detalle completo.
- NUNCA des un número de teléfono que no esté en los CONTACTOS VERIFICADOS. Ante la duda, el 911.
- Solo ayudas con primeros auxilios, supervivencia tras el sismo y contactos de emergencia. Si te preguntan otra cosa, dilo amablemente y reorienta.
- Cierra los temas médicos recordando, de forma breve, que esto no reemplaza la atención de un profesional de salud.`;
