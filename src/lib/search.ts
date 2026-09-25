/**
 * Búsqueda del catálogo en el cliente.
 *
 * El listado completo llega con la página (unas decenas de inmuebles), así que
 * filtrar en el navegador es instantáneo.
 *
 * El buscador en lenguaje natural ("Apartamento con 3 baños y parqueadero en
 * Cedritos, máximo 500 millones") se resuelve con reglas, sin IA ni APIs: el
 * texto se convierte en filtros y se refleja en los controles de la interfaz
 * (tipo, zona, habitaciones, precio, estrato, características...). Lo que no
 * tiene control (barrio, palabras sueltas) queda como etiquetas bajo el cuadro
 * de texto. Los barrios, zonas y tipos que reconoce salen de los propios
 * datos, así que un barrio nuevo en Supabase se puede buscar sin tocar el
 * código.
 *
 * Si pocos inmuebles cumplen todo, se recomiendan los más parecidos con un
 * puntaje por criterio (p. ej. un precio 10 % por encima cuenta a medias).
 */

import { normalize, type Property } from '../data/properties';

/** Criterios entendidos del texto que no tienen control propio en la interfaz. */
export interface TextFilters {
  neighborhoods: string[];
  /** Palabras sueltas que aparecen en alguna ficha; ordenan, no filtran. */
  keywords: string[];
}

export interface SearchFilters {
  /** null = cualquier tipo. */
  type: string | null;
  /** Vacío = cualquier zona. */
  zones: string[];
  /** Chips del diseño: 1, 2, 3 o 4 (= "4+"). null = sin filtro. */
  bedrooms: number | null;
  bathrooms: number | null;
  /** null = sin límite. */
  minPrice: number | null;
  maxPrice: number | null;
  /* ----- Panel "Más filtros" ----- */
  /** Vacío = cualquier estrato. */
  strata: number[];
  /** m². null = sin límite. */
  minArea: number | null;
  maxArea: number | null;
  /** Años de construido como máximo; uno de AGE_OPTIONS. null = cualquiera. */
  maxAge: number | null;
  /** Debe tenerlas todas. */
  features: Feature[];
  text: TextFilters;
}

/** Los filtros que tienen control en la interfaz. */
export type ControlFilters = Omit<SearchFilters, 'text'>;

export interface ParsedQuery {
  /** Solo los controles que el texto menciona. */
  controls: Partial<ControlFilters>;
  text: TextFilters;
}

export interface SearchResults {
  /** Cumplen todos los filtros. */
  matches: Property[];
  /** No cumplen todo, pero se acercan. Solo cuando hay pocas coincidencias. */
  similar: Property[];
}

export const EMPTY_FILTERS: SearchFilters = {
  type: null,
  zones: [],
  bedrooms: null,
  bathrooms: null,
  // Precio null = sin límite, para no dejar fuera los inmuebles sin precio.
  minPrice: null,
  maxPrice: null,
  strata: [],
  minArea: null,
  maxArea: null,
  maxAge: null,
  features: [],
  text: { neighborhoods: [], keywords: [] },
};

/** Chips de antigüedad: "hasta N años". 1 se muestra como "A estrenar". */
export const AGE_OPTIONS = [1, 5, 10, 20] as const;

export const ageLabel = (years: number) => (years <= 1 ? 'A estrenar' : `Hasta ${years} años`);

/** Con menos coincidencias que esto se muestran opciones parecidas. */
const SIMILAR_WHEN_FEWER_THAN = 4;
const MAX_SIMILAR = 6;
/** Fracción mínima del puntaje para considerar un inmueble "parecido". */
const MIN_SIMILARITY = 0.6;
/** "Alrededor de 500 millones" = 500 M ± 15 %. */
const ABOUT = 0.15;

/* -------------------------------------------------------------------------- */
/* Vocabulario                                                                */
/* -------------------------------------------------------------------------- */

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
};

interface FeatureDefinition {
  label: string;
  /** Cómo lo escribe quien busca (regex sobre texto normalizado). */
  words: string;
  /**
   * Si el inmueble la tiene. Las que no tienen columna propia (piscina,
   * gimnasio...) se buscan en la descripción.
   */
  has: (p: Property, description: string) => boolean;
}

/** Características del panel "Más filtros", en el orden en que se muestran. */
export const FEATURES = {
  parking: {
    label: 'Parqueadero',
    words: 'parqueaderos?|garajes?|parqueo|estacionamientos?|carros?',
    has: (p) => p.hasParking,
  },
  elevator: {
    label: 'Ascensor',
    words: 'ascensor(?:es)?|elevador(?:es)?',
    has: (p) => isYes(p.elevator),
  },
  balcony: {
    label: 'Balcón o terraza',
    words: 'balcon(?:es)?|terrazas?',
    has: (p, d) => isYes(p.balcony) || /\b(balcon|terraza)/.test(d),
  },
  deposit: {
    label: 'Depósito',
    words: 'depositos?|bodegas?|cuarto util',
    has: (p, d) => isYes(p.deposit) || /\bdeposito/.test(d),
  },
  study: {
    label: 'Estudio',
    words: '(?<!aparta )estudios?',
    has: (_, d) => /(?<!aparta )\bestudio/.test(d),
  },
  pool: {
    label: 'Piscina',
    words: 'piscinas?',
    has: (_, d) => /\bpiscina/.test(d),
  },
  kids: {
    label: 'Parque o zona infantil',
    words:
      'parques?(?: (?:infantil(?:es)?|privados?|internos?|de ninos))?|juegos infantiles|zonas? (?:infantil|de ninos)|infantil',
    // \b evita que "parqueadero" cuente como parque.
    has: (_, d) => /\bparques?\b|infantil|zonas? de ninos|juegos de ninos/.test(d),
  },
  gym: {
    label: 'Gimnasio',
    words: 'gimnasios?|gym',
    has: (_, d) => /\b(gimnasio|gym)\b/.test(d),
  },
  bbq: {
    label: 'Zona BBQ',
    words: 'bbq|asador(?:es)?|parrillas?',
    has: (_, d) => /\bbbq\b|asador|parrilla/.test(d),
  },
  social: {
    label: 'Salón comunal',
    words: 'salon (?:comunal|social|de eventos)|casa club|club house',
    has: (_, d) => /salon (comunal|social|de eventos)|casa club|club house/.test(d),
  },
  pets: {
    label: 'Zona de mascotas',
    words: 'mascotas?|pet friendly|perros?|gatos?',
    has: (_, d) => /mascota|pet friendly/.test(d),
  },
  security: {
    label: 'Portería / vigilancia',
    words: '(?:porteria|vigilancia|seguridad(?: privada)?)(?: 24 ?(?:horas|h|7))?',
    has: (_, d) => /porteria|vigilancia|seguridad/.test(d),
  },
  green: {
    label: 'Zonas verdes',
    words: 'zonas? verdes?|jardin(?:es)?|senderos?',
    has: (_, d) => /zonas? verdes|jardin|sendero/.test(d),
  },
  sports: {
    label: 'Canchas',
    words: 'canchas?|squash|tenis',
    has: (_, d) => /cancha|squash|tenis/.test(d),
  },
  sauna: {
    label: 'Sauna o turco',
    words: 'saunas?|turcos?|jacuzzi',
    has: (_, d) => /sauna|turco|jacuzzi/.test(d),
  },
  fireplace: {
    label: 'Chimenea',
    words: 'chimeneas?',
    has: (_, d) => /chimenea/.test(d),
  },
  coworking: {
    label: 'Coworking',
    words: 'co ?working',
    has: (_, d) => /co-?working/.test(d),
  },
} satisfies Record<string, FeatureDefinition>;

export type Feature = keyof typeof FEATURES;

export const FEATURE_KEYS = Object.keys(FEATURES) as Feature[];

/** Palabras que no aportan como palabra clave. */
const STOPWORDS = new Set(
  (
    'algo alguna alguno busco buscando quiero necesito queremos tenga tener tiene ojala ' +
    'para como donde este esta estos estas cerca bogota sector zona barrio inmueble ' +
    'inmuebles propiedad propiedades venta vender compra comprar vivir familia hijos ' +
    'bonito bonita lindo linda bueno buena buen precio pesos valor millones metros ' +
    'habitacion habitaciones alcoba alcobas cuarto cuartos banos estrato tipo tambien ' +
    'minimo maximo menos hasta desde entre alrededor aproximadamente unos unas otro otra ' +
    'mismo misma todo toda todos cual cuales sean pueda puedo quisiera gracias favor hola'
  ).split(' '),
);

/* -------------------------------------------------------------------------- */
/* Utilidades de texto                                                        */
/* -------------------------------------------------------------------------- */

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sinónimos para que "apto" o "apartaestudio" coincidan con los tipos de la BD. */
function canonical(text: string): string {
  return normalize(text)
    .replace(/²/g, '2')
    .replace(/\baparta?[\s-]?estudios?\b|\bloft\b|\bmonoambiente\b/g, 'aparta estudio')
    .replace(/\b(aptos?|apartamentos|departamentos?|deptos?|depas?)\b/g, 'apartamento')
    .replace(/(?<!apartamento (tipo )?)\bduplex\b/g, 'apartamento duplex')
    .replace(/\bcasas\b/g, 'casa');
}

/** Distancia de edición, para tolerar errores como "sedritos" o "chico nabarra". */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

/** Errores tolerados según el largo: ninguno en palabras cortas. */
const allowedTypos = (length: number) => (length >= 10 ? 2 : length >= 7 ? 1 : 0);

/**
 * Busca un nombre en el texto, exacto o con errores de tipeo, y lo borra del
 * texto para que no se vuelva a interpretar. Devuelve el texto sin el nombre,
 * o null si no aparece.
 *
 * Una palabra que ya aparece en las fichas no se toma como error de tipeo:
 * "cocina" no es el barrio "Colina" mal escrito.
 */
function takeName(text: string, name: string, knownWords: Set<string>): string | null {
  const exact = new RegExp(`\\b${escapeRegex(name)}s?\\b`);
  if (exact.test(text)) return text.replace(exact, ' ');

  const typos = allowedTypos(name.length);
  if (typos === 0) return null;

  const words = text.split(/\s+/).filter(Boolean);
  const size = name.split(' ').length;
  for (let i = 0; i + size <= words.length; i++) {
    const candidate = words.slice(i, i + size).join(' ');
    if (knownWords.has(candidate)) continue;
    if (Math.abs(candidate.length - name.length) <= typos && editDistance(candidate, name) <= typos) {
      return [...words.slice(0, i), ...words.slice(i + size)].join(' ');
    }
  }
  return null;
}

/**
 * Aplica un patrón global al texto. Cada coincidencia que `handle` acepta se
 * borra del texto; si devuelve false, se deja para otras reglas.
 */
function extract(
  text: string,
  pattern: RegExp,
  handle: (groups: (string | undefined)[]) => boolean | void,
): string {
  return text.replace(pattern, (match: string, ...args: unknown[]) => {
    const groups = args.slice(0, -2) as (string | undefined)[];
    return handle(groups) === false ? match : ' ';
  });
}

function toCount(token: string): number {
  return WORD_NUMBERS[token] ?? Number(token);
}

/** "1.200" -> 1200 (miles), "1,5" -> 1.5, "450.000.000" -> 450000000. */
function toNumber(token: string): number {
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return Number(token.replace(/\./g, ''));
  if (/^\d{1,3}(,\d{3})+$/.test(token)) return Number(token.replace(/,/g, ''));
  return Number(token.replace(',', '.'));
}

/** Convierte cifra + unidad en pesos. Sin unidad solo acepta cifras completas. */
function toPesos(amount: string, unit: string | undefined): number | null {
  const value = toNumber(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit?.startsWith('mil ')) return value * 1e9;
  if (unit) return value * 1e6;
  return value >= 1e6 ? value : null;
}

type Bound = 'max' | 'min' | 'about';

/** Palabras antes de una cifra que indican si es tope, piso o aproximado. */
const QUALIFIERS =
  '(no mas de|que no (?:pase|supere)(?: de| los)?|menos de|menor a|por debajo de|hasta|maximo|max|tope(?: de)?|presupuesto(?: maximo)?(?: de)?|' +
  'mas o menos|alrededor de|cerca de|aproximadamente|aprox|unos|como|' +
  'mas de|mayor a|por encima de|a partir de|desde|minimo|min|superior a)';

function boundOf(qualifier: string | undefined): Bound {
  if (!qualifier) return 'about';
  if (/^(mas o menos|alrededor|cerca|aprox|unos|como)/.test(qualifier)) return 'about';
  if (/^(no mas|que no|menos|menor|por debajo|hasta|max|tope|presupuesto)/.test(qualifier)) {
    return 'max';
  }
  return 'min';
}

/** Aplica una cota a un rango [min, max]. */
function applyBound(bound: Bound, value: number, range: { min: number | null; max: number | null }) {
  if (bound === 'max') range.max = value;
  else if (bound === 'min') range.min = value;
  else {
    range.min = Math.round(value * (1 - ABOUT));
    range.max = Math.round(value * (1 + ABOUT));
  }
}

/* -------------------------------------------------------------------------- */
/* Interpretación del texto                                                   */
/* -------------------------------------------------------------------------- */

const NUM = '(\\d+(?:[.,]\\d+)*)';
const COUNT = '(\\d+|un|una|uno|dos|tres|cuatro|cinco|seis)';
const MONEY_UNIT = '(mil millones|millones|millon|mill|mm|palos?)';
const AREA_UNIT = '(?:m2|mts2?|mtrs|mt2|metros(?: cuadrados)?|m)';

/**
 * Convierte el texto libre en filtros.
 *
 * Cada regla borra del texto lo que interpreta, así "3 baños" no se vuelve a
 * leer como precio y lo que sobra al final son palabras clave.
 */
export function parseQuery(query: string, properties: Property[]): ParsedQuery {
  const controls: Partial<ControlFilters> = {};
  const text: TextFilters = { neighborhoods: [], keywords: [] };

  // "500M" con M mayúscula es precio; "80 m" en minúscula, área.
  let rest = canonical(
    query
      .replace(/(\d)\s*M\b/g, '$1 millones')
      .replace(/(\d)\s*\+/g, '$1 o mas ')
      .replace(/[“”"'¿?¡!;:()]/g, ' '),
  )
    .replace(/(?<![\d.,]\s*)\bmil millones\b/g, '1 mil millones')
    .replace(/\s+/g, ' ');

  if (!rest.trim()) return { controls, text };

  /* ----- Precio ----- */
  const price = { min: null as number | null, max: null as number | null };

  // "entre 300 y 450 millones", "de 300 a 450 millones": la unidad puede ir solo al final.
  rest = extract(
    rest,
    new RegExp(`\\b(?:entre|de|desde) \\$?\\s*${NUM}\\s*${MONEY_UNIT}? (?:y|a|hasta|-) \\$?\\s*${NUM}\\s*${MONEY_UNIT}?\\b`, 'g'),
    ([fromAmount, fromUnit, toAmount, toUnit]) => {
      const to = toPesos(toAmount!, toUnit);
      const from = toPesos(fromAmount!, fromUnit ?? toUnit);
      if (from === null || to === null) return false;
      price.min = Math.min(from, to);
      price.max = Math.max(from, to);
    },
  );

  rest = extract(
    rest,
    new RegExp(`(?:\\b${QUALIFIERS} )?(\\$\\s*)?${NUM}\\s*${MONEY_UNIT}?\\b`, 'g'),
    ([qualifier, currency, amount, unit]) => {
      const value = toPesos(amount!, unit);
      if (value === null || (!unit && !currency && value < 1e6)) return false;
      applyBound(boundOf(qualifier), value, price);
    },
  );

  if (price.min !== null) controls.minPrice = price.min;
  if (price.max !== null) controls.maxPrice = price.max;

  /* ----- Área ----- */
  const area = { min: null as number | null, max: null as number | null };
  rest = extract(
    rest,
    new RegExp(`(?:\\b${QUALIFIERS} )?${NUM}\\s*${AREA_UNIT}\\b`, 'g'),
    ([qualifier, amount]) => {
      const value = toNumber(amount!);
      if (!Number.isFinite(value) || value < 10) return false;
      applyBound(boundOf(qualifier), value, area);
    },
  );
  if (area.min !== null) controls.minArea = area.min;
  if (area.max !== null) controls.maxArea = area.max;

  /* ----- Antigüedad: "para estrenar", "menos de 10 años" ----- */
  rest = extract(rest, /\b(?:para |a )?estrenar\b|\bobra nueva\b|\bnuevos?\b(?! country)/g, () => {
    controls.maxAge = AGE_OPTIONS[0];
  });
  rest = extract(
    rest,
    new RegExp(`(?:\\b${QUALIFIERS} )?${NUM} anos?(?: de (?:construido|construccion|antiguedad))?\\b`, 'g'),
    ([, amount]) => {
      // Se ajusta al chip más cercano por encima: "menos de 8 años" -> "Hasta 10 años".
      const years = toNumber(amount!);
      const option = AGE_OPTIONS.find((o) => o >= years);
      if (option === undefined) return false;
      controls.maxAge = option;
    },
  );

  /* ----- Habitaciones y baños ----- */
  rest = extract(
    rest,
    new RegExp(
      `\\b${COUNT}\\s*(?:o mas )?(?:habitaciones|habitacion|habs?|alcobas?|cuartos?|piezas?|dormitorios?|recamaras?)\\b`,
      'g',
    ),
    ([count]) => {
      controls.bedrooms = Math.min(toCount(count!), 4);
    },
  );

  rest = extract(rest, new RegExp(`\\b${COUNT}\\s*(?:o mas )?banos?\\b`, 'g'), ([count]) => {
    controls.bathrooms = Math.min(Math.floor(toCount(count!)), 4);
  });

  /* ----- Estrato: "estrato 4", "estratos 3 o 4", "estrato 3 a 5" ----- */
  rest = extract(rest, /\bestratos? ((?:\d(?: ?(?:,|y|o|a|-) ?)?)+)/g, ([list]) => {
    const digits = (list!.match(/\d/g) ?? []).map(Number);
    const strata = new Set(controls.strata);
    if (digits.length === 2 && /\d ?(a|-) ?\d/.test(list!)) {
      for (let n = Math.min(...digits); n <= Math.max(...digits); n++) strata.add(n);
    } else {
      digits.forEach((d) => strata.add(d));
    }
    controls.strata = [...strata].sort();
  });

  /* ----- Tipo: el más específico primero ("apartamento duplex" antes que "apartamento") ----- */
  const types = [...new Set(properties.map((p) => p.type).filter(Boolean) as string[])]
    .map((type) => ({ type, key: canonical(type) }))
    .sort((a, b) => b.key.length - a.key.length);
  for (const { type, key } of types) {
    const pattern = new RegExp(`\\b${escapeRegex(key)}s?\\b`);
    if (pattern.test(rest)) {
      controls.type = type;
      rest = rest.replace(pattern, ' ');
      break;
    }
  }

  /* ----- Zonas y barrios ----- */
  // Los nombres más largos primero, para que "Chico Norte" no se lea como la zona "Norte".
  // Con el mismo largo gana la zona escrita completa ("Suba" es zona y barrio),
  // luego el barrio y por último una palabra suelta de la zona ("cajica").
  const zoneNames = [...new Set(properties.map((p) => p.zone).filter(Boolean) as string[])];
  const hoodNames = [...new Set(properties.map((p) => p.neighborhood).filter(Boolean) as string[])];
  const places = [
    ...zoneNames.map((value) => ({ value, key: normalize(value), kind: 'zone' as const, rank: 0 })),
    ...hoodNames.map((value) => ({ value, key: normalize(value), kind: 'hood' as const, rank: 1 })),
    ...zoneNames.flatMap((value) =>
      normalize(value)
        .split(' ')
        .filter((word) => word.length >= 4 && !['norte', 'sur'].includes(word) && word !== normalize(value))
        .map((word) => ({ value, key: word, kind: 'zone' as const, rank: 2 })),
    ),
  ].sort((a, b) => b.key.length - a.key.length || a.rank - b.rank);

  const haystacks = properties.map(haystackOf);
  const knownWords = new Set(haystacks.flatMap((haystack) => haystack.split(/[^a-z0-9ñ]+/)));
  const zones = new Set<string>();
  for (const place of places) {
    const remaining = takeName(rest, place.key, knownWords);
    if (remaining === null) continue;
    rest = remaining;
    if (place.kind === 'zone') zones.add(place.value);
    else if (!text.neighborhoods.includes(place.value)) text.neighborhoods.push(place.value);
  }
  if (zones.size > 0) controls.zones = [...zones];

  /* ----- Características ("sin ascensor" no se exige) ----- */
  // Después de los barrios, para que "Parques de Alameda" no se lea como "parque".
  const features = new Set<Feature>();
  for (const feature of FEATURE_KEYS) {
    const { words } = FEATURES[feature];
    rest = extract(rest, new RegExp(`\\b(sin |no )?(?:${words})\\b`, 'g'), ([negated]) => {
      if (!negated) features.add(feature);
    });
  }
  if (features.size > 0) controls.features = FEATURE_KEYS.filter((f) => features.has(f));

  /* ----- Palabras clave: solo las que aparecen en alguna ficha ----- */
  text.keywords = [
    ...new Set(
      rest
        .split(/[^a-z0-9ñ]+/)
        .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d/.test(word)),
    ),
  ].filter((word) => haystacks.some((haystack) => haystack.includes(stem(word))));

  return { controls, text };
}

/* -------------------------------------------------------------------------- */
/* Filtrado y similitud                                                       */
/* -------------------------------------------------------------------------- */

/** "remodelados" -> "remodelado", para comparar sin importar el plural. */
function stem(word: string): string {
  return word.length > 4 ? word.replace(/(es|s)$/, '') : word;
}

const haystackCache = new WeakMap<Property, string>();

function haystackOf(p: Property): string {
  let haystack = haystackCache.get(p);
  if (haystack === undefined) {
    haystack = normalize(
      [p.title, p.code, p.zone, p.type, p.address, p.description, p.bedroomsText, p.floor, p.areaText, p.parking, p.age]
        .filter(Boolean)
        .join(' '),
    );
    haystackCache.set(p, haystack);
  }
  return haystack;
}

/** "SI", "1", "SI, DIRECTO AL APTO" cuentan; "NO APLICA" o "POR PREGUNTAR", no. */
function isYes(value: string | null): boolean {
  return value !== null && /^(si|1)\b/.test(normalize(value));
}

const descriptionCache = new WeakMap<Property, string>();

export function hasFeature(p: Property, feature: Feature): boolean {
  let description = descriptionCache.get(p);
  if (description === undefined) {
    description = normalize([p.description, p.bedroomsText, p.areaText].filter(Boolean).join(' '));
    descriptionCache.set(p, description);
  }
  return (FEATURES[feature] as FeatureDefinition).has(p, description);
}

/** "A ESTRENAR" -> 0, "10 Años de Construido" -> 10, "POR AVERIGUAR" -> null. */
function ageInYears(p: Property): number | null {
  if (!p.age) return null;
  const age = normalize(p.age);
  if (/estrenar|nuevo|menos de 1/.test(age)) return 0;
  // "42 AÑOS EL TERRENO, LA CASA 1.4 AÑOS": cuenta la construcción, el último número.
  const numbers = age.match(/\d+(?:[.,]\d+)?/g);
  return numbers ? Number(numbers.at(-1)!.replace(',', '.')) : null;
}

/**
 * 1 si el valor está en el rango; baja hasta 0 a medida que se aleja.
 * Con la tolerancia por defecto, un 15 % fuera del rango vale 0,5.
 */
function rangeScore(value: number | null, min: number | null, max: number | null, tolerance = ABOUT): number {
  if (min === null && max === null) return 1;
  if (value === null) return 0;
  const below = min !== null && value < min ? (min - value) / min : 0;
  const above = max !== null && value > max ? (value - max) / max : 0;
  const miss = Math.max(below, above);
  return miss === 0 ? 1 : Math.max(0, 1 - miss / (2 * tolerance));
}

/** Los chips usan valor exacto, salvo "4+" que incluye 4 o más. Uno de diferencia vale 0,5. */
function chipScore(value: number | null, chip: number): number {
  if (value === null) return 0;
  const whole = Math.floor(value);
  const distance = chip === 4 ? Math.max(0, 4 - whole) : Math.abs(whole - chip);
  return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
}

interface Criterion {
  weight: number;
  /** 1 = cumple, 0 = no se parece en nada. */
  score: (p: Property) => number;
}

function buildCriteria(filters: SearchFilters, properties: Property[]): Criterion[] {
  const criteria: Criterion[] = [];
  const { text } = filters;

  if (filters.type) {
    const wanted = normalize(filters.type);
    criteria.push({
      weight: 3,
      score: (p) => {
        const type = normalize(p.type ?? '');
        if (type === wanted) return 1;
        // "Apartamento" y "Apartamento Duplex" se parecen.
        return type && (type.includes(wanted) || wanted.includes(type)) ? 0.5 : 0;
      },
    });
  }

  if (filters.zones.length > 0) {
    criteria.push({ weight: 2, score: (p) => (p.zone && filters.zones.includes(p.zone) ? 1 : 0) });
  }

  if (text.neighborhoods.length > 0) {
    // Otro barrio de la misma zona cuenta a medias.
    const nearbyZones = new Set(
      properties
        .filter((p) => p.zone && p.neighborhood && text.neighborhoods.includes(p.neighborhood))
        .map((p) => p.zone),
    );
    criteria.push({
      weight: 3,
      score: (p) =>
        p.neighborhood && text.neighborhoods.includes(p.neighborhood) ? 1 : nearbyZones.has(p.zone) ? 0.5 : 0,
    });
  }

  if (filters.bedrooms !== null) {
    const chip = filters.bedrooms;
    criteria.push({ weight: 2, score: (p) => chipScore(p.bedrooms, chip) });
  }

  if (filters.bathrooms !== null) {
    const chip = filters.bathrooms;
    criteria.push({ weight: 1.5, score: (p) => chipScore(p.bathrooms, chip) });
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    criteria.push({ weight: 3, score: (p) => rangeScore(p.price, filters.minPrice, filters.maxPrice) });
  }

  if (filters.minArea !== null || filters.maxArea !== null) {
    criteria.push({ weight: 1, score: (p) => rangeScore(p.area, filters.minArea, filters.maxArea) });
  }

  if (filters.strata.length > 0) {
    criteria.push({
      weight: 1.5,
      score: (p) => {
        if (p.stratum === null) return 0;
        const distance = Math.min(...filters.strata.map((s) => Math.abs(s - p.stratum!)));
        return distance === 0 ? 1 : distance === 1 ? 0.5 : 0;
      },
    });
  }

  if (filters.maxAge !== null) {
    const maxAge = filters.maxAge;
    criteria.push({
      weight: 1,
      score: (p) => {
        const age = ageInYears(p);
        if (age === null) return 0;
        return age <= maxAge ? 1 : age <= maxAge + 5 ? 0.5 : 0;
      },
    });
  }

  for (const feature of filters.features) {
    criteria.push({ weight: 1, score: (p) => (hasFeature(p, feature) ? 1 : 0) });
  }

  return criteria;
}

export function searchProperties(properties: Property[], filters: SearchFilters): SearchResults {
  const criteria = buildCriteria(filters, properties);
  const keywords = filters.text.keywords.map(stem);
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  const scored = properties.map((property, index) => {
    const scores = criteria.map((c) => c.score(property));
    const haystack = haystackOf(property);
    return {
      property,
      index,
      exact: scores.every((s) => s === 1),
      similarity: totalWeight
        ? scores.reduce((sum, s, i) => sum + s * criteria[i].weight, 0) / totalWeight
        : 1,
      keywordHits: keywords.filter((k) => haystack.includes(k)).length,
    };
  });

  // Las palabras clave no descartan: suben en la lista las fichas que las mencionan.
  const byKeywords = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    b.keywordHits - a.keywordHits || a.index - b.index;

  const matches = scored.filter((s) => s.exact).sort(byKeywords);

  const similar =
    criteria.length > 0 && matches.length < SIMILAR_WHEN_FEWER_THAN
      ? scored
          .filter((s) => !s.exact && s.similarity >= MIN_SIMILARITY)
          .sort((a, b) => b.similarity - a.similarity || byKeywords(a, b))
          .slice(0, MAX_SIMILAR)
      : [];

  return {
    matches: matches.map((s) => s.property),
    similar: similar.map((s) => s.property),
  };
}

/* -------------------------------------------------------------------------- */
/* Etiquetas de lo entendido                                                  */
/* -------------------------------------------------------------------------- */

export interface FilterTag {
  key: string;
  label: string;
  /** Cambio que quita esta etiqueta de los filtros. */
  remove: Partial<SearchFilters>;
}

const formatArea = (value: number) => `${Math.round(value).toLocaleString('es-CO')} m²`;

/**
 * Etiquetas removibles para lo que no se ve en los bloques de arriba: lo
 * entendido del texto sin control propio y lo elegido en "Más filtros".
 */
export function describeExtraFilters(filters: SearchFilters): FilterTag[] {
  const tags: FilterTag[] = [];
  const { text } = filters;

  for (const hood of text.neighborhoods) {
    tags.push({
      key: `barrio-${hood}`,
      label: hood,
      remove: { text: { ...text, neighborhoods: text.neighborhoods.filter((h) => h !== hood) } },
    });
  }

  if (filters.strata.length > 0) {
    const list = [...filters.strata].sort();
    tags.push({
      key: 'estrato',
      label: `Estrato ${list.length > 1 ? `${list.slice(0, -1).join(', ')} o ${list.at(-1)}` : list[0]}`,
      remove: { strata: [] },
    });
  }

  if (filters.minArea !== null || filters.maxArea !== null) {
    const { minArea, maxArea } = filters;
    const label =
      minArea !== null && maxArea !== null
        ? `${formatArea(minArea)} – ${formatArea(maxArea)}`
        : minArea !== null
          ? `Desde ${formatArea(minArea)}`
          : `Hasta ${formatArea(maxArea!)}`;
    tags.push({ key: 'area', label, remove: { minArea: null, maxArea: null } });
  }

  if (filters.maxAge !== null) {
    tags.push({ key: 'antiguedad', label: ageLabel(filters.maxAge), remove: { maxAge: null } });
  }

  for (const feature of filters.features) {
    tags.push({
      key: feature,
      label: FEATURES[feature].label,
      remove: { features: filters.features.filter((f) => f !== feature) },
    });
  }

  for (const keyword of text.keywords) {
    tags.push({
      key: `palabra-${keyword}`,
      label: `“${keyword}”`,
      remove: { text: { ...text, keywords: text.keywords.filter((k) => k !== keyword) } },
    });
  }

  return tags;
}
