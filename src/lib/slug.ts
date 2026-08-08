/**
 * URL slug generation with Georgian → Latin transliteration.
 * Used by the admin API when the slug field is left empty.
 */

/** Georgian alphabet → Latin (national romanization, lowercase). */
const GEORGIAN_TO_LATIN: Record<string, string> = {
  'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z',
  'თ': 't', 'ი': 'i', 'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o',
  'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's', 'ტ': 't', 'უ': 'u', 'ფ': 'p',
  'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts', 'ძ': 'dz',
  'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h',
};

/**
 * Turns free text (Georgian or Latin) into a URL-safe slug.
 * e.g. "დიზელ გენერატორი 100 kVA" → "dizel-generatori-100-kva"
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map((ch) => GEORGIAN_TO_LATIN[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
