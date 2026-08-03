/**
 * Minimal HMAC-signed session cookie auth, built on the Web Crypto API
 * (crypto.subtle) so it runs in the Cloudflare Workers runtime as well as
 * Node dev. No node:crypto.
 */

export const SESSION_COOKIE = 'admin_session';

const SESSION_PAYLOAD = 'admin-v1';
const encoder = new TextEncoder();

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Token written into the session cookie after a successful login. */
export async function createSessionToken(secret: string): Promise<string> {
  return hmacHex(secret, SESSION_PAYLOAD);
}

/** Constant-time-ish verification of a cookie token. */
export async function verifySessionToken(token: string, secret: string): Promise<boolean> {
  const expected = await createSessionToken(secret);
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Compare a submitted password with ADMIN_PASSWORD without early exit. */
export function checkPassword(submitted: string, actual: string): boolean {
  const a = encoder.encode(submitted);
  const b = encoder.encode(actual);
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export function sessionCookieOptions(): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
} {
  return {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
