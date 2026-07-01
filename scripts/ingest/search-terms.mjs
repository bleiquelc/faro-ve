/**
 * Términos de búsqueda para enumerar venezuela-te-busca (la fuente pasó a un modelo
 * SOLO-búsqueda: `query` de ≥3 chars matchea substring de nombre Y de ubicación, y
 * pagina por cursor). Cubrir la mayor parte del registro = barrer nombres comunes +
 * apellidos + ubicaciones; la RED DE TRIGRAMAS de respaldo captura los nombres raros
 * (todo nombre de ≥3 letras contiene algún trigrama frecuente). La dedup por
 * (source, source_id) hace inofensivo el solape entre términos.
 *
 * Orden importa: primero lo más frecuente (más cobertura temprana), luego el
 * respaldo. El runner corta cada término al agotar registros NUEVOS (los nuevos van
 * primero por created_at desc), así el solape no cuesta caro.
 */

// Nombres de pila frecuentes en Venezuela (M + F), sin acentos, minúscula.
const FIRST_NAMES = [
  'jose', 'maria', 'jesus', 'carlos', 'luis', 'juan', 'pedro', 'miguel', 'rafael',
  'francisco', 'antonio', 'manuel', 'gabriel', 'daniel', 'david', 'victor', 'angel',
  'oscar', 'cesar', 'jorge', 'alberto', 'eduardo', 'fernando', 'ricardo', 'roberto',
  'sergio', 'andres', 'alejandro', 'javier', 'diego', 'pablo', 'marco', 'hector',
  'hugo', 'ivan', 'ramon', 'ruben', 'simon', 'tomas', 'vicente', 'wilmer', 'jonathan',
  'yormary', 'deivis', 'deibis', 'jean', 'jesus', 'jose luis', 'jose gregorio',
  'gregorio', 'edgar', 'elias', 'enrique', 'ernesto', 'felix', 'gustavo', 'ignacio',
  'jhon', 'johan', 'jose manuel', 'julio', 'leonardo', 'lorenzo', 'marcos', 'mario',
  'martin', 'moises', 'nelson', 'omar', 'orlando', 'pedro luis', 'rene', 'reinaldo',
  'roger', 'rodolfo', 'salvador', 'santiago', 'saul', 'sebastian', 'wilfredo',
  'williams', 'yonathan', 'yorman', 'yenderson', 'kevin', 'brian', 'anderson',
  // Femeninos
  'ana', 'carmen', 'rosa', 'luisa', 'marta', 'elena', 'teresa', 'gloria', 'isabel',
  'patricia', 'sandra', 'monica', 'laura', 'andrea', 'paola', 'daniela', 'gabriela',
  'valentina', 'camila', 'sofia', 'natalia', 'adriana', 'mariana', 'yesenia',
  'yulimar', 'yuleidy', 'deisy', 'yanet', 'yaneth', 'zuleima', 'zulay', 'nairobi',
  'nazareth', 'oriana', 'yohana', 'yoselin', 'yorgelis', 'yusmary', 'keila', 'keila',
  'maria jose', 'maria fernanda', 'maria gabriela', 'maria alejandra', 'ana maria',
  'francis', 'genesis', 'geraldine', 'greisy', 'jennifer', 'jessica', 'karla',
  'katherine', 'leidy', 'lisbeth', 'marielys', 'nathaly', 'norelys', 'rosangela',
  'yannelis', 'yelitza', 'yenifer', 'yorley', 'yusneidy', 'wendy', 'wilmary'
];

// Apellidos frecuentes en Venezuela, sin acentos, minúscula.
const SURNAMES = [
  'gonzalez', 'rodriguez', 'perez', 'gomez', 'hernandez', 'garcia', 'martinez',
  'lopez', 'sanchez', 'ramirez', 'torres', 'flores', 'rivas', 'rojas', 'moreno',
  'romero', 'diaz', 'alvarez', 'ruiz', 'blanco', 'castro', 'ortega', 'guerrero',
  'medina', 'aguilar', 'vargas', 'mendoza', 'silva', 'marcano', 'bolivar', 'colina',
  'paredes', 'guerra', 'salazar', 'fuentes', 'contreras', 'figueroa', 'acosta',
  'molina', 'herrera', 'jimenez', 'mora', 'suarez', 'reyes', 'delgado', 'cordero',
  'pena', 'guzman', 'navarro', 'campos', 'vega', 'cabrera', 'rincon', 'chacon',
  'quintero', 'graterol', 'brito', 'montilla', 'camacho', 'escalona', 'zambrano',
  'castillo', 'rangel', 'sequera', 'sarmiento', 'lugo', 'nava', 'urbina', 'pineda',
  'palacios', 'carrillo', 'valera', 'villalobos', 'sivira', 'ojeda', 'gil', 'leon',
  'espinoza', 'gutierrez', 'dominguez', 'aponte', 'bello', 'briceno', 'carrasco',
  'crespo', 'duarte', 'farias', 'gallardo', 'guevara', 'lara', 'linares', 'marin',
  'meza', 'millan', 'nunez', 'ortiz', 'parra', 'quintana', 'ramos', 'rivero',
  'sosa', 'tovar', 'valero', 'velasquez', 'zapata', 'zerpa'
];

// Estados + ciudades/municipios (la búsqueda también matchea ubicación).
const PLACES = [
  'amazonas', 'anzoategui', 'apure', 'aragua', 'barinas', 'bolivar', 'carabobo',
  'cojedes', 'delta amacuro', 'falcon', 'guarico', 'lara', 'merida', 'miranda',
  'monagas', 'nueva esparta', 'portuguesa', 'sucre', 'tachira', 'trujillo', 'vargas',
  'yaracuy', 'zulia', 'caracas', 'distrito capital', 'la guaira', 'maracaibo',
  'valencia', 'barquisimeto', 'maracay', 'ciudad guayana', 'san cristobal', 'maturin',
  'barcelona', 'cumana', 'puerto la cruz', 'petare', 'turmero', 'cabimas', 'guarenas',
  'los teques', 'guacara', 'coro', 'carupano', 'el tigre', 'guanare', 'acarigua',
  'punto fijo', 'cabudare', 'ocumare', 'charallave', 'guatire', 'santa teresa',
  'san felipe', 'valle de la pascua', 'calabozo', 'san carlos', 'san juan',
  'puerto cabello', 'la victoria', 'cagua', 'palo negro', 'ejido', 'el vigia',
  'tucupita', 'porlamar', 'pampatar', 'catia', 'baruta', 'chacao', 'sucre',
  'libertador', 'sebucan', 'antimano', 'catia la mar', 'macuto', 'naiguata'
];

// Red de trigramas de respaldo: onset/coda frecuentes en nombres hispanos, para
// capturar los que no matchean nombre/apellido/lugar de las listas de arriba.
const TRIGRAMS = [
  'san', 'jos', 'jua', 'mar', 'car', 'lui', 'jes', 'ang', 'gab', 'dan', 'dav',
  'vic', 'ale', 'and', 'fra', 'ant', 'man', 'ped', 'mig', 'raf', 'ric', 'rob',
  'ser', 'fer', 'edu', 'arm', 'wil', 'yor', 'yon', 'dei', 'gre', 'yul', 'yes',
  'ros', 'ele', 'ter', 'glo', 'isa', 'pat', 'mon', 'lau', 'pao', 'nat', 'adr',
  'val', 'sof', 'cam', 'ana', 'luz', 'flo', 'nor', 'oli', 'ram', 'rey', 'riv',
  'roj', 'rod', 'rom', 'rui', 'sal', 'sil', 'sua', 'tor', 'var', 'veg', 'vil',
  'zam', 'gon', 'gom', 'her', 'gar', 'per', 'lop', 'alv', 'bla', 'cas', 'ort',
  'gue', 'med', 'agu', 'men', 'bol', 'col', 'par', 'fue', 'con', 'fig', 'aco',
  'mol', 'jim', 'del', 'cor', 'guz', 'nav', 'cab', 'rin', 'cha', 'qui', 'gra',
  'bri', 'esc', 'cru', 'est', 'nie', 'paz', 'rio', 'zam', 'bar', 'ber', 'bet',
  'cel', 'cin', 'dia', 'dom', 'esp', 'eve', 'fab', 'gil', 'ibe', 'kar', 'ken',
  'lil', 'mel', 'nel', 'oma', 'ovi', 'pas', 'qué', 'sam', 'tab', 'uli', 'wen',
  'xav', 'yan', 'zab', 'ceci', 'gene', 'greg'
];

function normalize(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Lista final: normalizada, ≥3 chars, sin duplicados, en orden de frecuencia.
export const TERMS = [...new Set(
  [...FIRST_NAMES, ...SURNAMES, ...PLACES, ...TRIGRAMS]
    .map(normalize)
    .filter((t) => t.replace(/\s+/g, '').length >= 3)
)];
