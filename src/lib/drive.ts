/**
 * Fotos de las propiedades alojadas en Google Drive.
 *
 * La columna `fotos` guarda el enlace a una carpeta compartida
 * ("Cualquier persona con el enlace"). Su contenido se lee desde la vista
 * embebible de Drive, que no requiere clave de API, y cada imagen se sirve
 * desde lh3.googleusercontent.com, que además convierte HEIC a JPEG.
 *
 * El listado de cada carpeta se guarda en memoria unos minutos para no
 * consultar Drive en cada visita. Una foto nueva tarda como mucho
 * `CACHE_TTL_MS` en aparecer.
 */

export interface DriveImage {
  id: string;
  name: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

/** Extensiones que no son fotos (documentos, comprimidos, vídeos…). */
const NON_IMAGE_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'odt', 'txt', 'rtf', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx',
  'zip', 'rar', '7z', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', 'mp3', 'm4a', 'wav',
]);

const cache = new Map<string, { at: number; images: Promise<DriveImage[]> }>();

/** Extrae el ID de un enlace de carpeta de Drive. */
export function driveFolderId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match =
    url.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? url.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/** URL de una imagen de Drive con el ancho pedido (siempre en JPEG). */
export function driveImageUrl(fileId: string, width = 1600): string {
  return `https://lh3.googleusercontent.com/d/${fileId}=w${width}`;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function isImage(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return true;
  return !NON_IMAGE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

async function fetchFolder(folderId: string): Promise<DriveImage[]> {
  const response = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
  );

  if (!response.ok) {
    throw new Error(`Drive respondió ${response.status} para la carpeta ${folderId}`);
  }

  const html = await response.text();
  const images: DriveImage[] = [];

  // Cada archivo es un <div class="flip-entry" id="entry-ID"> con su título dentro.
  for (const entry of html.split('class="flip-entry"').slice(1)) {
    const id = entry.match(/id="entry-([A-Za-z0-9_-]+)"/)?.[1];
    const name = decodeEntities(entry.match(/flip-entry-title">([^<]*)/)?.[1] ?? '');
    // Las subcarpetas enlazan a /folders/ en lugar de /file/.
    const isFolder = /\/folders\//.test(entry.split('flip-entry-title')[0] ?? '');

    if (id && !isFolder && isImage(name)) images.push({ id, name });
  }

  return images.sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }),
  );
}

/**
 * Imágenes de la carpeta de Drive de una propiedad, en orden de nombre.
 * Si la carpeta no existe o no es pública, devuelve una lista vacía.
 */
export async function getDriveImages(folderUrl: string | null | undefined): Promise<DriveImage[]> {
  const folderId = driveFolderId(folderUrl);
  if (!folderId) return [];

  const cached = cache.get(folderId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.images;

  const images = fetchFolder(folderId).catch((error) => {
    console.error(`No se pudieron leer las fotos de Drive (${folderId}):`, error);
    cache.delete(folderId);
    return [];
  });

  cache.set(folderId, { at: Date.now(), images });
  return images;
}
