import type { APIRoute } from 'astro';
import {
  updatePost,
  deletePost,
  formToPostPayload,
  getImageFile,
  validateImageFile,
  uploadProductImage,
  triggerDeployHook,
  resolveUniqueSlug,
  translatePostPayload,
} from '../../../lib/supabase-admin';
import { getEnv } from '../../../lib/env';

export const prerender = false;

/**
 * POST /api/posts/:id — HTML-form friendly endpoint.
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
    result = await deletePost(url, serviceKey, id);
  } else {
    const payload = formToPostPayload(form);

    // Keep the row's own slug valid, suffix (-2, -3, …) on collision with others.
    payload.slug = await resolveUniqueSlug(url, serviceKey, 'posts', payload.slug, id);

    // Auto-translate Georgian → Russian on save (MyMemory, Google fallback).
    await translatePostPayload(payload, getEnv(locals, 'MYMEMORY_EMAIL'));

    // An uploaded cover image replaces the current image (hidden current_image field).
    const imageFile = getImageFile(form);
    if (imageFile) {
      const invalid = validateImageFile(imageFile);
      if (invalid) return redirect(`/admin/posts/edit/${id}?error=${invalid}`, 303);

      const upload = await uploadProductImage(url, serviceKey, imageFile, payload.slug);
      if (!upload.ok) {
        console.error(`[api/posts/${id}] image upload failed`, upload.error);
        return redirect(`/admin/posts/edit/${id}?error=image-upload`, 303);
      }
      payload.image = upload.publicUrl;
    }

    result = await updatePost(url, serviceKey, id, payload);
  }

  if (!result.ok) {
    console.error(`[api/posts/${id}] ${method} failed`, result.error);
    return new Response(JSON.stringify({ error: result.error }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rebuild static pages. Must be awaited (or passed to ctx.waitUntil):
  // un-awaited fetches are cancelled when the Worker returns the response.
  const hook = getEnv(locals, 'DEPLOY_HOOK_URL');
  if (hook) await triggerDeployHook(hook);

  return redirect('/admin/posts?saved=1', 303);
};
