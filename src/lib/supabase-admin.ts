/**
 * Server-side Supabase PostgREST writes (admin CRUD) using the service role key.
 * Plain fetch — no supabase-js dependency.
 */

import { slugify } from './slug';
import { translateKaToRu, translateSpecs } from './translate';

export interface ProductPayload {
  slug: string;
  name: string;
  category: string;
  short_desc: string;
  description: string;
  image: string;
  specs: { label: string; value: string }[];
  featured: boolean;
  /** Russian translations — optional, empty string means "fall back to Georgian". */
  name_ru: string;
  short_desc_ru: string;
  description_ru: string;
  specs_ru: { label: string; value: string }[];
}

function adminHeaders(serviceKey: string): Record<string, string> {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

/**
 * Returns `slug` when it is free in the given table, otherwise the first
 * available `slug-2`, `slug-3`, … variant. Handles any number of collisions.
 * `excludeId` lets an update keep its own current slug.
 * Falls back to the plain slug when the check query fails — the database's
 * unique constraint remains the final guard (also against concurrent writes).
 */
export async function resolveUniqueSlug(
  url: string,
  serviceKey: string,
  table: 'products' | 'posts',
  slug: string,
  excludeId?: string
): Promise<string> {
  let query = `select=slug&or=(slug.eq.${slug},slug.like.${slug}-*)`;
  if (excludeId) query += `&id=neq.${encodeURIComponent(excludeId)}`;

  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return slug;

  const rows = (await res.json()) as { slug: string }[];
  const taken = new Set(rows.map((r) => r.slug));

  let candidate = slug;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${slug}-${n}`;
    n++;
  }
  return candidate;
}

export async function createProduct(
  url: string,
  serviceKey: string,
  payload: ProductPayload
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${url}/rest/v1/products`, {
    method: 'POST',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ ...payload, created_at: new Date().toISOString() }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
}

export async function updateProduct(
  url: string,
  serviceKey: string,
  id: string,
  payload: ProductPayload
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify(payload),
  });
  return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
}

export async function deleteProduct(
  url: string,
  serviceKey: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(serviceKey),
  });
  return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
}

/**
 * Fire-and-forget POST to a Cloudflare Pages deploy hook so static pages
 * regenerate after a mutation. Never awaited by the caller.
 */
export async function triggerDeployHook(deployHookUrl: string): Promise<void> {
  try {
    await fetch(deployHookUrl, { method: 'POST' });
  } catch (err) {
    console.warn('[deploy-hook] trigger failed', err);
  }
}

/* ---------- product image upload (Supabase Storage) ---------- */

export const IMAGE_BUCKET = 'product-images';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** Georgian error messages keyed by the `?error=` code sent back to the form. */
export const IMAGE_ERROR_MESSAGES: Record<string, string> = {
  'image-type': 'დაუშვებელი ფაილის ფორმატი — მხოლოდ JPEG, PNG, WebP ან AVIF.',
  'image-size': 'სურათი ძალიან დიდია — მაქსიმუმ 5 MB.',
  'image-upload': 'სურათის ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.',
};

/** Extracts the uploaded file from the multipart form, or null when absent/empty. */
export function getImageFile(form: FormData): File | null {
  const value = form.get('image_file');
  if (!value || typeof value === 'string') return null;
  const file = value as File;
  return file.size > 0 ? file : null;
}

/** Returns an error code when the file is not an allowed image, else null. */
export function validateImageFile(file: File): 'image-type' | 'image-size' | null {
  if (!IMAGE_EXT_BY_TYPE[file.type]) return 'image-type';
  if (file.size > MAX_IMAGE_BYTES) return 'image-size';
  return null;
}

/**
 * Uploads an image to the public `product-images` bucket via the Storage REST
 * API and returns its public URL. Workers-compatible (fetch + ArrayBuffer only).
 */
export async function uploadProductImage(
  url: string,
  serviceKey: string,
  file: File,
  slugHint: string
): Promise<{ ok: true; publicUrl: string } | { ok: false; error: string }> {
  const ext = IMAGE_EXT_BY_TYPE[file.type];
  const base =
    slugHint
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/^-+|-+$/g, '') || crypto.randomUUID();
  const filename = `${base}-${Date.now()}.${ext}`;

  const res = await fetch(`${url}/storage/v1/object/${IMAGE_BUCKET}/${filename}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': file.type,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-upsert': 'true',
    },
    body: await file.arrayBuffer(),
  });

  if (!res.ok) {
    return { ok: false, error: `${res.status}: ${await res.text()}` };
  }
  return {
    ok: true,
    publicUrl: `${url}/storage/v1/object/public/${IMAGE_BUCKET}/${filename}`,
  };
}

/** Parses the admin form's specs textarea ("label | value" per line). */
export function parseSpecs(text: string): { label: string; value: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split('|');
      return { label: (label ?? '').trim(), value: rest.join('|').trim() };
    })
    .filter((s) => s.label && s.value);
}

/** Serializes specs back into the textarea format for the edit form. */
export function specsToText(specs: { label: string; value: string }[]): string {
  return specs.map((s) => `${s.label} | ${s.value}`).join('\n');
}

export function formToPayload(form: FormData): ProductPayload {
  const name = String(form.get('name') ?? '').trim();
  // No manual slug field: edits keep the existing slug (stable URLs),
  // new products get one transliterated from the name.
  const slug = String(form.get('current_slug') ?? '').trim() || slugify(name);
  return {
    slug,
    name,
    category: String(form.get('category') ?? 'generators'),
    short_desc: String(form.get('short_desc') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    // No manual URL field anymore — keep the existing image unless a file was uploaded.
    image:
      String(form.get('current_image') ?? '').trim() || '/images/products/generator.svg',
    specs: parseSpecs(String(form.get('specs') ?? '')),
    featured: form.get('featured') === 'on',
    // Filled by translateProductPayload() — the forms no longer carry ru inputs.
    name_ru: '',
    short_desc_ru: '',
    description_ru: '',
    specs_ru: [],
  };
}

/**
 * Machine-translates the Georgian fields of a product payload into Russian
 * (MyMemory, Google fallback). Runs once per save, on შენახვა — never live.
 */
export async function translateProductPayload(
  payload: ProductPayload,
  email?: string
): Promise<void> {
  [payload.name_ru, payload.short_desc_ru, payload.description_ru, payload.specs_ru] =
    await Promise.all([
      translateKaToRu(payload.name, email),
      translateKaToRu(payload.short_desc, email),
      translateKaToRu(payload.description, email),
      translateSpecs(payload.specs, email),
    ]);
}

/* ---------- blog post CRUD (admin) ---------- */

export interface PostPayload {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  published: boolean;
  /** Russian translations — optional, empty string means "fall back to Georgian". */
  title_ru: string;
  excerpt_ru: string;
  content_ru: string;
}

export async function createPost(
  url: string,
  serviceKey: string,
  payload: PostPayload
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${url}/rest/v1/posts`, {
    method: 'POST',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify({ ...payload, created_at: new Date().toISOString() }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
}

export async function updatePost(
  url: string,
  serviceKey: string,
  id: string,
  payload: PostPayload
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${url}/rest/v1/posts?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminHeaders(serviceKey),
    body: JSON.stringify(payload),
  });
  return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
}

export async function deletePost(
  url: string,
  serviceKey: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${url}/rest/v1/posts?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminHeaders(serviceKey),
  });
  return res.ok ? { ok: true } : { ok: false, error: `${res.status}: ${await res.text()}` };
}

export function formToPostPayload(form: FormData): PostPayload {
  const title = String(form.get('title') ?? '').trim();
  // No manual slug field: edits keep the existing slug (stable URLs),
  // new posts get one transliterated from the title.
  const slug = String(form.get('current_slug') ?? '').trim() || slugify(title);
  return {
    slug,
    title,
    excerpt: String(form.get('excerpt') ?? '').trim(),
    content: String(form.get('content') ?? '').trim(),
    // No manual URL field anymore — keep the existing image unless a file was uploaded.
    image: String(form.get('current_image') ?? '').trim(),
    published: form.get('published') === 'on',
    // Filled by translatePostPayload() — the forms no longer carry ru inputs.
    title_ru: '',
    excerpt_ru: '',
    content_ru: '',
  };
}

/**
 * Machine-translates the Georgian fields of a post payload into Russian
 * (MyMemory, Google fallback). Runs once per save, on შენახვა — never live.
 */
export async function translatePostPayload(
  payload: PostPayload,
  email?: string
): Promise<void> {
  [payload.title_ru, payload.excerpt_ru, payload.content_ru] = await Promise.all([
    translateKaToRu(payload.title, email),
    translateKaToRu(payload.excerpt, email),
    translateKaToRu(payload.content, email),
  ]);
}
