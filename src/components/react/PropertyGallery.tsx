import { useEffect, useRef, useState } from 'react';
import type { PropertyImage } from '../../data/properties';

interface Props {
  images: PropertyImage[];
  alt: string;
  /** Precio ya formateado que se muestra en la banda amarilla. */
  priceLabel: string;
  /** Imagen a mostrar si la propiedad aún no tiene fotos. */
  placeholder: string;
}

/**
 * Galería de la ficha de detalle: imagen grande, flechas, contador y
 * miniaturas. Las fotos vienen de la carpeta de Drive de la propiedad.
 * Figma: nodos 163:5236 (claro) y 149:1968 (oscuro).
 */
export default function PropertyGallery({ images, alt, priceLabel, placeholder }: Props) {
  const [index, setIndex] = useState(0);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const total = images.length;

  const go = (direction: 1 | -1) => {
    setIndex((current) => (current + direction + total) % total);
  };

  // Mantiene la miniatura activa a la vista.
  useEffect(() => {
    thumbsRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [index]);

  // Precarga la siguiente foto para que el cambio sea inmediato.
  useEffect(() => {
    if (total > 1) new Image().src = images[(index + 1) % total].full;
  }, [index, images, total]);

  const current = images[index];

  return (
    <div className="flex flex-col rounded-(--radius-panel) bg-gallery p-[14px]">
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-t-(--radius-button) bg-black/20"
        tabIndex={total > 1 ? 0 : undefined}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
        aria-roledescription="carrusel"
        aria-label={`Fotos de ${alt}`}
      >
        <img
          key={current?.full ?? placeholder}
          src={current?.full ?? placeholder}
          alt={current ? `${alt} — foto ${index + 1} de ${total}` : `${alt} — fotos próximamente`}
          className="h-[380px] w-full object-cover md:h-[560px]"
          fetchPriority="high"
          decoding="async"
          referrerPolicy="no-referrer"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 flex -translate-y-1/2 items-center rounded-(--radius-chip) bg-gallery p-2.5 transition-opacity hover:opacity-80"
            >
              <span className="sr-only">Foto anterior</span>
              <img
                src="/assets/icons/arrow-next.svg"
                alt=""
                width={24}
                height={24}
                aria-hidden="true"
                className="rotate-180"
              />
            </button>

            <button
              type="button"
              onClick={() => go(1)}
              className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center rounded-(--radius-chip) bg-gallery p-2.5 transition-opacity hover:opacity-80"
            >
              <span className="sr-only">Foto siguiente</span>
              <img
                src="/assets/icons/arrow-next.svg"
                alt=""
                width={24}
                height={24}
                aria-hidden="true"
              />
            </button>

            <p
              className="absolute right-3 bottom-3 rounded-md bg-black/60 px-2.5 py-1 text-[13px] font-semibold text-white"
              aria-live="polite"
            >
              {index + 1} / {total}
            </p>
          </>
        )}
      </div>

      <p className="flex items-center justify-center bg-brand-yellow px-6 py-4 last:rounded-b-(--radius-chip)">
        <span className="font-display text-[32px] leading-[46px] font-extrabold tracking-[-0.96px] text-navy-900 md:text-[48px]">
          {priceLabel}
        </span>
      </p>

      {total > 1 && (
        <div
          ref={thumbsRef}
          className="flex gap-2 overflow-x-auto pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Miniaturas"
        >
          {images.map((image, thumbIndex) => (
            <button
              key={image.full}
              type="button"
              role="tab"
              data-index={thumbIndex}
              aria-selected={thumbIndex === index}
              aria-label={`Ver foto ${thumbIndex + 1}`}
              onClick={() => setIndex(thumbIndex)}
              className={`h-[64px] w-[88px] shrink-0 overflow-hidden rounded-md transition-opacity ${
                thumbIndex === index
                  ? 'ring-2 ring-brand-yellow'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={image.thumb}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
