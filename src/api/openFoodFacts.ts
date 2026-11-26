import type { BaseUnit, Measure } from '../types';
import { ApiError, fetchJson, toNum, type SearchResult } from './types';
import { KJ_PER_KCAL } from '../lib/nutrition';

/**
 * Open Food Facts: base de datos abierta de productos comerciales.
 * No requiere clave. Los valores se piden por 100 g (o 100 ml en bebidas).
 * https://openfoodfacts.github.io/openfoodfacts-server/api/
 */
const HOST = 'https://world.openfoodfacts.org';
const FIELDS = [
  'code',
  'product_name',
  'product_name_es',
  'generic_name_es',
  'brands',
  'quantity',
  'serving_size',
  'serving_quantity',
  'nutriments',
].join(',');

function liquid(p: any): boolean {
  const q = `${p.quantity || ''} ${p.serving_size || ''}`.toLowerCase();
  return /\d\s*(ml|cl|l|fl\.? ?oz)\b/.test(q);
}

export function mapProduct(p: any): SearchResult | null {
  const name = (p.product_name_es || p.product_name || p.generic_name_es || '').trim();
  if (!name) return null;
  const n = p.nutriments || {};
  const unit: BaseUnit = liquid(p) ? 'ml' : 'g';

  let kcal = toNum(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = toNum(n['energy-kj_100g']);
    if (kj !== undefined) kcal = kj / KJ_PER_KCAL; // conversión exacta, no estimación
  }
  let vals = {
    kcal,
    protein: toNum(n.proteins_100g),
    carbs: toNum(n.carbohydrates_100g),
    fat: toNum(n.fat_100g),
  };
  let baseAmount = 100;
  let note = `por 100 ${unit}`;

  const servingQty = toNum(p.serving_quantity);
  const has = (v: typeof vals) => v.kcal !== undefined && v.protein !== undefined && v.carbs !== undefined && v.fat !== undefined;

  // Si no hay datos por 100 g pero sí por porción con su peso, usar la porción como base.
  if (!has(vals) && servingQty && servingQty > 0) {
    const sv = {
      kcal: toNum(n['energy-kcal_serving']),
      protein: toNum(n.proteins_serving),
      carbs: toNum(n.carbohydrates_serving),
      fat: toNum(n.fat_serving),
    };
    if (has(sv)) {
      vals = sv;
      baseAmount = servingQty;
      note = `por porción (${p.serving_size || servingQty + ' ' + unit})`;
    }
  }

  const measures: Measure[] = [];
  if (servingQty && servingQty > 0) {
    measures.push({ label: `porción${p.serving_size ? ` (${String(p.serving_size).trim()})` : ''}`.slice(0, 40), amount: servingQty });
  }

  const incomplete = !has(vals);
  return {
    incomplete,
    note: incomplete ? 'Sin datos nutricionales completos' : note,
    draft: {
      source: 'off',
      sourceId: String(p.code || ''),
      name,
      brand: (Array.isArray(p.brands) ? p.brands.join(',') : String(p.brands || '')).split(',')[0].replace(/^[a-z]{2}:/, '').trim(),
      baseAmount,
      baseUnit: unit,
      kcal: vals.kcal ?? 0,
      protein: vals.protein ?? 0,
      carbs: vals.carbs ?? 0,
      fat: vals.fat ?? 0,
      measures,
      tags: [],
      favorite: 0,
      category: '',
    },
  };
}

function collect(products: any[]): SearchResult[] {
  const out: SearchResult[] = [];
  const seen = new Set<string>();
  for (const p of products ?? []) {
    const r = mapProduct(p);
    if (!r || seen.has(r.draft.sourceId)) continue;
    seen.add(r.draft.sourceId);
    out.push(r);
  }
  // Los productos con datos completos primero.
  return out.sort((a, b) => Number(a.incomplete) - Number(b.incomplete));
}

/**
 * Búsqueda por texto. OFF limita las búsquedas (~10 por minuto) y, cuando las rechaza,
 * el navegador solo ve un error de red. Por eso, si el buscador clásico falla,
 * se intenta con el buscador nuevo (search.openfoodfacts.org) antes de mostrar el error.
 */
export async function searchOFF(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const classic =
    `${HOST}/cgi/search.pl?search_simple=1&action=process&json=1&page_size=24&lc=es` +
    `&search_terms=${encodeURIComponent(query)}&fields=${FIELDS}`;
  try {
    const data = await fetchJson(classic, signal, 20000);
    return collect(data?.products);
  } catch (e) {
    if (signal?.aborted) throw e;
    try {
      const data = await fetchJson(
        `https://search.openfoodfacts.org/search?q=${encodeURIComponent(query)}&page_size=24&langs=es&fields=${FIELDS}`,
        signal,
        20000,
      );
      return collect(data?.hits);
    } catch (e2) {
      if (signal?.aborted) throw e2;
      throw new ApiError('Open Food Facts no respondió (limita a unas 10 búsquedas por minuto). Espera un momento y reintenta.', 'network');
    }
  }
}

/** Busca un producto por código de barras (EAN/UPC). */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<SearchResult | null> {
  const clean = code.replace(/\D/g, '');
  const data = await fetchJson(`${HOST}/api/v2/product/${clean}.json?fields=${FIELDS}`, signal).catch((e) => {
    if (e?.kind === 'notfound') return null;
    throw e;
  });
  if (!data || data.status !== 1 || !data.product) return null;
  return mapProduct({ code: clean, ...data.product });
}

export const isBarcode = (q: string) => /^\d{8,14}$/.test(q.trim());
