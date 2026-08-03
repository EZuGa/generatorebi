import type { APIRoute } from 'astro';
import {
  createProduct,
  formToPayload,
  getImageFile,
  validateImageFile,
  uploadProductImage,
  triggerDeployHook,
} from '../../../lib/supabase-admin';
import { getEnv } from '../../../lib/env';

export const prerender = false;

/** POST /api/products — create a product (multipart form post from /admin/new). */
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
  const payload = formToPayload(form);

  if (!payload.name || !payload.slug) {
    return new Response(JSON.stringify({ error: 'name and slug are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // An uploaded image file takes precedence over the manual image path/URL.
  const imageFile = getImageFile(form);
  if (imageFile) {
    const invalid = validateImageFile(imageFile);
    if (invalid) return redirect(`/admin/new?error=${invalid}`, 303);

    const upload = await uploadProductImage(url, serviceKey, imageFile, payload.slug);
    if (!upload.ok) {
      console.error('[api/products] image upload failed', upload.error);
      return redirect('/admin/new?error=image-upload', 303);
    }
    payload.image = upload.publicUrl;
  }

  const result = await createProduct(url, serviceKey, payload);
  if (!result.ok) {
    console.error('[api/products] create failed', result.error);
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
