// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL || 'https://generatori.com.ge',
  output: 'static',
  adapter: cloudflare(),
  integrations: [
    sitemap({
      // Admin area is noindex and disallowed in robots.txt — keep it out of the sitemap.
      filter: (page) => !page.includes('/admin'),
      // ka at root (default), ru under /ru — emits xhtml-link hreflang alternates.
      i18n: {
        defaultLocale: 'ka',
        locales: {
          ka: 'ka-GE',
          ru: 'ru-RU',
        },
      },
    }),
  ],
});
