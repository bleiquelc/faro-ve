/**
 * Sismo y supervivencia — contenido curado de fuentes oficiales (ver sources.ts).
 * Fuente local prioritaria: guía de tres fases de Protección Civil Venezuela /
 * FUNVISIS. Cifras críticas (hervir 1 min, cloro 2 gotas/L, comida 4 h / 4 °C)
 * verificadas contra CDC, EPA, OMS y FoodSafety.gov.
 */
import type { Procedure } from "./types";

export const EARTHQUAKE: Procedure[] = [
  {
    id: "durante-sismo-dentro",
    title: "Durante el sismo: si estás dentro de un edificio",
    emoji: "🏠",
    summary: "Agáchate, cúbrete y agárrate.",
    steps: [
      "AGÁCHATE: bájate de inmediato al piso, sobre manos y rodillas, antes de que el sismo te tumbe.",
      "CÚBRETE: métete debajo de una mesa o escritorio resistente. Si no hay un mueble cerca, agáchate junto a una pared interior (no una con ventanas) y cubre tu cabeza y cuello con tus brazos.",
      "AGÁRRATE: sostén la pata de la mesa con una mano y quédate ahí hasta que pare de temblar. Si la mesa se mueve, muévete con ella.",
      "Si estás en la cama, quédate ahí, encógete y protege tu cabeza con una almohada.",
    ],
    dont: [
      "NO corras hacia afuera durante el temblor: la mayoría de las lesiones son por objetos que caen o vuelan (lámparas, vidrios, estantes), no por el colapso del edificio.",
      "NO te pares en el marco de una puerta: es un mito, no te protege de objetos que vuelan.",
      "NO uses ascensores.",
      "NO te pongas junto a ventanas, espejos, vidrios ni objetos colgantes.",
    ],
    sources: ["shakeout", "pc-funvisis-ve"],
  },
  {
    id: "durante-sismo-afuera",
    title: "Durante el sismo: si estás afuera o manejando",
    emoji: "🚗",
    steps: [
      "Si estás en la calle, aléjate de edificios, postes de luz y cables eléctricos.",
      "Ve a un área despejada y agáchate ahí hasta que pare el temblor.",
      "Si vas manejando, reduce la velocidad y detente en un lugar seguro, lejos de puentes, pasos elevados y edificios.",
      "Quédate dentro del vehículo, con el cinturón puesto, hasta que pare el temblor.",
    ],
    dont: [
      "NO te detengas debajo o encima de puentes, pasos elevados, ni junto a edificios o postes.",
      "NO te quedes cerca de cables eléctricos caídos.",
    ],
    sources: ["pc-funvisis-ve", "shakeout"],
  },
  {
    id: "despues-sismo",
    title: "Después del sismo: réplicas, gas y evacuación",
    emoji: "⚠️",
    summary: "Lo primero tras el temblor: réplicas y fugas de gas.",
    steps: [
      'Espera réplicas: son sismos más pequeños que siguen al principal. Vuelve a "agáchate, cúbrete y agárrate" cada vez que tiemble.',
      "Revisa si estás herido. Si puedes, ayuda a otros. No muevas a heridos graves a menos que estén en peligro inmediato.",
      "Si hueles gas o ves una tubería rota, cierra la válvula principal desde afuera, abre una ventana y sal del lugar.",
      "Si tu edificio está dañado, evacúa con calma usando las escaleras, nunca el ascensor.",
      "No vuelvas a entrar a un edificio dañado hasta que las autoridades digan que es seguro. Sal si escuchas crujidos o ruidos extraños.",
      "Usa el teléfono solo para emergencias; prefiere mensajes de texto. Sintoniza una radio confiable para instrucciones oficiales.",
    ],
    dont: [
      "NO uses fósforos, encendedores, velas, electrodomésticos ni interruptores de luz hasta estar seguro de que no hay fuga de gas: una chispa puede causar una explosión.",
      "NO entres a edificios dañados.",
      "NO uses ascensores.",
    ],
    sources: ["cdc-earthquake", "pc-funvisis-ve"],
  },
  {
    id: "atrapado-escombros",
    title: "Si quedas atrapado bajo escombros",
    emoji: "🆘",
    summary: "Cómo lograr que te encuentren sin agotarte.",
    steps: [
      "Cúbrete la boca, la nariz y los ojos con una tela o tu camisa para protegerte del polvo.",
      "Para que te encuentren, golpea con algo duro una tubería o una pared, o usa un silbato. Hazlo en grupos (por ejemplo, golpear fuerte 3 veces) cada pocos minutos: los rescatistas escuchan esos sonidos.",
      "Si tienes teléfono, envía un mensaje de texto pidiendo ayuda (usa menos batería y red que una llamada).",
      "Conserva tu energía y mantén la calma mientras esperas.",
    ],
    dont: [
      "NO grites, salvo como último recurso: gritar te agota y puede hacerte inhalar polvo peligroso.",
      "NO enciendas fósforos ni encendedores: puede haber fuga de gas.",
      "NO te muevas más de lo necesario ni levantes polvo.",
    ],
    sources: ["cdc-earthquake", "redcross-earthquake"],
  },
  {
    id: "agua-segura-hervir",
    title: "Agua segura para beber: hervir",
    emoji: "💧",
    summary: "La forma más segura de potabilizar agua.",
    steps: [
      "Si el agua está turbia, primero déjala reposar para que el sedimento baje, o fíltrala con un paño limpio.",
      "Pon el agua a hervir y mantenla en hervor fuerte (burbujeo intenso) durante 1 minuto. En casi toda Venezuela (incluida Caracas) basta con 1 minuto.",
      "Solo en zonas de alta montaña (por encima de ~2.000 metros) hierve durante 3 minutos.",
      "Deja enfriar sola, tapada. Guárdala en recipientes limpios con tapa.",
    ],
    dont: [
      "Hervir NO elimina contaminación química ni combustible, solo microbios: no confíes en hervir agua con químicos tóxicos.",
      "No uses el agua mientras esté hirviendo (riesgo de quemadura); espera a que enfríe.",
    ],
    sources: ["cdc-water", "epa-water"],
  },
  {
    id: "agua-segura-cloro",
    title: "Agua segura para beber: desinfectar con cloro",
    emoji: "🧴",
    summary: "Si no puedes hervir, usa cloro doméstico sin perfume.",
    steps: [
      "Usa solo cloro (lejía) doméstico SIN perfume y sin aditivos (concentración de hipoclorito de sodio entre 5% y 9%, lo común en botellas de cloro).",
      "Si el agua está turbia, fíltrala primero con un paño limpio y déjala asentar.",
      "Para agua clara: agrega 2 gotas de cloro por cada 1 litro de agua (equivale a 8 gotas por galón / ~3,8 litros).",
      "Si el agua está turbia o muy fría, usa el DOBLE: 4 gotas por litro.",
      "Revuelve bien y deja reposar al menos 30 minutos antes de beber.",
      "El agua debe tener un ligero olor a cloro. Si NO huele a cloro, repite la dosis y espera otros 15 minutos antes de usarla.",
    ],
    dont: [
      'No uses cloro perfumado, en gel, "color-safe", ni con detergente añadido.',
      'No uses más cloro del indicado pensando que es "más seguro": el exceso de cloro es dañino.',
      "No confíes en el cloro para agua con contaminación química.",
    ],
    sources: ["cdc-water", "who-water"],
  },
  {
    id: "comida-segura",
    title: "Comida segura tras corte de luz o inundación",
    emoji: "🥫",
    summary: "Qué guardar y qué botar cuando se va la luz.",
    steps: [
      "Mantén las puertas de la nevera y el congelador CERRADAS. La nevera mantiene la comida fría unas 4 horas sin luz. Un congelador lleno aguanta cerca de 48 horas (24 horas si está medio lleno) si no se abre.",
      "Bota cualquier comida perecedera (carne, pollo, pescado, huevos, sobras, leche) que haya estado más de 4 horas por encima de 4 °C.",
      "La comida congelada se puede volver a congelar con seguridad solo si todavía tiene cristales de hielo o está a 4 °C o menos.",
      "Bota toda comida (incluso enlatada) que haya tocado agua de inundación.",
      "Cuando tengas duda, bótala.",
    ],
    dont: [
      'No pruebes la comida para "ver si está buena": puedes enfermarte aunque se vea y huela normal.',
      "No consumas latas abolladas, hinchadas, oxidadas o que tocaron agua de inundación.",
      "No vuelvas a congelar comida que ya pasó de 4 °C sin cristales de hielo.",
    ],
    sources: ["foodsafety", "cdc-food"],
  },
  {
    id: "kit-emergencia",
    title: "Kit básico de emergencia",
    emoji: "🎒",
    summary: "Lo esencial que conviene tener listo.",
    steps: [
      "Agua: ~3,8 litros (1 galón) por persona por día, para al menos 3 días (beber e higiene).",
      "Comida no perecedera para al menos 3 días + abrelatas manual.",
      "Radio a pilas o de manivela.",
      "Linterna + pilas extra.",
      "Botiquín de primeros auxilios.",
      "Silbato (para pedir ayuda sin gastar la voz).",
      "Mascarilla antipolvo; plástico y cinta adhesiva (teipe) para improvisar refugio.",
      "Toallitas húmedas, bolsas de basura y amarres plásticos (higiene).",
      "Llave inglesa o alicate para cerrar el gas y el agua.",
      "Documentos importantes, medicinas personales, y necesidades de bebés o mascotas.",
      "Teléfono con cargador y batería de respaldo. Guarda todo en uno o dos recipientes fáciles de cargar.",
    ],
    dont: [
      "No dependas solo del celular para luz o información: ten linterna y radio físicos.",
      "No guardes el kit en un solo lugar inaccesible: ten uno en casa, el trabajo y el carro.",
    ],
    sources: ["ready-kit"],
  },
];
