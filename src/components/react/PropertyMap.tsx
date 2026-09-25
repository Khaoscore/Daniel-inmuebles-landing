import { useEffect, useMemo, useRef, useState } from 'react';
import { formatPriceShort, formatPropertyMeta, type Property } from '../../data/properties';
import {
  GOOGLE_MAPS_KEY,
  MAP_STYLES,
  createPriceMarker,
  loadGoogleMaps,
  onGoogleMapsAuthFailure,
  type PriceMarker,
} from '../../lib/google-maps';

interface Props {
  properties: Property[];
  /**
   * La home oscura usa marco azul; la ficha y el buscador, el marco normal.
   * Ver `[data-map-tone='home']` en global.css.
   */
  tone?: 'home' | 'default';
  /** Propiedad de la ficha: su pin se distingue del de las cercanas. */
  primaryId?: number;
}

const hasCoords = (p: Property): p is Property & { lat: number; lng: number } =>
  p.lat !== null && p.lng !== null;

/**
 * Mapa + carrusel de tarjetas sincronizado.
 * Figma: nodos 217:659 (claro) y 149:1139 (oscuro).
 *
 * Con `PUBLIC_GOOGLE_MAPS_API_KEY`, un Google Maps con un pin de precio por
 * propiedad (coordenadas de `src/lib/geocode.ts`). Al pulsar un pin se marca su
 * tarjeta; al pulsar "Ver en el mapa", el mapa va al pin.
 *
 * Sin clave, o si Google la rechaza, se usa el Google Maps embebido de antes:
 * muestra solo la propiedad seleccionada. Ver `src/lib/location.ts`.
 */
export default function PropertyMap({ properties, tone = 'default', primaryId }: Props) {
  const [activeId, setActiveId] = useState<number | null>(properties[0]?.id ?? null);
  const [mapFailed, setMapFailed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<number, HTMLElement>());
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef(new Map<number, PriceMarker>());
  // El mapa carga después del primer render: los pines leen de aquí cuál resaltar.
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const located = useMemo(() => properties.filter(hasCoords), [properties]);
  const interactive = Boolean(GOOGLE_MAPS_KEY) && located.length > 0 && !mapFailed;

  const active = properties.find((p) => p.id === activeId) ?? properties[0];

  const scrollBy = (direction: 1 | -1) => {
    // Avanza una "página" completa: las tarjetas miden una fracción exacta del carrusel.
    const track = trackRef.current;
    track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' });
  };

  const carouselButton = (direction: 1 | -1) => (
    <button
      type="button"
      onClick={() => scrollBy(direction)}
      className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-button) border border-line/25 text-fg transition-colors hover:border-line md:size-11"
    >
      <span className="sr-only">
        {direction === -1 ? 'Ver propiedades anteriores' : 'Ver más propiedades'}
      </span>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path
          d={direction === -1 ? 'M12.5 4L6.5 10l6 6' : 'M7.5 4l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  /** Lleva la tarjeta al inicio del carrusel sin mover la página. */
  const scrollToCard = (id: number) => {
    const card = cardRefs.current.get(id);
    // El carrusel es el offsetParent (relative); se resta su padding para no cortar el anillo activo.
    if (card) trackRef.current?.scrollTo({ left: card.offsetLeft - 4, behavior: 'smooth' });
  };

  const showOnMap = (property: Property) => {
    setActiveId(property.id);
    const map = mapRef.current;
    if (!map || !hasCoords(property)) return;
    map.panTo({ lat: property.lat, lng: property.lng });
    // Con dirección exacta se acerca a la cuadra; con solo el barrio, a la zona.
    const zoom = property.mapPrecise ? 16 : 14;
    if ((map.getZoom() ?? 0) < zoom) map.setZoom(zoom);
  };

  // Crea el mapa y un pin por propiedad.
  useEffect(() => {
    if (!interactive) return;
    let cancelled = false;
    const markers = markersRef.current;
    const stopListening = onGoogleMapsAuthFailure(() => setMapFailed(true));

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapDivRef.current) return;
        const map = new maps.Map(mapDivRef.current, {
          styles: MAP_STYLES,
          gestureHandling: 'cooperative',
          mapTypeControl: false,
          streetViewControl: false,
          clickableIcons: false,
        });
        mapRef.current = map;

        const bounds = new maps.LatLngBounds();
        for (const property of located) {
          const position = { lat: property.lat, lng: property.lng };
          bounds.extend(position);
          const marker = createPriceMarker(
            map,
            position,
            formatPriceShort(property.price),
            property.title,
            () => {
              setActiveId(property.id);
              scrollToCard(property.id);
            },
            property.id === primaryId,
          );
          marker.setActive(property.id === activeIdRef.current);
          markers.set(property.id, marker);
        }

        if (located.length === 1) {
          map.setCenter(bounds.getCenter());
          map.setZoom(15);
        } else {
          map.fitBounds(bounds, 48);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setMapFailed(true);
      });

    return () => {
      cancelled = true;
      stopListening();
      markers.forEach((marker) => marker.remove());
      markers.clear();
      mapRef.current = null;
    };
  }, [interactive, located, primaryId]);

  // Resalta el pin de la propiedad seleccionada.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => marker.setActive(id === activeId));
  }, [activeId]);

  if (!active) return null;

  const query = active.mapQuery;
  const zoom = active.mapPrecise ? 17 : 14;

  return (
    <div className="flex flex-col gap-8" data-map-tone={tone}>
      <div className="rounded-(--radius-panel) bg-map-frame p-[14px]">
        <div className="relative h-[320px] overflow-hidden rounded-(--radius-button) bg-fg/5 md:h-[480px] xl:h-[560px]">
          {interactive ? (
            <div
              ref={mapDivRef}
              className="absolute inset-0"
              role="region"
              aria-label="Mapa de propiedades"
            />
          ) : (
            <iframe
              key={query}
              title={`Mapa: ${active.title}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&hl=es&output=embed`}
              className="absolute inset-0 size-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}

          <a
            href={`/propiedades/${active.slug}`}
            className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-md bg-map-chip px-3 py-2 text-[13px] font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          >
            <span>{active.title}</span>
            <span className="rounded bg-pin px-2 py-0.5 font-bold text-navy-900">
              {formatPriceShort(active.price)}
            </span>
          </a>

          {!active.mapPrecise && (
            <p className="absolute top-3 right-3 z-10 max-w-[260px] rounded-md bg-map-chip px-3 py-2 text-[12px] font-semibold text-white shadow-lg">
              Ubicación aproximada: se muestra el barrio
            </p>
          )}
        </div>
      </div>

      {properties.length > 1 && (
        <div className="flex items-center gap-2 md:gap-3">
          {carouselButton(-1)}

          <div
            ref={trackRef}
            className="relative flex min-w-0 flex-1 scroll-px-1 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {properties.map((property) => (
              <article
                key={property.id}
                ref={(card) => {
                  if (card) cardRefs.current.set(property.id, card);
                  else cardRefs.current.delete(property.id);
                }}
                className={`flex w-full shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)] flex-col gap-2 rounded-(--radius-field) bg-card p-[14px] text-fg transition-shadow ${
                  active.id === property.id ? 'ring-2 ring-accent' : ''
                }`}
              >
                <a
                  href={`/propiedades/${property.slug}`}
                  className="block h-[177px] overflow-hidden rounded-[11px] bg-fg/5"
                >
                  <img
                    src={property.cover}
                    alt={property.title}
                    width={236}
                    height={177}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </a>

                <div className="flex items-baseline justify-between gap-2 font-semibold">
                  <h3 className="text-[16px] leading-5">
                    <a href={`/propiedades/${property.slug}`} className="hover:opacity-70">
                      {property.title}
                    </a>
                  </h3>
                  {property.type && (
                    <span className="text-[12px] whitespace-nowrap">{property.type}</span>
                  )}
                </div>

                <p className="text-[14px] leading-[22px]">{formatPropertyMeta(property)}</p>

                <p className="font-display mt-auto text-[34px] leading-[34px] font-extrabold tracking-[-0.68px] text-accent">
                  {formatPriceShort(property.price)}
                </p>

                <button
                  type="button"
                  onClick={() => showOnMap(property)}
                  disabled={interactive && !hasCoords(property)}
                  aria-pressed={active.id === property.id}
                  className="flex h-[41px] items-center justify-center rounded-[9px] bg-cta text-[14px] font-bold text-navy-900 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {interactive && !hasCoords(property)
                    ? 'Sin ubicación'
                    : active.id === property.id
                      ? 'En el mapa'
                      : 'Ver en el mapa'}
                </button>
              </article>
            ))}
          </div>

          {carouselButton(1)}
        </div>
      )}
    </div>
  );
}
