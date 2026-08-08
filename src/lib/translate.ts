/**
 * Free ka → ru machine translation for the admin save flow.
 * Primary: MyMemory (no key; 5k chars/day anonymous, 50k/day with an email).
 * Fallback: Google Translate's unofficial gtx endpoint (best effort).
 * Texts without Georgian characters are returned unchanged.
 */

const GEORGIAN_RE = /[ა-ჰ]/;
/** MyMemory rejects long q values — keep each request well under its limit. */
const MAX_CHUNK_BYTES = 450;

interface MyMemoryResponse {
  responseStatus?: number | string;
  quotaFinished?: boolean;
  responseData?: { translatedText?: string };
}

async function myMemoryTranslate(text: string, email?: string): Promise<string | null> {
  try {
    let url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ka|ru`;
    if (email) url += `&de=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as MyMemoryResponse;
    const translated = data.responseData?.translatedText ?? '';
    if (
      Number(data.responseStatus) !== 200 ||
      data.quotaFinished ||
      !translated ||
      translated.toUpperCase().includes('MYMEMORY WARNING')
    ) {
      return null;
    }
    return translated;
  } catch {
    return null;
  }
}

async function googleTranslate(text: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ka&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    // Response shape: [[["translated","source",...], ...], ...]
    const data = (await res.json()) as [Array<[string, ...unknown[]]> | null, ...unknown[]] | null;
    const translated = (data?.[0] ?? []).map((seg) => seg?.[0] ?? '').join('');
    return translated || null;
  } catch {
    return null;
  }
}

/** Splits text into ≤ MAX_CHUNK_BYTES chunks, preferring newline/space boundaries. */
function chunkText(text: string): string[] {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let rest = text;
  while (encoder.encode(rest).length > MAX_CHUNK_BYTES) {
    // Find the largest prefix that fits, then back off to a newline or space.
    let end = Math.min(rest.length, MAX_CHUNK_BYTES); // Georgian chars are 3 bytes — safe upper probe
    while (end > 0 && encoder.encode(rest.slice(0, end)).length > MAX_CHUNK_BYTES) end--;
    if (end === 0) end = 1;
    const newline = rest.lastIndexOf('\n', end);
    const space = rest.lastIndexOf(' ', end);
    const cut = newline > end / 2 ? newline + 1 : space > end / 2 ? space + 1 : end;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) chunks.push(rest);
  return chunks;
}

/**
 * Translates Georgian text to Russian. Non-Georgian text passes through
 * unchanged (numbers, latin model names, "100 kVA", etc.). If every provider
 * fails, the original text is returned — the site already falls back to
 * Georgian on ru pages, so a failed save never breaks anything.
 */
export async function translateKaToRu(text: string, email?: string): Promise<string> {
  if (!text.trim() || !GEORGIAN_RE.test(text)) return text;

  const chunks = chunkText(text);
  const translated = await Promise.all(
    chunks.map(async (chunk) => {
      const viaMyMemory = await myMemoryTranslate(chunk, email);
      if (viaMyMemory !== null) return viaMyMemory;
      const viaGoogle = await googleTranslate(chunk);
      if (viaGoogle !== null) return viaGoogle;
      console.warn('[translate] all providers failed for a chunk, keeping Georgian');
      return chunk;
    })
  );
  return translated.join('');
}

/**
 * Translates spec rows: labels always (they're Georgian UI text), values only
 * when they contain Georgian (units and numbers like "100 kVA" stay as-is).
 */
export async function translateSpecs(
  specs: { label: string; value: string }[],
  email?: string
): Promise<{ label: string; value: string }[]> {
  return Promise.all(
    specs.map(async (s) => ({
      label: await translateKaToRu(s.label, email),
      value: await translateKaToRu(s.value, email),
    }))
  );
}
