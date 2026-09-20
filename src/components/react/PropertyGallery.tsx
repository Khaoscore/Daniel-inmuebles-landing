import { useState } from 'react';

interface Props {
  images: string[];
  alt: string;
  /** Precio ya formateado que se muestra en la banda amarilla. */
  priceLabel: string;
}

/**
 * Galería de la ficha de detalle: imagen grande, flechas y puntos.
 * Figma: nodos 163:5236 (claro) y 149:1968 (oscuro).
 */
export default function PropertyGallery({ images, alt, priceLabel }: Props) {
  const [index, setIndex] = useState(0);
  const total = images.length;

  const go = (direction: 1 | -1) => {
    setIndex((current) => (current + direction + total) % total);
  };

  return (
    <div className="flex flex-col rounded-(--radius-panel) bg-gallery p-[14px]">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-(--radius-button)">
        <img
          src={images[index]}
          alt={`${alt} — imagen ${index + 1} de ${total}`}
          className="h-[380px] w-full object-cover md:h-[560px]"
          fetchPriority="high"
          decoding="async"
        />

        {total > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute top-1/2 left-2 flex -translate-y-1/2 items-center rounded-(--radius-chip) bg-gallery p-2.5 transition-opacity hover:opacity-80"
            >
              <span className="sr-only">Imagen anterior</span>
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
              <span className="sr-only">Imagen siguiente</span>
              <img
                src="/assets/icons/arrow-next.svg"
                alt=""
                width={24}
                height={24}
                aria-hidden="true"
              />
            </button>

            <div
              className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2"
              role="tablist"
              aria-label="Imágenes de la propiedad"
            >
              {images.map((image, dotIndex) => (
                <button
                  key={image}
                  type="button"
                  role="tab"
                  aria-selected={dotIndex === index}
                  aria-label={`Ver imagen ${dotIndex + 1}`}
                  onClick={() => setIndex(dotIndex)}
                  className={`size-2 rounded-full transition-colors ${
                    dotIndex === index ? 'bg-brand-yellow' : 'bg-dot hover:opacity-80'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="flex items-center justify-center rounded-b-(--radius-chip) bg-brand-yellow px-6 py-4">
        <span className="font-display text-[32px] leading-[46px] font-extrabold tracking-[-0.96px] text-navy-900 md:text-[48px]">
          {priceLabel}
        </span>
      </p>
    </div>
  );
}
