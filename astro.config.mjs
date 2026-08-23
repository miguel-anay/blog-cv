// @ts-check

import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/docs/guides/deploy/vercel/
export default defineConfig({
  site: 'https://miguel-anay.nom.pe',

  output: 'server',
  adapter: vercel(),

  // Astro 5.14+ ignores X-Forwarded-Host from a reverse proxy unless the
  // host is explicitly allowlisted here — otherwise Astro.url (and the
  // origin used by the built-in CSRF checkOrigin middleware) falls back to
  // "localhost", so no real browser Origin header can ever match behind
  // Vercel. miguel-anay.nom.pe (apex) is the canonical domain; www redirects
  // to it at the Vercel domain level, so it's kept here only as a fallback
  // for requests that reach the app before that redirect applies.
  security: {
    allowedDomains: [
      { protocol: 'https', hostname: 'miguel-anay.nom.pe' },
      { protocol: 'https', hostname: 'www.miguel-anay.nom.pe' },
      { protocol: 'https', hostname: '*.vercel.app' },
    ],
  },

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
  },
});