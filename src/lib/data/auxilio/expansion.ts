/**
 * GENERADO desde el workflow de investigación+verificación (auxilio-biblioteca-expansion).
 * 11 procedimientos verificados (accurate, cero invención). agua-sodis se descartó
 * (invención: afirmaba que el vidrio bloquea UV-A). No editar a mano: regenerar con
 * scripts/gen-expansion.mjs si hace falta.
 */
import type { Procedure, Source } from "./types";

export const EXPANSION_SOURCES: Record<string, Source> = {
  "organizacion-mundial": {
    id: "organizacion-mundial",
    org: "Organización Mundial de la Salud (OMS/WHO)",
    title:
      "Cholera outbreaks – Q&A (receta de suero oral casero: 1 litro de agua segura, 6 cucharaditas de azúcar y media cucharadita de sal)",
    url: "https://www.who.int/news-room/questions-and-answers/item/cholera-outbreaks",
  },
  "oms-humanitarian": {
    id: "oms-humanitarian",
    org: "OMS / Humanitarian Health Care Manual (NCBI Bookshelf)",
    title:
      "Diarrhoea and dehydration – señales de deshidratación, cantidades de suero tras cada evacuación y qué hacer si vomita",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK143745/",
  },
  "unicef-supply": {
    id: "unicef-supply",
    org: "UNICEF Supply Division",
    title:
      "Oral rehydration salts (ORS) and zinc – uso de SRO y zinc en diarrea infantil",
    url: "https://www.unicef.org/supply/oral-rehydration-salts-ors-and-zinc",
  },
  "cdc-centros": {
    id: "cdc-centros",
    org: "CDC (Centros para el Control y la Prevención de Enfermedades, EE.UU.)",
    title:
      "Cholera – Signs and Symptoms (señales de deshidratación grave y cuándo buscar atención)",
    url: "https://www.cdc.gov/cholera/signs-symptoms/index.html",
  },
  "oms-unicef": {
    id: "oms-unicef",
    org: "OMS / UNICEF",
    title:
      "WHO/UNICEF Joint Statement: Clinical Management of Acute Diarrhoea (SRO de baja osmolaridad + zinc, seguir alimentando)",
    url: "https://data.unicef.org/wp-content/uploads/2021/07/WHO-UNICEF_JOint-Statement_clinical-management-of-acurte-diarrhoea.pdf",
  },
  "cruz-roja": {
    id: "cruz-roja",
    org: "Cruz Roja Americana (American Red Cross)",
    title: "Allergic Reaction / Anaphylaxis: Causes, Symptoms, How To Help",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/allergic-reaction-anaphylaxis",
  },
  "mayo-clinic": {
    id: "mayo-clinic",
    org: "Mayo Clinic",
    title: "Anaphylaxis: First aid",
    url: "https://www.mayoclinic.org/first-aid/first-aid-anaphylaxis/basics/art-20056608",
  },
  "world-allergy": {
    id: "world-allergy",
    org: "World Allergy Organization (WAO)",
    title: "World Allergy Organization Anaphylaxis Guidance 2020",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7607509/",
  },
  "ccohs-centro": {
    id: "ccohs-centro",
    org: "CCOHS (Centro Canadiense de Salud y Seguridad Ocupacional)",
    title: "First Aid - Using an Epinephrine Auto-injector",
    url: "https://www.ccohs.ca/oshanswers/hsprograms/firstaid/firstaid_epinephrine.html",
  },
  "mayo-clinic-2": {
    id: "mayo-clinic-2",
    org: "Mayo Clinic",
    title: "Poisoning: First aid",
    url: "https://www.mayoclinic.org/first-aid/first-aid-poisoning/basics/art-20056657",
  },
  "poison-control": {
    id: "poison-control",
    org: "Poison Control (America's Poison Centers)",
    title: "First Aid: Act Fast!",
    url: "https://www.poison.org/first-aid-for-poisonings",
  },
  "american-red": {
    id: "american-red",
    org: "American Red Cross",
    title: "Poison Exposure: Signs, Symptoms, and First Aid",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/poison-exposure",
  },
  "poison-help": {
    id: "poison-help",
    org: "Poison Help (HRSA)",
    title: "Calling Poison Help: What to have ready",
    url: "https://poisonhelp.hrsa.gov/faq/calling-poison-help",
  },
  "merck-manual": {
    id: "merck-manual",
    org: "Merck Manual (Consumer Version)",
    title: "Caustic Chemicals Poisoning",
    url: "https://www.merckmanuals.com/home/injuries-and-poisoning/poisoning/caustic-chemicals-poisoning",
  },
  "organizacion-mundial-2": {
    id: "organizacion-mundial-2",
    org: "Organización Mundial de la Salud (OMS)",
    title: "Snakebite envenoming",
    url: "https://www.who.int/health-topics/snakebite",
  },
  "mayo-clinic-3": {
    id: "mayo-clinic-3",
    org: "Mayo Clinic",
    title: "Snakebites: First aid",
    url: "https://www.mayoclinic.org/first-aid/first-aid-snake-bites/basics/art-20056681",
  },
  "american-red-2": {
    id: "american-red-2",
    org: "American Red Cross (Cruz Roja Americana)",
    title: "Snake Bites: Symptoms, Causes, and Treatment",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/venomous-snake-bites",
  },
  "cdc-niosh": {
    id: "cdc-niosh",
    org: "CDC / NIOSH",
    title: "Insects and Scorpions at Work",
    url: "https://www.cdc.gov/niosh/outdoor-workers/about/insects-and-scorpions.html",
  },
  "universidad-central": {
    id: "universidad-central",
    org: "Universidad Central de Venezuela (UCV) - SOS Telemedicina",
    title: "Escorpiones: ¿Qué hacer en caso de emponzoñamiento?",
    url: "https://sostelemedicina.ucv.ve/escorpio/escorpio.php?module=aspectos_des&id=10",
  },
  "cruz-roja-2": {
    id: "cruz-roja-2",
    org: "Cruz Roja Americana (American Red Cross)",
    title: "Bleeding (Life-Threatening External)",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/bleeding-life-threatening-external",
  },
  "mayo-clinic-4": {
    id: "mayo-clinic-4",
    org: "Mayo Clinic",
    title: "Foreign object in the skin: First aid",
    url: "https://www.mayoclinic.org/first-aid/first-aid/basics/art-20056604",
  },
  "mayo-clinic-5": {
    id: "mayo-clinic-5",
    org: "Mayo Clinic",
    title: "Puncture wounds: First aid",
    url: "https://www.mayoclinic.org/first-aid/first-aid-puncture-wounds/basics/art-20056665",
  },
  "st-john": {
    id: "st-john",
    org: "St John Ambulance (St John Victoria)",
    title: "How to provide first aid to a major wound",
    url: "https://www.stjohnvic.com.au/news/provide-first-aid-major-wound/",
  },
  "cleveland-clinic": {
    id: "cleveland-clinic",
    org: "Cleveland Clinic",
    title: "Puncture Wound",
    url: "https://my.clevelandclinic.org/health/diseases/puncture-wound",
  },
  "cdc-centros-2": {
    id: "cdc-centros-2",
    org: "CDC (Centros para el Control y la Prevención de Enfermedades) — HEADS UP",
    title:
      "Signs and Symptoms of Concussion (señales de peligro, incluye bebés y niños)",
    url: "https://www.cdc.gov/heads-up/signs-symptoms/index.html",
  },
  "cdc-traumatic": {
    id: "cdc-traumatic",
    org: "CDC — Traumatic Brain Injury & Concussion",
    title:
      "Recovering from a Mild Traumatic Brain Injury or Concussion (reposo, vigilancia 24 h, señales de peligro)",
    url: "https://www.cdc.gov/traumatic-brain-injury/media/pdfs/2024/05/patient_discharge_instructions_ENG-508.pdf",
  },
  "mayo-clinic-6": {
    id: "mayo-clinic-6",
    org: "Mayo Clinic",
    title:
      "Head trauma: First aid (mantener quieto, no mover el cuello, pupila desigual, líquido por nariz/oídos)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-head-trauma/basics/art-20056626",
  },
  "american-red-3": {
    id: "american-red-3",
    org: "American Red Cross (Cruz Roja Americana)",
    title:
      "Concussion: Symptoms, Causes, and Treatment (reposo, llamar al 911, evitar analgésicos, vigilar a la persona)",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/concussion",
  },
  "kaiser-permanente": {
    id: "kaiser-permanente",
    org: "Kaiser Permanente (guía de cuidado basada en consenso CDC)",
    title:
      "Concussion (Mild Traumatic Brain Injury): Care Instructions (hielo 10–20 min con paño, no alcohol, vigilar 24 h)",
    url: "https://healthy.kaiserpermanente.org/health-wellness/health-encyclopedia/he.concussion-mild-traumatic-brain-injury-care-instructions.uf7532",
  },
  "mayo-clinic-7": {
    id: "mayo-clinic-7",
    org: "Mayo Clinic",
    title: "Nosebleeds: First aid",
    url: "https://www.mayoclinic.org/first-aid/first-aid-nosebleeds/basics/art-20056683",
  },
  "cleveland-clinic-2": {
    id: "cleveland-clinic-2",
    org: "Cleveland Clinic",
    title: "6 Steps To Stop a Nosebleed",
    url: "https://health.clevelandclinic.org/how-to-stop-a-nosebleed",
  },
  "cleveland-clinic-3": {
    id: "cleveland-clinic-3",
    org: "Cleveland Clinic",
    title: "When To Worry About a Nosebleed: Is It Serious?",
    url: "https://health.clevelandclinic.org/do-you-get-too-many-nosebleeds-when-to-worry",
  },
  "american-academy": {
    id: "american-academy",
    org: "American Academy of Otolaryngology–Head and Neck Surgery (AAO-HNS)",
    title: "Clinical Practice Guideline: Nosebleed (Epistaxis)",
    url: "https://www.entnet.org/quality-practice/quality-products/clinical-practice-guidelines/nosebleed-epistaxis/",
  },
  "american-red-4": {
    id: "american-red-4",
    org: "American Red Cross",
    title: "Nosebleed (Epistaxis)",
    url: "https://www.redcross.org/take-a-class/resources/learn-first-aid/nosebleeds",
  },
  "medlineplus-biblioteca": {
    id: "medlineplus-biblioteca",
    org: "MedlinePlus (Biblioteca Nacional de Medicina de EE. UU.)",
    title: "Inhalation Injuries / Lesiones por inhalación",
    url: "https://medlineplus.gov/inhalationinjuries.html",
  },
  "manual-msd": {
    id: "manual-msd",
    org: "Manual MSD (versión para público general)",
    title: "Inhalación de humo",
    url: "https://www.msdmanuals.com/es/hogar/traumatismos-y-envenenamientos/quemaduras/inhalaci%C3%B3n-de-humo",
  },
  "cleveland-clinic-4": {
    id: "cleveland-clinic-4",
    org: "Cleveland Clinic",
    title: "Smoke Inhalation: Symptoms & When To Be Concerned",
    url: "https://my.clevelandclinic.org/health/diseases/smoke-inhalation",
  },
  "american-red-5": {
    id: "american-red-5",
    org: "American Red Cross / Cruz Roja Americana",
    title: "Smoke Inhalation (first aid guidance)",
    url: "https://www.redcross.org/take-a-class/resources/learn-pet-first-aid/dog/smoke-inhalation",
  },
  "cdc-centros-3": {
    id: "cdc-centros-3",
    org: "CDC (Centros para el Control y la Prevención de Enfermedades, EE. UU.)",
    title:
      "Emergency Wound Care After a Natural Disaster (Cuidado de heridas de emergencia después de un desastre natural)",
    url: "https://www.cdc.gov/natural-disasters/communication-resources/emergency-wound-care-after-a-natural-disaster-factsheet.html",
  },
  "cdc-centros-4": {
    id: "cdc-centros-4",
    org: "CDC (Centros para el Control y la Prevención de Enfermedades, EE. UU.)",
    title:
      "Safety Guidelines: Floodwater (Heridas abiertas y agua de inundación)",
    url: "https://www.cdc.gov/floods/safety/floodwater-after-a-disaster-or-emergency-safety.html",
  },
  "cdc-centros-5": {
    id: "cdc-centros-5",
    org: "CDC (Centros para el Control y la Prevención de Enfermedades, EE. UU.)",
    title:
      "About Tetanus / Clinical Guidance for Wound Management to Prevent Tetanus (Tétanos: heridas de riesgo y vacuna)",
    url: "https://www.cdc.gov/tetanus/hcp/clinical-guidance/index.html",
  },
  "mayo-clinic-8": {
    id: "mayo-clinic-8",
    org: "Mayo Clinic",
    title: "Cuts and scrapes: First aid (Cortes y raspones: primeros auxilios)",
    url: "https://www.mayoclinic.org/first-aid/first-aid-cuts/basics/art-20056711",
  },
  "oms-organizacion": {
    id: "oms-organizacion",
    org: "OMS (Organización Mundial de la Salud)",
    title:
      "Prevention and management of wound infection (Prevención y manejo de la infección de heridas)",
    url: "https://www.who.int/publications/i/item/prevention-and-management-of-wound-infection",
  },
  "oms-who": {
    id: "oms-who",
    org: "OMS / WHO",
    title:
      "Cholera (fact sheet): WASH, lavado de manos con jabón, agua y alimentos seguros, disposición segura de heces, y atención urgente ante diarrea acuosa grave",
    url: "https://www.who.int/news-room/fact-sheets/detail/cholera",
  },
  "oms-who-2": {
    id: "oms-who-2",
    org: "OMS / WHO",
    title:
      "Five keys to safer food (Cinco claves para la inocuidad de los alimentos)",
    url: "https://www.who.int/activities/promoting-safe-food-handling/five-key-to-safer-food",
  },
  "ops-paho": {
    id: "ops-paho",
    org: "OPS / PAHO",
    title:
      "PAHO/WHO recommends five keys to safer food (separar crudo/cocido, cocer bien, no dejar comida >2h, agua segura)",
    url: "https://www.paho.org/en/news/21-12-2015-pahowho-recommends-five-keys-safer-food-healthy-holiday-season",
  },
  cdc: {
    id: "cdc",
    org: "CDC",
    title:
      "Global Hygiene (lavado de manos con jabón al menos 20 segundos; momentos clave)",
    url: "https://www.cdc.gov/global-water-sanitation-hygiene/about/about-global-hygiene.html",
  },
  "cdc-2": {
    id: "cdc-2",
    org: "CDC",
    title:
      "Water Disinfection for Travelers (hervir 1 minuto; SODIS: botella transparente, 6 horas al sol o 2 días si está nublado; aclarar agua turbia primero)",
    url: "https://www.cdc.gov/yellow-book/hcp/preparing-international-travelers/water-disinfection-for-travelers.html",
  },
  "cdc-3": {
    id: "cdc-3",
    org: "CDC",
    title:
      "How to make oral rehydration solution (ORS): 1 litro de agua, 6 cucharaditas rasas de azúcar, 1/2 cucharadita de sal",
    url: "https://www.cdc.gov/global-water-sanitation-hygiene/media/pdfs/ors_seasia_508.pdf",
  },
  "sphere-emergency": {
    id: "sphere-emergency",
    org: "Sphere / Emergency WASH (basado en OMS)",
    title:
      "Minimum standards in Water Supply, Sanitation and Hygiene: letrinas a ≥30 m de fuentes de agua",
    url: "https://handbook.spherestandards.org/",
  },
  "ops-oms": {
    id: "ops-oms",
    org: "OPS/OMS (PAHO)",
    title: "Dengue: síntomas, prevención y tratamiento (Dengue topic page)",
    url: "https://www.paho.org/en/topics/dengue",
  },
  "ops-oms-2": {
    id: "ops-oms-2",
    org: "OPS/OMS (PAHO)",
    title: "Vector Control in Disaster Situations",
    url: "https://www.paho.org/en/health-emergencies/vector-control-disaster-situations",
  },
  "oms-who-3": {
    id: "oms-who-3",
    org: "OMS (WHO)",
    title: "Dengue and severe dengue – Fact sheet",
    url: "https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue",
  },
  "cdc-4": {
    id: "cdc-4",
    org: "CDC",
    title: "Preventing Dengue",
    url: "https://www.cdc.gov/dengue/prevention/index.html",
  },
  "cdc-5": {
    id: "cdc-5",
    org: "CDC",
    title:
      "Manage Dengue (treatment: usar acetaminofén, no aspirina ni ibuprofeno)",
    url: "https://www.cdc.gov/dengue/treatment/index.html",
  },
  "cdc-6": {
    id: "cdc-6",
    org: "CDC",
    title: "Severe Dengue: Know the Warning Signs",
    url: "https://www.cdc.gov/dengue/stories/severe-dengue.html",
  },
  "cdc-7": {
    id: "cdc-7",
    org: "CDC",
    title: "Preventing Mosquito Bites (repelente, ropa, mallas, mosquiteros)",
    url: "https://www.cdc.gov/mosquitoes/prevention/index.html",
  },
};

export const EXPANSION_FIRST_AID: Procedure[] = [
  {
    id: "anafilaxia",
    title: "Reacción alérgica grave (anafilaxia): qué hacer",
    summary:
      "Emergencia mortal en minutos por una alergia severa. Usa esto cuando alguien, tras comer algo, una picadura o un medicamento, empieza a hincharse, le cuesta respirar o se desmaya.",
    steps: [
      "Reconoce las señales de alarma: hinchazón de cara, labios, lengua o garganta; ronchas o sarpullido con picazón; dificultad para respirar o tragar; silbidos al respirar (sibilancias); mareo o desmayo; vómito o diarrea; pulso débil y rápido; y a veces una fuerte sensación de que algo muy malo va a pasar.",
      "Llama YA al 911 (o al número de emergencia local). Di claramente: 'es una reacción alérgica grave, anafilaxia, y puede necesitar epinefrina'. No esperes a ver si mejora sola.",
      "Si la persona tiene un autoinyector de epinefrina (tipo EpiPen), ayúdala a usarlo de inmediato, antes de que empeore. Se aplica presionándolo con firmeza contra la parte de afuera, en el medio del muslo (puede ser por encima de la ropa). Mantenlo presionado unos segundos según las instrucciones del aparato.",
      "Acuesta a la persona boca arriba y que se quede quieta; si puedes, levántale un poco las piernas. Esto ayuda a que no le baje la presión de golpe.",
      "Si le cuesta mucho respirar, déjala sentarse en la posición que le sea más cómoda. Si está vomitando o sangra por la boca, ponla de lado para que no se ahogue.",
      "Afloja la ropa apretada y cúbrela con una manta para mantenerla abrigada mientras llega la ayuda.",
      "Si después de unos 5 minutos no mejora (y no antes), la ayuda médica aún no llega y hay un segundo autoinyector disponible, aplica una segunda dosis en el muslo.",
      "Si la persona deja de respirar, no responde y no se mueve, empieza RCP (reanimación): compresiones fuertes y rápidas en el centro del pecho, de 100 a 120 por minuto, sin parar hasta que llegue la ayuda.",
      "Aunque la persona mejore, debe ir al hospital igual: los síntomas pueden volver horas después.",
    ],
    dont: [
      "No la hagas pararse ni caminar de golpe, ni la sientes bruscamente: el cambio brusco a estar de pie o sentada puede causar un paro y muerte súbita en la anafilaxia.",
      "No le des nada de beber ni medicinas por la boca si le cuesta respirar o tragar (riesgo de ahogo).",
      "No esperes 'a ver si se le pasa' para llamar al 911 ni para usar la epinefrina: cada minuto cuenta.",
      "No tengas miedo de usar el autoinyector de epinefrina en el muslo: es el tratamiento que salva la vida.",
      "No dejes sola a la persona; quédate vigilando su respiración hasta que llegue la ayuda.",
    ],
    callEmergency: [
      "Llama al 911 SIEMPRE ante una reacción alérgica grave: la anafilaxia puede matar en minutos.",
      "Llama de inmediato si hay hinchazón de cara, labios, lengua o garganta, dificultad para respirar o tragar, o silbidos al respirar.",
      "Llama si la persona se desmaya, se ve muy mareada, pálida o con pulso débil y rápido.",
      "Aunque ya hayas usado la epinefrina y mejore, igual debe ser vista por personal médico: los síntomas pueden regresar.",
    ],
    sources: ["cruz-roja", "mayo-clinic", "world-allergy", "ccohs-centro"],
  },
  {
    id: "intoxicacion-envenenamiento",
    title:
      "Si alguien se tragó algo tóxico (químicos, limpieza, medicinas, plantas)",
    summary:
      "Qué hacer cuando una persona tragó un veneno o producto peligroso: aleja, averigua qué fue, llama a emergencias y sigue sus indicaciones; NUNCA hagas vomitar por tu cuenta.",
    steps: [
      "Aleja a la persona de lo que la intoxicó. Si fue un gas o humo (por ejemplo cloro mezclado), sácala al aire libre. Si quedó algo en la boca, retíralo con cuidado con los dedos.",
      "Averigua qué tragó y cuánto, y desde hace cuánto tiempo. Guarda el envase, la botella, la caja o la planta para mostrárselos a quien te ayude: la etiqueta tiene información importante.",
      "Llama de inmediato a emergencias o a un centro de toxicología. Ten a mano: el nombre del producto, cuánto se tragó, hace cuánto pasó, y la edad y el peso de la persona. (En EE. UU., la línea de ayuda por envenenamiento es 1-800-222-1222.)",
      "Sigue al pie de la letra lo que te indiquen por teléfono. Ellos saben qué hacer según lo que tragó. No hagas nada por tu cuenta antes de escucharlos.",
      "Si la persona está inconsciente pero respira, recuéstala de costado (de lado), con la cabeza un poco hacia abajo, para que no se ahogue si vomita. Quédate con ella y vigila que siga respirando.",
      "Si la persona vomita por sí sola, voltéale la cabeza hacia un lado para que no se atragante. No la obligues a vomitar.",
      "Si deja de respirar o no responde, llama al 911 y empieza RCP si sabes hacerlo, hasta que llegue la ayuda.",
    ],
    dont: [
      "NO la hagas vomitar, salvo que un profesional te lo indique. Muchos químicos corrosivos (cloro, destapacaños, ácidos, limpiadores fuertes) queman de nuevo la garganta y el esófago al subir, y empeoran el daño.",
      "NO uses jarabe de ipecacuana ni ningún remedio para provocar el vómito. Ya no se recomienda.",
      "NO le des leche, agua, sal, ni 'remedios caseros' por tu cuenta. Dáselos solo si un profesional o el centro de toxicología te lo indica.",
      "NO le des nada por la boca si está inconsciente, con convulsiones o no puede tragar: se puede ahogar.",
      "NO intentes 'neutralizar' el veneno con vinagre, limón, bicarbonato u otra cosa.",
      "NO esperes a que aparezcan síntomas para pedir ayuda: llama de una vez.",
      "NO entres a un espacio cerrado lleno de gas o humo para rescatar sin protección: puedes intoxicarte tú también. Espera a los bomberos.",
    ],
    callEmergency: [
      "Llama al 911 si la persona está adormilada, no se despierta o está inconsciente.",
      "Llama al 911 si tiene dificultad para respirar o dejó de respirar.",
      "Llama al 911 si tiene convulsiones (ataques).",
      "Llama al 911 si está muy inquieta, agitada o desorientada.",
      "Llama al 911 si tragó algo a propósito o tomó una sobredosis de medicinas.",
      "Si no estás seguro de la gravedad, llama igual al centro de toxicología o a emergencias: la llamada es gratis y te orientan.",
    ],
    sources: [
      "mayo-clinic-2",
      "poison-control",
      "american-red",
      "poison-help",
      "merck-manual",
    ],
  },
  {
    id: "mordedura-serpiente",
    title: "Mordedura de serpiente o picadura de alacrán (escorpión)",
    summary:
      "Toda mordedura de serpiente o picadura de alacrán es una emergencia: lleva a la persona al hospital de inmediato para el suero (antiveneno). Mantenla quieta y calmada mientras tanto.",
    steps: [
      "Aléjate de la serpiente o el alacrán. No trates de atraparlo ni de matarlo: pierdes tiempo y te puedes lastimar.",
      "Mantén a la persona quieta, sentada o acostada, y muy calmada. Moverse hace que el veneno se reparta más rápido por el cuerpo.",
      "Quítale anillos, reloj, pulseras y ropa apretada cerca de la zona mordida ANTES de que empiece a hincharse.",
      "Deja la parte mordida quieta y a la altura del corazón o un poco más abajo. No dejes que la persona camine si no es absolutamente necesario.",
      "Si puedes, lava la herida con agua y jabón y cúbrela sin apretar con un paño o vendaje limpio y seco.",
      "Trata de recordar el color y la forma de la serpiente o el alacrán (solo si lo puedes ver sin acercarte). Eso ayuda al médico, pero NO lo persigas para mirarlo.",
      "Lleva a la persona al hospital o centro de salud YA. El único tratamiento real es el suero (antiveneno) que se pone bajo supervisión médica. Mientras más rápido llegue, mejor.",
      "Si la persona vomita, ponla de lado (sobre el lado izquierdo) para que no se ahogue. Vigila que siga respirando.",
    ],
    dont: [
      "NO pongas torniquete ni amarres la zona para 'cortar la sangre'.",
      "NO cortes la herida con cuchillo ni navaja.",
      "NO chupes ni succiones el veneno con la boca ni con ningún aparato.",
      "NO pongas hielo sobre una mordedura de serpiente.",
      "NO le des alcohol ni bebidas con cafeína (café, energizantes).",
      "NO le des aspirina, ibuprofeno ni naproxeno: pueden aumentar el sangrado (puedes dar paracetamol para el dolor si el médico lo indica).",
      "NO uses remedios caseros, hierbas, rezos ni 'piedras negras': no sirven y hacen perder tiempo valioso.",
      "NO persigas ni trates de capturar a la serpiente o el alacrán para identificarlo: solo recuerda cómo era.",
    ],
    callEmergency: [
      "SIEMPRE. Toda mordedura de serpiente se trata como emergencia: llama al 911 o ve al hospital de inmediato, aunque la persona se sienta bien al principio.",
      "Toda picadura de alacrán: busca atención médica de una vez, sin esperar a que aparezcan mareos, vómitos, sudoración o latidos rápidos (especialmente en niños).",
      "Llama al 911 urgente si hay: dificultad para respirar o tragar, babeo o saliva excesiva, hinchazón que crece rápido, dolor muy fuerte, vómitos, convulsiones, temblores, visión borrosa o si la persona se desmaya.",
      "Los niños corren más riesgo y se complican más rápido que los adultos: trasládalos sin perder tiempo.",
    ],
    sources: [
      "organizacion-mundial-2",
      "mayo-clinic-3",
      "american-red-2",
      "cdc-niosh",
      "universidad-central",
    ],
  },
  {
    id: "objeto-clavado",
    title: "Herida con un objeto clavado (no lo saques)",
    summary:
      "Qué hacer cuando algo quedó clavado en el cuerpo (cuchillo, varilla, vidrio, escombro): déjalo puesto, sujétalo para que no se mueva y llama al 911.",
    steps: [
      "NO saques el objeto. Aunque cause miedo verlo, déjalo donde está. Muchas veces el objeto está tapando una vena o arteria y, si lo sacas, la persona puede sangrar mucho más.",
      "Llama YA al 911 (o al número de emergencia de tu zona). Pide ayuda de inmediato; este tipo de herida siempre necesita atención médica profesional.",
      "Mantén a la persona lo más quieta posible y tranquilízala. Mientras menos se mueva, menos se mueve el objeto y menos daño hace.",
      "Si la herida sangra, haz presión a los LADOS de la herida, alrededor del objeto, nunca encima de él. Usa una tela limpia o gasa doblada en cada lado.",
      "Sujeta el objeto para que no se mueva: pon trapos o vendas enrollados alrededor del objeto, a ambos lados, como un soporte. Luego envuélvelos con una venda o tela para que el objeto quede firme y no se incline ni gire.",
      "No vendes por encima del objeto ni lo aprietes. La venda solo debe sostener los trapos que están a los lados.",
      "Cubre a la persona con una manta o ropa para que no pase frío y quédate con ella, hablándole con calma, hasta que llegue la ayuda.",
      "Vigila a la persona: si se pone pálida, fría, con sudor frío, muy débil o confundida, avísalo al 911, porque puede ser señal de que está perdiendo mucha sangre.",
    ],
    dont: [
      "No saques el objeto clavado por ningún motivo: eso lo debe hacer solo personal médico.",
      "No hagas presión encima del objeto; presiona solo a los lados, alrededor de la herida.",
      "No muevas ni jales el objeto, ni lo gires para 'acomodarlo'.",
      "No muevas de más a la persona ni la hagas caminar si no es necesario.",
      "No metas los dedos ni nada dentro de la herida para revisar.",
      "No le des de comer ni de beber, por si necesita cirugía.",
    ],
    callEmergency: [
      "Llama al 911 SIEMPRE que haya un objeto clavado en el cuerpo: es una emergencia.",
      "Llama de inmediato si la herida sangra mucho o el sangrado no se detiene aunque hagas presión a los lados.",
      "Llama si el objeto está clavado en la cabeza, cuello, pecho, abdomen o cerca de los ojos o los genitales.",
      "Llama si la persona se pone pálida, fría, sudorosa, muy débil, mareada o confundida (posible pérdida grave de sangre).",
      "Busca atención médica aunque la herida se vea pequeña: por dentro puede ser más profunda y puede infectarse.",
    ],
    sources: [
      "cruz-roja-2",
      "mayo-clinic-4",
      "mayo-clinic-5",
      "st-john",
      "cleveland-clinic",
    ],
  },
  {
    id: "golpe-cabeza",
    title: "Golpe en la cabeza (posible conmoción cerebral)",
    summary:
      "Qué hacer ante un golpe en la cabeza y las señales de alarma que obligan a buscar ayuda de emergencia de inmediato.",
    steps: [
      "Si la persona se golpeó fuerte la cabeza, el cuello o la espalda (por ejemplo en un derrumbe) y NO puedes descartar lesión de cuello o columna: NO la muevas. Déjala en la posición en que la encontraste y mantén su cabeza quieta, salvo que esté en peligro inmediato (fuego, agua, derrumbe). No le muevas el cuello.",
      "Mantén a la persona quieta y en reposo. Si está acostada, puede estar con la cabeza y los hombros un poco elevados. Que descanse y no siga moviéndose ni haciendo esfuerzos.",
      "Si hay un chichón o hinchazón, ponle frío: una bolsa de hielo o algo frío envuelto en un paño limpio, NUNCA el hielo directo sobre la piel. Déjalo de 10 a 20 minutos cada vez. Puedes repetir cada pocas horas las primeras 24 a 48 horas.",
      "Si hay una herida que sangra, presiona suave con un paño limpio o gasa. No presiones fuerte si sospechas que hay hundimiento o fractura del cráneo.",
      "Vigila a la persona de cerca por lo menos durante las primeras 24 horas (mejor 24 a 48 horas). Quédate con ella y revísala seguido: que esté despierta, que responda, que respire bien y que se comporte normal. Los síntomas pueden aparecer horas o incluso días después.",
      "Que descanse el cuerpo y la mente esos primeros días: dormir bien, evitar esfuerzos físicos o mentales grandes, pantallas y ruido fuerte si la molestan.",
      "Si en cualquier momento aparece UNA de las señales de alarma de la lista de abajo, busca atención de emergencia o llama al 911 de inmediato.",
    ],
    dont: [
      "NO dejes sola a la persona durante las primeras horas: necesita que alguien la vigile por si empeora.",
      "NO le des bebidas alcohólicas ni drogas: pueden ocultar o empeorar las señales de una lesión grave.",
      "NO le des calmantes para el dolor por tu cuenta (como ciertos analgésicos): pueden tapar las señales de alarma. Que los indique un personal de salud.",
      "NO le muevas el cuello ni la cabeza si sospechas lesión de cuello o columna, ni la sacudas para 'despertarla'.",
      "NO pongas el hielo directo sobre la piel: siempre envuelto en un paño.",
      "NO ignores las señales de alarma ni esperes 'a ver si se le pasa'. Aunque la persona parezca estar bien al principio, puede empeorar después.",
    ],
    callEmergency: [
      "Llama al 911 o busca atención de emergencia de inmediato si después del golpe aparece cualquiera de estas señales:",
      "Pérdida del conocimiento (se desmayó o quedó inconsciente), aunque haya sido por poco tiempo.",
      "Vómitos repetidos (especialmente si vomita una y otra vez por más de 30 minutos).",
      "Confusión que aumenta, no reconoce a las personas o los lugares, o un comportamiento extraño, inquieto o agitado.",
      "Somnolencia anormal: muy dormido, cuesta despertarlo o no logra mantenerse despierto.",
      "Dolor de cabeza que empeora y no se le quita.",
      "Convulsiones o ataques (temblores o sacudidas del cuerpo).",
      "Una pupila más grande que la otra, o ve doble / cambios en la vista.",
      "Habla enredada (arrastra las palabras), debilidad, hormigueo o pérdida de coordinación o de equilibrio.",
      "Sale sangre o un líquido transparente por la nariz o los oídos.",
      "En un bebé o niño pequeño: llora sin parar y no se calma, o no quiere comer ni tomar pecho.",
    ],
    sources: [
      "cdc-centros-2",
      "cdc-traumatic",
      "mayo-clinic-6",
      "american-red-3",
      "kaiser-permanente",
    ],
  },
  {
    id: "sangrado-nariz",
    title: "Sangrado de nariz (epistaxis)",
    summary:
      "Cómo detener un sangrado de nariz: siéntate, inclina la cabeza hacia adelante y aprieta la parte blanda de la nariz por 10 a 15 minutos sin soltar.",
    steps: [
      "Siéntate y mantén la calma. Inclina la cabeza un poco hacia ADELANTE (no hacia atrás). Así la sangre sale por la nariz y no baja por la garganta.",
      "Con dos dedos (pulgar e índice) aprieta la parte blanda de la nariz, justo abajo del hueso. Aprieta las dos fosas juntas.",
      "Mantén apretado de forma continua por 10 a 15 minutos. No sueltes para revisar, porque el sangrado puede empezar de nuevo. Si tienes reloj o celular, mide el tiempo.",
      "Mientras aprietas, respira por la boca.",
      "Puedes ponerte algo frío (una bolsa de hielo envuelta en un paño) sobre el puente de la nariz para ayudar a que el sangrado pare más rápido. Es opcional.",
      "A los 10 a 15 minutos, suelta despacio y revisa. Si sigue sangrando, vuelve a apretar otros 10 a 15 minutos sin soltar.",
      "Cuando pare, evita sonarte, tocarte o hurgarte la nariz por varias horas, y no levantes cosas pesadas, para que no vuelva a sangrar.",
    ],
    dont: [
      "NO inclines la cabeza hacia atrás ni te acuestes boca arriba: la sangre baja por la garganta hasta el estómago y puede dar náuseas, vómito o atragantamiento.",
      "NO sueltes la nariz antes de tiempo solo para revisar; eso reinicia el sangrado.",
      "NO te suenes la nariz, no te hurgues ni te frotes la nariz mientras sangra ni en las horas siguientes.",
      "NO levantes peso ni hagas esfuerzo fuerte mientras o justo después del sangrado.",
    ],
    callEmergency: [
      "El sangrado no para después de 20 a 30 minutos apretando bien.",
      "El sangrado es muy abundante o sientes que te tragas mucha sangre.",
      "El sangrado vino por un golpe fuerte o accidente y sospechas que la nariz está rota.",
      "La persona toma medicinas para adelgazar la sangre (anticoagulantes, como warfarina o aspirina en dosis altas).",
      "La persona se siente mareada, débil, a punto de desmayarse o tiene dificultad para respirar.",
    ],
    sources: [
      "mayo-clinic-7",
      "cleveland-clinic-2",
      "cleveland-clinic-3",
      "american-academy",
      "american-red-4",
    ],
  },
  {
    id: "inhalacion-humo",
    title: "Inhalación de humo (incendio después del sismo)",
    summary:
      "Qué hacer cuando alguien respiró humo de un incendio: sácalo al aire fresco solo si es seguro, llama al 911 y vigila su respiración.",
    steps: [
      "1. Primero, tu seguridad. NO entres a un lugar lleno de humo ni a un edificio en llamas si te pones en peligro. Si arriesgas tu vida, espera a los bomberos o rescatistas.",
      "2. Si es seguro hacerlo, saca a la persona del humo y llévala al aire fresco (afuera o a un lugar bien ventilado) lo más rápido posible.",
      "3. Llama al 911 (o al número de emergencia local). Avisa que hubo humo de un incendio y describe cómo está respirando la persona.",
      "4. Afloja la ropa apretada del cuello y el pecho para que pueda respirar mejor.",
      "5. Mantén a la persona en reposo, sentada o recostada de lado (no boca arriba). Si vomita, gírale la cabeza hacia un lado para que no se ahogue.",
      "6. Si la persona NO respira y no da señales de vida (no se mueve, no respira, no tose), empieza RCP de inmediato si sabes hacerlo, y sigue hasta que llegue ayuda.",
      "7. Quédate con ella y vigila su respiración todo el tiempo. Los síntomas pueden aparecer o empeorar hasta 24 horas después, así que no la dejes sola.",
    ],
    dont: [
      "NO entres a un lugar lleno de humo sin protección ni te metas a un incendio para rescatar a alguien si pones tu vida en peligro: espera a los rescatistas.",
      "NO subestimes los síntomas aunque la persona se sienta bien: pueden empeorar varias horas después (hasta 24 horas).",
      "NO acuestes boca arriba a alguien que vomita o está mareado; ponlo de lado.",
      "NO le des de comer ni de beber si tiene mucha dificultad para respirar o está confundida.",
      "NO esperes a que pase solo si hay quemaduras en la cara, hollín en boca o nariz, o dificultad para respirar: busca atención médica.",
    ],
    callEmergency: [
      "Llama al 911 SIEMPRE que la persona tenga dificultad para respirar, respiración ruidosa o ronquera.",
      "Llama al 911 si está confundida, muy somnolienta, mareada o pierde el conocimiento.",
      "Llama al 911 si tiene quemaduras en la cara, hollín en la boca o nariz, o vello de la nariz quemado (señal de quemadura en las vías respiratorias).",
      "Llama al 911 si no respira o no da señales de vida (empieza RCP de inmediato).",
      "Busca atención médica aunque la persona parezca estar bien si estuvo en un incendio o respiró mucho humo: los síntomas pueden tardar hasta 24 horas en aparecer.",
    ],
    sources: [
      "medlineplus-biblioteca",
      "manual-msd",
      "cleveland-clinic-4",
      "american-red-5",
    ],
  },
];

export const EXPANSION_SALUD: Procedure[] = [
  {
    id: "rehidratacion-suero-oral",
    title: "Diarrea y deshidratación: cómo hacer y dar suero oral en casa",
    summary:
      "Tras un desastre, el agua sucia causa diarrea y deshidratación, que puede matar (sobre todo a bebés y niños). Usa este suero para reponer líquidos.",
    steps: [
      "Reconoce las señales de deshidratación: mucha sed, boca y lengua secas, orina poca y oscura, ojos hundidos, llanto sin lágrimas, cansancio o irritabilidad. En bebés también: la mollera (parte blanda de la cabeza) se ve hundida.",
      "Consigue 1 litro (1.000 ml) de AGUA SEGURA: agua embotellada, hervida y dejada enfriar, o agua tratada/clorada. Si no estás seguro, primero potabilízala. Lávate las manos antes de preparar.",
      "Prepara el suero oral con la receta de la OMS: en 1 litro de agua segura disuelve 6 cucharaditas rasas de azúcar y media (½) cucharadita rasa de sal. Mezcla bien hasta que se disuelva. Pruébalo: no debe quedar más salado que las lágrimas.",
      "Si tienes sobres de SRO/SRO (sales de rehidratación oral) de farmacia o de una organización de ayuda, úsalos en vez del casero: disuelve el sobre en la cantidad de agua segura que indique el paquete. Es la mejor opción.",
      "Da el suero a sorbos pequeños y seguidos, con cucharita, taza o jeringa (sin aguja). Poquito y constante es mejor que mucho de golpe.",
      "Da una cantidad extra después de CADA evacuación líquida (cada vez que va al baño con diarrea): a un niño menor de 2 años, entre 50 y 100 ml (de un cuarto a media taza); a un niño de 2 años o más, entre 100 y 200 ml (media a una taza). Un adulto debe tomar bastante, según la sed.",
      "Si la persona vomita, espera unos 10 minutos y vuelve a dar el suero, pero más despacio y a sorbos más pequeños. Casi siempre logra retener algo.",
      "Sigue dando de comer. Si es bebé, sigue amamantando todas las veces que pida; el pecho ayuda a recuperarse. A niños mayores y adultos, ofréceles comida en porciones pequeñas y frecuentes apenas la acepten.",
      "Si tienes acceso a zinc para niños (jarabe o tabletas, viene en kits de ayuda), darlo junto con el suero ayuda a que la diarrea dure menos. Sigue la dosis del envase o del personal de salud.",
      "Prepara suero nuevo cada día. Tira el que sobre después de 24 horas y haz uno fresco, porque se puede contaminar.",
      "Sigue dando líquidos extra hasta que la diarrea se detenga. La meta es que orine claro y con normalidad.",
    ],
    dont: [
      "NO uses gaseosas, jugos azucarados, bebidas energéticas ni bebidas deportivas como suero: tienen demasiada azúcar y pueden EMPEORAR la diarrea.",
      "NO des solo agua sola en grandes cantidades para tratar la deshidratación: no repone la sal que el cuerpo pierde.",
      "NO le des líquidos por la boca a alguien inconsciente, muy somnoliento o que no puede tragar: puede ahogarse. Busca ayuda urgente.",
      "NO insistas en dar más suero si la persona vomita TODO lo que toma y no retiene nada: necesita atención médica.",
      "NO te pases de sal: un suero muy salado es peligroso, sobre todo para bebés. Respeta media (½) cucharadita por litro.",
      "NO uses agua que no sea segura para preparar el suero; primero hiérvela o trátala.",
      "NO des medicamentos para 'cortar' la diarrea (antidiarreicos) si hay fiebre alta o sangre en las heces: pueden empeorar la enfermedad.",
    ],
    callEmergency: [
      "Señales de deshidratación grave: muy somnoliento o inconsciente, no puede beber o bebe muy mal, ojos muy hundidos, o al pellizcar suavemente la piel esta tarda más de 2 segundos en volver a su lugar.",
      "Sangre en las heces (popó con sangre) o vómito con sangre.",
      "No logra retener ningún líquido (vomita todo) o sigue con diarrea muy abundante y frecuente.",
      "No orina en 8 horas o más (en bebés, pañal seco mucho tiempo o mollera muy hundida).",
      "Bebé pequeño, persona mayor o persona con otra enfermedad con diarrea: busca atención médica antes, porque se deshidratan más rápido.",
      "Fiebre alta, convulsiones, confusión o mareo fuerte al ponerse de pie. Llama al 911 o ve al centro de salud o refugio médico más cercano de inmediato.",
    ],
    sources: [
      "organizacion-mundial",
      "oms-humanitarian",
      "unicef-supply",
      "cdc-centros",
      "oms-unicef",
    ],
  },
  {
    id: "cuidado-heridas-infeccion",
    title: "Cómo cuidar heridas y cortes para evitar infección y tétanos",
    summary:
      "Limpiar y cubrir bien cualquier corte o herida tras el terremoto, para evitar que se infecte o dé tétanos; clave porque los escombros y el agua sucia traen muchos microbios.",
    steps: [
      "Lávate bien las manos con agua limpia y jabón antes de tocar la herida. Si puedes, ponte guantes y no toques la herida con los dedos.",
      "Detén el sangrado: presiona la herida con una tela o gasa limpia hasta que pare. Si sangra mucho y no para, busca ayuda médica.",
      "Lava la herida echándole agua limpia o agua embotellada a chorro, para arrastrar la suciedad. Lava ALREDEDOR de la herida con agua limpia y jabón.",
      "Quita con cuidado la suciedad o tierra que veas. Si hay un objeto clavado (vidrio, madera, metal) o no sale la mugre, NO escarbes: busca atención médica.",
      "Seca con toques suaves usando una tela o gasa limpia. No frotes fuerte.",
      "Cubre la herida con una gasa o tela limpia y seca. Si vas a estar cerca de agua sucia o de inundación, usa una venda a prueba de agua.",
      "Cambia el vendaje todos los días, y también cada vez que se moje o se ensucie. Antes de tocar la herida, lávate las manos otra vez.",
      "Mantén la herida limpia y seca. Revísala a diario buscando señales de infección.",
      "Vacuna contra el tétanos: si la herida es sucia, profunda o punzante (por ejemplo, pisar un clavo, metal oxidado, mordida, escombros) y tu última vacuna fue hace 5 años o más (o no sabes/nunca te vacunaste), busca un refuerzo lo antes posible. En heridas limpias, el refuerzo se recomienda si pasaron 10 años o más.",
      "SEÑALES DE INFECCIÓN (vigílalas): enrojecimiento que crece alrededor de la herida; calor en la zona; hinchazón; dolor que aumenta; pus o líquido turbio; mal olor; fiebre; y líneas rojas que salen de la herida hacia el resto del cuerpo. Si aparece cualquiera, busca atención médica.",
    ],
    dont: [
      "NO laves la herida con agua de inundación, charcos, ríos ni agua sucia: trae microbios y puede infectarla. Usa agua limpia o embotellada.",
      "NO eches alcohol, agua oxigenada (peróxido) ni yodo DENTRO de la herida: irrita y daña la piel. Limpia por dentro solo con agua limpia.",
      "NO entres al agua de inundación si tienes una herida abierta; si no hay más remedio, cúbrela con una venda a prueba de agua y, si puedes, usa botas y guantes de goma.",
      "NO toques la herida con las manos sucias ni con los dedos sin lavar.",
      "NO saques tú mismo un objeto clavado (vidrio, metal, madera): puede sangrar más; déjalo y busca ayuda médica.",
      "NO ignores las señales de infección ni esperes a que empeore para buscar ayuda.",
      "NO dejes la herida destapada y sucia: cúbrela y mantenla limpia y seca.",
    ],
    callEmergency: [
      "Busca atención médica de inmediato si la herida tiene enrojecimiento que crece, hinchazón, calor, pus, mal olor, dolor que aumenta, fiebre o líneas rojas que salen hacia el cuerpo (puede ser infección que se está esparciendo).",
      "Busca ayuda médica si la herida es profunda, muy sucia, punzante (como pisar un clavo) o tiene tierra, escombros, heces o saliva.",
      "Busca ayuda médica si es una mordida de animal o persona.",
      "Busca un refuerzo de la vacuna contra el tétanos si la herida es sucia/punzante y tu última vacuna fue hace 5 años o más, no sabes cuándo fue, o nunca te vacunaste.",
      "Busca ayuda si hay un objeto clavado en la herida o si no logras quitar la suciedad.",
      "Llama al 911 o ve a urgencias si el sangrado es fuerte y no para con presión, la herida es muy grande o profunda, o tienes fiebre alta con escalofríos y te sientes muy mal.",
    ],
    sources: [
      "cdc-centros-3",
      "cdc-centros-4",
      "cdc-centros-5",
      "mayo-clinic-8",
      "oms-organizacion",
    ],
  },
  {
    id: "higiene-prevencion",
    title:
      "Higiene y prevención de enfermedades en un refugio o tras el desastre",
    summary:
      "Pasos sencillos para evitar diarrea y otras enfermedades cuando hay muchas personas juntas: lavarse las manos, beber agua segura, manejar bien la basura y las heces, y cuidar la comida.",
    steps: [
      "Lávate las manos con agua y jabón en los momentos clave: antes de comer, antes de cocinar o tocar comida, después de ir al baño, después de cambiar a un niño y después de atender a un enfermo. Frota durante al menos 20 segundos (cuenta despacio hasta 20) y enjuaga.",
      "Si no hay jabón, lávate las manos frotando con ceniza limpia (de madera quemada) o arena y bastante agua. Es mejor que solo agua. El jabón sigue siendo lo ideal: úsalo apenas tengas.",
      "Bebe y cocina SOLO con agua segura. Si no estás seguro de que el agua es segura, trátala así: hiérvela 1 minuto a borbotones y déjala enfriar; o ponla en una botella de plástico transparente y limpia, acostada al sol 6 horas en día soleado (2 días seguidos si está nublado). Si el agua está turbia, primero déjala reposar o cuélala con tela limpia antes de tratarla.",
      "Maneja la basura y las heces LEJOS del agua y de la comida. La letrina o el pozo deben estar al menos a 30 metros de cualquier fuente de agua (pozo, río, tanque) y, si hay pendiente, más abajo que el agua. Tapa la basura y las heces.",
      "Cubre y protege los alimentos: tápalos para que no les caigan moscas ni polvo, lava frutas y verduras con agua segura, cocina bien la carne, el pollo, el huevo y el pescado, y separa la comida cruda de la cocida.",
      "No dejes la comida cocinada más de 2 horas a temperatura ambiente; si pasó ese tiempo y hace calor, es más seguro no comerla. Sirve la comida bien caliente.",
      "Si puedes, separa a las personas enfermas (con diarrea o vómito) en una zona aparte y que usen su propio baño, vaso, plato y toalla.",
      "Si alguien tiene diarrea, dale líquidos para que no se deshidrate. Suero oral casero: 1 litro de agua segura + 6 cucharaditas rasas de azúcar + media (1/2) cucharadita de sal. Mezcla bien y dale a sorbos seguido. Prepara una jarra nueva cada día: bota lo que sobre después de 24 horas.",
    ],
    dont: [
      "No defeques ni botes aguas sucias cerca del agua, los pozos o la comida.",
      "No tomes agua sin tratar (de río, charco o de fuente dudosa) aunque se vea limpia.",
      "No compartas vasos, platos, cubiertos ni toallas con personas enfermas.",
      "No prepares ni toques comida para otros si tienes diarrea o vómito.",
      "No uses solo agua para 'lavarte' las manos si tienes jabón o ceniza disponible: el agua sola limpia menos.",
      "No guardes el suero oral casero de un día para otro: bótalo a las 24 horas y prepara nuevo.",
    ],
    callEmergency: [
      "Si en el refugio aparecen VARIAS personas con diarrea o vómito al mismo tiempo: puede ser un brote. Avisa de inmediato al personal de salud o al coordinador del refugio.",
      "Busca atención médica urgente si la persona con diarrea tiene señales de deshidratación: mucha sed, boca y lengua secas, orina poca o muy oscura, ojos hundidos, debilidad o mareo al pararse.",
      "Llama al 911 o ve a un centro de salud YA si hay diarrea muy líquida y abundante (como agua de arroz), vómitos que no paran, no logra tomar líquidos, está muy decaído, confundido o no responde bien: la deshidratación grave puede ser mortal en pocas horas.",
      "En bebés y niños pequeños, ancianos o personas enfermas, busca ayuda antes: se deshidratan más rápido. Señales en bebés: no moja pañales, llora sin lágrimas, está muy flojo o tiene la mollera hundida.",
    ],
    sources: [
      "oms-who",
      "oms-who-2",
      "ops-paho",
      "cdc",
      "cdc-2",
      "cdc-3",
      "sphere-emergency",
    ],
  },
  {
    id: "prevencion-mosquitos",
    title:
      "Prevención de enfermedades por mosquitos (dengue, malaria, zika, chikungunya) después del terremoto",
    summary:
      "Cómo evitar las picaduras de mosquitos y eliminar el agua estancada para prevenir dengue y otras enfermedades; úsalo en casa, refugios y zonas afectadas donde se junta agua.",
    steps: [
      "Elimina el agua estancada cada semana. Los mosquitos del dengue ponen huevos en agua quieta. Vacía, voltea, tapa o bota todo lo que junte agua: baldes, tobos, botellas, latas, floreros, llantas (cauchos), tapas, juguetes y recipientes viejos.",
      "Tapa bien los tanques, pipas y depósitos de agua. Mantén siempre cubiertos los tanques y reservorios donde guardas agua, para que los mosquitos no entren a poner huevos.",
      "Lava y restriega los recipientes de agua una vez por semana. Cepilla las paredes por dentro (no solo vacíes), porque los huevos quedan pegados; luego tápalos.",
      "Recoge y bota la basura. No dejes que se acumule basura ni envases que junten agua; guarda la basura en bolsas plásticas cerradas.",
      "Usa repelente contra mosquitos en la piel y la ropa que queda destapada. Sirven los que tienen DEET, picaridina (picaridin) o IR3535. Úsalo siguiendo las instrucciones del envase; estos repelentes registrados se consideran seguros incluso en embarazadas y mujeres que dan pecho cuando se usan como indica la etiqueta.",
      "Ponte ropa que cubra la mayor parte del cuerpo: camisas o franelas de manga larga y pantalones largos, sobre todo al amanecer y al atardecer.",
      "Duerme bajo mosquitero, sobre todo bebés, niños y mujeres embarazadas, y cuando no hay aire acondicionado ni ventanas con malla. Cubre también las cunas y los coches (sillas) de bebé con malla mosquitera.",
      "Pon mallas (telas metálicas) en ventanas y puertas, y repara los huecos para que no entren mosquitos. Si puedes, quédate en lugares con ventanas y puertas con malla o con aire acondicionado.",
      "Vigila las señales del dengue. La fiebre suele venir con dolor de cabeza fuerte, dolor detrás de los ojos, dolor de músculos y articulaciones (huesos) y a veces salpullido (ronchas). Descansa y toma muchos líquidos: agua o suero con electrolitos.",
      "ATENCIÓN: las señales de dengue grave aparecen muchas veces 1 a 2 días DESPUÉS de que baja la fiebre, y empeoran en pocas horas. Busca atención médica de inmediato si aparecen estos signos de alarma (ver más abajo).",
    ],
    dont: [
      "NO dejes recipientes ni tanques de agua destapados: son el criadero principal de los mosquitos del dengue.",
      "NO tomes ni le des a nadie aspirina ni ibuprofeno si sospechas dengue. La CDC y la OMS indican usar acetaminofén (paracetamol) para la fiebre y el dolor, y EVITAR aspirina e ibuprofeno y otros antiinflamatorios (AINEs) porque aumentan el riesgo de sangrado.",
      "NO te automediques con antibióticos ni inyecciones por tu cuenta para el dengue.",
      "NO ignores el dolor de barriga fuerte, el vómito que no para o el sangrado: son emergencia, no esperes a ver si pasa.",
      "NO confíes en que ya estás mejor solo porque bajó la fiebre: justo en esos 1 a 2 días pueden empezar las complicaciones graves.",
      "NO uses repelente con DEET en bebés menores de 2 meses; para ellos usa mosquitero sobre la cuna o el coche.",
      "NO acumules basura ni dejes agua sucia juntándose alrededor de la casa o el refugio.",
    ],
    callEmergency: [
      "Busca atención médica urgente (o llama a emergencias) si después de la fiebre aparece dolor fuerte o sensibilidad en la barriga (abdomen).",
      "Vómito persistente: al menos 3 veces en 24 horas.",
      "Sangrado por las encías o la nariz, sangre en el vómito o sangre en las heces (popó).",
      "Mucho sueño, cansancio extremo, persona inquieta o irritable, o cambios en la conciencia.",
      "Respiración rápida o dificultad para respirar, piel pálida y fría, mucha sed o debilidad fuerte.",
      "El dengue grave es una emergencia médica y empeora en pocas horas: si ves cualquiera de estas señales, busca ayuda de inmediato.",
    ],
    sources: [
      "ops-oms",
      "ops-oms-2",
      "oms-who-3",
      "cdc-4",
      "cdc-5",
      "cdc-6",
      "cdc-7",
    ],
  },
];
