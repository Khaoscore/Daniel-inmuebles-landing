# Daniel Inmuebles

Sitio web de Daniel Inmuebles, implementado desde el diseño de Figma
[Web Daniel Inmuebles](https://www.figma.com/design/wklDKNY9jpkJbkjltE5m5H/Web-Daniel-Inmuebles),
página **"Single page 2"**, que trae cada pantalla en dos modelos: claro y oscuro.

El catálogo sale de un **Google Sheet** que un Apps Script sincroniza con
**Supabase**. El sitio lo lee en cada visita, así que agregar, editar o quitar
un inmueble en la hoja se refleja sin recompilar ni desplegar.

## Stack

- **Astro 5** en modo servidor (`output: "server"`, adaptador de Node standalone)
- **React 19**: solo en las partes interactivas (islas)
- **Tailwind CSS 4**: tokens de marca en `@theme` y tokens semánticos por modo
- **Supabase**: base de datos del catálogo (se consulta una vista pública)

## Empezar

```bash
npm install
npm run dev              # http://localhost:4321
npx tsc --noEmit         # verificación de tipos (o npx astro check)
npm run build            # genera dist/
node dist/server/entry.mjs   # sirve el build (variables PORT y HOST)
```

Hace falta un `.env` con las variables de [Configuración](#configuración).

## Estructura

```
src/
  data/
    site.ts          Marca, navegación, contacto, redes
    properties.ts    Tipos del catálogo, limpieza de filas (mapRow) y formateadores
    icons.ts         Iconos con una variante por modo
  lib/
    catalog.ts       Consultas a Supabase (solo servidor)
    search.ts        Motor de búsqueda: texto libre, filtros y similitud
    drive.ts         Fotos desde carpetas públicas de Google Drive
    location.ts      Limpieza de direcciones y enlaces de Google Maps
    geocode.ts       Dirección → coordenadas (Geocoding API + caché en Supabase)
    google-maps.ts   Carga de Maps JavaScript API en el navegador
    supabase.ts      Cliente con la clave publicable
    supabase-admin.ts  Cliente con la clave secreta (solo servidor)
  layouts/
    BaseLayout.astro Head, tipografías, script de modo, header y footer
  components/
    Header.astro · Footer.astro
    PropertyCard.astro          Tarjeta compacta
    FeaturedPropertyCard.astro  Tarjeta grande de la home
    ui/Button.astro             primary · outline · soft · cta · feature · contrast
    ui/ThemedIcon.astro         Muestra la variante del icono según el modo
    sections/        Una sección de la home por archivo
    react/           Islas interactivas (ver abajo)
  pages/
    index.astro                  Home, con el buscador completo
    propiedades/index.astro      Catálogo completo (filtros, sin texto libre)
    propiedades/[slug].astro     Ficha de detalle
    sobre-nosotros.astro
    404.astro
    api/portada/[id].ts          Portada de las tarjetas (302 a la primera foto)
  styles/global.css  Paleta, tokens por modo y utilidades
supabase/
  ubicaciones.sql    Tabla de coordenadas para el mapa
public/assets/       Imágenes e iconos exportados de Figma
design-assets/       Assets exportados que ya no se usan (no se publican)
```

### Islas de React

Solo se hidrata lo que necesita estado:

| Componente | Directiva | Qué hace |
|---|---|---|
| `ThemeToggle` | `client:load` | Botón de modo día / noche |
| `MobileNav` | `client:load` | Menú de navegación en pantallas pequeñas |
| `PropertySearch` | `client:load` | Filtros, panel "Más filtros", búsqueda por texto y resultados |
| `PropertyGallery` | `client:load` | Galería de la ficha con flechas y puntos |
| `PropertyMap` | `client:visible` | Mapa con pines de precio + carrusel sincronizado |
| `FaqAccordion` | `client:visible` | Acordeón de preguntas frecuentes |

## Datos: Google Sheet → Supabase → sitio

```
Google Sheet ──Apps Script──▶ propiedades ──vista──▶ propiedades_publicas ──▶ servidor Astro ──▶ navegador
                                (tabla)                (solo columnas públicas)   (cada visita)     (islas)
```

1. **Google Sheet**: fuente de verdad, una fila por inmueble.
2. **Apps Script**: copia las filas a la tabla `propiedades` de Supabase.
3. **Vista `propiedades_publicas`**: expone solo lo publicable. Captador,
   documentos, `link_agente` y `ficha_inmueble` se quedan en la tabla. El sitio
   usa la clave publicable, que solo lee esta vista.
4. **Servidor**: `getProperties()` (`src/lib/catalog.ts`) consulta la vista en
   cada visita, ordenada por `created_at` e `id_inmueble` descendente, y limpia
   cada fila con `mapRow`.
5. **Navegador**: el catálogo completo llega como props a las islas.

> El código del Apps Script y el SQL de la tabla `propiedades` y de la vista
> **no están en este repositorio**. Renombrar, mover o borrar una columna del
> Sheet exige actualizar el script, la tabla, la vista y `PublicRow`. Agregar
> columnas al final es seguro.

### Limpieza de cada fila (`mapRow`)

Los textos llegan del Sheet en mayúsculas y con formatos libres ("126 MTRS",
"3 MAS ESTUDIO", "📍"). `src/data/properties.ts` los limpia una sola vez; los
campos `*Text` conservan el valor legible y los numéricos sirven para filtrar.

| Campo | Regla |
|---|---|
| `type`, `neighborhood`, `zone` | Title Case: "VILLAS DE GRANADA" → "Villas de Granada" |
| `bedrooms`, `area` | Primer número del texto: "3 Y ESTUDIO" → 3, "82.15MTRS" → 82.15 |
| `areaText` | MTRS / MTS / M2 → m² |
| `hasParking` | Falso si está vacío o empieza por "no", "0" o "ninguno" |
| `balcony`, `deposit`, `elevator` | "SI" → "Sí", "NO" → "No"; el resto en sentence case |
| `unavailable` | `estatus` distinto de "disponible" (etiqueta en la tarjeta) |
| `slug` | `{tipo}-{barrio}-{id_inmueble}`, p. ej. `casa-villas-de-granada-38` |
| `cover` | `/api/portada/{id}` si hay carpeta de fotos; si no, `sin-fotos.svg` |

### Fotos

La columna `fotos` guarda el enlace a una carpeta de Drive compartida como
"Cualquier persona con el enlace". `src/lib/drive.ts` lee la vista embebible de
la carpeta (sin API key), ignora subcarpetas y archivos que no son imagen, y
ordena por nombre. Cada foto se sirve desde `lh3.googleusercontent.com`, que
además convierte HEIC a JPEG. El listado se cachea 10 minutos en memoria.

Las tarjetas no leen Drive al renderizar: apuntan a `/api/portada/{id}`, que
responde con un 302 a la primera foto (`?w=` entre 120 y 1600, por defecto 720)
cuando el navegador la pide con `loading="lazy"`.

### Rutas

| Ruta | Comportamiento |
|---|---|
| `/` | Home con buscador completo (texto libre + paginación de 12) y mapa |
| `/propiedades` | Catálogo completo: filtros sin texto libre, sin paginar |
| `/propiedades/{slug}` | Ficha. Si el tipo o el barrio cambian, la URL vieja redirige (301); si la fila se borra, da 404 |
| `/api/portada/{id}` | 302 a la primera foto de la carpeta o al placeholder |

Si Supabase falla, las páginas del catálogo se renderizan igual con un mensaje
y un enlace a WhatsApp.

## Buscador

El buscador ("Busca tu inmueble ideal") funciona completo en el navegador, sin
IA ni APIs externas: el catálogo cabe entero en la página y filtrar en memoria
es instantáneo. La lógica está en `src/lib/search.ts` (funciones puras, sin
React) y la interfaz en `src/components/react/PropertySearch.tsx`.

### Controles

- **Bloques**: zona, habitaciones, baños y precio. Se aplican al instante.
- **Tipo de inmueble**: comparte fila con "Más filtros"; con el panel abierto
  baja debajo de él.
- **Más filtros**: estrato, área (m²), antigüedad y características. El botón
  muestra cuántos filtros del panel están activos.
- **Texto libre**: se interpreta al pulsar "Buscar" o Enter.
- **Etiquetas "También buscamos"**: lo que no se ve en los bloques (barrio,
  palabras clave y filtros del panel). Cada una se quita por separado.

Zonas, tipos, estratos, rango de precios y características salen de los datos:
lo que aparece en Supabase aparece en los filtros sin tocar el código.

### Modelo de filtros

```ts
interface SearchFilters {
  type; zones; bedrooms; bathrooms; minPrice; maxPrice;   // bloques visibles
  strata; minArea; maxArea; maxAge; features;             // panel "Más filtros"
  text: { neighborhoods; keywords };                      // solo desde el texto
}
```

| Export | Qué hace |
|---|---|
| `parseQuery(query, properties)` | Texto → `{ controls, text }`. `controls` solo trae lo que el texto menciona |
| `searchProperties(properties, filters)` | → `{ matches, similar }` |
| `describeExtraFilters(filters)` | Etiquetas removibles para barrio, palabras clave y panel |
| `FEATURES`, `FEATURE_KEYS`, `hasFeature` | Registro de características |
| `EMPTY_FILTERS`, `AGE_OPTIONS`, `ageLabel` | Estado inicial y chips de antigüedad |

Al aplicar el texto, `PropertySearch` ajusta el precio a los pasos del
deslizador y libera los controles que llenó la búsqueda anterior y que la nueva
no menciona (estado `fromText`).

### Intérprete de texto (`parseQuery`)

Cada regla aplica una regex y **borra del texto lo que interpreta**, para que
la siguiente no lo lea dos veces (el "3" de "3 baños" no se toma como precio).
El orden importa:

1. **Preparación**: minúsculas y sin tildes; sinónimos de tipo (apto, depa,
   loft, monoambiente…); "500M" con M mayúscula → millones; "4+" → "4 o más".
2. **Precio**: rangos ("entre 300 y 450 millones") y cifras sueltas ("400M",
   "350 palos", "$1.500.000.000", "mil millones"). "hasta", "máximo", "menos
   de" → tope; "desde", "más de" → mínimo; sin calificador → ± 15 %.
3. **Área** ("más de 90 m2"), **antigüedad** ("para estrenar", "menos de 10
   años"), **habitaciones**, **baños** y **estrato** ("estrato 3 o 4").
4. **Tipo**: el más largo primero ("apartamento duplex" antes que "apartamento").
5. **Zonas y barrios**: el nombre más largo primero, para que "Chico Norte" no
   se lea como la zona "Norte". Tolera errores de tipeo (1 error desde 7
   letras, 2 desde 10), pero nunca toma como error una palabra que ya existe en
   las fichas: "cocina" no se convierte en el barrio "Colina".
6. **Características**: vocabulario de `FEATURES`; "sin ascensor" no se exige.
   Va después de los barrios para no romper "Parques de Alameda".
7. **Palabras clave**: lo que sobra y aparece en alguna ficha. No filtran,
   solo suben en la lista las fichas que las mencionan.

### Exactos y parecidos

Cada filtro activo es un criterio con peso y un puntaje de 0 a 1 por inmueble.
**Exacto** = 1 en todos. Si hay menos de 4 exactos, se muestran hasta 6
**opciones parecidas** con al menos el 60 % del puntaje.

| Criterio | Peso | Parcial |
|---|---|---|
| Tipo, barrio, precio | 3 | Apartamento ↔ Duplex 0,5 · barrio de la misma zona 0,5 · 15 % fuera del rango 0,5 |
| Zona, habitaciones | 2 | Una habitación de diferencia 0,5 |
| Baños, estrato | 1,5 | Uno de diferencia 0,5 |
| Área, antigüedad, cada característica | 1 | Área como precio · hasta 5 años de más 0,5 |

Las constantes están al inicio de `search.ts`: `SIMILAR_WHEN_FEWER_THAN`,
`MAX_SIMILAR`, `MIN_SIMILARITY` y `ABOUT`.

### Características

Cada característica es una entrada de `FEATURES`:

```ts
pool: {
  label: 'Piscina',                      // botón del panel y etiqueta
  words: 'piscinas?',                    // cómo lo escribe quien busca
  has: (_, d) => /\bpiscina/.test(d),    // cómo se detecta en el inmueble
},
```

Parqueadero, ascensor, balcón y depósito se leen de sus columnas. Piscina,
gimnasio, BBQ, parque infantil, salón comunal, mascotas, portería, zonas
verdes, canchas, sauna, chimenea, coworking y estudio se detectan en
`informacion_adicional`: si la descripción no los menciona, no aparecen al
filtrar. Solo se muestran en el panel las que tiene al menos un inmueble.

### Cómo extenderlo

- **Nueva característica**: agregar una entrada a `FEATURES` y, si hay ícono,
  a `FEATURE_ICONS` en `PropertySearch.tsx`. El panel, el intérprete, el
  ranking y las etiquetas la toman solos.
- **Sinónimos**: tipos en `canonical()`, características en su `words`,
  palabras a ignorar en `STOPWORDS`.
- **Columna nueva del Sheet**: Sheet → Apps Script → tabla y vista →
  `PublicRow` → `mapRow` / `Property` → y, si se filtra, `SearchFilters`,
  `EMPTY_FILTERS`, `buildCriteria`, `describeExtraFilters` y el panel.

## Mapa con pines

El mapa muestra todas las propiedades a la vez, cada una con un pin amarillo
con su precio (`.map-pin` en `global.css`).

1. `src/lib/location.ts` limpia la columna `direccion` ("Cra. 54 # 126-35 TR 6"
   → "Carrera 54 # 126-35, Bogotá, Colombia"). Si es un enlace de Google Maps,
   extrae las coordenadas (siguiendo el enlace corto si hace falta). Sin
   dirección usa el barrio. Chía y Cajicá se buscan en su municipio.
2. `src/lib/geocode.ts` (servidor) convierte la dirección en coordenadas con la
   Geocoding API y las guarda en `propiedades_ubicacion`. Cada dirección se
   consulta una sola vez; si cambia, se vuelve a consultar.
3. `PropertyMap.tsx` (navegador) dibuja el mapa y los pines.

**Puesta en marcha**

1. Ejecutar `supabase/ubicaciones.sql` en el SQL Editor de Supabase.
2. En Google Cloud, con facturación activa, habilitar **Maps JavaScript API** y
   **Geocoding API** y crear dos claves:
   - Navegador: restringida por referente HTTP (`danielinmuebles.com/*`,
     `localhost:4321/*`) y solo a Maps JavaScript API.
   - Servidor: restringida solo a Geocoding API. No se publica.

Sin `SUPABASE_SECRET_KEY`, las coordenadas solo quedan en memoria y se vuelven a
pedir a Google al reiniciar el servidor. Sin las claves de Google, o si Google
rechaza la del navegador, el mapa vuelve al Google Maps embebido, que muestra
una propiedad a la vez.

## Configuración

| Variable | ¿Llega al navegador? | Uso |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Sí | URL del proyecto |
| `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Lectura de `propiedades_publicas` y `propiedades_ubicacion` |
| `SUPABASE_SECRET_KEY` | No | Guardar coordenadas (se salta RLS). Opcional |
| `PUBLIC_GOOGLE_MAPS_API_KEY` | Sí | Maps JavaScript API |
| `GOOGLE_MAPS_SERVER_KEY` | No | Geocoding API |

### Despliegue

`astro.config.mjs` elige el adaptador según dónde se compila:

- **Vercel** (define `VERCEL=1` al compilar): `@astrojs/vercel`. Las páginas
  corren como una función serverless (Node 22). Framework preset: Astro, sin
  cambiar el comando de build ni el directorio de salida.
- **Local o servidor propio**: `@astrojs/node` standalone.
  `npm run build` y `node dist/server/entry.mjs` (variables `PORT` y `HOST`).

En Vercel, las variables de la tabla de arriba se cargan en **Settings →
Environment Variables** para Production y Preview. Las `PUBLIC_*` se incrustan
al compilar, así que después de agregarlas o cambiarlas hay que volver a
desplegar. En serverless, las cachés en memoria (ver abajo) se pierden en cada
arranque en frío.

### Cachés

| Qué | Dónde | Duración |
|---|---|---|
| Listado de carpetas de Drive | Memoria del servidor | 10 min |
| Redirect de portada | Navegador / CDN | 600 s |
| Coordenadas | Tabla `propiedades_ubicacion` | Hasta que cambie la dirección |
| Geocoding y enlaces de Maps resueltos | Memoria del servidor | Mientras viva el proceso |
| Consulta del catálogo | Sin caché | Una por visita |

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

## Pendientes

1. **Versionar el Apps Script y el esquema.** El script de sincronización y el
   SQL de `propiedades` y `propiedades_publicas` no están en el repo.
2. **Pruebas del buscador.** `parseQuery` y `searchProperties` son funciones
   puras; una tabla de frases con su salida esperada (p. ej. con Vitest)
   evitaría regresiones al agregar reglas.
3. **Una consulta por portada.** `/api/portada/[id]` hace un `getPropertyById`
   por tarjeta para conocer la carpeta; pasar el ID de la carpeta en la URL
   ahorraría esas consultas.
4. **Comprimir las imágenes.** Los PNG exportados de Figma pesan entre 1,6 MB y
   5 MB cada uno. Conviene pasarlos a WebP/AVIF o moverlos a `src/assets/` para
   que Astro los optimice con `astro:assets`.
5. **Foto del equipo.** La sección "Detrás de cada operación" tiene un espacio
   reservado; en Figma todavía no hay imagen definitiva.
6. **Claves del mapa.** Crear las claves de Google en producción y correr el
   SQL (ver "Mapa con pines").
7. **Páginas legales.** El footer enlaza a `/politica-de-privacidad`,
   `/terminos-y-condiciones` y `/cookies`, que aún no existen.
8. **Dominio.** Ajustar `site` en `astro.config.mjs`; hoy apunta a
   `https://danielinmuebles.com`.

## Decisiones tomadas frente al diseño

### Buscador

- **Texto libre sin IA.** Un intérprete por reglas en lugar de un modelo o una
  API: gratis, instantáneo, predecible y sin límites de uso.
- **El texto mueve los filtros.** Lo que se entiende del texto se marca en los
  controles para que el usuario vea qué se interpretó y pueda corregirlo.
- **Opciones parecidas.** No están en Figma; se agregaron para no dejar al
  usuario en una pantalla vacía cuando nada cumple todos los filtros.
- **Panel "Más filtros".** No está en Figma; usa los estilos de los bloques de
  filtro existentes.

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
