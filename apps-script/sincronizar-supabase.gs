/**
 * Sincronización Google Sheet → Supabase del catálogo de Daniel Inmuebles.
 *
 * Copia la pestaña "INVENTARIO DANIEL INMUEBLES" a la tabla `propiedades`.
 * La web lee esa tabla en cada visita, así que queda igual al Sheet:
 *
 * - Cada edición de la pestaña sincroniza en segundos (`alEditar`).
 * - Insertar, borrar u ordenar filas también (`alCambiar`).
 * - Cada hora se sincroniza todo y se vuelven a listar las carpetas de fotos,
 *   para que `fotos_urls` incluya las fotos subidas después (`sincronizarTodo`).
 * - Las filas que ya no están en el Sheet se borran de Supabase.
 *
 * Cada fila se identifica por su "ID INMUEBLE" (columna A), que se guarda en
 * `id_hoja`. Cambiar el código, el precio o cualquier otra columna actualiza
 * el mismo inmueble, y su `id_inmueble` (el número de su URL en la web) no
 * cambia nunca.
 *
 * Instalación: ver "Sincronización Sheet → Supabase" en el README del sitio.
 * Requiere haber ejecutado antes `supabase/sincronizacion.sql`.
 */

/* -------------------------------------------------------------------------- */
/* Configuración                                                              */
/* -------------------------------------------------------------------------- */

const HOJA = 'INVENTARIO DANIEL INMUEBLES';
const TABLA = 'propiedades';

/** Ancho de las miniaturas guardadas en `fotos_urls`. */
const ANCHO_MINIATURA = 1000;

/** Cada cuántas horas se sincroniza todo, fotos incluidas. */
const HORAS_ENTRE_SINCRONIZACIONES = 1;

/**
 * Seguro contra borrados masivos: si una sincronización fuera a borrar más de
 * esta fracción de la tabla (p. ej. porque alguien vació la pestaña por error),
 * no borra nada y deja un error en el registro de ejecuciones.
 */
const MAX_FRACCION_BORRADO = 0.3;

/** Cuánto espera una sincronización a que termine otra que ya está corriendo. */
const ESPERA_CANDADO_MS = 2 * 60 * 1000;

/**
 * Columnas del Sheet (por el texto de su encabezado, sin importar tildes ni
 * mayúsculas) y su columna en Supabase. Se pueden mover de lugar en el Sheet;
 * si se renombra un encabezado hay que cambiarlo aquí.
 */
const COLUMNAS = [
  { encabezado: 'ID INMUEBLE', campo: 'id_hoja', tipo: 'entero' },
  { encabezado: 'ESTATUS', campo: 'estatus', tipo: 'minusculas' },
  { encabezado: 'CODIGO', campo: 'codigo', tipo: 'texto' },
  { encabezado: 'ZONA', campo: 'zona', tipo: 'texto' },
  { encabezado: 'BARRIO', campo: 'barrio', tipo: 'texto' },
  { encabezado: 'DIRECCION', campo: 'direccion', tipo: 'texto' },
  { encabezado: 'TIPO', campo: 'tipo', tipo: 'minusculas' },
  { encabezado: 'PRECIO', campo: 'precio', tipo: 'pesos' },
  { encabezado: 'HABITACIONES', campo: 'habitaciones', tipo: 'texto' },
  { encabezado: 'BAÑOS', campo: 'banos', tipo: 'decimal' },
  { encabezado: 'AREA', campo: 'area', tipo: 'texto' },
  { encabezado: 'ESTRATO', campo: 'estrato', tipo: 'entero' },
  { encabezado: 'ANTIGUEDAD', campo: 'antiguedad', tipo: 'texto' },
  { encabezado: 'BALCON/TERRAZA', campo: 'balcon_terraza', tipo: 'texto' },
  { encabezado: 'PARQUEADERO', campo: 'parqueadero', tipo: 'texto' },
  { encabezado: 'DEPOSITO', campo: 'deposito', tipo: 'texto' },
  { encabezado: 'ASCENSOR', campo: 'ascensor', tipo: 'texto' },
  { encabezado: 'ADMINISTRACION', campo: 'administracion', tipo: 'pesos' },
  { encabezado: 'PISO', campo: 'piso', tipo: 'texto' },
  { encabezado: 'INFORMACION ADICIONAL', campo: 'informacion_adicional', tipo: 'texto' },
  { encabezado: 'FICHA INMUEBLE', campo: 'ficha_inmueble', tipo: 'texto' },
  { encabezado: 'LINK INSTAGRAM', campo: 'link_instagram', tipo: 'enlace' },
  // Chip de la carpeta de Drive con las fotos que muestra la web.
  { encabezado: 'FOTOS', campo: 'fotos', tipo: 'enlace' },
  { encabezado: 'LINK AGENTE', campo: 'link_agente', tipo: 'enlace' },
  { encabezado: 'CAPTADOR', campo: 'captador', tipo: 'casilla' },
  { encabezado: 'DOCUMENTOS', campo: 'documentos', tipo: 'casilla' },
];

/* -------------------------------------------------------------------------- */
/* Activadores                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ejecutar UNA vez a mano después de pegar el script. Instala los activadores
 * y hace la primera sincronización. Se puede volver a ejecutar sin duplicarlos.
 *
 * Elimina también los activadores que apuntan a funciones que ya no existen
 * (los del script de sincronización anterior).
 */
function configurar() {
  // Falla aquí si faltan las propiedades del script o la columna `id_hoja`.
  supabase_('get', TABLA + '?select=id_hoja&limit=1');

  const propios = ['alEditar', 'alCambiar', 'sincronizarTodo'];
  ScriptApp.getProjectTriggers().forEach((activador) => {
    const funcion = activador.getHandlerFunction();
    if (propios.indexOf(funcion) !== -1 || typeof globalThis[funcion] !== 'function') {
      console.log('Se elimina el activador de ' + funcion);
      ScriptApp.deleteTrigger(activador);
    }
  });

  const libro = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('alEditar').forSpreadsheet(libro).onEdit().create();
  ScriptApp.newTrigger('alCambiar').forSpreadsheet(libro).onChange().create();
  ScriptApp.newTrigger('sincronizarTodo').timeBased().everyHours(HORAS_ENTRE_SINCRONIZACIONES).create();

  sincronizarTodo();
}

/** Menú "Web" en el Sheet para sincronizar a mano. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Web').addItem('Sincronizar ahora', 'sincronizarTodo').addToUi();
}

/** Activador instalable "Al editar". */
function alEditar(e) {
  if (e && e.range && e.range.getSheet().getName() !== HOJA) return;
  sincronizar_(false);
}

/** Activador instalable "Al cambiar": filas insertadas, borradas u ordenadas. */
function alCambiar(e) {
  const tipo = e && e.changeType;
  if (['INSERT_ROW', 'REMOVE_ROW', 'OTHER'].indexOf(tipo) === -1) return;
  sincronizar_(false);
}

/** Sincronización completa, incluidas las fotos de cada carpeta. */
function sincronizarTodo() {
  sincronizar_(true);
}

/* -------------------------------------------------------------------------- */
/* Sincronización                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Lee la pestaña completa y deja Supabase igual. Solo escribe las filas que
 * cambiaron. `refrescarFotos` vuelve a listar todas las carpetas de Drive; si
 * es false, solo las de inmuebles nuevos o cuya carpeta cambió.
 */
function sincronizar_(refrescarFotos) {
  const candado = LockService.getScriptLock();
  if (!candado.tryLock(ESPERA_CANDADO_MS)) {
    console.warn('Otra sincronización sigue en curso; la siguiente edición o la sincronización horaria se pondrán al día.');
    return;
  }

  try {
    const filas = leerHoja_();
    const existentes = supabase_('get', TABLA + '?select=*');
    const propiedades = PropertiesService.getScriptProperties();

    const plan = planificar_(filas, existentes, {
      refrescarFotos: refrescarFotos,
      listarFotos: miniaturas_,
      nuevoUuid: () => Utilities.getUuid(),
      ultimoId: Number(propiedades.getProperty('ULTIMO_ID_INMUEBLE')) || 0,
    });

    plan.avisos.forEach((aviso) => console.warn(aviso));

    if (plan.guardar.length) {
      supabase_('post', TABLA + '?on_conflict=id', plan.guardar, 'resolution=merge-duplicates,return=minimal');
    }
    propiedades.setProperty('ULTIMO_ID_INMUEBLE', String(plan.ultimoId));

    if (plan.borrar.length) {
      const ids = plan.borrar.map((registro) => registro.id).join(',');
      supabase_('delete', TABLA + '?id=in.(' + ids + ')', undefined, 'return=minimal');
    }

    console.log(
      'Sincronización: ' + plan.nuevos + ' nuevos, ' + (plan.guardar.length - plan.nuevos) +
        ' actualizados, ' + plan.borrar.length + ' borrados (' + filas.length + ' filas en el Sheet).' +
        (plan.borrar.length ? ' Borrados: ' + plan.borrar.map((r) => r.codigo).join(' · ') : ''),
    );

    if (plan.borradoBloqueado) throw new Error(plan.borradoBloqueado);
  } finally {
    candado.releaseLock();
  }
}

/**
 * Decide qué guardar y qué borrar. No escribe nada.
 *
 * - `filas`: lo que devuelve `leerHoja_`.
 * - `existentes`: filas actuales de la tabla.
 * - `opciones.listarFotos(url)`: miniaturas de una carpeta, o null si falló.
 */
function planificar_(filas, existentes, opciones) {
  const avisos = [];

  // 1. Un ID repetido en el Sheet: se usa la primera fila.
  const primeraFila = {};
  filas = filas.filter((f) => {
    const id = f.registro.id_hoja;
    if (primeraFila[id]) {
      avisos.push('El ID ' + id + ' está en las filas ' + primeraFila[id] + ' y ' + f.fila + ': se usa la fila ' + primeraFila[id] + '.');
      return false;
    }
    primeraFila[id] = f.fila;
    return true;
  });

  // 2. Emparejar cada fila del Sheet con su registro de Supabase.
  const porIdHoja = {};
  const sinIdHoja = [];
  existentes.forEach((e) => {
    if (e.id_hoja === null || e.id_hoja === undefined) sinIdHoja.push(e);
    else porIdHoja[e.id_hoja] = e;
  });

  const pareja = new Map();
  filas.forEach((f) => {
    if (porIdHoja[f.registro.id_hoja]) pareja.set(f, porIdHoja[f.registro.id_hoja]);
  });

  // Registros de antes de `id_hoja`: por código y, si no, por carpeta de Drive
  // (cubre los que cambiaron de código, p. ej. "470 SAN JOSE" → "495 SAN JOSE").
  enlazar_(filas, sinIdHoja, pareja, (r) => [normalizar_(r.codigo)]);
  enlazar_(filas, sinIdHoja, pareja, (r) => [idCarpeta_(r.fotos), idCarpeta_(r.link_agente)]);

  // 3. Registro completo de cada fila.
  let ultimoId = existentes.reduce((max, e) => Math.max(max, Number(e.id_inmueble) || 0), opciones.ultimoId);
  let nuevos = 0;

  const guardar = [];
  filas.forEach((f) => {
    const previo = pareja.get(f);
    const registro = Object.assign({}, f.registro);

    registro.id = previo ? previo.id : opciones.nuevoUuid();
    registro.id_inmueble = previo ? previo.id_inmueble : ++ultimoId;

    // Celdas con texto o chip pero sin enlace legible: se conserva el anterior.
    f.sinEnlace.forEach((columna) => {
      registro[columna.campo] = previo ? previo[columna.campo] : null;
      avisos.push(
        'Fila ' + f.fila + ' (' + registro.codigo + '): no se pudo leer el enlace de "' + columna.encabezado + '"' +
          (previo ? '; se deja el que ya estaba.' : '.'),
      );
    });

    let fotos = null;
    if (!registro.fotos) {
      fotos = [];
    } else if (
      opciones.refrescarFotos ||
      !previo ||
      idCarpeta_(previo.fotos) !== idCarpeta_(registro.fotos) ||
      !Array.isArray(previo.fotos_urls)
    ) {
      fotos = opciones.listarFotos(registro.fotos);
    }
    if (fotos === null) fotos = previo && Array.isArray(previo.fotos_urls) ? previo.fotos_urls : [];
    registro.fotos_urls = fotos;

    if (!previo) {
      nuevos++;
      guardar.push(registro);
    } else if (cambio_(registro, previo)) {
      guardar.push(registro);
    }
  });

  // 4. Lo que ya no está en el Sheet.
  const enHoja = new Set(pareja.values());
  let borrar = existentes.filter((e) => !enHoja.has(e));
  let borradoBloqueado = null;
  const limite = Math.max(3, Math.floor(existentes.length * MAX_FRACCION_BORRADO));
  if (borrar.length > limite) {
    borradoBloqueado =
      'No se borró nada: la sincronización iba a borrar ' + borrar.length + ' de ' + existentes.length +
      ' inmuebles (límite ' + limite + '). Si es correcto, sube MAX_FRACCION_BORRADO y ejecuta sincronizarTodo.';
    borrar = [];
  }

  return { guardar: guardar, borrar: borrar, nuevos: nuevos, ultimoId: ultimoId, avisos: avisos, borradoBloqueado: borradoBloqueado };
}

/**
 * Enlaza filas del Sheet sin pareja con registros sin `id_hoja` que comparten
 * alguna clave. Solo si la coincidencia es única en los dos sentidos.
 */
function enlazar_(filas, sinIdHoja, pareja, claves) {
  const usados = new Set(pareja.values());
  const libres = sinIdHoja.filter((e) => !usados.has(e));
  const sueltas = filas.filter((f) => !pareja.has(f));
  const comparten = (a, b) => a.some((clave) => clave && b.indexOf(clave) !== -1);

  sueltas.forEach((f) => {
    const clavesFila = claves(f.registro);
    const opciones = libres.filter((e) => comparten(clavesFila, claves(e)));
    if (opciones.length !== 1) return;
    const rivales = sueltas.filter((otra) => comparten(claves(opciones[0]), claves(otra.registro)));
    if (rivales.length !== 1) return;
    pareja.set(f, opciones[0]);
    libres.splice(libres.indexOf(opciones[0]), 1);
  });
}

/** true si algún campo del registro difiere de lo guardado. */
function cambio_(registro, previo) {
  return Object.keys(registro).some((campo) => {
    const nuevo = registro[campo] === undefined ? null : registro[campo];
    const actual = previo[campo] === undefined ? null : previo[campo];
    return JSON.stringify(nuevo) !== JSON.stringify(actual);
  });
}

/* -------------------------------------------------------------------------- */
/* Lectura del Sheet                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Filas con ID INMUEBLE y CODIGO, ya convertidas a columnas de Supabase:
 * `{ fila, registro, sinEnlace }`. `sinEnlace` lista las columnas de enlace
 * con contenido del que no se pudo sacar una URL.
 */
function leerHoja_() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(HOJA);
  if (!hoja) throw new Error('No existe la pestaña "' + HOJA + '".');

  const rango = hoja.getDataRange();
  const valores = rango.getValues();
  const visibles = rango.getDisplayValues();
  const enriquecidos = rango.getRichTextValues();

  const filaEncabezado = valores.findIndex((fila) => normalizar_(fila[0]) === 'ID INMUEBLE');
  if (filaEncabezado === -1) throw new Error('No se encontró el encabezado "ID INMUEBLE" en la columna A.');

  const encabezados = valores[filaEncabezado].map(normalizar_);
  const columnas = COLUMNAS.map((columna) => {
    const indice = encabezados.indexOf(normalizar_(columna.encabezado));
    if (indice === -1) throw new Error('Falta la columna "' + columna.encabezado + '" en el Sheet.');
    return Object.assign({ indice: indice }, columna);
  });

  const filas = [];
  for (let i = filaEncabezado + 1; i < valores.length; i++) {
    const registro = {};
    const sinEnlace = [];

    columnas.forEach((c) => {
      if (c.tipo !== 'enlace') {
        registro[c.campo] = CONVERTIR[c.tipo](valores[i][c.indice]);
        return;
      }
      const texto = texto_(visibles[i][c.indice]);
      const url = enlace_(texto, enriquecidos[i][c.indice]);
      registro[c.campo] = url;
      if (!url && texto) sinEnlace.push(c);
    });

    if (registro.id_hoja === null || registro.codigo === null) {
      if (registro.codigo !== null) {
        console.warn('Fila ' + (i + 1) + ' (' + registro.codigo + '): no tiene ID INMUEBLE, no se publica.');
      }
      continue;
    }
    filas.push({ fila: i + 1, registro: registro, sinEnlace: sinEnlace });
  }

  completarChips_(hoja, filas);
  return filas;
}

/** URL de una celda: el texto si ya es un enlace; si no, el enlace del chip o hipervínculo. */
function enlace_(texto, enriquecido) {
  if (texto && /^https?:\/\//i.test(texto)) return texto;
  if (!enriquecido) return null;
  if (enriquecido.getLinkUrl()) return enriquecido.getLinkUrl();
  const tramo = enriquecido.getRuns().find((run) => run.getLinkUrl());
  return tramo ? tramo.getLinkUrl() : null;
}

/**
 * Plan B para los chips de Drive cuyo enlace no devuelve `getRichTextValues`:
 * los lee con el servicio avanzado "Google Sheets API" (Servicios → +), si
 * está activado.
 */
function completarChips_(hoja, filas) {
  const pendientes = filas.filter((f) => f.sinEnlace.length);
  if (!pendientes.length || typeof Sheets === 'undefined') return;

  const columnas = [];
  pendientes.forEach((f) => f.sinEnlace.forEach((c) => columnas.indexOf(c) === -1 && columnas.push(c)));

  columnas.forEach((columna) => {
    const urls = enlacesDeChips_(hoja, columna.indice + 1);
    pendientes.forEach((f) => {
      const posicion = f.sinEnlace.indexOf(columna);
      if (posicion !== -1 && urls[f.fila]) {
        f.registro[columna.campo] = urls[f.fila];
        f.sinEnlace.splice(posicion, 1);
      }
    });
  });
}

/** { numeroDeFila: url } de los chips e hipervínculos de una columna. */
function enlacesDeChips_(hoja, columna) {
  const a1 = hoja.getRange(1, columna, hoja.getLastRow(), 1).getA1Notation();
  try {
    const respuesta = Sheets.Spreadsheets.get(hoja.getParent().getId(), {
      ranges: "'" + hoja.getName().replace(/'/g, "''") + "'!" + a1,
      fields: 'sheets.data.rowData.values(hyperlink,chipRuns)',
    });
    const urls = {};
    (respuesta.sheets[0].data[0].rowData || []).forEach((fila, i) => {
      const celda = (fila.values || [])[0] || {};
      const chip = (celda.chipRuns || [])
        .map((run) => run.chip && run.chip.richLinkProperties && run.chip.richLinkProperties.uri)
        .find(Boolean);
      if (chip || celda.hyperlink) urls[i + 1] = chip || celda.hyperlink;
    });
    return urls;
  } catch (error) {
    console.warn('No se pudieron leer los chips con la API de Sheets: ' + error);
    return {};
  }
}

/* -------------------------------------------------------------------------- */
/* Conversión de valores                                                      */
/* -------------------------------------------------------------------------- */

const CONVERTIR = {
  texto: texto_,
  minusculas: (valor) => {
    const texto = texto_(valor);
    return texto && texto.toLowerCase();
  },
  pesos: pesos_,
  decimal: decimal_,
  entero: entero_,
  casilla: (valor) => valor === true || /^(true|verdadero|si|sí)$/i.test(String(valor).trim()),
};

/** Texto sin espacios sobrantes; vacío → null. Los números pasan a texto ("99.6"). */
function texto_(valor) {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/** "$265.000.000" → 265000000, "2.890.000,00" → 2890000, "-" o "NO APLICA" → null. */
function pesos_(valor) {
  if (typeof valor === 'number') return valor;
  const limpio = String(valor === null || valor === undefined ? '' : valor).replace(/[^\d.,]/g, '');
  if (!/\d/.test(limpio)) return null;
  // Formato colombiano: punto de miles y coma decimal.
  const numero = Number(limpio.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}

/** "2,5" → 2.5, "3" → 3, "2 MAS 1/2" → null. */
function decimal_(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  return /^\d+(?:[.,]\d+)?$/.test(texto) ? Number(texto.replace(',', '.')) : null;
}

/** "3" → 3, "4/5" o "-" → null. */
function entero_(valor) {
  if (typeof valor === 'number') return Number.isInteger(valor) ? valor : null;
  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  return /^\d+$/.test(texto) ? Number(texto) : null;
}

/** Mayúsculas, sin tildes y con un solo espacio: para comparar encabezados y códigos. */
function normalizar_(valor) {
  return String(valor === null || valor === undefined ? '' : valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* Google Drive                                                               */
/* -------------------------------------------------------------------------- */

/** ID de un enlace de carpeta de Drive (mismo criterio que `src/lib/drive.ts`). */
function idCarpeta_(url) {
  if (!url) return null;
  const coincidencia = String(url).match(/\/folders\/([A-Za-z0-9_-]+)/) || String(url).match(/[?&]id=([A-Za-z0-9_-]+)/);
  return coincidencia ? coincidencia[1] : null;
}

/** Miniaturas de las imágenes de una carpeta, por nombre. null si no se pudo leer. */
function miniaturas_(urlCarpeta) {
  const id = idCarpeta_(urlCarpeta);
  if (!id) return [];
  try {
    const imagenes = [];
    const archivos = DriveApp.getFolderById(id).getFiles();
    while (archivos.hasNext()) {
      const archivo = archivos.next();
      if (archivo.getMimeType().indexOf('image/') === 0) {
        imagenes.push({ id: archivo.getId(), nombre: archivo.getName() });
      }
    }
    imagenes.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }));
    return imagenes.map((imagen) => 'https://drive.google.com/thumbnail?id=' + imagen.id + '&sz=w' + ANCHO_MINIATURA);
  } catch (error) {
    console.warn('No se pudo leer la carpeta de fotos ' + id + ': ' + error);
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Supabase                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Llamada a la API REST de Supabase con la clave secreta, guardada en
 * Configuración del proyecto → Propiedades del script:
 * SUPABASE_URL y SUPABASE_SECRET_KEY.
 */
function supabase_(metodo, ruta, cuerpo, prefer) {
  const propiedades = PropertiesService.getScriptProperties();
  const url = propiedades.getProperty('SUPABASE_URL');
  const clave = propiedades.getProperty('SUPABASE_SECRET_KEY');
  if (!url || !clave) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SECRET_KEY en las propiedades del script.');
  }

  const cabeceras = { apikey: clave.trim(), Authorization: 'Bearer ' + clave.trim() };
  if (prefer) cabeceras.Prefer = prefer;

  const peticion = { method: metodo, headers: cabeceras, muteHttpExceptions: true };
  if (cuerpo !== undefined) {
    peticion.contentType = 'application/json';
    peticion.payload = JSON.stringify(cuerpo);
  }

  const respuesta = UrlFetchApp.fetch(url.trim().replace(/\/+$/, '') + '/rest/v1/' + ruta, peticion);

  const codigo = respuesta.getResponseCode();
  const texto = respuesta.getContentText();
  if (codigo >= 300) {
    throw new Error('Supabase respondió ' + codigo + ' a ' + metodo.toUpperCase() + ' ' + ruta.split('?')[0] + ': ' + texto);
  }
  return texto ? JSON.parse(texto) : null;
}
