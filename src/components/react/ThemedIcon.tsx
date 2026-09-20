import { THEMED_ICONS, type ThemedIconName } from '../../data/icons';

/** Versión React de `ui/ThemedIcon.astro`, para usar dentro de las islas. */
export default function ThemedIcon({
  name,
  className = '',
}: {
  name: ThemedIconName;
  className?: string;
}) {
  const icon = THEMED_ICONS[name];

  return (
    <>
      <img
        src={icon.light}
        alt=""
        width={icon.width}
        height={icon.height}
        aria-hidden="true"
        className={`only-light shrink-0 ${className}`}
      />
      <img
        src={icon.dark}
        alt=""
        width={icon.width}
        height={icon.height}
        aria-hidden="true"
        className={`only-dark shrink-0 ${className}`}
      />
    </>
  );
}
