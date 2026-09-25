// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://danielinmuebles.com',
  // Las páginas se generan en cada visita: una propiedad que se agrega o se
  // elimina en Supabase aparece o desaparece sin volver a compilar el sitio.
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
