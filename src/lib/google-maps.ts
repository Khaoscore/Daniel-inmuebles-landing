/**
 * Carga de la API de Google Maps en el navegador y pines de precio.
 *
 * `PUBLIC_GOOGLE_MAPS_API_KEY` llega al navegador: en Google Cloud debe estar
 * restringida por dominio (referentes HTTP) y solo a "Maps JavaScript API".
 */

export const GOOGLE_MAPS_KEY: string | undefined = import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

declare global {
  interface Window {
    __initGoogleMaps?: () => void;
    /** Google lo llama si la clave no es válida o no autoriza este dominio. */
    gm_authFailure?: () => void;
  }
}

let loading: Promise<typeof google.maps> | null = null;
const authListeners = new Set<() => void>();

/** Carga el script una sola vez, aunque haya varios mapas en la página. */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!GOOGLE_MAPS_KEY) return Promise.reject(new Error('Falta PUBLIC_GOOGLE_MAPS_API_KEY'));
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    window.__initGoogleMaps = () => resolve(google.maps);
    window.gm_authFailure = () => authListeners.forEach((listener) => listener());

    const params = new URLSearchParams({
      key: GOOGLE_MAPS_KEY,
      v: 'weekly',
      language: 'es',
      region: 'CO',
      loading: 'async',
      callback: '__initGoogleMaps',
    });
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => {
      loading = null;
      reject(new Error('No se pudo cargar Google Maps'));
    };
    document.head.append(script);
  });
  return loading;
}

/** Avisa si Google rechaza la clave; devuelve la función para dejar de escuchar. */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

/**
 * Mapa gris como el del diseño: sin saturación y sin negocios, para que
 * resalten los pines amarillos.
 */
export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { stylers: [{ saturation: -75 }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -40 }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

export interface PriceMarker {
  setActive(active: boolean): void;
  remove(): void;
}

/**
 * Pin con el precio ("$470 M") dibujado con HTML, así toma los colores del
 * sitio (ver `.map-pin` en global.css). La punta queda sobre la coordenada.
 * `primary` marca la propiedad de la ficha: otro color y siempre encima.
 */
export function createPriceMarker(
  map: google.maps.Map,
  position: google.maps.LatLngLiteral,
  label: string,
  title: string,
  onClick: () => void,
  primary = false,
): PriceMarker {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'map-pin';
  if (primary) button.dataset.variant = 'primary';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', `${title}, ${label}`);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onClick();
  });

  class Overlay extends google.maps.OverlayView {
    onAdd() {
      this.getPanes()?.overlayMouseTarget.append(button);
    }
    draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(position);
      if (!point) return;
      button.style.left = `${point.x}px`;
      button.style.top = `${point.y}px`;
    }
    onRemove() {
      button.remove();
    }
  }

  const overlay = new Overlay();
  overlay.setMap(map);

  return {
    setActive(active) {
      button.dataset.active = String(active);
      button.setAttribute('aria-pressed', String(active));
    },
    remove() {
      overlay.setMap(null);
    },
  };
}
