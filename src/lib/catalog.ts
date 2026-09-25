/**
 * Consultas del catálogo. Solo se usa en el servidor (páginas .astro y
 * endpoints), nunca desde las islas de React.
 *
 * Se consulta la vista `propiedades_publicas`, NO la tabla `propiedades`.
 */

import { supabase } from './supabase';
import { driveImageUrl, getDriveImages } from './drive';
import { resolveMapsLink } from './location';
import { withCoordinates } from './geocode';
import { mapRow, type Property, type PropertyImage, type PublicRow } from '../data/properties';

const VIEW = 'propiedades_publicas';

/**
 * Si `direccion` es un enlace corto de Google Maps, lo cambia por sus
 * coordenadas exactas (el resultado queda en caché).
 */
async function withLocation(property: Property): Promise<Property> {
  if (!property.mapsLink || property.mapPrecise) return property;
  const coords = await resolveMapsLink(property.mapsLink);
  return coords ? { ...property, mapQuery: coords, mapPrecise: true } : property;
}

/** Todas las propiedades públicas, las más recientes primero. */
export async function getProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from(VIEW)
    .select('*')
    .order('created_at', { ascending: false })
    .order('id_inmueble', { ascending: false });

  if (error) {
    throw new Error(`No se pudieron obtener las propiedades: ${error.message}`);
  }

  const properties = await Promise.all((data as PublicRow[]).map((row) => withLocation(mapRow(row))));
  return withCoordinates(properties);
}

/** Una propiedad por su `id_inmueble`, o null si ya no existe. */
export async function getPropertyById(id: number): Promise<Property | null> {
  const { data, error } = await supabase.from(VIEW).select('*').eq('id_inmueble', id).maybeSingle();

  if (error) {
    throw new Error(`No se pudo obtener el inmueble ${id}: ${error.message}`);
  }

  if (!data) return null;
  const [property] = await withCoordinates([await withLocation(mapRow(data as PublicRow))]);
  return property;
}

/** El id va al final del slug: `casa-villas-de-granada-38` -> 38. */
export function idFromSlug(slug: string | undefined): number | null {
  const match = slug?.match(/(?:^|-)(\d+)$/);
  return match ? Number(match[1]) : null;
}

/** Fotos de la carpeta de Drive de la propiedad. */
export async function getPropertyImages(property: Property): Promise<PropertyImage[]> {
  const images = await getDriveImages(property.photosUrl);
  return images.map((image) => ({
    full: driveImageUrl(image.id, 1600),
    thumb: driveImageUrl(image.id, 240),
  }));
}
