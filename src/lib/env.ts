/**
 * Environment variable helper.
 *
 * In Cloudflare Pages/Workers runtime, secrets set in the dashboard are
 * available via `locals.runtime.env`. At build time (and in dev) they come
 * from `import.meta.env` (i.e. `.env` files / process env). This helper
 * checks the runtime first so server-rendered pages and API routes work in
 * both contexts.
 */
export function getEnv(locals: unknown, key: string): string | undefined {
  const runtimeEnv = (locals as { runtime?: { env?: Record<string, string | undefined> } } | null)?.runtime?.env;
  const fromRuntime = runtimeEnv?.[key];
  if (fromRuntime) return fromRuntime;
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[key];
  return fromMeta || undefined;
}
