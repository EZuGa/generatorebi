import samplePosts from '../data/posts.json';
import samplePostsRu from '../data/posts.ru.json';
import { hasSupabase } from './products';
import type { Lang } from './i18n';

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  published: boolean;
  created_at: string;
  /** Optional Russian translations (Supabase columns; empty = fall back to Georgian). */
  title_ru?: string;
  excerpt_ru?: string;
  content_ru?: string;
}

// Memoized for static generation; skipped in dev so edits show up immediately.
let cache: Post[] | null = null;

/**
 * Reads published blog posts from Supabase PostgREST when configured
 * (RLS on the table only exposes published rows to the anon key), otherwise
 * falls back to the bundled sample posts so the site always builds.
 */
export async function getPosts(lang: Lang = 'ka'): Promise<Post[]> {
  if (cache && !import.meta.env.DEV) return lang === 'ka' ? cache : cache.map((p) => localizePost(p));

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

  const published = posts
    .filter((p) => p.published)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  if (!import.meta.env.DEV) cache = published;
  return lang === 'ka' ? published : published.map((p) => localizePost(p));
}

/** Bundled Russian translations keyed by slug — fallback when Supabase rows have no *_ru fields. */
const ruBySlug = new Map((samplePostsRu as Post[]).map((p) => [p.slug, p]));

/**
 * Russian view of a post: Supabase *_ru columns win, then the bundled
 * ru JSON by slug, then the Georgian text as a last resort.
 */
function localizePost(p: Post): Post {
  const ru = ruBySlug.get(p.slug);
  return {
    ...p,
    title: p.title_ru?.trim() || ru?.title || p.title,
    excerpt: p.excerpt_ru?.trim() || ru?.excerpt || p.excerpt,
    content: p.content_ru?.trim() || ru?.content || p.content,
  };
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

export async function getPostBySlug(slug: string, lang: Lang = 'ka'): Promise<Post | undefined> {
  const posts = await getPosts(lang);
  return posts.find((p) => p.slug === slug);
}

/** Blocks of post content (stored as \n-separated text; "## " lines are h2). */
export function contentParagraphs(content: string): string[] {
  return content
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders one content block to safe HTML: escapes everything first, then
 * converts markdown-style inline links [anchor](/path-or-url) to <a> tags.
 * Only root-relative paths and http(s) URLs are accepted — no other markdown.
 */
export function renderInline(text: string): string {
  return escapeHtml(text).replace(
    /\[([^\]]+)]\((\/[^\s)]+|https?:\/\/[^\s)]+)\)/g,
    '<a href="$2">$1</a>'
  );
}

/** Long-form date in the page's locale, e.g. «8 ოქტომბერი, 2024» / «8 октября 2024 г.» */
export function formatDate(iso: string, lang: Lang = 'ka'): string {
  return new Date(iso).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'ka-GE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
