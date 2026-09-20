# Daniel Inmuebles

Sitio web de Daniel Inmuebles, implementado desde el diseño de Figma
[Web Daniel Inmuebles](https://www.figma.com/design/wklDKNY9jpkJbkjltE5m5H/Web-Daniel-Inmuebles),
página **"Single page 2"**, que trae cada pantalla en dos modelos: claro y oscuro.

## Stack

- **Astro 5**: páginas estáticas, una por ruta
- **React 19**: solo en las partes interactivas (islas)
- **Tailwind CSS 4**: tokens de marca en `@theme` y tokens semánticos por modo

## Empezar

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # genera dist/
npm run preview  # sirve dist/
npx astro check  # verificación de tipos
```

## Estructura

```
src/
  data/
    site.ts          Marca, navegación, contacto, redes
    properties.ts    Catálogo + tipos. Punto de entrada para la BD
    icons.ts         Iconos con una variante por modo
  lib/
    search.ts        Filtros y búsqueda en lenguaje natural (provisional)
  layouts/
    BaseLayout.astro Head, tipografías, script de modo, header y footer
  components/
    Header.astro     Navegación + botón día/noche
    Footer.astro
    PropertyCard.astro          Tarjeta compacta
    FeaturedPropertyCard.astro  Tarjeta grande de la home
    ui/Button.astro             primary · outline · soft · cta · feature · contrast
    ui/ThemedIcon.astro         Muestra la variante del icono según el modo
    sections/        Una sección de la home por archivo
    react/           Islas interactivas (ver abajo)
  pages/
    index.astro                  Home
    propiedades/index.astro      Buscador "Busca tu inmueble ideal"
    propiedades/[slug].astro     Ficha de detalle
  styles/global.css  Paleta, tokens por modo y utilidades
public/assets/       Imágenes e iconos exportados de Figma
design-assets/       Assets exportados que ya no se usan (no se publican)
```

### Islas de React

Solo se hidrata lo que necesita estado:

| Componente | Directiva | Qué hace |
|---|---|---|
| `ThemeToggle` | `client:load` | Botón de modo día / noche |
| `MobileNav` | `client:load` | Menú de navegación en pantallas pequeñas |
| `PropertySearch` | `client:load` | Filtros, Venta/Arriendo, búsqueda por texto y resultados |
| `PropertyGallery` | `client:load` | Galería de la ficha con flechas y puntos |
| `PropertyMap` | `client:visible` | Mapa con pines de precio + carrusel sincronizado |
| `FaqAccordion` | `client:visible` | Acordeón de preguntas frecuentes |

## Modo día / noche

El atributo `data-theme="light" | "dark"` en `<html>` decide el modo.

1. **Antes de pintar**, un script en el `<head>` de `BaseLayout.astro` elige el
   modo: primero la elección guardada, si no la preferencia del sistema
   operativo. Así no hay parpadeo al cargar.
2. **El botón** (`ThemeToggle.tsx`) alterna el modo, lo guarda en
   `localStorage` (clave `di-theme`) y hace un fundido con View Transitions
   donde el navegador lo soporta. Con "reducir movimiento" activado, cambia
   sin animación.

### Cómo están hechos los colores

`global.css` tiene tres capas:

1. **Primitivos**: la paleta de marca (`navy-950`, `brand-yellow`, …), igual
   en ambos modos.
2. **Tokens semánticos**: un token por rol del diseño (`bg-page`, `text-fg`,
   `text-heading`, `bg-card`, `text-accent`, `bg-btn`, …).
3. **Valores por modo**: `[data-theme='light']` y `[data-theme='dark']` le dan a
   cada token su color de Figma.

Los componentes solo usan tokens semánticos. Para cambiar un color en un modo,
basta editar su valor en la capa 3.

| Token | Claro | Oscuro | Dónde |
|---|---|---|---|
| `page` | `#FFFFFF` | `#021024` | Fondo |
| `fg` | `#0C1727` | `#FFFFFF` | Texto |
| `heading` | `#031939` | `#FFFFFF` | Títulos de sección |
| `card` | `#F6F5F4` | `#031939` | Tarjetas |
| `accent` | `#0C1727` | `#FFCC00` | Precios, subtítulos de tarjeta |
| `btn` / `btn-fg` | `#0C1727` / blanco | blanco / `#031C69` | Botón principal |
| `band` | `#031939` | `#031939` | Estadísticas y CTA de valoración |
| `footer` | `#020D1D` | `#021024` | Pie de página |

La lista completa está comentada en `global.css`.

### Iconos

Figma exporta cada SVG con el color ya aplicado, así que un icono que cambia de
color tiene dos archivos (`public/assets/icons/themed/*-light.svg` y
`*-dark.svg`). `ThemedIcon` pinta los dos y el CSS oculta el del modo inactivo.
Para agregar uno, se registra en `src/data/icons.ts`.

## Buscador

`/propiedades` implementa "Busca tu inmueble ideal":

- Filtros por zona, habitaciones, baños y rango de precio (aplican al instante)
- Venta / Arriendo y Apartamento / Casa
- Búsqueda por texto libre, que se aplica con "Buscar" o Enter

La búsqueda por texto es **provisional** (`src/lib/search.ts`): entiende
cantidades de habitaciones y baños (en número o en letras), parqueadero, tipo de
inmueble y barrios, sin importar tildes. Por ejemplo, la frase de ejemplo del
diseño, "Apartamento grande con 3 baños y parqueadero en Rosales", devuelve el
apartamento de Rosales. Al conectar la base de datos, `filterProperties` se
reemplaza por una consulta al servidor que recibe el mismo `SearchFilters`.

## Conectar la base de datos

Todo el contenido dinámico sale de `src/data/properties.ts`. La interfaz
`Property` está pensada para mapear 1:1 con una tabla, así que la integración
consiste en reemplazar la constante `PROPERTIES` por la consulta:

```ts
// Hoy
export const PROPERTIES: Property[] = [ /* ... */ ];

// Después
export async function getProperties(): Promise<Property[]> {
  return db.select().from(properties).where(eq(properties.status, 'disponible'));
}
```

Los consumidores a actualizar son `src/pages/index.astro`,
`src/pages/propiedades/index.astro` y `getStaticPaths()` en
`src/pages/propiedades/[slug].astro`.

Los campos de la ficha de detalle (`age`, `floors`, `propertyTax`, `adminFee`,
`amenities`, `highlights`) son opcionales a propósito: la ficha solo muestra las
celdas con dato, así que ninguna propiedad queda con información inventada.

## Pendientes antes de publicar

1. **Comprimir las imágenes.** Los PNG exportados de Figma pesan entre 1,6 MB y
   5 MB cada uno. Conviene pasarlos a WebP/AVIF o moverlos a `src/assets/` para
   que Astro los optimice con `astro:assets`.
2. **Foto del equipo.** La sección "Detrás de cada operación" tiene un espacio
   reservado; en Figma todavía no hay imagen definitiva.
3. **Mapa real.** Hoy es la imagen estática del diseño con los pines
   posicionados desde `property.mapPin`. Al conectar la BD se puede cambiar por
   Leaflet o Google Maps reutilizando esos mismos datos.
4. **Inmuebles en arriendo.** El filtro existe, pero todo el catálogo actual es
   de venta, así que "Arriendo" hoy muestra un mensaje de "sin resultados".
5. **Páginas legales.** El footer enlaza a `/politica-de-privacidad`,
   `/terminos-y-condiciones` y `/cookies`, que aún no existen.
6. **Dominio.** Ajustar `site` en `astro.config.mjs`; hoy apunta a
   `https://danielinmuebles.com`.

## Decisiones tomadas frente al diseño

### Modos claro y oscuro

- **Botón día/noche.** No está en Figma; se agregó a pedido del cliente, junto
  al botón de WhatsApp del header.
- **Buscador oscuro.** El frame oscuro (`152:2414`) no trae los bloques de
  filtro que sí tiene el claro (`163:4744`). Se usa la estructura completa en
  ambos modos, con los colores del bloque de filtro oscuro que el diseñador
  dejó suelto en el canvas (`209:810`).
- **Pines del mapa.** En la home oscura son blancos sobre marco azul; en la
  ficha y el buscador, amarillos. Se respeta tal cual (`tone="home"`).
- **Texto invisible en Figma.** Dos textos quedaron del mismo color que su
  fondo: el párrafo "Elige tu camino…" en claro (blanco sobre blanco) y la
  etiqueta "Destacado" en oscuro. Se pintan con el color de texto de su bloque.
- **Iconos de amenidades.** En oscuro, tres SVG (ascensor, zona infantil, salón
  de eventos) se exportaron con relleno `#323232` aunque en el diseño se ven
  blancos. Se normalizó solo el color; los trazados no se tocaron.

### Generales

- **Salto de línea de los títulos grandes.** El navegador dibuja el texto ~1,5 %
  más ancho que Figma, así que el hero usa 900 px útiles en vez de 836 px para
  conservar las tres líneas del diseño.
- **Datos inconsistentes entre secciones.** El bloque de destacadas y el
  carrusel muestran valores distintos para las mismas propiedades (p. ej.
  "Apartamento luminoso" aparece en Chapinero con 3 baños y en Cedritos con 2).
  Se tomó el carrusel como fuente única por ser el catálogo completo.
- **Filtro de zona.** Las cinco zonas del diseño están implementadas, pero los
  inmuebles del catálogo son del norte, así que solo "Norte" devuelve
  resultados.
- **Descripción de la ficha.** El texto de "Puntos cercanos" del diseño menciona
  lugares de Envigado (Medellín) en un inmueble de Usaquén. Se dejó tal cual
  para no inventar contenido; conviene corregirlo con el cliente.
