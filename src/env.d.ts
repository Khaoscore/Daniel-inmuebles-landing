/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  /** Solo servidor: escribe en `propiedades_ubicacion`. */
  readonly SUPABASE_SECRET_KEY?: string;
  /** Navegador: mapa con pines. Restringida por dominio. */
  readonly PUBLIC_GOOGLE_MAPS_API_KEY?: string;
  /** Solo servidor: convierte direcciones en coordenadas (Geocoding API). */
  readonly GOOGLE_MAPS_SERVER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
