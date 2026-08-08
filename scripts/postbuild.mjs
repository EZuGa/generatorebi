// Astro only emits a bare `404.html` for the root /404 route (build.format
// "directory" special-cases STATUS_CODE_PAGES = /404, /500). The Russian 404
// page builds to dist/ru/404/index.html; mirror it to dist/ru/404.html so the
// /ru tree has the same shape as the ka root.
import { copyFileSync, existsSync } from 'node:fs';

const src = new URL('../dist/ru/404/index.html', import.meta.url);
const dest = new URL('../dist/ru/404.html', import.meta.url);

if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log('[postbuild] dist/ru/404.html written');
} else {
  console.warn('[postbuild] dist/ru/404/index.html not found — skipping 404.html copy');
}
