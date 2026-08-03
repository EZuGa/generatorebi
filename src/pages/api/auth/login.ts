import type { APIRoute } from 'astro';
import { SESSION_COOKIE, checkPassword, createSessionToken, sessionCookieOptions } from '../../../lib/auth';
import { getEnv } from '../../../lib/env';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect, locals }) => {
  const password = getEnv(locals, 'ADMIN_PASSWORD');
  const secret = getEnv(locals, 'AUTH_SECRET');

  if (!password || !secret) {
    return redirect('/admin/login?error=1', 303);
  }

  const form = await request.formData();
  const submitted = String(form.get('password') ?? '');

  if (!checkPassword(submitted, password)) {
    return redirect('/admin/login?error=1', 303);
  }

  const token = await createSessionToken(secret);
  cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

  return redirect('/admin', 303);
};
