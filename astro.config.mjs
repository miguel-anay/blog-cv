// @ts-check

import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/docs/guides/deploy/vercel/
export default defineConfig({
  site: 'https://blog.miguel-anay.nom.pe',

  output: 'server',
  adapter: vercel(),

  build: {
    inlineStylesheets: 'auto',
  },

  trailingSlash: 'ignore',

  integrations: [
    mdx(),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
    react()
  ],

  vite: {
    plugins: [tailwindcss()],
    cacheDir: "/home/k3n5h1n/.cache/vite-callous-1779996592106",
  },
});