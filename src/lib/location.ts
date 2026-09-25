/**
 * Ubicación de las propiedades en el mapa.
 *
 * La columna `direccion` se escribe a mano y mezcla la dirección con datos
 * que confunden a Google Maps ("Torre 3 Apto 1202", "Conjunto Miraflores",
 * "detrás de El Edén") y abreviaturas de todo tipo ("KR", "Cll", "Tranav").
 * Aquí se extrae solo la nomenclatura ("Carrera 71D # 12D-64") para que
 * Google ubique el punto exacto.
 *
 * Si `direccion` es un enlace de Google Maps, el servidor lo resuelve a
 * coordenadas exactas (ver `resolveMapsLink`).
 */

export interface MapLocation {
  /** Texto o "lat,lng" que se le pasa a Google Maps. */
  query: string;
  /** true si ubica el inmueble (dirección o coordenadas), false si solo el barrio. */
  precise: boolean;
}

/** Tipos de vía y sus abreviaturas. El orden importa: las más largas primero. */
const STREET_TYPES: [RegExp, string][] = [
  [/^(avenida\s*carrera|av\.?\s*(cra|kr|carrera)|ak)$/, 'Avenida Carrera'],
  [/^(avenida\s*calle|av\.?\s*(cl|cll|calle)|ac)$/, 'Avenida Calle'],
  [/^(calle|clalle|cll|cl|call)$/, 'Calle'],
  [/^(carrera|cra|kra|kr|cr|crr|k)$/, 'Carrera'],
  [/^(transversal|tranversal|tranav|trans|tv|tr)$/, 'Transversal'],
  [/^(diagonal|diag|dg)$/, 'Diagonal'],
];

const STREET_PATTERN =
  'avenida\\s*carrera|avenida\\s*calle|av\\.?\\s*(?:cra|kr|carrera|cl|cll|calle)|ak|ac|' +
  'calle|clalle|cll|call|cl|carrera|cra|kra|kr|crr|cr|k|' +
  'transversal|tranversal|tranav|trans|tv|diagonal|diag|dg';

/** Número de vía: "150a", "13 C bis", "22 bis", "7F". Solo letras a–h, como en Bogotá. */
const NUMBER = '\\d+(?:\\s?[a-h](?![a-z]))?(?:\\s?bis)?(?:\\s?[a-h](?![a-z]))?';

const ADDRESS = new RegExp(
  `\\b(${STREET_PATTERN})\\.?\\s*(${NUMBER})` + // vía principal: "Carrera 71D"
    `(?:\\s*(?:#|no\\.?|nº|n°|n\\b|con\\b|-)?\\s*(${NUMBER})` + // cruce: "# 12D"
    `(?:\\s*-?\\s*(\\d+))?)?`, // placa: "-64"
  'i',
);

function streetType(raw: string): string | null {
  const key = raw.toLowerCase().replace(/\s+/g, ' ').replace(/\.$/, '').trim();
  return STREET_TYPES.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

/** "13 c bis" -> "13C Bis", "150a" -> "150A". */
function formatNumber(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s([A-H])\b/g, '$1$2')
    .replace(/BIS/, 'Bis')
    .trim();
}

/**
 * Extrae la nomenclatura de una dirección escrita a mano.
 * "Cra. 54 # 126-35 TR 6 AP 303" -> "Carrera 54 # 126-35".
 * Devuelve null si no encuentra una vía reconocible.
 */
export function normalizeAddress(address: string | null): string | null {
  if (!address) return null;
  const match = address.match(ADDRESS);
  if (!match) return null;

  const type = streetType(match[1]);
  if (!type) return null;

  const [, , main, cross, plate] = match;
  let result = `${type} ${formatNumber(main)}`;
  if (cross) result += ` # ${formatNumber(cross)}${plate ? `-${plate}` : ''}`;
  return result;
}

export function isMapsLink(text: string | null): boolean {
  return Boolean(text && /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.)/i.test(text));
}

/** Coordenadas dentro de una URL de Google Maps ("q=4.84,-74.05", "@4.84,-74.05", "!3d4.84!4d-74.05"). */
export function coordsFromMapsUrl(url: string): string | null {
  const decoded = decodeURIComponent(url);
  const match =
    decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ??
    decoded.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) ??
    decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return match ? `${match[1]},${match[2]}` : null;
}

/** Ciudad para completar la búsqueda: las zonas de Chía y Cajicá no son Bogotá. */
function cityFor(zone: string | null, neighborhood: string | null): string {
  const text = `${zone ?? ''} ${neighborhood ?? ''}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
  if (/\bchia\b/.test(text)) return 'Chía, Cundinamarca';
  if (/\bcajica\b/.test(text)) return 'Cajicá, Cundinamarca';
  return 'Bogotá';
}

/** Ubicación a partir de los datos de la fila (sin consultar servicios externos). */
export function buildMapLocation(
  address: string | null,
  neighborhood: string | null,
  zone: string | null,
): MapLocation {
  const city = cityFor(zone, neighborhood);

  if (address && isMapsLink(address)) {
    const coords = coordsFromMapsUrl(address);
    if (coords) return { query: coords, precise: true };
  }

  const street = normalizeAddress(address);
  if (street?.includes('#')) return { query: `${street}, ${city}, Colombia`, precise: true };

  // Solo la vía ("Calle 123"): se acota con el barrio.
  if (street) {
    return {
      query: [street, neighborhood, city, 'Colombia'].filter(Boolean).join(', '),
      precise: false,
    };
  }

  // Sin dirección: el barrio. Google muestra la zona, no el inmueble.
  return {
    query: [neighborhood, city, 'Colombia'].filter(Boolean).join(', '),
    precise: false,
  };
}

const linkCache = new Map<string, Promise<string | null>>();

/**
 * Resuelve un enlace corto de Google Maps (maps.app.goo.gl) a "lat,lng"
 * siguiendo sus redirecciones. Solo en el servidor; el resultado se guarda
 * en memoria porque el enlace no cambia.
 */
export function resolveMapsLink(url: string): Promise<string | null> {
  let pending = linkCache.get(url);
  if (!pending) {
    pending = fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(6000) })
      .then((response) => coordsFromMapsUrl(response.url))
      .catch((error) => {
        console.error(`No se pudo resolver el enlace de Maps ${url}:`, error);
        linkCache.delete(url);
        return null;
      });
    linkCache.set(url, pending);
  }
  return pending;
}
