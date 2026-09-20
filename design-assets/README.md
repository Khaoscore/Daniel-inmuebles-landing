# Assets fuera de uso

Archivos exportados de Figma que el sitio ya no usa. Quedan fuera de `public/`
para no publicarse, pero se conservan porque las URLs de exportación de Figma
caducan a los 7 días.

## `single-page-1/`

Del primer modelo del diseño (página "Single page", nodo 27:2048), reemplazado
por "Single page 2" al agregar el modo día/noche.

- `img/hero-bogota.png` — foto aérea de Bogotá del hero. En "Single page 2" el
  hero no lleva foto. En el modelo anterior iba detrás del texto a
  1590 × 927 px, centrada y 101 px por encima de la sección, estirada
  (`object-fit: fill`, como en Figma), con una capa negra al 20 % en modo
  overlay y un degradado radial `rgba(6,11,53,0.8)` → transparente en modo
  multiply para dar contraste al título.
- `icons/` — iconos de un solo color, sustituidos por las variantes por modo de
  `public/assets/icons/themed/`.
