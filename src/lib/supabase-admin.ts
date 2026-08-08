/**
 * Server-side Supabase PostgREST writes (admin CRUD) using the service role key.
 * Plain fetch — no supabase-js dependency.
 */

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
  return {
    slug: String(form.get('slug') ?? '').trim(),
    name: String(form.get('name') ?? '').trim(),
    category: String(form.get('category') ?? 'generators'),
    short_desc: String(form.get('short_desc') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    image: String(form.get('image') ?? '/images/products/generator.svg').trim(),
    specs: parseSpecs(String(form.get('specs') ?? '')),
    featured: form.get('featured') === 'on',
    name_ru: String(form.get('name_ru') ?? '').trim(),
    short_desc_ru: String(form.get('short_desc_ru') ?? '').trim(),
    description_ru: String(form.get('description_ru') ?? '').trim(),
    specs_ru: parseSpecs(String(form.get('specs_ru') ?? '')),
  };
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
  return {
    slug: String(form.get('slug') ?? '').trim(),
    title: String(form.get('title') ?? '').trim(),
    excerpt: String(form.get('excerpt') ?? '').trim(),
    content: String(form.get('content') ?? '').trim(),
    image: String(form.get('image') ?? '').trim(),
    published: form.get('published') === 'on',
    title_ru: String(form.get('title_ru') ?? '').trim(),
    excerpt_ru: String(form.get('excerpt_ru') ?? '').trim(),
    content_ru: String(form.get('content_ru') ?? '').trim(),
  };
}
