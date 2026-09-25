// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Vercel define VERCEL=1 al compilar: ahí las páginas corren como funciones
// serverless. En local o en un servidor propio se usa Node standalone
// (`node dist/server/entry.mjs`).
const adapter = process.env.VERCEL ? vercel() : node({ mode: 'standalone' });

// https://astro.build/config
export default defineConfig({
  site: 'https://danielinmuebles.com',
  // Las páginas se generan en cada visita: una propiedad que se agrega o se
  // elimina en Supabase aparece o desaparece sin volver a compilar el sitio.
  output: 'server',
  adapter,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
