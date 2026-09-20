import { useMemo, useState, type ReactNode } from 'react';
import ThemedIcon from './ThemedIcon';
import {
  formatPriceFull,
  formatPriceShort,
  formatPropertyMeta,
  ZONES,
  type Operation,
  type Property,
  type PropertyType,
  type Zone,
} from '../../data/properties';
import { filterProperties, type SearchFilters } from '../../lib/search';

interface Props {
  properties: Property[];
}

/** El diseño muestra 12 tarjetas antes de "Ver más propiedades". */
const PAGE_SIZE = 12;
const ROOM_OPTIONS = [1, 2, 3, 4] as const;
const PRICE_STEP = 10_000_000;

const roomLabel = (n: number) => (n === 4 ? '4+' : String(n));

/**
 * Buscador "Busca tu inmueble ideal".
 * Figma: nodos 163:4744 (claro) y 152:2414 (oscuro).
 *
 * El frame oscuro no trae los bloques de filtro; se usa la estructura completa
 * del claro en ambos modos y los colores oscuros del bloque de referencia 209:810.
 */
export default function PropertySearch({ properties }: Props) {
  const bounds = useMemo(
    () => ({
      min: Math.min(...properties.map((p) => p.price)),
      max: Math.max(...properties.map((p) => p.price)),
    }),
    [properties],
  );

  const initialFilters: SearchFilters = {
    operation: 'venta',
    type: null,
    zones: [],
    bedrooms: null,
    bathrooms: null,
    minPrice: bounds.min,
    maxPrice: bounds.max,
    query: '',
  };

  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  // El texto se aplica al pulsar "Buscar"; el resto de filtros, al instante.
  const [draftQuery, setDraftQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const update = (patch: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setVisible(PAGE_SIZE);
  };

  const results = useMemo(() => filterProperties(properties, filters), [properties, filters]);

  const isDirty =
    JSON.stringify(filters) !== JSON.stringify(initialFilters) || draftQuery !== '';

  const reset = () => {
    setFilters(initialFilters);
    setDraftQuery('');
    setVisible(PAGE_SIZE);
  };

  const toggleZone = (zone: Zone) =>
    update({
      zones: filters.zones.includes(zone)
        ? filters.zones.filter((z) => z !== zone)
        : [...filters.zones, zone],
    });

  const asPercent = (value: number) => ((value - bounds.min) / (bounds.max - bounds.min)) * 100;

  return (
    <div className="flex flex-col gap-16">
      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          update({ query: draftQuery });
        }}
      >
        {/* ---------- Bloques de filtro ---------- */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FilterBlock title="Zona de Bogotá">
            <div className="flex flex-col">
              {ZONES.map((zone) => {
                const checked = filters.zones.includes(zone);
                return (
                  <label
                    key={zone}
                    className="flex cursor-pointer items-center gap-4 rounded-(--radius-chip) px-6 py-1 transition-colors hover:bg-fg/5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleZone(zone)}
                      className="peer sr-only"
                    />
                    {checked ? (
                      <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[3px] bg-brand-yellow">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                          <path
                            d="M2.5 7.5l3 3 6-6.5"
                            stroke="var(--color-navy-900)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <ThemedIcon name="checkbox" />
                    )}
                    <span className="text-[16px] leading-5 text-fg peer-focus-visible:underline">
                      {zone}
                    </span>
                  </label>
                );
              })}
            </div>
          </FilterBlock>

          <FilterBlock title="Habitaciones">
            <OptionGrid
              label="Habitaciones"
              value={filters.bedrooms}
              onChange={(bedrooms) => update({ bedrooms })}
            />
          </FilterBlock>

          <FilterBlock title="Baños">
            <OptionGrid
              label="Baños"
              value={filters.bathrooms}
              onChange={(bathrooms) => update({ bathrooms })}
            />
          </FilterBlock>

          <FilterBlock title="Precio">
            <div className="px-6">
              <div className="relative h-2">
                <div className="absolute inset-0 rounded-full bg-track" />
                <div
                  className="absolute top-0 h-2 rounded-full bg-brand-yellow"
                  style={{
                    left: `${asPercent(filters.minPrice)}%`,
                    width: `${asPercent(filters.maxPrice) - asPercent(filters.minPrice)}%`,
                  }}
                />
                <label className="sr-only" htmlFor="busqueda-precio-min">
                  Precio mínimo
                </label>
                <input
                  id="busqueda-precio-min"
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={PRICE_STEP}
                  value={filters.minPrice}
                  onChange={(e) =>
                    update({ minPrice: Math.min(Number(e.target.value), filters.maxPrice) })
                  }
                  className="range-handle"
                />
                <label className="sr-only" htmlFor="busqueda-precio-max">
                  Precio máximo
                </label>
                <input
                  id="busqueda-precio-max"
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={PRICE_STEP}
                  value={filters.maxPrice}
                  onChange={(e) =>
                    update({ maxPrice: Math.max(Number(e.target.value), filters.minPrice) })
                  }
                  className="range-handle"
                />
              </div>
              <div className="flex justify-between pt-5 text-[16px] leading-5 font-semibold text-fg">
                <span>{formatPriceShort(filters.minPrice).replace(' ', '')}</span>
                <span>{formatPriceShort(filters.maxPrice).replace(' ', '')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 px-6">
              <p className="rounded-(--radius-chip) border border-option-border bg-option px-4 py-2 text-[16px] leading-5 font-semibold whitespace-nowrap text-fg">
                Mín: {formatPriceFull(filters.minPrice)}
              </p>
              <p className="rounded-(--radius-chip) border border-option-border bg-option px-4 py-2 text-[16px] leading-5 font-semibold whitespace-nowrap text-fg">
                Máx: {formatPriceFull(filters.maxPrice)}
              </p>
            </div>
          </FilterBlock>
        </div>

        {/* ---------- Venta / Arriendo y tipo ---------- */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-4" role="group" aria-label="Tipo de negocio">
            {(['venta', 'arriendo'] as Operation[]).map((operation) => (
              <Toggle
                key={operation}
                active={filters.operation === operation}
                onClick={() => update({ operation })}
              >
                {operation === 'venta' ? 'Venta' : 'Arriendo'}
              </Toggle>
            ))}
          </div>
          <div className="flex gap-4" role="group" aria-label="Tipo de inmueble">
            {(['Apartamento', 'Casa'] as PropertyType[]).map((type) => (
              <Toggle
                key={type}
                active={filters.type === type}
                onClick={() => update({ type: filters.type === type ? null : type })}
              >
                {type}
              </Toggle>
            ))}
          </div>
        </div>

        {/* ---------- Búsqueda en lenguaje natural ---------- */}
        <label className="sr-only" htmlFor="busqueda-texto">
          Describe lo que buscas
        </label>
        <textarea
          id="busqueda-texto"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter busca; Shift+Enter hace salto de línea.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              update({ query: draftQuery });
            }
          }}
          placeholder="Ej: “Apartamento grande con 3 baños y parqueadero en Rosales”"
          className="h-[225px] w-full resize-none rounded-(--radius-chip) border border-input-border bg-input p-4 text-[16px] leading-5 text-fg placeholder:text-input-fg focus:border-brand-yellow focus:outline-none"
        />

        <div className="flex items-end justify-end gap-4">
          <button
            type="button"
            onClick={reset}
            disabled={!isDirty}
            className="flex items-start gap-2 rounded-(--radius-pill) border border-ghost px-[26px] py-4 text-[17px] font-bold text-ghost transition-opacity enabled:hover:opacity-70 disabled:cursor-not-allowed"
          >
            Borrar
            <ThemedIcon name="delete" />
          </button>
          <button
            type="submit"
            className="flex items-start gap-2 rounded-(--radius-pill) bg-btn px-[26px] py-4 text-[17px] font-bold text-btn-fg transition-opacity hover:opacity-90"
          >
            Buscar
            <ThemedIcon name="search-btn" />
          </button>
        </div>
      </form>

      {/* ---------- Resultados ---------- */}
      <section aria-labelledby="resultados-titulo" className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 text-[14px] leading-[22px] text-heading">
          <h2 id="resultados-titulo" aria-live="polite">
            {results.length}{' '}
            {results.length === 1 ? 'propiedad disponible' : 'propiedades disponibles'}
          </h2>
          {isDirty && (
            <button type="button" onClick={reset} className="font-medium underline">
              Limpiar filtros
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="rounded-(--radius-field) bg-card p-10 text-center text-fg">
            <p className="text-[19px] font-semibold">
              No encontramos propiedades con esos filtros.
            </p>
            {filters.operation === 'arriendo' && (
              <p className="mt-2 text-[16px] leading-5">
                Por ahora todo el catálogo está en venta. Escríbenos y te avisamos cuando haya
                inmuebles en arriendo.
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-[9px] bg-more px-6 py-3 text-[16px] font-bold text-more-fg"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.slice(0, visible).map((property) => (
              <li key={property.id}>
                <ResultCard property={property} />
              </li>
            ))}
          </ul>
        )}

        {results.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="mx-auto w-full max-w-[362px] rounded-[9px] bg-more px-4 py-[14px] text-[16px] font-bold text-more-fg transition-opacity hover:opacity-90"
          >
            Ver más propiedades
          </button>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-[10px] bg-field p-4">
      <legend className="float-left w-full px-6 py-2 text-[16px] leading-5 font-semibold text-field-label">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function OptionGrid({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 px-6" role="group" aria-label={label}>
      {ROOM_OPTIONS.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : option)}
            className={`flex h-[67px] items-center justify-center rounded-(--radius-chip) border text-[16px] leading-5 font-semibold transition-colors ${
              active
                ? 'border-transparent bg-option-active text-option-active-fg'
                : 'border-option-border bg-option text-option-fg hover:border-line/40'
            }`}
          >
            {roomLabel(option)}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-toggle border px-8 py-3 text-[20px] leading-[22px] font-semibold transition-colors ${
        active
          ? 'border-transparent bg-toggle text-toggle-fg'
          : 'border-toggle-line bg-transparent text-fg hover:bg-fg/5'
      }`}
    >
      {children}
    </button>
  );
}

/** Tarjeta de la rejilla de resultados. Figma: nodo 163:4780. */
function ResultCard({ property }: { property: Property }) {
  const href = `/propiedades/${property.slug}`;

  return (
    <article className="flex h-full flex-col gap-4 rounded-(--radius-field) bg-card p-[14px] text-fg">
      <a href={href} className="block h-[177px] overflow-hidden rounded-[11px]">
        <img
          src={property.image}
          alt={`${property.title} en ${property.neighborhood}`}
          width={361}
          height={177}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 hover:scale-105"
        />
      </a>

      <div className="flex items-baseline justify-between gap-3 font-semibold">
        <h3 className="text-[28px] leading-[30px] tracking-[-0.72px] md:text-[36px] md:leading-9">
          <a href={href} className="transition-opacity hover:opacity-70">
            {property.title}
          </a>
        </h3>
        <span className="text-[12px] whitespace-nowrap">{property.type}</span>
      </div>

      <p className="text-[16px] leading-5">{formatPropertyMeta(property)}</p>

      <p className="font-display mt-auto text-[40px] leading-[46px] font-extrabold tracking-[-0.96px] text-accent md:text-[48px]">
        {formatPriceShort(property.price)}
      </p>

      <a
        href={href}
        className="flex items-center justify-center rounded-[9px] bg-cta px-4 py-[14px] text-[16px] font-bold text-navy-900 transition-opacity hover:opacity-90"
      >
        Agendar visita
      </a>
    </article>
  );
}
