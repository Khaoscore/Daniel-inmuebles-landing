import { useRef, useState } from 'react';
import { formatPriceShort, formatPropertyMeta, type Property } from '../../data/properties';

interface Props {
  properties: Property[];
  /** Texto del chip sobre el mapa. */
  caption?: string;
  /**
   * La home oscura usa pines blancos y marco azul; la ficha y el buscador,
   * pines amarillos. Ver `[data-map-tone='home']` en global.css.
   */
  tone?: 'home' | 'default';
}

/**
 * Mapa con pines de precio + carrusel de tarjetas sincronizado.
 * Figma: nodos 217:659 (claro) y 149:1139 (oscuro).
 *
 * El mapa es la imagen estática del diseño; al conectar la base de datos
 * se puede sustituir por Leaflet/Google Maps reutilizando `property.mapPin`.
 */
export default function PropertyMap({
  properties,
  caption = 'Mapa ilustrativo · norte de Bogotá',
  tone = 'default',
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  /** Al pulsar un pin, desplaza el carrusel hasta la tarjeta correspondiente. */
  const focusProperty = (id: string) => {
    setActiveId(id);
    const card = trackRef.current?.querySelector<HTMLElement>(`[data-property="${id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const scrollBy = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * 280 * 2, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col gap-8" data-map-tone={tone}>
      <div className="rounded-(--radius-panel) bg-map-frame p-[14px]">
        <div className="relative h-[320px] overflow-hidden rounded-(--radius-button) md:h-[480px] xl:h-[640px]">
          <img
            src="/assets/img/mapa-bogota.png"
            alt="Mapa del norte de Bogotá con la ubicación de las propiedades"
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-black/10" aria-hidden="true" />

          <p className="absolute bottom-3 left-3 z-10 rounded-md bg-map-chip px-2.5 py-1.5 text-[12px] font-semibold text-white">
            {caption}
          </p>

          {properties.map((property) => {
            const isActive = activeId === property.id;

            return (
              <button
                key={property.id}
                type="button"
                onClick={() => focusProperty(property.id)}
                style={{ top: `${property.mapPin.top}%`, left: `${property.mapPin.left}%` }}
                className={`absolute flex -translate-x-1/2 flex-col items-center transition-transform focus-visible:z-20 ${
                  isActive ? 'z-10 scale-110' : 'hover:scale-105'
                }`}
                aria-label={`${property.title} en ${property.neighborhood}, ${formatPriceShort(property.price)}`}
              >
                <span
                  className={`rounded-[11.6px] bg-pin px-3.5 py-2.5 text-[16px] font-bold whitespace-nowrap text-navy-900 drop-shadow-[0_5px_9px_rgba(6,11,53,0.18)] xl:text-[19.3px] ${
                    isActive ? 'ring-2 ring-navy-900' : ''
                  }`}
                >
                  {formatPriceShort(property.price)}
                </span>
                <span className="-mt-[9px] size-[11.6px] rotate-45 bg-pin" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:thin]"
        >
          {properties.map((property) => (
            <article
              key={property.id}
              data-property={property.id}
              onMouseEnter={() => setActiveId(property.id)}
              onMouseLeave={() => setActiveId(null)}
              className={`flex w-[264px] shrink-0 snap-start flex-col gap-2 rounded-(--radius-field) bg-card p-[14px] text-fg transition-shadow ${
                activeId === property.id ? 'ring-2 ring-accent' : ''
              }`}
            >
              <a
                href={`/propiedades/${property.slug}`}
                className="block h-[177px] overflow-hidden rounded-[11px]"
              >
                <img
                  src={property.image}
                  alt={`${property.title} en ${property.neighborhood}`}
                  width={236}
                  height={177}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </a>

              <div className="flex items-baseline justify-between gap-2 font-semibold">
                <h3 className="text-[16px] leading-5">{property.title}</h3>
                <span className="text-[12px] whitespace-nowrap">{property.type}</span>
              </div>

              <p className="text-[14px] leading-[22px]">{formatPropertyMeta(property)}</p>

              <p className="font-display text-[34px] leading-[34px] font-extrabold tracking-[-0.68px] text-accent">
                {formatPriceShort(property.price)}
              </p>

              <a
                href={`/propiedades/${property.slug}`}
                className="flex h-[41px] items-center justify-center rounded-[9px] bg-cta text-[14px] font-bold text-navy-900 transition-opacity hover:opacity-90"
              >
                Agendar visita
              </a>
            </article>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => scrollBy(direction)}
              className="flex size-11 items-center justify-center rounded-(--radius-button) border border-line/25 text-fg transition-colors hover:border-line"
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
          ))}
        </div>
      </div>
    </div>
  );
}
