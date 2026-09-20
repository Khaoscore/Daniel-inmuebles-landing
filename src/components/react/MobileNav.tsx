import { useEffect, useRef, useState } from 'react';
import type { NavLink } from '../../data/site';
import ThemedIcon from './ThemedIcon';

interface Props {
  links: NavLink[];
  whatsappUrl: string;
}

/**
 * Menú de navegación para pantallas pequeñas.
 * El diseño de Figma sólo define la versión desktop; esta es la
 * adaptación responsive con el mismo lenguaje visual.
 */
export default function MobileNav({ links, whatsappUrl }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Bloquea el scroll del body y cierra con Escape mientras está abierto.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="flex size-11 items-center justify-center rounded-(--radius-button) border border-line/25 text-fg"
      >
        <span className="sr-only">Abrir menú</span>
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path
            d="M3 6h16M3 11h16M3 16h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de navegación"
          className="fixed inset-0 z-[60] flex flex-col bg-page px-5 py-6"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[22px] font-extrabold tracking-[-0.44px] text-fg">
              Daniel Inmuebles
            </span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="flex size-11 items-center justify-center rounded-(--radius-button) border border-line/25 text-fg"
            >
              <span className="sr-only">Cerrar menú</span>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                <path
                  d="M5 5l12 12M17 5L5 17"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav className="mt-10 flex flex-col gap-1" aria-label="Navegación principal">
            {links.map((link) => (
              <a
                key={`${link.label}-${link.href}`}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-(--radius-chip) px-2 py-4 text-2xl font-semibold text-fg transition-opacity hover:opacity-70"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center justify-center gap-3 rounded-(--radius-button) bg-btn px-5 py-4 text-[16px] font-bold text-btn-fg"
          >
            Quiero vender mi inmueble
            <ThemedIcon name="wa-header" />
          </a>
        </div>
      )}
    </div>
  );
}
