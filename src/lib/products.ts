import sampleProducts from '../data/products.json';

export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  short_desc: string;
  description: string;
  image: string;
  specs: Spec[];
  featured: boolean;
  created_at: string;
}

/** True when Supabase REST credentials are configured (build-time / import.meta.env). */
export function hasSupabase(): boolean {
  return Boolean(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.SUPABASE_ANON_KEY);
}

// Build/runtime memoization: avoid hammering the REST API during static generation.
let cache: Product[] | null = null;

/**
 * Reads the product catalog from Supabase PostgREST when configured,
 * otherwise falls back to the bundled sample data so the site always builds.
 */
export async function getProducts(): Promise<Product[]> {
  // Skip the cache in dev so newly added products show up without a restart.
  if (cache && !import.meta.env.DEV) return cache;

  if (hasSupabase()) {
    try {
      const res = await fetch(
        `${import.meta.env.PUBLIC_SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: import.meta.env.SUPABASE_ANON_KEY as string,
            Authorization: `Bearer ${import.meta.env.SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (res.ok) {
        cache = (await res.json()) as Product[];
        return cache;
      }
      console.warn('[products] Supabase responded with', res.status, '— falling back to sample data');
    } catch (err) {
      console.warn('[products] Supabase fetch failed — falling back to sample data', err);
    }
  }

  cache = sampleProducts as Product[];
  return cache;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug);
}

export async function getFeaturedProducts(limit = 6): Promise<Product[]> {
  const products = await getProducts();
  const featured = products.filter((p) => p.featured);
  return featured.slice(0, limit);
}

export async function getProductsByCategory(categoryKey: string): Promise<Product[]> {
  const products = await getProducts();
  return products.filter((p) => p.category === categoryKey);
}

/** Paragraphs of a product description (stored as \n-separated text). */
export function descriptionParagraphs(description: string): string[] {
  return description.split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
