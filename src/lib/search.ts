/**
 * Búsqueda del catálogo en el cliente.
 *
 * Provisional hasta conectar la base de datos: el buscador en lenguaje natural
 * ("Apartamento grande con 3 baños y parqueadero en Rosales") se resuelve aquí
 * con reglas simples. Con la BD, `filterProperties` se reemplaza por una
 * consulta al servidor que reciba el mismo `SearchFilters`.
 */

import {
  NEIGHBORHOOD_ZONES,
  type Operation,
  type Property,
  type PropertyType,
  type Zone,
} from '../data/properties';

export interface SearchFilters {
  operation: Operation;
  /** null = cualquier tipo. */
  type: PropertyType | null;
  /** Vacío = cualquier zona. */
  zones: Zone[];
  /** Chips del diseño: 1, 2, 3 o 4 (= "4+"). null = sin filtro. */
  bedrooms: number | null;
  bathrooms: number | null;
  minPrice: number;
  maxPrice: number;
  /** Texto libre del buscador. */
  query: string;
}

/** Lo que se pudo entender del texto libre. */
export interface ParsedQuery {
  minBedrooms?: number;
  minBathrooms?: number;
  needsParking?: boolean;
  type?: PropertyType;
  neighborhoods: string[];
  /** Palabras sin interpretar, para buscar en título y barrio. */
  keywords: string[];
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
};

/** Palabras que no aportan a la búsqueda por palabra clave. */
const STOPWORDS = new Set([
  'con', 'para', 'por', 'que', 'una', 'unos', 'unas', 'los', 'las', 'del', 'de', 'en', 'el', 'la',
  'y', 'o', 'a', 'mas', 'muy', 'busco', 'quiero', 'grande', 'bonito', 'bonita', 'cerca', 'bogota',
]);

/** Minúsculas y sin tildes, para comparar "Usaquén" con "usaquen". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function toNumber(token: string): number | undefined {
  const n = Number(token);
  return Number.isFinite(n) ? n : WORD_NUMBERS[token];
}

export function parseQuery(query: string): ParsedQuery {
  const text = normalize(query);
  const parsed: ParsedQuery = { neighborhoods: [], keywords: [] };
  if (!text) return parsed;

  const number = '(\\d+|un|una|uno|dos|tres|cuatro|cinco)';

  const baths = text.match(new RegExp(`${number}\\s*banos?`));
  if (baths) parsed.minBathrooms = toNumber(baths[1]);

  const rooms = text.match(new RegExp(`${number}\\s*(hab|habitacion|habitaciones|alcobas?|cuartos?)\\b`));
  if (rooms) parsed.minBedrooms = toNumber(rooms[1]);

  if (/\b(parqueaderos?|garajes?|parqueo)\b/.test(text)) parsed.needsParking = true;

  if (/\b(apartamento|apartaestudio|apto)\b/.test(text)) parsed.type = 'Apartamento';
  else if (/\bcasa\b/.test(text)) parsed.type = 'Casa';
  else if (/\boficina\b/.test(text)) parsed.type = 'Oficina';

  for (const hood of Object.keys(NEIGHBORHOOD_ZONES)) {
    if (text.includes(normalize(hood))) parsed.neighborhoods.push(hood);
  }

  // Lo que quede, sin números ni palabras ya interpretadas, se busca como texto.
  const consumed = /^(\d+|banos?|hab|habitacion(es)?|alcobas?|cuartos?|parqueaderos?|garajes?|parqueo|apartamento|apartaestudio|apto|casa|oficina)$/;
  const hoodWords = new Set(parsed.neighborhoods.flatMap((h) => normalize(h).split(/\s+/)));
  parsed.keywords = text
    .split(/[^a-z0-9ñ]+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        !STOPWORDS.has(w) &&
        !(w in WORD_NUMBERS) &&
        !consumed.test(w) &&
        !hoodWords.has(w),
    );

  return parsed;
}

/** Los chips usan valor exacto, salvo "4+" que incluye 4 o más. */
function matchesChip(value: number, chip: number | null): boolean {
  if (chip === null) return true;
  return chip === 4 ? value >= 4 : value === chip;
}

export function filterProperties(properties: Property[], filters: SearchFilters): Property[] {
  const parsed = parseQuery(filters.query);

  return properties.filter((p) => {
    if (p.operation !== filters.operation) return false;
    if (filters.type && p.type !== filters.type) return false;
    if (filters.zones.length > 0 && !filters.zones.includes(p.zone)) return false;
    if (!matchesChip(p.bedrooms, filters.bedrooms)) return false;
    if (!matchesChip(p.bathrooms, filters.bathrooms)) return false;
    if (p.price < filters.minPrice || p.price > filters.maxPrice) return false;

    // Texto libre
    if (parsed.minBedrooms && p.bedrooms < parsed.minBedrooms) return false;
    if (parsed.minBathrooms && p.bathrooms < parsed.minBathrooms) return false;
    if (parsed.needsParking && p.parking < 1) return false;
    if (parsed.type && p.type !== parsed.type) return false;
    if (parsed.neighborhoods.length > 0 && !parsed.neighborhoods.includes(p.neighborhood)) {
      return false;
    }
    if (parsed.keywords.length > 0) {
      const haystack = normalize(`${p.title} ${p.neighborhood} ${p.type}`);
      if (!parsed.keywords.some((k) => haystack.includes(k))) return false;
    }

    return true;
  });
}
