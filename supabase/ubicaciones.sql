-- Coordenadas de cada propiedad para los pines del mapa.
--
-- Se guardan en una tabla aparte para no tocar `propiedades` ni la vista
-- `propiedades_publicas`. El servidor del sitio la llena solo: la primera vez
-- que ve una propiedad convierte su dirección en coordenadas con Google y las
-- guarda aquí. Si la dirección cambia (`consulta` distinta), las recalcula.
--
-- Ejecutar una vez en Supabase: SQL Editor > New query > pegar > Run.

create table if not exists public.propiedades_ubicacion (
  id_inmueble integer primary key,
  -- Texto que se le pasó a Google ("Carrera 71D # 12D-64, Bogotá, Colombia").
  consulta text not null,
  lat double precision not null,
  lng double precision not null,
  actualizado timestamptz not null default now()
);

alter table public.propiedades_ubicacion enable row level security;

-- Lectura pública (son las mismas coordenadas que se ven en el mapa).
-- Solo escribe la clave secreta del servidor, que se salta RLS.
drop policy if exists "Lectura publica" on public.propiedades_ubicacion;
create policy "Lectura publica"
  on public.propiedades_ubicacion
  for select
  to anon, authenticated
  using (true);
