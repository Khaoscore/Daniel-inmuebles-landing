/**
 * Catálogo público de propiedades.
 *
 * Los datos vienen de la vista `propiedades_publicas` en Supabase.
 *
 * La vista contiene únicamente la información que puede ser enviada
 * al navegador. Los campos internos del negocio permanecen en la tabla
 * `propiedades` y no forman parte de este modelo.
 */

import { supabase } from '../lib/supabase';
import type { ThemedIconName } from './icons';

/* -------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Amenidades que existen actualmente en la base de datos.
 *
 * Se derivan de:
 * - ascensor
 * - balcon_terraza
 * - deposito
 */
export interface Amenities {
  elevator: boolean;
  balcony: boolean;
  deposit: boolean;
}

/**
 * Modelo de una propiedad para el frontend.
 *
 * Los campos corresponden a los datos públicos disponibles
 * en `propiedades_publicas`.
 *
 * `id`, `slug`, `title` y `amenities` son valores derivados
 * para facilitar el uso de los componentes del frontend.
 */
export interface Property {
  /* ----------------------- Valores derivados ----------------------- */

  /** Derivado de `id_inmueble`. */
  id: string;

  /** Derivado de `codigo`, utilizado para las URLs. */
  slug: string;

  /**
   * Título utilizado por la interfaz.
   * Se obtiene del `codigo` porque la BD no tiene una columna `title`.
   */
  title: string;

  /** Amenidades derivadas de los campos correspondientes de la BD. */
  amenities: Amenities;

  /* -------------------------- BD pública --------------------------- */

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
}

/**
 * Forma de una fila de la vista `propiedades_publicas`.
 *
 * IMPORTANTE:
 * Esta interfaz NO contiene:
 * - captador
 * - documentos
 * - link_agente
 * - ficha_inmueble
 *
 * Esos campos permanecen privados en la tabla original.
 */
interface SupabasePublicRow {
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

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Convierte un texto en un slug.
 *
 * Ejemplo:
 * "267 ALCAZAR SUBA"
 * -> "267-alcazar-suba"
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convierte texto a formato de título.
 *
 * Ejemplo:
 * "APARTAMENTO"
 * -> "Apartamento"
 */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;

      return (
        word.charAt(0).toUpperCase() +
        word.slice(1)
      );
    })
    .join(' ');
}

/**
 * Determina si un campo textual de la BD representa
 * un valor afirmativo.
 *
 * La hoja contiene valores como:
 * "1", "NO", etc.
 */
function esAfirmativo(
  value: string | null
): boolean {
  if (!value) return false;

  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return (
    normalized === '1' ||
    normalized === 'si' ||
    normalized === 'yes' ||
    normalized === 'true' ||
    normalized.startsWith('1 ')
  );
}

/* -------------------------------------------------------------------------- */
/* Adaptación de Supabase al frontend                                         */
/* -------------------------------------------------------------------------- */

function mapRowToProperty(
  row: SupabasePublicRow
): Property {
  const codigo = row.codigo?.trim() || null;

  /*
   * Estos valores son derivados.
   *
   * No son columnas adicionales de Supabase.
   */

  const id = String(row.id_inmueble);

  const slug = slugify(
    codigo || `inmueble-${row.id_inmueble}`
  );

  const title =
    codigo ||
    `${toTitleCase(row.tipo || 'Inmueble')} ${row.id_inmueble}`;

  return {
    /* Valores derivados */
    id,
    slug,
    title,

    /* Datos públicos reales */
    id_inmueble: row.id_inmueble,
    codigo: row.codigo,
    estatus: row.estatus,
    zona: row.zona,
    barrio: row.barrio,
    direccion: row.direccion,
    tipo: row.tipo,
    precio: row.precio,
    habitaciones: row.habitaciones,
    banos: row.banos,
    area: row.area,
    estrato: row.estrato,
    antiguedad: row.antiguedad,
    balcon_terraza: row.balcon_terraza,
    parqueadero: row.parqueadero,
    deposito: row.deposito,
    ascensor: row.ascensor,
    administracion: row.administracion,
    piso: row.piso,
    informacion_adicional:
      row.informacion_adicional,
    link_instagram: row.link_instagram,
    fotos: row.fotos,

    /* Amenidades derivadas */
    amenities: {
      elevator: esAfirmativo(row.ascensor),
      balcony: esAfirmativo(row.balcon_terraza),
      deposit: esAfirmativo(row.deposito),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Consultas a Supabase                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Obtiene todas las propiedades públicas.
 *
 * IMPORTANTE:
 * Se consulta `propiedades_publicas`, NO `propiedades`.
 */
export async function getProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('propiedades_publicas')
    .select('*')
    .order('created_at', {
      ascending: false,
    });

  if (error) {
    console.error(
      'Error obteniendo propiedades públicas:',
      error
    );

    throw new Error(
      `No se pudieron obtener las propiedades: ${error.message}`
    );
  }

  return (data ?? []).map((row) =>
    mapRowToProperty(
      row as SupabasePublicRow
    )
  );
}

/**
 * Obtiene una propiedad pública por su ID de inmueble.
 */
export async function getPropertyById(
  idInmueble: number
): Promise<Property | null> {
  const { data, error } = await supabase
    .from('propiedades_publicas')
    .select('*')
    .eq('id_inmueble', idInmueble)
    .maybeSingle();

  if (error) {
    console.error(
      `Error obteniendo inmueble ${idInmueble}:`,
      error
    );

    throw new Error(
      `No se pudo obtener el inmueble ${idInmueble}: ${error.message}`
    );
  }

  if (!data) {
    return null;
  }

  return mapRowToProperty(
    data as SupabasePublicRow
  );
}

/**
 * Obtiene una propiedad pública a partir de su slug.
 */
export async function getPropertyBySlug(
  slug: string
): Promise<Property | null> {
  const properties = await getProperties();

  return (
    properties.find(
      (property) => property.slug === slug
    ) ?? null
  );
}

/* -------------------------------------------------------------------------- */
/* Formateadores                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Formatea un precio completo.
 *
 * Ejemplo:
 * 265000000
 * -> "$265.000.000"
 */
export function formatPriceFull(
  price: number | null
): string {
  if (
    price === null ||
    !Number.isFinite(price)
  ) {
    return 'Precio no disponible';
  }

  return `$${price.toLocaleString('es-CO')}`;
}

/**
 * Formatea un precio de manera compacta.
 *
 * Ejemplo:
 * 265000000
 * -> "$265 M"
 */
export function formatPriceShort(
  price: number | null
): string {
  if (
    price === null ||
    !Number.isFinite(price)
  ) {
    return 'Precio no disponible';
  }

  if (price >= 1_000_000_000) {
    const billions = price / 1_000_000_000;

    return `$${billions
      .toFixed(1)
      .replace('.0', '')} B`;
  }

  if (price >= 1_000_000) {
    const millions = price / 1_000_000;

    return `$${millions
      .toFixed(1)
      .replace('.0', '')} M`;
  }

  return formatPriceFull(price);
}

/**
 * Línea de información resumida para las tarjetas.
 *
 * Ejemplo:
 * "SUBA · 60MTRS · 3 hab · 2 baños"
 */
export function formatPropertyMeta(
  property: Property
): string {
  const parts: string[] = [];

  if (property.barrio) {
    parts.push(property.barrio);
  }

  if (property.area) {
    parts.push(property.area);
  }

  if (property.habitaciones) {
    parts.push(
      `${property.habitaciones} hab`
    );
  }

  if (property.banos !== null) {
    parts.push(
      `${property.banos} baños`
    );
  }

  return parts.join(' · ');
}

/* -------------------------------------------------------------------------- */
/* Amenidades                                                                 */
/* -------------------------------------------------------------------------- */

export const AMENITY_LABELS: Record<
  keyof Amenities,
  {
    label: string;
    icon: ThemedIconName;
  }
> = {
  elevator: {
    label: 'Ascensor',
    icon: 'amenity-elevator',
  },

  balcony: {
    label: 'Balcón / Terraza',
    icon: 'amenity-events',
  },

  deposit: {
    label: 'Depósito',
    icon: 'amenity-events',
  },
};

/* -------------------------------------------------------------------------- */
/* Filtros                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Obtiene los tipos de inmueble que realmente existen
 * en la base de datos pública.
 */
export async function getPropertyTypes(): Promise<
  string[]
> {
  const properties = await getProperties();

  return Array.from(
    new Set(
      properties
        .map(
          (property) => property.tipo
        )
        .filter(
          (type): type is string =>
            Boolean(type?.trim())
        )
        .map((type) =>
          toTitleCase(type)
        )
    )
  ).sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

/**
 * Obtiene las zonas que realmente existen
 * en la base de datos pública.
 */
export async function getPropertyZones(): Promise<
  string[]
> {
  const properties = await getProperties();

  return Array.from(
    new Set(
      properties
        .map(
          (property) => property.zona
        )
        .filter(
          (zone): zone is string =>
            Boolean(zone?.trim())
        )
    )
  ).sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

/**
 * Obtiene los barrios que realmente existen
 * en la base de datos pública.
 */
export async function getPropertyNeighborhoods(): Promise<
  string[]
> {
  const properties = await getProperties();

  return Array.from(
    new Set(
      properties
        .map(
          (property) => property.barrio
        )
        .filter(
          (neighborhood): neighborhood is string =>
            Boolean(neighborhood?.trim())
        )
    )
  ).sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}
