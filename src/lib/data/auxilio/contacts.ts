/**
 * Contactos de emergencia de Venezuela (foco nacional + Caracas).
 *
 * REGLA CRÍTICA: un número errado cuesta vidas. Solo los contactos con
 * `tier: 'verified'` (fuente oficial + corroboración cruzada) exponen botón de
 * llamada. Los `unverified` muestran ubicación y remiten al 911; su teléfono
 * (si se conoce por directorios) se muestra apagado y rotulado "sin verificar",
 * jamás como enlace de llamada.
 *
 * Verificados a la fecha de curación: 911 (oficial), CICR Venezuela (línea de
 * personas desaparecidas), Cruz Roja Venezolana (sede), Bomberos Caracas.
 * Pendientes de que el founder confirme: Protección Civil (0800), FUNVISIS,
 * y los teléfonos de hospitales (solo en directorios terceros).
 */
import type { Contact } from "./types";

export const CONTACTS: Contact[] = [
  {
    id: "ven-911",
    name: "Emergencias 911",
    type: "nacional-emergencia",
    dial: [{ label: "Llamar al 911", tel: "911" }],
    zone: "Todo el país",
    note: "Línea única de emergencia (bomberos, policía, ambulancia). Gratuita desde fijo y celular. Reemplazó al antiguo 171.",
    tier: "verified",
    sourceId: "ven911-oficial",
  },
  {
    id: "cicr-personas",
    name: "Cruz Roja Internacional (CICR) — Personas desaparecidas",
    type: "cruz-roja",
    dial: [
      { label: "Llamar 0412-636.50.15", tel: "+584126365015" },
      { label: "Llamar 0424-172.13.64", tel: "+584241721364" },
    ],
    zone: "Nacional",
    note: 'Servicio "Sigamos en Contacto": ayuda a buscar familiares desaparecidos y restablecer el contacto. Email: centrocontactove@icrc.org',
    tier: "verified",
    searchPersons: true,
    sourceId: "icrc-ve",
  },
  {
    id: "cruz-roja-ve",
    name: "Cruz Roja Venezolana — Sede Nacional",
    type: "cruz-roja",
    dial: [{ label: "Llamar 0212-571.43.80", tel: "+582125714380" }],
    zone: "San Bernardino, Caracas",
    address:
      "Av. Andrés Bello, Edificio Cruz Roja Venezolana, Urb. San Bernardino, Caracas. Email: caracas@cruzroja.ve",
    note: "Sede nacional (Hospital Carlos J. Bello). No es una línea 24 h tipo 911.",
    tier: "verified",
    sourceId: "cruzroja-ve",
  },
  {
    id: "bomberos-caracas",
    name: "Bomberos del Distrito Capital (Caracas)",
    type: "bomberos",
    dial: [{ label: "Llamar 0212-545.45.45", tel: "+582125454545" }],
    zone: "Caracas / Distrito Capital",
    note: "Para emergencia general en cualquier ciudad, marca 911. No hay un número nacional único de bomberos.",
    tier: "verified",
  },
  {
    id: "proteccion-civil",
    name: "Protección Civil (Dirección Nacional)",
    type: "proteccion-civil",
    dial: [],
    unverifiedPhone: "0800-724.84.51",
    zone: "Nacional · Sede: Bello Monte, Caracas",
    note: "Para una emergencia, marca 911 (canal confirmado). El 0800 está pendiente de verificación oficial.",
    tier: "unverified",
  },
  {
    id: "funvisis",
    name: "FUNVISIS — Información sísmica",
    type: "sismologia",
    dial: [],
    unverifiedPhone: "0212-257.51.53",
    zone: "El Llanito, Caracas",
    note: "Información sísmica y científica, NO es línea de emergencia médica. Para emergencias, marca 911.",
    tier: "unverified",
  },
  {
    id: "hospital-universitario-caracas",
    name: "Hospital Universitario de Caracas (HUC)",
    type: "hospital",
    dial: [],
    zone: "Los Chaguaramos, Municipio Libertador",
    address:
      "Ciudad Universitaria de Caracas (UCV), Los Chaguaramos. Emergencia 24 h (adultos y pediátrica).",
    note: "Acude directo a Emergencia o marca 911. Teléfono no verificado oficialmente.",
    tier: "unverified",
  },
  {
    id: "hospital-domingo-luciani",
    name: "Hospital Dr. Domingo Luciani",
    type: "hospital",
    dial: [],
    zone: "El Llanito (límite con Petare)",
    address: "Final Av. Río de Janeiro, El Llanito. Emergencia 24 h.",
    note: "Acude directo a Emergencia o marca 911. Teléfono no verificado oficialmente.",
    tier: "unverified",
  },
  {
    id: "hospital-jm-de-los-rios",
    name: "Hospital de Niños J.M. de los Ríos",
    type: "hospital",
    dial: [],
    zone: "San Bernardino, Caracas",
    address: "Av. Vollmer, San Bernardino. Hospital pediátrico de referencia.",
    note: "Acude directo a Emergencia o marca 911. Teléfono no verificado oficialmente.",
    tier: "unverified",
  },
  {
    id: "hospital-vargas",
    name: "Hospital José María Vargas de Caracas",
    type: "hospital",
    dial: [],
    zone: "Centro de Caracas (San José)",
    address:
      "Calle Real de Carballo, sector San José, Municipio Libertador. Emergencia 24 h.",
    note: "Acude directo a Emergencia o marca 911. Teléfono no verificado oficialmente.",
    tier: "unverified",
  },
  {
    id: "hospital-carlos-arvelo",
    name: "Hospital Militar Dr. Carlos Arvelo",
    type: "hospital",
    dial: [],
    zone: "San Martín, Municipio Libertador",
    address: "Av. José Ángel Lamas, Urb. San Martín. Emergencia 24 h.",
    note: "Acude directo a Emergencia o marca 911. Teléfono no verificado oficialmente.",
    tier: "unverified",
  },
  {
    id: "hospital-jose-gregorio-catia",
    name: "Hospital Gral. del Oeste J. G. Hernández (Catia)",
    type: "hospital",
    dial: [],
    zone: "Los Magallanes de Catia, oeste de Caracas",
    address: "Av. La Laguna, Los Magallanes de Catia, Parroquia Sucre.",
    note: "Acude directo a Emergencia o marca 911. Teléfono no verificado oficialmente.",
    tier: "unverified",
  },
];
