/**
 * Coordenadas de las propiedades para los pines del mapa. Solo servidor.
 *
 * 1. Si `mapQuery` ya son coordenadas (enlace de Maps resuelto), se usan tal cual.
 * 2. Si no, se buscan en `propiedades_ubicacion`, siempre que `consulta` coincida
 *    con la dirección actual (si Daniel edita la dirección, se recalculan).
 * 3. Si faltan, se piden a la Geocoding API de Google y se guardan en la tabla.
 *    Así cada dirección se consulta a Google una sola vez.
 *
 * Ver `supabase/ubicaciones.sql`.
 */

import { supabase } from './supabase';
import { supabaseAdmin } from './supabase-admin';
import type { Property } from '../data/properties';

const TABLE = 'propiedades_ubicacion';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
/** Consultas simultáneas a Google la primera vez que se ve el catálogo. */
const CONCURRENCY = 5;

const serverKey = import.meta.env.GOOGLE_MAPS_SERVER_KEY?.trim();

interface Coords {
  lat: number;
  lng: number;
}

interface StoredLocation extends Coords {
  id_inmueble: number;
  consulta: string;
}

/** "4.84,-74.05" -> { lat: 4.84, lng: -74.05 }. */
export function parseCoords(text: string): Coords | null {
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return match ? { lat: Number(match[1]), lng: Number(match[2]) } : null;
}

// También guarda los fallos (null) para no repetir la consulta en cada visita.
const cache = new Map<string, Promise<Coords | null>>();

function geocode(query: string): Promise<Coords | null> {
  if (!serverKey) return Promise.resolve(null);

  let pending = cache.get(query);
  if (!pending) {
    const url = new URL(GEOCODE_URL);
    url.search = new URLSearchParams({
      address: query,
      region: 'co',
      components: 'country:CO',
      language: 'es',
      key: serverKey,
    }).toString();

    pending = fetch(url, { signal: AbortSignal.timeout(6000) })
      .then((response) => response.json())
      .then((body: { status: string; error_message?: string; results?: { geometry: { location: Coords } }[] }) => {
        if (body.status === 'OK' && body.results?.[0]) return body.results[0].geometry.location;
        if (body.status !== 'ZERO_RESULTS') {
          throw new Error(`${body.status} ${body.error_message ?? ''}`.trim());
        }
        return null;
      })
      .catch((error) => {
        console.error(`No se pudo ubicar "${query}":`, error);
        // Un error de red o de cuota se reintenta en la siguiente visita.
        cache.delete(query);
        return null;
      });
    cache.set(query, pending);
  }
  return pending;
}

async function readStored(ids: number[]): Promise<Map<number, StoredLocation>> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id_inmueble, consulta, lat, lng')
    .in('id_inmueble', ids);

  // Sin la tabla el sitio sigue funcionando: se geocodifica y queda en memoria.
  if (error) {
    console.error(`No se pudo leer ${TABLE}:`, error.message);
    return new Map();
  }
  return new Map((data as StoredLocation[]).map((row) => [row.id_inmueble, row]));
}

async function saveStored(rows: StoredLocation[]): Promise<void> {
  if (!supabaseAdmin || rows.length === 0) return;
  const { error } = await supabaseAdmin
    .from(TABLE)
    .upsert(rows.map((row) => ({ ...row, actualizado: new Date().toISOString() })));
  if (error) console.error(`No se pudo guardar en ${TABLE}:`, error.message);
}

/** Ejecuta `task` sobre cada elemento, como máximo `limit` a la vez. */
async function eachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await task(item);
  });
  await Promise.all(workers);
}

/** Completa `lat` / `lng` de cada propiedad. Las que no se ubican quedan en null. */
export async function withCoordinates(properties: Property[]): Promise<Property[]> {
  if (properties.length === 0) return properties;

  const stored = await readStored(properties.map((p) => p.id));
  const coords = new Map<number, Coords>();
  const missing: Property[] = [];

  for (const property of properties) {
    const direct = parseCoords(property.mapQuery);
    const saved = stored.get(property.id);
    if (direct) coords.set(property.id, direct);
    else if (saved && saved.consulta === property.mapQuery) coords.set(property.id, saved);
    else missing.push(property);
  }

  const toSave: StoredLocation[] = [];
  await eachLimited(missing, CONCURRENCY, async (property) => {
    const found = await geocode(property.mapQuery);
    if (!found) return;
    coords.set(property.id, found);
    toSave.push({ id_inmueble: property.id, consulta: property.mapQuery, ...found });
  });
  await saveStored(toSave);

  return properties.map((property) => {
    const found = coords.get(property.id);
    return found ? { ...property, lat: found.lat, lng: found.lng } : property;
  });
}
