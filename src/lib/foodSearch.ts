import type { Food } from './types';

// Open Food Facts: free, open, community-maintained product database. No API key is required.
// Values come from product labels entered by contributors, so they are shown as "Open Food Facts", not "verified".

const ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl';

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

export function mapOffProduct(p: OffProduct): Food | null {
  const n = p.nutriments || {};
  const name = (p.product_name || '').trim();
  if (!name || !p.code) return null;
  let kcal = num(n['energy-kcal_100g']);
  if (kcal == null) {
    const kj = num(n['energy_100g']);
    if (kj != null) kcal = kj / 4.184;
  }
  const protein = num(n['proteins_100g']);
  const carbs = num(n['carbohydrates_100g']);
  const fat = num(n['fat_100g']);
  if (kcal == null || protein == null || carbs == null || fat == null) return null; // incomplete data: don't guess
  if (kcal < 0 || kcal > 950) return null;
  const fiber = num(n['fiber_100g']);
  const servings = [];
  const sq = num(p.serving_quantity);
  if (sq && sq > 0 && sq < 2000) servings.push({ label: p.serving_size ? `1 serving (${p.serving_size})` : `1 serving`, amount: sq });
  servings.push({ label: '100 g', amount: 100 });
  return {
    id: `off:${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    source: 'openfoodfacts',
    baseUnit: 'g',
    baseAmount: 100,
    nutrients: {
      kcal: Math.round(kcal),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      ...(fiber != null ? { fiber: Math.round(fiber * 10) / 10 } : {}),
    },
    servings,
  };
}

export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    fields: 'code,product_name,brands,serving_size,serving_quantity,nutriments',
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!res.ok) throw new Error(`Food database returned ${res.status}`);
  const data = (await res.json()) as { products?: OffProduct[] };
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const p of data.products || []) {
    const f = mapOffProduct(p);
    if (!f) continue;
    const key = `${f.name.toLowerCase()}|${f.brand?.toLowerCase() || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
