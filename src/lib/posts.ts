import samplePosts from '../data/posts.json';
import { hasSupabase } from './products';

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  published: boolean;
  created_at: string;
}

// Memoized for static generation; skipped in dev so edits show up immediately.
let cache: Post[] | null = null;

/**
 * Reads published blog posts from Supabase PostgREST when configured
 * (RLS on the table only exposes published rows to the anon key), otherwise
 * falls back to the bundled sample posts so the site always builds.
 */
export async function getPosts(): Promise<Post[]> {
  if (cache && !import.meta.env.DEV) return cache;

  let posts: Post[] = samplePosts as Post[];
  if (hasSupabase()) {
    try {
      const res = await fetch(
        `${import.meta.env.PUBLIC_SUPABASE_URL}/rest/v1/posts?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: import.meta.env.SUPABASE_ANON_KEY as string,
            Authorization: `Bearer ${import.meta.env.SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (res.ok) {
        posts = (await res.json()) as Post[];
      } else {
        console.warn('[posts] Supabase responded with', res.status, '— falling back to sample data');
      }
    } catch (err) {
      console.warn('[posts] Supabase fetch failed — falling back to sample data', err);
    }
  }

  const published = posts.filter((p) => p.published);
  if (!import.meta.env.DEV) cache = published;
  return published;
}

/**
 * Admin listing: reads ALL posts (including drafts) with the service role key,
 * which bypasses the published-only RLS policy.
 */
export async function getAllPosts(url: string, serviceKey: string): Promise<Post[]> {
  const res = await fetch(`${url}/rest/v1/posts?select=*&order=created_at.desc`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!res.ok) throw new Error(`posts fetch failed: ${res.status}`);
  return (await res.json()) as Post[];
}

export async function getPostBySlug(slug: string): Promise<Post | undefined> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug);
}

/** Blocks of post content (stored as \n-separated text; "## " lines are h2). */
export function contentParagraphs(content: string): string[] {
  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Georgian long-form date, e.g. «8 ოქტომბერი, 2024». */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ka-GE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
