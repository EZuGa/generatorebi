import type { APIRoute } from 'astro';
import {
  createPost,
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

/** POST /api/posts — create a blog post (multipart form post from /admin/posts/new). */
export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const url = getEnv(locals, 'PUBLIC_SUPABASE_URL');
  const serviceKey = getEnv(locals, 'SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Supabase is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const form = await request.formData();
  const payload = formToPostPayload(form);

  if (!payload.title || !payload.slug) {
    return new Response(JSON.stringify({ error: 'title and slug are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Avoid unique-constraint failures: suffix the slug (-2, -3, …) when taken.
  payload.slug = await resolveUniqueSlug(url, serviceKey, 'posts', payload.slug);

  // Auto-translate Georgian → Russian on save (MyMemory, Google fallback).
  await translatePostPayload(payload, getEnv(locals, 'MYMEMORY_EMAIL'));

  // An uploaded cover image replaces the current image (hidden current_image field).
  const imageFile = getImageFile(form);
  if (imageFile) {
    const invalid = validateImageFile(imageFile);
    if (invalid) return redirect(`/admin/posts/new?error=${invalid}`, 303);

    const upload = await uploadProductImage(url, serviceKey, imageFile, payload.slug);
    if (!upload.ok) {
      console.error('[api/posts] image upload failed', upload.error);
      return redirect('/admin/posts/new?error=image-upload', 303);
    }
    payload.image = upload.publicUrl;
  }

  const result = await createPost(url, serviceKey, payload);
  if (!result.ok) {
    console.error('[api/posts] create failed', result.error);
    return new Response(JSON.stringify({ error: result.error }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rebuild static pages — fire and forget.
  const hook = getEnv(locals, 'DEPLOY_HOOK_URL');
  if (hook) triggerDeployHook(hook);

  return redirect('/admin/posts?saved=1', 303);
};
