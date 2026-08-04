# GENERATORI.GE — heavy machinery catalog (Astro 5)

A read-only online catalog of diesel generators, chillers and spare parts, with a
password-protected admin area for a single site owner. All visitor-facing UI is in
Georgian (`lang="ka"`); URLs use latin-transliterated slugs. Built for SEO in
Georgia: static generation, self-hosted Georgian fonts, JSON-LD structured data,
sitemap, near-zero client JS.

## Tech stack

- **Astro 5** (static output) + **@astrojs/cloudflare** adapter — public pages are
  prerendered HTML; `/admin/*` and `/api/*` routes are server-rendered Pages Functions
  (`export const prerender = false`).
- **@astrojs/sitemap** — sitemap from the `site` config value (`SITE_URL` env).
- **@fontsource/noto-sans-georgian** — self-hosted font, no Google Fonts CDN.
- Hand-written CSS (`src/styles/global.css`), no Tailwind, no JS framework.
- Supabase via plain `fetch()` against PostgREST — **no supabase-js**.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # preview the build
```

The site **builds and demos with zero configuration**: if
`PUBLIC_SUPABASE_URL` / `SUPABASE_ANON_KEY` are not set, the catalog falls back to
the sample data in `src/data/products.json`.

## Environment variables

Copy `.env.example` to `.env` (locally) or set these in Cloudflare Pages settings:

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xyz.supabase.co`) |
| `SUPABASE_ANON_KEY` | anon key — read-only catalog access |
| `SUPABASE_SERVICE_ROLE_KEY` | service key — admin CRUD only, keep secret |
| `ADMIN_PASSWORD` | the single admin password |
| `AUTH_SECRET` | random long string for HMAC cookie signing (`openssl rand -hex 32`) |
| `DEPLOY_HOOK_URL` | Cloudflare Pages deploy hook — POST'ed after each admin mutation to rebuild the static site |
| `SITE_URL` | canonical origin used for sitemap/canonical/OG (default `https://example.com`) |

Without the Supabase variables the public site still works (sample data) and the
admin login still works, but the dashboard shows a Georgian notice that CRUD is
unavailable.

## Supabase setup

Create the table (SQL editor in the Supabase dashboard):

```sql
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null check (category in ('generators', 'chillers', 'parts')),
  short_desc text not null default '',
  description text not null default '',
  image text not null default '',
  specs jsonb not null default '[]'::jsonb,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- Public read access for the anon key (catalog is public anyway):
alter table products enable row level security;

create policy "public read"
  on products for select
  using (true);

-- Inserts/updates/deletes are done with the service role key, which bypasses RLS.
```

Note: the admin "new product" form lets the database generate the `id`
(`gen_random_uuid()`), while sample data uses string ids — both work since all
lookups are by `slug` (public) or `id` (admin).

The blog/articles section uses a second table:

```sql
create table posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  content text not null default '',
  image text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table posts enable row level security;

-- Only published posts are publicly readable; drafts are admin-only:
create policy "public read published"
  on posts for select
  using (published = true);

-- Writes go through the service role key, which bypasses RLS.
```

`content` is plain text: blank lines separate paragraphs and lines starting
with `## ` render as `<h2>` subheadings on the article page.

## Supabase Storage setup

Product images can be uploaded straight from the browser in the admin form —
no repo changes needed. For this to work, create a **public** bucket named
`product-images`:

- Dashboard: **Storage → New bucket** → name it `product-images`, toggle
  **Public bucket** on, save.
- Or with SQL:

```sql
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true);
```

Public read is all that is required: uploads go through the service role key
(which bypasses storage RLS), and the site only ever needs the public URL,
which is stored in the product's `image` field as
`{PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/{filename}`.
Only JPEG/PNG/WebP/AVIF up to 5 MB are accepted; invalid files are rejected
with a Georgian error message on the form.

## How the admin works

1. Visit `/admin/login`, enter `ADMIN_PASSWORD`. On success the server sets an
   HMAC-signed `admin_session` httpOnly cookie (Web Crypto `crypto.subtle`,
   Workers-compatible) and redirects to `/admin`.
2. `src/middleware.ts` guards `/admin/*` (except `/admin/login`) and the mutation
   APIs (`/api/products*`, `/api/posts*`) by verifying the cookie against
   `AUTH_SECRET`.
3. `/admin` lists products with edit/delete; `/admin/new` and `/admin/edit/[id]`
   render the product form. Specs are edited as `label | value` lines. The form
   also has a file input («ან ატვირთეთ სურათი») — choosing a file uploads it to
   the `product-images` Storage bucket and takes precedence over the manual
   image path/URL field, which remains as a fallback.
4. `/admin/posts` does the same for blog articles (`/admin/posts/new`,
   `/admin/posts/edit/[id]`): title, latin slug, excerpt, content (blank line =
   paragraph, `## ` = subheading), optional cover image upload into the same
   `product-images` bucket, and a published checkbox — drafts stay invisible on
   the public site thanks to the RLS policy above.
5. Mutations POST to `/api/products`, `/api/products/[id]`, `/api/posts` or
   `/api/posts/[id]` as `multipart/form-data`. The API uploads any attached
   image to Supabase Storage via plain `fetch()` (service role key,
   `x-upsert: true`), writes the row via PostgREST, then fire-and-forget POSTs
   to `DEPLOY_HOOK_URL` so Cloudflare Pages rebuilds and the static pages
   regenerate (usually live within a couple of minutes).

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   pick the repo.
3. Build settings:
   - Framework preset: **Astro**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. In **Settings → Environment variables**, add all variables from the table above
   (production; add preview too if you use preview deployments).
5. In **Settings → Builds & deployments → Deploy hooks**, create a deploy hook and
   set its URL as the `DEPLOY_HOOK_URL` variable.
6. Add your custom domain under **Custom domains** and set `SITE_URL` to
   `https://yourdomain.ge`, then update `public/robots.txt` with the same origin.
7. Trigger a redeploy after changing variables so they are baked into the build.

## Project structure

```
public/
  favicon.svg
  robots.txt
  images/products/           # SVG placeholders (generator / chiller / parts)
src/
  data/products.json         # sample catalog (fallback when Supabase is unset)
  data/posts.json            # sample blog articles (fallback when Supabase is unset)
  lib/
    products.ts              # product data layer: Supabase REST → fallback JSON, memoized
    posts.ts                 # post data layer (same pattern; skips cache in dev)
    categories.ts            # category key ↔ slug ↔ Georgian name mapping
    auth.ts                  # HMAC session cookie helpers (Web Crypto)
    env.ts                   # runtime-or-build env var resolver
    supabase-admin.ts        # service-role CRUD + storage upload + deploy hook + form parsing
  middleware.ts              # protects /admin/*, /api/products* and /api/posts*
  layouts/BaseLayout.astro   # html head/meta/OG/fonts + header/footer
  components/                # Header, Footer, ProductCard, SpecTable, admin/ProductForm, admin/PostForm
  pages/
    index.astro              # home (hero, categories, featured, USP, latest articles, CTA)
    catalog/index.astro      # full catalog grouped by category
    catalog/[category].astro # one static page per category
    products/[slug].astro    # product detail + JSON-LD Product/Breadcrumb
    blog/index.astro         # article listing
    blog/[slug].astro        # article page + JSON-LD Article/Breadcrumb
    contact.astro, 404.astro
    admin/                   # login, dashboard, product + post forms (server-rendered)
    api/                     # auth/login, auth/logout, products + posts CRUD (server-rendered)
```

## Notes & caveats

- Prices are intentionally "on request" («ფასი მოთხოვნით»); the JSON-LD `Offer`
  omits a numeric price.
- Product images are lightweight SVG placeholders; replace files in
  `public/images/products/` (or point the `image` field at any URL/path) when real
  photos are available.
- The only client-side JavaScript is the mobile nav toggle in `Header.astro`.
