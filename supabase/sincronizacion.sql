-- Enlace entre cada fila de `propiedades` y su fila del Google Sheet.
--
-- `id_hoja` guarda el "ID INMUEBLE" de la columna A del Sheet. El Apps Script
-- (`apps-script/sincronizar-supabase.gs`) lo usa para saber qué fila de la
-- tabla corresponde a cada fila de la hoja, aunque cambie el código, el precio
-- o cualquier otra columna. `id_inmueble` (el número de la URL en la web) no
-- cambia nunca.
--
-- Las filas que ya existen quedan con `id_hoja` vacío: el script las enlaza
-- solo la primera vez que corre (por código y, si no, por carpeta de Drive).
--
-- Ejecutar una vez en Supabase: SQL Editor > New query > pegar > Run.
-- Hacerlo ANTES de instalar el script.

alter table public.propiedades
  add column if not exists id_hoja integer;

-- Un inmueble del Sheet = una fila de la tabla. Permite varios NULL.
create unique index if not exists propiedades_id_hoja_key
  on public.propiedades (id_hoja);
