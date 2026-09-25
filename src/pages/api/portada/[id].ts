import type { APIRoute } from 'astro';
import { getPropertyById } from '../../../lib/catalog';
import { driveImageUrl, getDriveImages } from '../../../lib/drive';
import { PLACEHOLDER_IMAGE } from '../../../data/properties';

/**
 * Portada de una propiedad: redirige a la primera foto de su carpeta de Drive.
 *
 * Las tarjetas apuntan aquí en lugar de a Drive para que el listado no tenga
 * que leer todas las carpetas antes de mostrarse: cada imagen se resuelve
 * cuando el navegador la pide (con `loading="lazy"`, al entrar en pantalla).
 */
export const GET: APIRoute = async ({ params, url }) => {
  const id = Number(params.id);
  const width = Math.min(Math.max(Number(url.searchParams.get('w')) || 720, 120), 1600);

  const property = Number.isInteger(id) ? await getPropertyById(id).catch(() => null) : null;
  const [first] = property ? await getDriveImages(property.photosUrl) : [];

  return new Response(null, {
    status: 302,
    headers: {
      Location: first ? driveImageUrl(first.id, width) : PLACEHOLDER_IMAGE,
      'Cache-Control': 'public, max-age=600',
    },
  });
};
