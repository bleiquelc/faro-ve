/**
 * Primeros auxilios — contenido curado de fuentes oficiales (ver sources.ts).
 * CERO invención. Lenguaje español latino, simple. Cifras críticas citadas
 * textualmente de la fuente (RCP 100-120/min · ≥5 cm; atragantamiento 5+5).
 */
import type { Procedure } from "./types";

export const FIRST_AID: Procedure[] = [
  {
    id: "sangrado-abundante",
    title: "Sangrado fuerte (hemorragia)",
    emoji: "🩸",
    summary: "Cómo detener una herida que sangra mucho.",
    steps: [
      "Si puedes, ponte guantes o usa una bolsa de plástico limpia en tu mano para protegerte.",
      "Recuesta a la persona y, si es posible, levanta la parte que sangra por encima del nivel del corazón.",
      "Cubre la herida con una gasa o un trapo limpio y presiona fuerte y directo con la palma de tu mano, sin soltar, hasta que pare el sangrado.",
      "Si la sangre traspasa el trapo, NO lo quites: pon otra gasa o trapo encima y sigue presionando firme.",
      "Cuando pare, deja el vendaje puesto y mantén a la persona quieta y tranquila mientras llega la ayuda.",
    ],
    dont: [
      "No presiones sobre un ojo lastimado ni sobre un objeto clavado.",
      "No saques objetos grandes o clavados profundo (pueden estar tapando la herida y frenando la sangre).",
      "No quites el primer trapo aunque se empape: agrega más encima.",
      "No hurgues dentro de la herida.",
    ],
    callEmergency: [
      "Si la sangre sale a chorros o no para con la presión.",
      "Si la herida es profunda o grande, o hay un objeto clavado.",
      "Si la persona se pone pálida, fría o confundida (signo de shock).",
    ],
    sources: ["mayo-bleeding", "ifrc-2020"],
  },
  {
    id: "rcp-adulto",
    title: "RCP en un adulto (solo con las manos)",
    emoji: "❤️",
    summary: "Si un adulto no responde y no respira normal.",
    steps: [
      'Verifica si responde: sacúdele el hombro y grítale "¿estás bien?". Si no responde y no respira normal (o solo jadea), actúa.',
      "Llama YA al 911 (o pide a alguien que llame) y consigue un desfibrilador (DEA) si hay uno cerca.",
      "Arrodíllate al lado de la persona, que esté boca arriba sobre una superficie firme.",
      "Coloca el talón de una mano en el CENTRO del pecho (sobre el esternón) y la otra mano encima, entrelazando los dedos.",
      "Con los brazos rectos, empuja FUERTE y RÁPIDO hacia abajo: al menos 5 cm de profundidad (sin pasar de 6 cm), a un ritmo de 100 a 120 compresiones por minuto.",
      "Deja que el pecho suba completo entre cada compresión (no te apoyes encima).",
      "No pares. Sigue hasta que llegue la ayuda, aparezca un DEA, o la persona despierte o respire.",
    ],
    dont: [
      "No te detengas a revisar el pulso una y otra vez: si no responde y no respira normal, comprime.",
      "No comprimas suave ni lento: debe ser fuerte y rápido.",
      "Si no tienes entrenamiento, no es necesario dar respiraciones boca a boca: solo manos.",
    ],
    callEmergency: [
      "Siempre, ANTES de empezar, o que alguien llame al 911 mientras tú comprimes.",
    ],
    sources: ["aha-cpr", "ifrc-2020"],
  },
  {
    id: "atragantamiento-adulto",
    title: "Atragantamiento en un adulto",
    emoji: "😶",
    summary: "Si un adulto se ahoga y no puede hablar, toser ni respirar.",
    steps: [
      'Pregunta "¿te estás ahogando?". Si no puede hablar, toser ni respirar, o se agarra el cuello, actúa.',
      "Ponte a un lado y un poco detrás. Inclínalo hacia adelante.",
      "Da 5 golpes firmes en la espalda, entre los omóplatos, con el talón de tu mano.",
      "Si no sale el objeto, ponte detrás y rodéale la cintura con tus brazos.",
      "Cierra un puño y ponlo con el lado del pulgar contra la barriga, un poco arriba del ombligo. Tómalo con la otra mano.",
      "Aprieta la barriga con 5 compresiones rápidas hacia ADENTRO y hacia ARRIBA (esto se llama maniobra de Heimlich).",
      "Alterna ciclos de 5 golpes en la espalda + 5 compresiones en la barriga, hasta que salga el objeto o la persona pueda toser o hablar.",
      "Si la persona se desmaya, bájala con cuidado a una superficie firme y empieza RCP (compresiones).",
    ],
    dont: [
      "No metas los dedos a ciegas en la boca para sacar el objeto (puedes empujarlo más adentro).",
      "No le des golpes en la espalda sin inclinarlo hacia adelante.",
      "No le sigas dando agua ni comida.",
    ],
    callEmergency: [
      "Llama al 911 apenas empieza el atragantamiento serio (o pide que alguien llame mientras tú ayudas).",
      "Si se desmaya, es urgente.",
    ],
    sources: ["redcross-choking-adult", "ifrc-2020"],
  },
  {
    id: "atragantamiento-bebe",
    title: "Atragantamiento en un bebé (menor de 1 año)",
    emoji: "👶",
    summary: "Un bebé que se ahoga se atiende distinto a un adulto.",
    steps: [
      "Si el bebé no puede toser, llorar ni respirar, actúa de inmediato.",
      "Acuesta al bebé boca abajo sobre tu antebrazo, apoyando el brazo en tu muslo. La cabeza debe quedar MÁS BAJA que el cuerpo. Sostén la cabeza y la mandíbula con tu mano.",
      "Da 5 golpes firmes en la espalda, entre los omóplatos, con el talón de tu mano.",
      "Voltea al bebé boca arriba, con la cabeza más baja que el cuerpo.",
      "Da 5 compresiones en el pecho: pon 2 o 3 dedos en el centro del pecho, en la línea entre los pezones, y empuja hacia abajo unos 4 cm (1½ pulgadas).",
      "Alterna 5 golpes en la espalda + 5 compresiones en el pecho hasta que salga el objeto o el bebé tosa o llore.",
      "Si el bebé deja de responder, bájalo a una superficie firme y empieza RCP infantil (compresiones).",
    ],
    dont: [
      "NUNCA hagas compresiones en la barriga (Heimlich) a un bebé: pueden dañarle el hígado.",
      "No metas los dedos a ciegas en su boca para buscar el objeto.",
      "No lo sostengas con la cabeza más alta que el cuerpo durante los golpes.",
    ],
    callEmergency: [
      "Llama al 911 de inmediato (o pide que alguien llame mientras tú ayudas al bebé).",
    ],
    sources: ["redcross-choking-infant", "ifrc-2020"],
  },
  {
    id: "quemaduras",
    title: "Quemaduras",
    emoji: "🔥",
    summary: "Cómo enfriar y proteger una quemadura.",
    steps: [
      "Aleja a la persona de la fuente de calor y, si es seguro, quita anillos, pulseras o ropa apretada del área antes de que se hinche (pero NO la ropa pegada a la quemadura).",
      "Enfría la quemadura con agua de la llave FRESCA (no helada) corriendo sobre el área por unos 10 minutos.",
      "Cubre la quemadura con un vendaje o tela limpia, floja, para protegerla y aliviar el dolor.",
      "Si hay dolor, la persona puede tomar un analgésico común de venta libre.",
    ],
    dont: [
      "No uses hielo ni agua helada directo sobre la quemadura (daña más la piel).",
      "No pongas mantequilla, pasta de dientes, aceite ni cremas grasosas (atrapan el calor y aumentan el riesgo de infección).",
      "No revientes las ampollas.",
      "No quites la ropa que quedó pegada a la piel quemada.",
    ],
    callEmergency: [
      "Si la quemadura es grande o profunda.",
      "Si afecta cara, manos, pies, genitales o una articulación grande.",
      "Si es por fuego, electricidad o químicos.",
      "Si la piel se ve blanca, acartonada, o quemada en círculo alrededor de un brazo o pierna.",
    ],
    sources: ["mayo-burns", "ifrc-2020"],
  },
  {
    id: "fracturas",
    title: "Fractura o hueso roto",
    emoji: "🦴",
    summary: "Si sospechas que un hueso se quebró.",
    steps: [
      "No muevas a la persona a menos que sea estrictamente necesario (peligro cercano).",
      "Si hay sangrado, presiona con una gasa o tela limpia hasta que pare.",
      "Inmoviliza la zona lesionada: mantenla quieta en la posición en que está.",
      "Si sabes entablillar y la ayuda tardará, coloca una férula (tablilla) sujetando por arriba y por abajo de la zona quebrada.",
      "Pon hielo envuelto en una tela (nunca directo sobre la piel) para bajar la hinchazón y el dolor.",
      "Vigila signos de shock: si se siente débil o respira corto y rápido, acuéstala y, si puedes, levántale las piernas.",
    ],
    dont: [
      "No intentes acomodar el hueso ni empujar hacia adentro un hueso que sobresale.",
      "No muevas a la persona si sospechas lesión de columna (cuello o espalda).",
      "No pongas hielo directo sobre la piel.",
    ],
    callEmergency: [
      "Si el hueso atravesó la piel o hay sangrado fuerte.",
      "Si fue por un golpe o accidente grande, o sospechas lesión de cuello o espalda.",
      "Si la persona no responde o no respira.",
      "Si la zona se ve azulada o sin pulso ni sensibilidad.",
    ],
    sources: ["mayo-fractures", "ifrc-2020"],
  },
  {
    id: "aplastamiento",
    title: "Persona atrapada o aplastada",
    emoji: "🧱",
    summary:
      "Muy importante tras un derrumbe: cómo ayudar sin causar más daño.",
    steps: [
      "Asegura primero tu seguridad: no entres a una estructura inestable; pide ayuda de rescate profesional.",
      "Si la persona pudo lesionarse el cuello o la espalda, NO la muevas. Mantenle la cabeza y el cuello quietos: sostén con tus manos o pon toallas o ropa enrolladas a ambos lados del cuello.",
      "Habla con la persona, mantenla consciente y tranquila mientras llega el rescate.",
      "Si tiene sangrado visible, presiona con tela limpia.",
      "ADVERTENCIA: si una parte del cuerpo lleva mucho rato aplastada (varias horas), liberar el peso de golpe puede ser muy peligroso (síndrome de aplastamiento). NO retires el objeto pesado sin la guía del personal de rescate o médico.",
      "Si está consciente y NO sospechas lesión de columna ni de pelvis, puedes recostarla y levantarle un poco las piernas.",
    ],
    dont: [
      "No muevas ni jales a la persona si sospechas lesión de columna.",
      "No liberes de golpe el peso que aplasta tras un atrapamiento prolongado, sin guía del rescate.",
      "No le tuerzas la cabeza ni el cuello.",
      "Si hay que dar RCP con sospecha de lesión de cuello, no le inclines la cabeza hacia atrás para abrir la vía aérea.",
    ],
    callEmergency: [
      "Siempre, de inmediato. Es una emergencia que requiere rescate y atención médica urgente, sobre todo si lleva atrapada más de unos minutos.",
    ],
    sources: ["cdc-crush", "mayo-spinal"],
  },
  {
    id: "shock",
    title: "Shock (gravedad por mala circulación)",
    emoji: "🫥",
    summary:
      "Estado peligroso que puede seguir a una herida grave, quemadura o pérdida de sangre.",
    steps: [
      "Reconoce los signos: piel fría, sudorosa, pálida o grisácea; labios o uñas azulados; pulso rápido; respiración rápida y superficial; debilidad, náuseas o confusión.",
      "Llama al 911.",
      "Recuesta a la persona boca arriba y levántale las piernas un poco (unos 30 cm), salvo que eso le cause dolor o haya una lesión que lo impida.",
      "Mantenla quieta y cómoda; afloja la ropa apretada.",
      "Abrígala con una manta o ropa para que no pierda calor (cubre cabeza, manos y pies).",
    ],
    dont: [
      "No le des de comer ni de tomar nada.",
      "No le levantes las piernas si sospechas lesión de columna, pelvis o pierna, o si le causa dolor o le cuesta respirar.",
      "No la dejes sola.",
    ],
    callEmergency: [
      "Siempre. El shock es una emergencia que pone en peligro la vida.",
    ],
    sources: ["mayo-shock", "ifrc-2020"],
  },
  {
    id: "desmayo-inconsciencia",
    title: "Desmayo o persona inconsciente que respira",
    emoji: "😵",
    summary:
      "Cómo poner a alguien de costado (posición de recuperación) para que no se ahogue.",
    steps: [
      "Si la persona está inconsciente pero RESPIRA y no sospechas lesión de cuello o espalda, ponla de costado para que la vía aérea quede abierta y, si vomita, no se ahogue.",
      "Arrodíllate a su lado. Coloca el brazo más cercano a ti en ángulo recto, con el codo doblado y la palma hacia arriba.",
      "Pasa el otro brazo cruzando el pecho y apoya el dorso de su mano contra la mejilla del lado tuyo.",
      "Dobla la rodilla más lejana hasta que el pie quede apoyado en el piso. Tira de esa rodilla para girar a la persona hacia ti, sobre su costado.",
      "Inclina suavemente la cabeza hacia atrás y levanta el mentón para mantener la vía aérea abierta. Vigila que siga respirando.",
      "Si solo se desmayó y sigue boca arriba sin lesión: acuéstalo, levántale las piernas unos 30 cm y afloja la ropa apretada.",
    ],
    dont: [
      "No la sientes ni la levantes de golpe (puede volver a desmayarse).",
      "No la pongas de costado si sospechas lesión de columna; en ese caso mantenla quieta como está.",
      "No le des de comer ni de tomar hasta que esté totalmente recuperada.",
    ],
    callEmergency: [
      "Si no recobra el conocimiento en 1 minuto.",
      "Si no respira (empieza RCP).",
      "Si se golpeó la cabeza, tiene dolor de pecho, dificultad para respirar, convulsiones, o se desmaya repetidas veces.",
    ],
    sources: ["sja-recovery", "mayo-fainting"],
  },
  {
    id: "golpe-de-calor",
    title: "Golpe de calor / deshidratación",
    emoji: "🥵",
    summary: "Cuando el cuerpo se sobrecalienta: es una emergencia.",
    steps: [
      "Reconoce el golpe de calor: temperatura muy alta (40 °C o más), piel caliente, confusión o habla enredada, pulso y respiración rápidos, náuseas.",
      "Llama al 911 de inmediato.",
      "Saca a la persona del calor y llévala a la sombra o a un lugar fresco.",
      "Enfríala por cualquier medio: ponla bajo agua fresca, mójala, pásale paños con agua fresca, abanícala, o pon paños húmedos en cuello, axilas e ingle.",
      "Si está consciente y puede tragar, dale agua fresca o una bebida con electrolitos (sin alcohol ni cafeína).",
    ],
    dont: [
      "No le des líquidos si está inconsciente o muy confundida (riesgo de ahogarse).",
      "No le des bebidas con alcohol ni cafeína.",
      'No esperes a que "se le pase": el golpe de calor es una emergencia médica.',
    ],
    callEmergency: [
      "Siempre, ante sospecha de golpe de calor (fiebre alta + confusión o pérdida de conocimiento).",
    ],
    sources: ["mayo-heatstroke"],
  },
];
