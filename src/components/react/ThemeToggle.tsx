import { useEffect, useRef, useState } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'di-theme';

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Modo privado o almacenamiento bloqueado: el cambio vale para esta visita.
  }
}

function paintTheme(theme: Theme) {
  const root = document.documentElement;

  // Sin esto, los elementos con `transition` animan su color y quedan
  // desfasados del resto durante el cambio de modo.
  root.classList.add('theme-switching');
  root.dataset.theme = theme;
  void root.offsetWidth; // aplica los estilos nuevos antes de reactivar transiciones
  requestAnimationFrame(() => root.classList.remove('theme-switching'));
}

/**
 * Botón de modo día / noche.
 * El tema inicial lo fija un script en el <head> (BaseLayout) antes de pintar,
 * para que no haya parpadeo; este botón solo lo alterna y lo recuerda.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  // Hasta hidratar no sabemos el tema real; evita un icono equivocado.
  const [theme, setTheme] = useState<Theme | null>(null);
  // Último modo pedido. Con View Transitions el DOM se actualiza un fotograma
  // después del clic; si el siguiente modo se calculara leyendo el DOM, dos
  // clics seguidos pedirían el mismo modo y el botón quedaría desincronizado.
  const requested = useRef<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    const current = requested.current ?? readTheme();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    requested.current = next;

    persistTheme(next);
    setTheme(next);

    // Fundido entre modos donde el navegador lo soporta.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !reduceMotion) {
      document.startViewTransition(() => paintTheme(next));
    } else {
      paintTheme(next);
    }
  };

  const isDark = theme !== 'light';
  const label = isDark ? 'Activar modo día' : 'Activar modo noche';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex size-11 shrink-0 items-center justify-center rounded-(--radius-button) border border-line/25 text-fg transition-colors hover:border-line ${className}`}
    >
      {/* En modo noche se ofrece el sol (pasar a día) y viceversa */}
      {isDark ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
          <path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
