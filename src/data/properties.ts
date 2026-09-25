/**
 * Catálogo público de propiedades.
 *
 * Los datos vienen de la vista `propiedades_publicas` en Supabase, que solo
 * contiene la información que puede llegar al navegador. Los campos internos
 * (captador, documentos, link_agente, ficha_inmueble) se quedan en la tabla
 * `propiedades`.
 *
 * Este archivo no consulta la base de datos (eso está en `src/lib/catalog.ts`),
 * así que las islas de React pueden importar sus tipos y formateadores.
 *
 * El sitio se renderiza en el servidor en cada visita (ver astro.config.mjs),
 * así que agregar o eliminar una fila en Supabase agrega o elimina la
 * propiedad del sitio sin tocar el código.
 */

import { WHATSAPP_URL } from './site';
import { buildMapLocation, isMapsLink } from '../lib/location';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/** Fila de la vista `propiedades_publicas`. */
export interface PublicRow {
  id: string;
  id_inmueble: number;
  codigo: string | null;
  estatus: string | null;
  zona: string | null;
  barrio: string | null;
  direccion: string | null;
  tipo: string | null;
  precio: number | null;
  habitaciones: string | null;
  banos: number | null;
  area: string | null;
  estrato: number | null;
  antiguedad: string | null;
  balcon_terraza: string | null;
  parqueadero: string | null;
  deposito: string | null;
  ascensor: string | null;
  administracion: number | null;
  piso: string | null;
  informacion_adicional: string | null;
  link_instagram: string | null;
  fotos: string | null;
  created_at: string;
}

/**
 * Propiedad lista para la interfaz.
 *
 * Los textos llegan de la hoja original en mayúsculas y con formatos libres
 * ("126 MTRS", "3 MAS ESTUDIO", "📍"). Aquí se limpian una sola vez; los
 * campos `*Text` conservan el valor original (ya legible) y los numéricos
 * derivados sirven para filtrar.
 */
export interface Property {
  /** `id_inmueble`. */
  id: number;
  /** URL: tipo + barrio + id, p. ej. `casa-villas-de-granada-38`. */
  slug: string;
  code: string | null;
  /** "Casa en Villas de Granada". */
  title: string;
  type: string | null;
  status: string | null;
  /** true si la propiedad no está marcada como disponible. */
  unavailable: boolean;
  zone: string | null;
  neighborhood: string | null;
  address: string | null;
  /** Búsqueda para Google Maps: dirección normalizada, coordenadas o barrio. */
  mapQuery: string;
  /** true si el mapa ubica el inmueble; false si solo muestra el barrio. */
  mapPrecise: boolean;
  /** Enlace de Google Maps escrito en `direccion`; el servidor lo resuelve a coordenadas. */
  mapsLink: string | null;
  /** Coordenadas del pin; las completa el servidor (`src/lib/geocode.ts`). */
  lat: number | null;
  lng: number | null;
  price: number | null;
  bedrooms: number | null;
  bedroomsText: string | null;
  bathrooms: number | null;
  area: number | null;
  areaText: string | null;
  stratum: number | null;
  age: string | null;
  parking: string | null;
  hasParking: boolean;
  floor: string | null;
  adminFee: number | null;
  balcony: string | null;
  deposit: string | null;
  elevator: string | null;
  description: string | null;
  instagramUrl: string | null;
  photosUrl: string | null;
  /** Foto de portada para las tarjetas. */
  cover: string;
}

export interface PropertyImage {
  full: string;
  thumb: string;
}

/** Imagen para las propiedades que aún no tienen fotos. */
export const PLACEHOLDER_IMAGE = '/assets/img/sin-fotos.svg';

/* -------------------------------------------------------------------------- */
/* Limpieza de texto                                                          */
/* -------------------------------------------------------------------------- */

/** Minúsculas y sin tildes, para comparar textos. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SMALL_WORDS = new Set(['a', 'de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'con', 'por']);

/** "VILLAS DE GRANADA" -> "Villas de Granada". */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(' ');
}

/** "3 MAS ESTUDIO" -> "3 más estudio". Solo la primera letra en mayúscula. */
function toSentenceCase(text: string): string {
  const lower = text.toLowerCase().replace(/\bmas\b/g, 'más');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Quita emojis, espacios de más y valores vacíos como "-" o "📍". */
function clean(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = value
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text && !/^[-–.\s]*$/.test(text) ? text : null;
}

/** Primer número de un texto: "82.15MTRS" -> 82.15, "3 Y ESTUDIO" -> 3. */
function leadingNumber(text: string | null): number | null {
  const match = text?.match(/^\s*(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(',', '.')) : null;
}

/** "126 MTRS" -> "126 m²", "82.15MTRS" -> "82.15 m²". */
function formatAreaText(text: string | null): string | null {
  if (!text) return null;
  return toSentenceCase(text)
    .replace(/(\d)\s*(mtrs|mts|mt2|m2|mt|metros)\b/gi, '$1 m²')
    .replace(/\b(mtrs|mts)\b/gi, 'm²');
}

/** "SI" -> "Sí", "NO APLICA" -> "No aplica". */
function formatYesNo(text: string | null): string | null {
  if (!text) return null;
  const value = normalize(text);
  if (value === 'si' || value === '1') return 'Sí';
  if (value === 'no' || value === '0') return 'No';
  return toSentenceCase(text);
}

/** "CODIGO: 390 CASA VILLAS DE GRANADA" se quita: el código ya se muestra aparte. */
function cleanDescription(text: string | null): string | null {
  if (!text) return null;
  // Se limpia línea por línea para conservar los saltos de línea del texto original.
  const lines = text
    .replace(/c[oó]digo\s*:?\s*[^\n]*$/i, '')
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean);
  return lines.join('\n').replace(/[.\s]+$/, '') || null;
}

function isNegative(text: string | null): boolean {
  if (!text) return true;
  return /^(no|0|ninguno)\b/.test(normalize(text));
}

/* -------------------------------------------------------------------------- */
/* Adaptación de Supabase al frontend                                         */
/* -------------------------------------------------------------------------- */

export function mapRow(row: PublicRow): Property {
  const type = clean(row.tipo) ? toTitleCase(clean(row.tipo)!) : null;
  const neighborhood = clean(row.barrio) ? toTitleCase(clean(row.barrio)!) : null;
  const zone = clean(row.zona) ? toTitleCase(clean(row.zona)!) : null;
  const status = clean(row.estatus);
  const bedroomsText = clean(row.habitaciones);
  const areaText = formatAreaText(clean(row.area));
  const parking = clean(row.parqueadero);
  const rawAddress = clean(row.direccion);
  const mapsLink = isMapsLink(rawAddress) ? rawAddress : null;
  const location = buildMapLocation(rawAddress, neighborhood, zone);

  const title = [type ?? 'Inmueble', neighborhood && `en ${neighborhood}`]
    .filter(Boolean)
    .join(' ');

  return {
    id: row.id_inmueble,
    slug: `${slugify(`${type ?? 'inmueble'} ${neighborhood ?? ''}`)}-${row.id_inmueble}`,
    code: clean(row.codigo),
    title,
    type,
    status,
    unavailable: status !== null && normalize(status) !== 'disponible',
    zone,
    neighborhood,
    // Un enlace de Maps no es una dirección legible: no se muestra como texto.
    address: mapsLink ? null : rawAddress,
    mapQuery: location.query,
    mapPrecise: location.precise,
    mapsLink,
    lat: null,
    lng: null,
    price: row.precio,
    bedrooms: leadingNumber(bedroomsText),
    bedroomsText: bedroomsText && toSentenceCase(bedroomsText),
    bathrooms: row.banos,
    area: leadingNumber(areaText),
    areaText,
    stratum: row.estrato,
    age: clean(row.antiguedad) && toSentenceCase(clean(row.antiguedad)!),
    parking: parking && toSentenceCase(parking),
    hasParking: !isNegative(parking),
    floor: clean(row.piso) && toSentenceCase(clean(row.piso)!),
    adminFee: row.administracion,
    balcony: formatYesNo(clean(row.balcon_terraza)),
    deposit: formatYesNo(clean(row.deposito)),
    elevator: formatYesNo(clean(row.ascensor)),
    description: cleanDescription(row.informacion_adicional),
    instagramUrl: clean(row.link_instagram),
    photosUrl: clean(row.fotos),
    cover: clean(row.fotos) ? `/api/portada/${row.id_inmueble}` : PLACEHOLDER_IMAGE,
  };
}

/* -------------------------------------------------------------------------- */
/* Formateadores                                                              */
/* -------------------------------------------------------------------------- */

/** 265000000 -> "$265.000.000". */
export function formatPriceFull(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return 'Precio a consultar';
  return `$${price.toLocaleString('es-CO')}`;
}

/** 265000000 -> "$265 M", 1500000000 -> "$1.500 M". */
export function formatPriceShort(price: number | null): string {
  if (price === null || !Number.isFinite(price)) return 'Consultar';
  if (price >= 1_000_000) {
    const millions = Math.round((price / 1_000_000) * 10) / 10;
    return `$${millions.toLocaleString('es-CO')} M`;
  }
  return formatPriceFull(price);
}

/** 2.5 -> "2,5". */
export function formatNumber(value: number): string {
  return value.toLocaleString('es-CO');
}

/** "Villas de Granada · 126 m² · 3 hab · 2,5 baños". */
export function formatPropertyMeta(property: Property): string {
  const parts: string[] = [];
  if (property.neighborhood) parts.push(property.neighborhood);
  if (property.area !== null) parts.push(`${formatNumber(property.area)} m²`);
  if (property.bedrooms !== null) parts.push(`${property.bedrooms} hab`);
  if (property.bathrooms !== null) {
    parts.push(`${formatNumber(property.bathrooms)} ${property.bathrooms === 1 ? 'baño' : 'baños'}`);
  }
  return parts.join(' · ');
}

/** WhatsApp con un mensaje que ya incluye el código del inmueble. */
export function whatsappPropertyUrl(property: Property): string {
  const reference = property.code ? `código ${property.code}` : property.title;
  const text = `Hola, me interesa el inmueble ${reference} y quiero agendar una visita.`;
  return `${WHATSAPP_URL}?text=${encodeURIComponent(text)}`;
}

/** Convierte un enlace de reel o publicación de Instagram en su versión embebible. */
export function instagramEmbedUrl(url: string | null): string | null {
  const match = url?.match(/instagram\.com\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  const kind = match[1] === 'reels' ? 'reel' : match[1];
  return `https://www.instagram.com/${kind}/${match[2]}/embed/`;
}

/** Valores únicos y ordenados de un campo, para construir los filtros. */
export function uniqueValues(
  properties: Property[],
  pick: (property: Property) => string | null,
): string[] {
  return Array.from(
    new Set(properties.map(pick).filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'es'));
}
