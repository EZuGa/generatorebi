import sampleProducts from '../data/products.json';
import sampleProductsRu from '../data/products.ru.json';
import type { Lang } from './i18n';

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
  /** Optional Russian translations (Supabase columns; empty = fall back to Georgian). */
  name_ru?: string;
  short_desc_ru?: string;
  description_ru?: string;
  specs_ru?: Spec[];
}

/** True when Supabase REST credentials are configured (build-time / import.meta.env). */
export function hasSupabase(): boolean {
  return Boolean(import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.SUPABASE_ANON_KEY);
}

// Build/runtime memoization: avoid hammering the REST API during static generation.
let cache: Product[] | null = null;

/** Bundled Russian translations keyed by slug — fallback when Supabase rows have no *_ru fields. */
const ruBySlug = new Map((sampleProductsRu as Product[]).map((p) => [p.slug, p]));

/**
 * Russian view of a product: Supabase *_ru columns win, then the bundled
 * ru JSON by slug, then the Georgian text as a last resort.
 */
function localizeProduct(p: Product, lang: Lang): Product {
  if (lang === 'ka') return p;
  const ru = ruBySlug.get(p.slug);
  return {
    ...p,
    name: p.name_ru?.trim() || ru?.name || p.name,
    short_desc: p.short_desc_ru?.trim() || ru?.short_desc || p.short_desc,
    description: p.description_ru?.trim() || ru?.description || p.description,
    specs: p.specs_ru?.length ? p.specs_ru : ru?.specs?.length ? ru.specs : p.specs,
  };
}

/**
 * Reads the product catalog from Supabase PostgREST when configured,
 * otherwise falls back to the bundled sample data so the site always builds.
 */
export async function getProducts(lang: Lang = 'ka'): Promise<Product[]> {
  const base = await getBaseProducts();
  return lang === 'ka' ? base : base.map((p) => localizeProduct(p, lang));
}

async function getBaseProducts(): Promise<Product[]> {
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

export async function getProductBySlug(slug: string, lang: Lang = 'ka'): Promise<Product | undefined> {
  const products = await getProducts(lang);
  return products.find((p) => p.slug === slug);
}

export async function getFeaturedProducts(limit = 6, lang: Lang = 'ka'): Promise<Product[]> {
  const products = await getProducts(lang);
  const featured = products.filter((p) => p.featured);
  return featured.slice(0, limit);
}

export async function getProductsByCategory(categoryKey: string, lang: Lang = 'ka'): Promise<Product[]> {
  const products = await getProducts(lang);
  return products.filter((p) => p.category === categoryKey);
}

/** Paragraphs of a product description (stored as \n-separated text). */
export function descriptionParagraphs(description: string): string[] {
  return description.split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
