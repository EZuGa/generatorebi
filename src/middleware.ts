import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySessionToken } from './lib/auth';
import { getEnv } from './lib/env';

/**
 * Protects /admin/* (except /admin/login) and the product mutation API.
 * Auth state = HMAC-signed httpOnly cookie, verified with Web Crypto.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isAdminPage = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isMutationApi = pathname.startsWith('/api/products');

  if (!isAdminPage && !isMutationApi) return next();

  const secret = getEnv(context.locals, 'AUTH_SECRET');
  const token = context.cookies.get(SESSION_COOKIE)?.value;

  const authed = Boolean(secret && token && (await verifySessionToken(token, secret)));

  if (!authed) {
    if (isMutationApi) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return context.redirect('/admin/login');
  }

  return next();
});
