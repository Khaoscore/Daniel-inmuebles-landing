import { useMemo, useState, type ReactNode } from 'react';
import ThemedIcon from './ThemedIcon';
import type { ThemedIconName } from '../../data/icons';
import {
  formatPriceFull,
  formatPriceShort,
  formatPropertyMeta,
  uniqueValues,
  whatsappPropertyUrl,
  type Property,
} from '../../data/properties';
import {
  AGE_OPTIONS,
  ageLabel,
  describeExtraFilters,
  EMPTY_FILTERS,
  FEATURE_KEYS,
  FEATURES,
  hasFeature,
  parseQuery,
  searchProperties,
  type ControlFilters,
  type Feature,
  type SearchFilters,
} from '../../lib/search';

interface Props {
  properties: Property[];
  /** Muestra el cuadro de texto libre con los botones Borrar / Buscar. */
  textSearch?: boolean;
  /** Muestra las tarjetas de 12 en 12; en false se listan todas de una vez. */
  paginate?: boolean;
}

/** El diseño muestra 12 tarjetas antes de "Ver más propiedades". */
const PAGE_SIZE = 12;
const ROOM_OPTIONS = [1, 2, 3, 4] as const;
const PRICE_STEP = 10_000_000;

const roomLabel = (n: number) => (n === 4 ? '4+' : String(n));

/** Íconos de amenidades que ya existen en el diseño. */
const FEATURE_ICONS: Partial<Record<Feature, ThemedIconName>> = {
  elevator: 'amenity-elevator',
  pool: 'amenity-pool',
  kids: 'amenity-kids',
  pets: 'amenity-pets',
  social: 'amenity-events',
  gym: 'amenity-gym',
};

const toggleIn = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * Buscador "Busca tu inmueble ideal".
 * Figma: nodos 163:4744 (claro) y 152:2414 (oscuro).
 *
 * El frame oscuro no trae los bloques de filtro; se usa la estructura completa
 * del claro en ambos modos y los colores oscuros del bloque de referencia 209:810.
 */
export default function PropertySearch({ properties, textSearch = true, paginate = true }: Props) {
  // Zonas, tipos y rango de precios salen de los datos: si en Supabase aparece
  // una zona o un tipo nuevo, el filtro lo incluye sin tocar el código.
  const zones = useMemo(() => uniqueValues(properties, (p) => p.zone), [properties]);
  const types = useMemo(() => uniqueValues(properties, (p) => p.type), [properties]);

  const bounds = useMemo(() => {
    const prices = properties.map((p) => p.price).filter((p): p is number => p !== null);
    const min = prices.length ? Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP : 0;
    const max = prices.length ? Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP : 0;
    return { min, max: Math.max(max, min + PRICE_STEP) };
  }, [properties]);

  // Estratos y características: solo los que tiene al menos un inmueble.
  const strata = useMemo(
    () =>
      [...new Set(properties.map((p) => p.stratum).filter((s): s is number => s !== null))].sort(
        (a, b) => a - b,
      ),
    [properties],
  );
  const featureCounts = useMemo(
    () =>
      FEATURE_KEYS.map((feature) => ({
        feature,
        count: properties.filter((p) => hasFeature(p, feature)).length,
      })).filter(({ count }) => count > 0),
    [properties],
  );

  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [moreOpen, setMoreOpen] = useState(false);
  // El texto se aplica al pulsar "Buscar"; el resto de filtros, al instante.
  const [draftQuery, setDraftQuery] = useState('');
  // Controles que llenó la última búsqueda por texto: una búsqueda nueva que no
  // los mencione los vuelve a dejar libres.
  const [fromText, setFromText] = useState<(keyof ControlFilters)[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const update = (patch: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setVisible(PAGE_SIZE);
  };

  /** Interpreta el texto y lo refleja en los filtros de la interfaz. */
  const applyText = () => {
    const { controls, text } = parseQuery(draftQuery, properties);

    // El slider solo va de bounds.min a bounds.max, en pasos de PRICE_STEP.
    if (controls.minPrice != null) {
      const value = Math.floor(controls.minPrice / PRICE_STEP) * PRICE_STEP;
      controls.minPrice = value <= bounds.min ? null : Math.min(value, bounds.max);
    }
    if (controls.maxPrice != null) {
      const value = Math.ceil(controls.maxPrice / PRICE_STEP) * PRICE_STEP;
      controls.maxPrice = value >= bounds.max ? null : Math.max(value, bounds.min);
    }

    const cleared = Object.fromEntries(
      fromText.filter((key) => !(key in controls)).map((key) => [key, EMPTY_FILTERS[key]]),
    );
    update({ ...cleared, ...controls, text });
    setFromText(Object.keys(controls) as (keyof ControlFilters)[]);
  };

  const { matches, similar } = useMemo(
    () => searchProperties(properties, filters),
    [properties, filters],
  );
  const shown = paginate ? matches.slice(0, visible) : matches;
  const extraTags = describeExtraFilters(filters);
  const moreCount =
    filters.strata.length +
    filters.features.length +
    (filters.minArea !== null || filters.maxArea !== null ? 1 : 0) +
    (filters.maxAge !== null ? 1 : 0);

  const isDirty =
    JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) || draftQuery !== '';

  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setDraftQuery('');
    setFromText([]);
    setVisible(PAGE_SIZE);
  };

  const minPrice = filters.minPrice ?? bounds.min;
  const maxPrice = filters.maxPrice ?? bounds.max;

  const toggleZone = (zone: string) =>
    update({
      zones: filters.zones.includes(zone)
        ? filters.zones.filter((z) => z !== zone)
        : [...filters.zones, zone],
    });

  /** Tipo de inmueble. Va junto a "Más filtros" o, con el panel abierto, debajo de él. */
  const typeToggles = (className = '') =>
    types.length > 1 && (
      <div className={`flex flex-wrap gap-4 ${className}`} role="group" aria-label="Tipo de inmueble">
        {types.map((type) => (
          <Toggle
            key={type}
            active={filters.type === type}
            onClick={() => update({ type: filters.type === type ? null : type })}
          >
            {type}
          </Toggle>
        ))}
      </div>
    );

  const asPercent = (value: number) => ((value - bounds.min) / (bounds.max - bounds.min)) * 100;

  return (
    <div className="flex flex-col gap-16">
      <form
        className="flex flex-col gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          applyText();
        }}
      >
        {/* ---------- Bloques de filtro ---------- */}
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <FilterBlock title="Zona">
              <div className="flex max-h-[300px] flex-col overflow-y-auto">
                {zones.map((zone) => {
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
                      left: `${asPercent(minPrice)}%`,
                      width: `${asPercent(maxPrice) - asPercent(minPrice)}%`,
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
                    value={minPrice}
                    onChange={(e) => {
                      const value = Math.min(Number(e.target.value), maxPrice);
                      update({ minPrice: value <= bounds.min ? null : value });
                    }}
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
                    value={maxPrice}
                    onChange={(e) => {
                      const value = Math.max(Number(e.target.value), minPrice);
                      update({ maxPrice: value >= bounds.max ? null : value });
                    }}
                    className="range-handle"
                  />
                </div>
                <div className="flex justify-between pt-5 text-[16px] leading-5 font-semibold text-fg">
                  <span>{formatPriceShort(minPrice).replace(' ', '')}</span>
                  <span>{formatPriceShort(maxPrice).replace(' ', '')}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 px-6">
                <p className="rounded-(--radius-chip) border border-option-border bg-option px-4 py-2 text-[16px] leading-5 font-semibold whitespace-nowrap text-fg">
                  Mín: {formatPriceFull(minPrice)}
                </p>
                <p className="rounded-(--radius-chip) border border-option-border bg-option px-4 py-2 text-[16px] leading-5 font-semibold whitespace-nowrap text-fg">
                  Máx: {formatPriceFull(maxPrice)}
                </p>
              </div>
            </FilterBlock>
          </div>

          {/* "Más filtros" debajo del bloque de precio, en su misma columna. Con el
              panel cerrado, los tipos de inmueble ocupan el resto de la fila. */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
            <button
              type="button"
              onClick={() => setMoreOpen((open) => !open)}
              aria-expanded={moreOpen}
              aria-controls="busqueda-mas-filtros"
              className="flex items-center justify-between gap-3 rounded-[10px] bg-field px-10 py-4 text-[16px] leading-5 font-semibold text-field-label transition-opacity hover:opacity-80 sm:col-start-2 lg:col-start-4 lg:row-start-1"
            >
              <span className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path
                    d="M3 5h8m4 0h2M3 10h2m4 0h8M3 15h10m4 0h0"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <circle cx="13" cy="5" r="2" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="7" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                Más filtros
                {moreCount > 0 && (
                  <span className="flex size-6 items-center justify-center rounded-full bg-brand-yellow text-[13px] font-bold text-navy-900">
                    {moreCount}
                  </span>
                )}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
                className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}
              >
                <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {!moreOpen && typeToggles('sm:col-span-2 lg:col-span-3 lg:col-start-1 lg:row-start-1')}
          </div>
        </div>

        {/* ---------- Más filtros ---------- */}
        {moreOpen && (
          <div
            id="busqueda-mas-filtros"
            className="flex flex-col gap-8 rounded-[10px] bg-field p-6 md:p-8"
          >
            <div className="grid gap-8 md:grid-cols-3">
              {strata.length > 0 && (
                <PanelSection title="Estrato">
                  <div className="flex flex-wrap gap-3" role="group" aria-label="Estrato">
                    {strata.map((stratum) => (
                      <Chip
                        key={stratum}
                        active={filters.strata.includes(stratum)}
                        onClick={() => update({ strata: toggleIn(filters.strata, stratum) })}
                        className="size-12 justify-center"
                      >
                        {stratum}
                      </Chip>
                    ))}
                  </div>
                </PanelSection>
              )}

              <PanelSection title="Área (m²)">
                <div className="flex items-center gap-3">
                  <AreaInput
                    label="Área mínima"
                    placeholder="Desde"
                    value={filters.minArea}
                    onChange={(minArea) => update({ minArea })}
                  />
                  <span className="text-fg" aria-hidden="true">–</span>
                  <AreaInput
                    label="Área máxima"
                    placeholder="Hasta"
                    value={filters.maxArea}
                    onChange={(maxArea) => update({ maxArea })}
                  />
                </div>
              </PanelSection>

              <PanelSection title="Antigüedad">
                <div className="flex flex-wrap gap-3" role="group" aria-label="Antigüedad">
                  {AGE_OPTIONS.map((years) => (
                    <Chip
                      key={years}
                      active={filters.maxAge === years}
                      onClick={() => update({ maxAge: filters.maxAge === years ? null : years })}
                    >
                      {ageLabel(years)}
                    </Chip>
                  ))}
                </div>
              </PanelSection>
            </div>

            {featureCounts.length > 0 && (
              <PanelSection title="Características">
                <div className="flex flex-wrap gap-3" role="group" aria-label="Características">
                  {featureCounts.map(({ feature, count }) => {
                    const active = filters.features.includes(feature);
                    const icon = FEATURE_ICONS[feature];
                    return (
                      <Chip
                        key={feature}
                        active={active}
                        onClick={() => update({ features: toggleIn(filters.features, feature) })}
                      >
                        {/* Activo lleva check: los íconos no contrastan sobre el fondo activo. */}
                        {active ? <CheckMark /> : icon && <ThemedIcon name={icon} className="size-5" />}
                        {FEATURES[feature].label}
                        <span className={active ? 'opacity-70' : 'text-option-fg'}>({count})</span>
                      </Chip>
                    );
                  })}
                </div>
              </PanelSection>
            )}

            {moreCount > 0 && (
              <button
                type="button"
                onClick={() =>
                  update({ strata: [], minArea: null, maxArea: null, maxAge: null, features: [] })
                }
                className="self-start text-[14px] font-medium text-fg underline"
              >
                Quitar estos filtros
              </button>
            )}
          </div>
        )}

        {/* Con el panel abierto, los tipos bajan debajo de él. */}
        {moreOpen && typeToggles()}

        {/* ---------- Búsqueda en lenguaje natural ---------- */}
        {textSearch && (
          <>
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
                  applyText();
                }
              }}
              placeholder="Ej: “Apartamento con 3 habitaciones, 2 baños y parqueadero en Cedritos”"
              className="h-[225px] w-full resize-none rounded-(--radius-chip) border border-input-border bg-input p-4 text-[16px] leading-5 text-fg placeholder:text-input-fg focus:border-brand-yellow focus:outline-none"
            />
          </>
        )}

        {/* Lo que no se ve en los bloques de arriba: barrio, palabras y "Más filtros". */}
        {extraTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            <span className="text-[14px] leading-[22px] text-heading">También buscamos:</span>
            {extraTags.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => update(tag.remove)}
                aria-label={`Quitar ${tag.label}`}
                className="flex items-center gap-2 rounded-(--radius-pill) border border-option-border bg-option px-4 py-1.5 text-[14px] leading-5 font-semibold text-fg transition-colors hover:border-line/40"
              >
                {tag.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {textSearch && (
          <>
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
          </>
        )}
      </form>

      {/* ---------- Resultados ---------- */}
      <section aria-labelledby="resultados-titulo" className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 text-[14px] leading-[22px] text-heading">
          <h2 id="resultados-titulo" aria-live="polite">
            {matches.length}{' '}
            {matches.length === 1 ? 'propiedad disponible' : 'propiedades disponibles'}
          </h2>
          {isDirty && (
            <button type="button" onClick={reset} className="font-medium underline">
              Limpiar filtros
            </button>
          )}
        </div>

        {matches.length === 0 && similar.length === 0 ? (
          <div className="rounded-(--radius-field) bg-card p-10 text-center text-fg">
            <p className="text-[19px] font-semibold">
              No encontramos propiedades con esos filtros.
            </p>
            <p className="mt-2 text-[16px] leading-5">
              Prueba con menos filtros o escríbenos y te avisamos cuando llegue un inmueble así.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-[9px] bg-more px-6 py-3 text-[16px] font-bold text-more-fg"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          matches.length > 0 && <ResultGrid properties={shown} />
        )}

        {shown.length < matches.length && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="mx-auto w-full max-w-[362px] rounded-[9px] bg-more px-4 py-[14px] text-[16px] font-bold text-more-fg transition-opacity hover:opacity-90"
          >
            Ver más propiedades
          </button>
        )}

        {/* ---------- Opciones parecidas (cuando pocas cumplen todo) ---------- */}
        {similar.length > 0 && (
          <div className="flex flex-col gap-6 pt-4">
            <div className="text-fg">
              <h3 className="text-[19px] font-semibold">
                {matches.length === 0
                  ? 'No hay propiedades que cumplan todo, pero estas se acercan'
                  : 'Otras opciones parecidas'}
              </h3>
              <p className="mt-1 text-[16px] leading-5">
                Difieren en algún detalle (precio, barrio, habitaciones...). Escríbenos si alguna te
                interesa.
              </p>
            </div>
            <ResultGrid properties={similar} />
          </div>
        )}
      </section>
    </div>
  );
}

function ResultGrid({ properties }: { properties: Property[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((property) => (
        <li key={property.id}>
          <ResultCard property={property} />
        </li>
      ))}
    </ul>
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

/* ----- Panel "Más filtros" (sin diseño en Figma; usa los estilos de los bloques) ----- */

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="float-left w-full pb-4 text-[16px] leading-5 font-semibold text-field-label">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Chip({
  active,
  onClick,
  className = '',
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-(--radius-chip) border px-4 py-3 text-[15px] leading-5 font-semibold transition-colors ${
        active
          ? 'border-transparent bg-option-active text-option-active-fg'
          : 'border-option-border bg-option text-fg hover:border-line/40'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M2.5 7.5l3 3 6-6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AreaInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="min-w-0 flex-1">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        step={5}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={(e) => {
          const number = Number(e.target.value);
          onChange(e.target.value === '' || !Number.isFinite(number) || number <= 0 ? null : number);
        }}
        className="w-full rounded-(--radius-chip) border border-option-border bg-option px-4 py-3 text-[16px] leading-5 font-semibold text-fg placeholder:font-normal placeholder:text-option-fg focus:border-brand-yellow focus:outline-none"
      />
    </label>
  );
}

/** Tarjeta de la rejilla de resultados. Figma: nodo 163:4780. */
function ResultCard({ property }: { property: Property }) {
  const href = `/propiedades/${property.slug}`;

  return (
    <article className="flex h-full flex-col gap-4 rounded-(--radius-field) bg-card p-[14px] text-fg">
      <a href={href} className="relative block h-[220px] overflow-hidden rounded-[11px] bg-fg/5">
        <img
          src={property.cover}
          alt={property.title}
          width={361}
          height={220}
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 hover:scale-105"
        />
        {property.unavailable && property.status && (
          <span className="absolute top-2 right-2 rounded-md bg-brand-yellow px-2 py-1 text-[12px] font-bold text-navy-900 capitalize">
            {property.status}
          </span>
        )}
      </a>

      <div className="flex items-baseline justify-between gap-3 font-semibold">
        <h3 className="text-[24px] leading-[28px] tracking-[-0.6px] md:text-[28px] md:leading-8">
          <a href={href} className="transition-opacity hover:opacity-70">
            {property.title}
          </a>
        </h3>
        {property.zone && <span className="text-[12px] whitespace-nowrap">{property.zone}</span>}
      </div>

      <p className="text-[16px] leading-5">{formatPropertyMeta(property)}</p>

      <p className="font-display mt-auto text-[40px] leading-[46px] font-extrabold tracking-[-0.96px] text-accent md:text-[48px]">
        {formatPriceShort(property.price)}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={href}
          className="flex items-center justify-center rounded-[9px] border border-line/25 px-4 py-[14px] text-[16px] font-bold transition-colors hover:border-line"
        >
          Ver detalles
        </a>
        <a
          href={whatsappPropertyUrl(property)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-[9px] bg-cta px-4 py-[14px] text-[16px] font-bold text-navy-900 transition-opacity hover:opacity-90"
        >
          Agendar visita
        </a>
      </div>
    </article>
  );
}
