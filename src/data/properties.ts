/**
 * Catálogo de propiedades.
 *
 * Datos tomados del diseño de Figma. La forma de `Property` está pensada para
 * mapear 1:1 con la tabla de la base de datos cuando se haga la integración:
 * basta reemplazar `PROPERTIES` por la consulta correspondiente.
 */

import type { ThemedIconName } from './icons';

export type PropertyType = 'Apartamento' | 'Casa' | 'Oficina';

export type PropertyStatus = 'disponible' | 'reservado' | 'vendido';

/** Tipo de negocio: el buscador filtra por Venta / Arriendo. */
export type Operation = 'venta' | 'arriendo';

/** Zonas de Bogotá usadas por el filtro del catálogo. */
export type Zone = 'Norte' | 'Centro' | 'Sur' | 'Oriente' | 'Occidente';

export const ZONES: Zone[] = ['Sur', 'Centro', 'Norte', 'Oriente', 'Occidente'];

/**
 * Barrio → zona. Daniel Inmuebles opera sobre todo en el norte, por eso
 * hoy todos los barrios del catálogo caen en esa zona.
 */
export const NEIGHBORHOOD_ZONES: Record<string, Zone> = {
  'Chicó': 'Norte',
  'Usaquén': 'Norte',
  'Cedritos': 'Norte',
  'Chapinero Alto': 'Norte',
  'Santa Bárbara': 'Norte',
  'Colina Campestre': 'Norte',
  'Rosales': 'Norte',
  'La Carolina': 'Norte',
};

export interface MapPin {
  /** Posición sobre el mapa, en % relativo al contenedor (del diseño). */
  top: number;
  left: number;
}

/** Amenidades del conjunto, mostradas como iconos en la ficha de detalle. */
export interface Amenities {
  elevator?: boolean;
  pool?: boolean;
  kidsZone?: boolean;
  petFriendly?: boolean;
  eventsRoom?: boolean;
  gym?: boolean;
}

/** Un bloque de la descripción: "Cuenta con: ...". */
export interface Highlight {
  label: string;
  text: string;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  type: PropertyType;
  operation: Operation;
  /** Barrio o sector. */
  neighborhood: string;
  /** Zona de la ciudad, derivada del barrio. */
  zone: Zone;
  city: string;
  /** Área construida en m². */
  area: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  stratum: number;
  /** Precio en pesos colombianos. */
  price: number;
  status: PropertyStatus;
  /** Ruta de la imagen principal en /public. */
  image: string;
  /** Foto alterna que usa el bloque de destacadas de la home. */
  featuredImage?: string;
  /** Galería de la ficha de detalle. */
  gallery?: string[];
  mapPin: MapPin;
  featured: boolean;

  /* --- Campos de la ficha de detalle ---------------------------------
     Opcionales: hoy solo el inmueble diseñado en Figma los trae completos.
     La integración con la base de datos irá poblando el resto.            */

  /** Encabezado de la ficha: "Venta de apartamento". */
  listingLabel?: string;
  /** Antigüedad legible: "1 año", "5 años". */
  age?: string;
  /** Número de pisos del inmueble. */
  floors?: number;
  /** Impuesto predial anual en COP. */
  propertyTax?: number;
  /** Cuota de administración mensual en COP. */
  adminFee?: number;
  amenities?: Amenities;
  highlights?: Highlight[];
  /** Nota destacada al pie de la descripción. */
  closingNote?: string;
}

/** Etiquetas de las amenidades y su icono (con variante por modo, ver data/icons.ts). */
export const AMENITY_LABELS: Record<keyof Amenities, { label: string; icon: ThemedIconName }> = {
  elevator: { label: 'Ascensor', icon: 'amenity-elevator' },
  pool: { label: 'Piscina', icon: 'amenity-pool' },
  kidsZone: { label: 'Zona infantil', icon: 'amenity-kids' },
  petFriendly: { label: 'Pet friendly', icon: 'amenity-pets' },
  eventsRoom: { label: 'Salón de eventos', icon: 'amenity-events' },
  gym: { label: 'Gym', icon: 'amenity-gym' },
};

/**
 * Formatea el precio como en el diseño: "$1.180 M".
 * Por debajo de mil millones se muestra en millones sin decimales.
 */
export function formatPriceShort(price: number): string {
  const millions = price / 1_000_000;
  const value = millions % 1 === 0 ? millions.toString() : millions.toFixed(0);
  return `$${Number(value).toLocaleString('es-CO')} M`;
}

/** Formatea el precio completo: "$760.000.000". */
export function formatPriceFull(price: number): string {
  return `$${price.toLocaleString('es-CO')}`;
}

/** Línea de metadatos de la tarjeta: "Chicó · 128 m² · 3 hab · 3 baños". */
export function formatPropertyMeta(property: Property): string {
  return `${property.neighborhood} · ${property.area} m² · ${property.bedrooms} hab · ${property.bathrooms} baños`;
}

export const PROPERTIES: Property[] = [
  {
    id: 'prop-001',
    slug: 'apartamento-con-terraza-chico',
    title: 'Apartamento con terraza',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'Chicó',
    zone: 'Norte',
    city: 'Bogotá',
    area: 128,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    stratum: 6,
    price: 1_180_000_000,
    status: 'disponible',
    image: '/assets/img/card-apartamento-terraza.png',
    featuredImage: '/assets/img/featured-apartamento-terraza.png',
    mapPin: { top: 31.8, left: 62.88 },
    featured: true,
  },
  {
    id: 'prop-002',
    slug: 'casa-remodelada-usaquen',
    title: 'Casa remodelada',
    type: 'Casa',
    operation: 'venta',
    neighborhood: 'Usaquén',
    zone: 'Norte',
    city: 'Bogotá',
    area: 240,
    bedrooms: 4,
    bathrooms: 4,
    parking: 2,
    stratum: 5,
    price: 1_650_000_000,
    status: 'disponible',
    image: '/assets/img/card-casa-remodelada.png',
    featuredImage: '/assets/img/featured-casa-remodelada.png',
    mapPin: { top: 13.3, left: 42.64 },
    featured: true,
  },
  {
    id: 'prop-003',
    slug: 'apartamento-luminoso-cedritos',
    title: 'Apartamento luminoso',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'Cedritos',
    zone: 'Norte',
    city: 'Bogotá',
    area: 68,
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    stratum: 4,
    price: 470_000_000,
    status: 'disponible',
    image: '/assets/img/card-apartamento-luminoso.png',
    featuredImage: '/assets/img/featured-apartamento-luminoso.png',
    mapPin: { top: 8.06, left: 20.64 },
    featured: true,
  },
  {
    id: 'prop-004',
    slug: 'apartaestudio-moderno-chapinero-alto',
    title: 'Apartaestudio moderno',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'Chapinero Alto',
    zone: 'Norte',
    city: 'Bogotá',
    area: 42,
    bedrooms: 1,
    bathrooms: 1,
    parking: 1,
    stratum: 4,
    price: 320_000_000,
    status: 'disponible',
    image: '/assets/img/card-apartaestudio-moderno.png',
    mapPin: { top: 70.3, left: 38.9 },
    featured: false,
  },
  {
    id: 'prop-005',
    slug: 'apartamento-familiar-santa-barbara',
    title: 'Apartamento familiar',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'Santa Bárbara',
    zone: 'Norte',
    city: 'Bogotá',
    area: 96,
    bedrooms: 3,
    bathrooms: 2,
    parking: 2,
    stratum: 5,
    price: 780_000_000,
    status: 'disponible',
    image: '/assets/img/card-apartamento-familiar.png',
    mapPin: { top: 41.7, left: 29.11 },
    featured: false,
  },
  {
    id: 'prop-006',
    slug: 'oficina-torre-corporativa-chico',
    title: 'Oficina en torre corporativa',
    type: 'Oficina',
    operation: 'venta',
    neighborhood: 'Chicó',
    zone: 'Norte',
    city: 'Bogotá',
    area: 74,
    bedrooms: 1,
    bathrooms: 2,
    parking: 2,
    stratum: 6,
    price: 640_000_000,
    status: 'disponible',
    image: '/assets/img/card-oficina-torre.png',
    mapPin: { top: 26.17, left: 84.39 },
    featured: false,
  },
  {
    id: 'prop-007',
    slug: 'casa-conjunto-cerrado-colina-campestre',
    title: 'Casa en conjunto cerrado',
    type: 'Casa',
    operation: 'venta',
    neighborhood: 'Colina Campestre',
    zone: 'Norte',
    city: 'Bogotá',
    area: 186,
    bedrooms: 4,
    bathrooms: 3,
    parking: 2,
    stratum: 5,
    price: 950_000_000,
    status: 'disponible',
    image: '/assets/img/card-casa-conjunto.png',
    mapPin: { top: 23.57, left: 7.99 },
    featured: false,
  },
  {
    id: 'prop-008',
    slug: 'apartamento-con-vista-rosales',
    title: 'Apartamento con vista',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'Rosales',
    zone: 'Norte',
    city: 'Bogotá',
    area: 142,
    bedrooms: 3,
    bathrooms: 3,
    parking: 2,
    stratum: 6,
    price: 1_420_000_000,
    status: 'disponible',
    image: '/assets/img/card-apartamento-vista.png',
    mapPin: { top: 59.83, left: 46.93 },
    featured: false,
  },
  {
    id: 'prop-009',
    slug: 'apartamento-reformado-la-carolina',
    title: 'Apartamento reformado',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'La Carolina',
    zone: 'Norte',
    city: 'Bogotá',
    area: 82,
    bedrooms: 2,
    bathrooms: 2,
    parking: 1,
    stratum: 5,
    price: 560_000_000,
    status: 'disponible',
    image: '/assets/img/card-apartamento-reformado.png',
    mapPin: { top: 64.78, left: 15.38 },
    featured: false,
  },
  {
    // Inmueble diseñado en detalle en Figma (nodo 88:509).
    id: 'prop-010',
    slug: 'apto-para-estrenar-usaquen',
    title: 'Hermoso Apto para estrenar en Usaquén',
    type: 'Apartamento',
    operation: 'venta',
    neighborhood: 'Usaquén',
    zone: 'Norte',
    city: 'Bogotá',
    area: 84,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    stratum: 4,
    price: 760_000_000,
    status: 'disponible',
    image: '/assets/img/detalle-usaquen-1.png',
    gallery: ['/assets/img/detalle-usaquen-1.png'],
    mapPin: { top: 18.5, left: 55 },
    featured: false,
    listingLabel: 'Venta de apartamento',
    age: '1 año',
    floors: 1,
    propertyTax: 3_946_000,
    adminFee: 560_000,
    amenities: {
      elevator: true,
      pool: true,
      kidsZone: true,
      petFriendly: true,
      eventsRoom: true,
      gym: true,
    },
    highlights: [
      {
        label: 'Cuenta con:',
        text: 'Unidad Cerrada con vigilancia 24/7, piscina, juegos infantiles, zonas verdes, BBQ, sendero para mascotas, yoga, salón social',
      },
      {
        label: 'Puntos cercanos:',
        text: 'parque de envigado, polideportivo envigado, av Las Vegas, Sabaneta, Mayorca y Viva Envigado',
      },
      {
        label: 'Puntos a tener en cuenta:',
        text: 'proyecto Nuevo y listo para escriturar',
      },
    ],
    closingNote: 'Escribe a un asesor para ver según disponibilidad',
  },
];

/** Área exacta del inmueble diseñado, con decimales como en Figma. */
export const AREA_OVERRIDES: Record<string, string> = {
  'prop-010': '84,07 mt2',
};

/** Las tres propiedades del bloque "Propiedades destacadas" de la home. */
export const FEATURED_PROPERTIES = PROPERTIES.filter((p) => p.featured);

export function getPropertyBySlug(slug: string): Property | undefined {
  return PROPERTIES.find((p) => p.slug === slug);
}

/** Valores únicos para alimentar los filtros del catálogo. */
export const PROPERTY_TYPES: PropertyType[] = ['Apartamento', 'Casa', 'Oficina'];

export const NEIGHBORHOODS = [...new Set(PROPERTIES.map((p) => p.neighborhood))].sort();

export const PRICE_RANGE = {
  min: Math.min(...PROPERTIES.map((p) => p.price)),
  max: Math.max(...PROPERTIES.map((p) => p.price)),
};
