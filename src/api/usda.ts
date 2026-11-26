import type { Measure } from '../types';
import { fetchJson, isNum, type SearchResult } from './types';

/**
 * USDA FoodData Central: alimentos genéricos (Foundation, SR Legacy, FNDDS) con valores por 100 g.
 * Requiere API key gratuita: https://fdc.nal.usda.gov/api-key-signup
 * Orden de prioridad de la clave: Ajustes de la app > VITE_USDA_API_KEY (build) > DEMO_KEY (muy limitada).
 */
const API = 'https://api.nal.usda.gov/fdc/v1/foods/search';
export const ENV_USDA_KEY: string = (import.meta.env.VITE_USDA_API_KEY as string | undefined)?.trim() || '';

export function resolveUsdaKey(userKey: string): { key: string; isDemo: boolean } {
  const key = userKey.trim() || ENV_USDA_KEY;
  return key ? { key, isDemo: false } : { key: 'DEMO_KEY', isDemo: true };
}

// Números de nutriente de FDC
const KCAL = ['208', '957', '958']; // Energía; Atwater general / específico (Foundation)
const PROT = '203';
const FAT = '204';
const CARB = '205';

function nutrient(list: any[], numbers: string[]): number | undefined {
  for (const num of numbers) {
    const hit = list.find(
      (n) => String(n.nutrientNumber) === num && (num !== '208' || String(n.unitName).toUpperCase() === 'KCAL'),
    );
    if (hit && isNum(hit.value)) return hit.value;
  }
  return undefined;
}

const DATA_LABEL: Record<string, string> = {
  Foundation: 'USDA Foundation',
  'SR Legacy': 'USDA SR Legacy',
  'Survey (FNDDS)': 'USDA FNDDS',
  Branded: 'USDA Branded',
};

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export function mapFood(f: any): SearchResult | null {
  const name = String(f.description || '').trim();
  if (!name) return null;
  const list = f.foodNutrients || [];
  const vals = {
    kcal: nutrient(list, KCAL),
    protein: nutrient(list, [PROT]),
    carbs: nutrient(list, [CARB]),
    fat: nutrient(list, [FAT]),
  };
  const incomplete = Object.values(vals).some((v) => v === undefined);
  const measures: Measure[] = [];
  const unit = String(f.servingSizeUnit || '').toLowerCase();
  if (isNum(f.servingSize) && f.servingSize > 0 && (unit === 'g' || unit === 'grm' || unit === 'ml' || unit === 'mlt')) {
    const label = f.householdServingFullText ? `porción (${f.householdServingFullText})` : 'porción';
    measures.push({ label: label.slice(0, 40), amount: f.servingSize });
  }
  const liquid = unit === 'ml' || unit === 'mlt';
  return {
    incomplete,
    note: incomplete ? 'Sin datos nutricionales completos' : `por 100 ${liquid ? 'ml' : 'g'} · ${DATA_LABEL[f.dataType] || 'USDA'}`,
    draft: {
      source: 'usda',
      sourceId: String(f.fdcId),
      // Los genéricos vienen en MAYÚSCULAS a veces
      name: name === name.toUpperCase() ? cap(name) : name,
      brand: String(f.brandOwner || f.brandName || '').trim(),
      baseAmount: 100,
      baseUnit: liquid ? 'ml' : 'g',
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

export async function searchUSDA(query: string, apiKey: string, signal?: AbortSignal): Promise<SearchResult[]> {
  // Se codifica con encodeURIComponent: USDA responde 400 si los espacios llegan como "+".
  const params = [
    ['api_key', apiKey],
    ['query', query],
    ['pageSize', '25'],
    ['dataType', 'Foundation,SR Legacy,Survey (FNDDS)'],
  ]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  const data = await fetchJson(`${API}?${params}`, signal);
  return (data?.foods ?? [])
    .map(mapFood)
    .filter((r: SearchResult | null): r is SearchResult => !!r)
    .sort((a: SearchResult, b: SearchResult) => Number(a.incomplete) - Number(b.incomplete));
}
