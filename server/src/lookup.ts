import { toUpcA } from './barcode.ts';

export interface ProductInfo {
  name: string;
  brand: string;
  size: string;
  category: string;
  imageUrl: string;
  source: 'openfoodfacts' | 'upcitemdb';
}

/** Finds product details for a normalized barcode, or null when nobody knows it. */
export type Lookup = (barcode: string) => Promise<ProductInfo | null>;

const TIMEOUT_MS = 4000;

type Fetch = typeof fetch;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** "en:canned-green-beans" -> "Canned green beans" */
function humanizeTag(tag: string): string {
  const words = tag.replace(/^[a-z]{2}:/, '').replace(/-+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Some listings shout: "WHOLE KERNEL CORN" -> "Whole Kernel Corn". */
function calm(name: string): string {
  if (name !== name.toUpperCase() || !/[A-Z]{3}/.test(name)) return name;
  return name.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

async function getJson(fetchFn: Fetch, url: string, userAgent: string): Promise<unknown | null> {
  try {
    const res = await fetchFn(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    // Offline, timed out, rate limited or bad JSON: all just mean "not found
    // right now". The volunteer gets the manual entry form instead.
    return null;
  }
}

export async function lookupOpenFoodFacts(fetchFn: Fetch, userAgent: string, barcode: string): Promise<ProductInfo | null> {
  const fields = 'product_name,brands,quantity,categories_tags,image_front_small_url';
  const body = (await getJson(
    fetchFn,
    `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`,
    userAgent,
  )) as { status?: number; product?: Record<string, unknown> } | null;
  const product = body?.status === 1 ? body.product : undefined;
  const name = calm(text(product?.product_name));
  if (!product || !name) return null;

  const tags = Array.isArray(product.categories_tags) ? (product.categories_tags as unknown[]) : [];
  // Tags run general -> specific; the last English one is the most useful.
  const tag = tags.filter((t): t is string => typeof t === 'string' && t.startsWith('en:')).at(-1);
  return {
    name,
    // "Del Monte,Del Monte Foods" -> "Del Monte"
    brand: text(product.brands).split(',')[0]!.trim(),
    size: text(product.quantity),
    category: tag ? humanizeTag(tag) : '',
    imageUrl: text(product.image_front_small_url),
    source: 'openfoodfacts',
  };
}

export async function lookupUpcItemDb(fetchFn: Fetch, userAgent: string, barcode: string): Promise<ProductInfo | null> {
  const code = toUpcA(barcode) ?? barcode;
  const body = (await getJson(fetchFn, `https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, userAgent)) as {
    items?: Array<Record<string, unknown>>;
  } | null;
  const item = body?.items?.[0];
  const name = calm(text(item?.title));
  if (!item || !name) return null;

  const images = Array.isArray(item.images) ? (item.images as unknown[]) : [];
  return {
    name,
    brand: text(item.brand),
    size: text(item.size),
    // "Food, Beverages & Tobacco > Food Items > Soups & Broths" -> "Soups & Broths"
    category: text(item.category).split('>').at(-1)!.trim(),
    imageUrl: text(images.find((i) => typeof i === 'string' && i.startsWith('https://'))),
    source: 'upcitemdb',
  };
}

/** Open Food Facts first (free, grocery-focused), UPCitemdb for what it misses. */
export function createLookup(userAgent: string, fetchFn: Fetch = fetch): Lookup {
  return async (barcode) =>
    (await lookupOpenFoodFacts(fetchFn, userAgent, barcode)) ?? (await lookupUpcItemDb(fetchFn, userAgent, barcode));
}
