import type { APIRoute } from 'astro';
import {
  updateProduct,
  deleteProduct,
  formToPayload,
  getImageFile,
  validateImageFile,
  uploadProductImage,
  triggerDeployHook,
  resolveUniqueSlug,
  translateProductPayload,
} from '../../../lib/supabase-admin';
import { getEnv } from '../../../lib/env';

export const prerender = false;

/**
 * POST /api/products/:id — HTML-form friendly endpoint.
 * Hidden field `_method=delete` deletes; anything else updates (PATCH semantics).
 */
export const POST: APIRoute = async ({ request, params, redirect, locals }) => {
  const url = getEnv(locals, 'PUBLIC_SUPABASE_URL');
  const serviceKey = getEnv(locals, 'SUPABASE_SERVICE_ROLE_KEY');
  const id = params.id;

  if (!id) {
    return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 });
  }
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const form = await request.formData();
  const method = String(form.get('_method') ?? 'update').toLowerCase();

  let result: { ok: boolean; error?: string };
  if (method === 'delete') {
    result = await deleteProduct(url, serviceKey, id);
  } else {
    const payload = formToPayload(form);

    // Keep the row's own slug valid, suffix (-2, -3, …) on collision with others.
    payload.slug = await resolveUniqueSlug(url, serviceKey, 'products', payload.slug, id);

    // Auto-translate Georgian → Russian on save (MyMemory, Google fallback).
    await translateProductPayload(payload, getEnv(locals, 'MYMEMORY_EMAIL'));

    // An uploaded image file replaces the current image (hidden current_image field).
    const imageFile = getImageFile(form);
    if (imageFile) {
      const invalid = validateImageFile(imageFile);
      if (invalid) return redirect(`/admin/edit/${id}?error=${invalid}`, 303);

      const upload = await uploadProductImage(url, serviceKey, imageFile, payload.slug);
      if (!upload.ok) {
        console.error(`[api/products/${id}] image upload failed`, upload.error);
        return redirect(`/admin/edit/${id}?error=image-upload`, 303);
      }
      payload.image = upload.publicUrl;
    }

    result = await updateProduct(url, serviceKey, id, payload);
  }

  if (!result.ok) {
    console.error(`[api/products/${id}] ${method} failed`, result.error);
    return new Response(JSON.stringify({ error: result.error }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rebuild static pages — fire and forget.
  const hook = getEnv(locals, 'DEPLOY_HOOK_URL');
  if (hook) triggerDeployHook(hook);

  return redirect('/admin?saved=1', 303);
};
