import { db, uid } from '../db';
import type { Entry, Food, FoodDraft, MealKey, Settings } from '../types';
import { cleanTag, norm } from './text';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  // Valores ilustrativos, no recomendaciones. Se cambian en Ajustes.
  goals: { kcal: 2000, protein: 120, carbs: 220, fat: 65 },
  theme: 'light',
  energyUnit: 'kcal',
  weightUnit: 'g',
  usdaApiKey: '',
};

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('app');
  return { ...DEFAULT_SETTINGS, ...s, goals: { ...DEFAULT_SETTINGS.goals, ...s?.goals } };
}

export async function saveSettings(patch: Partial<Settings>) {
  const cur = await getSettings();
  const next = { ...cur, ...patch, id: 'app' as const };
  await db.settings.put(next);
  if (patch.theme) {
    try {
      localStorage.setItem('mt-theme', patch.theme);
    } catch {
      /* ignore */
    }
  }
  return next;
}

/** Limpia y valida un alimento antes de guardarlo. */
function sanitize<T extends FoodDraft>(f: T): T {
  const num = (n: number) => (Number.isFinite(n) && n >= 0 ? n : 0);
  return {
    ...f,
    name: f.name.trim(),
    brand: (f.brand || '').trim(),
    kcal: num(f.kcal),
    protein: num(f.protein),
    carbs: num(f.carbs),
    fat: num(f.fat),
    baseAmount: f.baseAmount > 0 ? f.baseAmount : 100,
    measures: (f.measures || []).filter((m) => m.label.trim() && m.amount > 0),
    tags: [...new Set((f.tags || []).map(cleanTag).filter(Boolean))],
  };
}

/** Busca un alimento ya guardado equivalente (mismo origen externo, o mismo nombre+marca si es propio). */
export async function findExisting(d: FoodDraft): Promise<Food | undefined> {
  if (d.id) return db.foods.get(d.id);
  if (d.source !== 'custom' && d.sourceId) {
    return db.foods.where('[source+sourceId]').equals([d.source, d.sourceId]).first();
  }
  return undefined;
}

/** Crea o actualiza un alimento. Los externos se deduplican por origen + id. */
export async function upsertFood(draft: FoodDraft): Promise<Food> {
  const d = sanitize(draft);
  const now = Date.now();
  const existing = await findExisting(d);
  if (existing) {
    const next: Food = { ...existing, ...d, id: existing.id, updatedAt: now } as Food;
    await db.foods.put(next);
    await ensureTags(next.tags);
    return next;
  }
  const food: Food = { ...d, id: d.id || uid(), useCount: 0, lastUsed: 0, createdAt: now, updatedAt: now } as Food;
  await db.foods.put(food);
  await ensureTags(food.tags);
  return food;
}

export async function ensureTags(tags: string[]) {
  const now = Date.now();
  await db.tags.bulkPut(tags.map((name) => ({ name, createdAt: now }))).catch(() => undefined);
}

export async function deleteFood(id: string) {
  // Los registros conservan su copia del alimento, así que el historial no se pierde.
  await db.foods.delete(id);
}

export async function toggleFavorite(f: Food) {
  await db.foods.update(f.id, { favorite: f.favorite ? 0 : 1, updatedAt: Date.now() });
}

export async function deleteTag(name: string) {
  await db.transaction('rw', db.foods, db.tags, async () => {
    await db.tags.delete(name);
    const foods = await db.foods.where('tags').equals(name).toArray();
    for (const f of foods) await db.foods.update(f.id, { tags: f.tags.filter((t) => t !== name) });
  });
}

export async function renameTag(from: string, to: string) {
  const t = cleanTag(to);
  if (!t || t === from) return;
  await db.transaction('rw', db.foods, db.tags, async () => {
    await db.tags.delete(from);
    await db.tags.put({ name: t, createdAt: Date.now() });
    const foods = await db.foods.where('tags').equals(from).toArray();
    for (const f of foods) await db.foods.update(f.id, { tags: [...new Set(f.tags.map((x) => (x === from ? t : x)))] });
  });
}

export async function allTags(): Promise<string[]> {
  const [stored, foods] = await Promise.all([db.tags.toArray(), db.foods.toArray()]);
  const set = new Set(stored.map((t) => t.name));
  foods.forEach((f) => f.tags.forEach((t) => set.add(t)));
  return [...set].sort((a, b) => norm(a).localeCompare(norm(b)));
}

export interface LogInput {
  food: FoodDraft | Food;
  date: string;
  meal: MealKey;
  quantity: number;
  unitLabel: string;
  baseQty: number;
}

/** Registra un consumo. Si el alimento viene de una búsqueda externa, se guarda para reutilizarlo. */
export async function logFood(input: LogInput): Promise<Entry> {
  return db.transaction('rw', db.foods, db.entries, db.tags, async () => {
    // Si el alimento externo ya estaba guardado, se reutiliza sin sobrescribir etiquetas ni favoritos.
    const saved =
      'useCount' in input.food
        ? (input.food as Food)
        : (await findExisting(input.food)) ?? (await upsertFood(input.food));
    const cur = (await db.foods.get(saved.id)) ?? saved;
    await db.foods.update(saved.id, { useCount: (cur.useCount || 0) + 1, lastUsed: Date.now() });
    const entry: Entry = {
      id: uid(),
      date: input.date,
      meal: input.meal,
      foodId: saved.id,
      food: {
        name: saved.name,
        brand: saved.brand,
        baseAmount: saved.baseAmount,
        baseUnit: saved.baseUnit,
        kcal: saved.kcal,
        protein: saved.protein,
        carbs: saved.carbs,
        fat: saved.fat,
        measures: saved.measures,
        source: saved.source,
      },
      quantity: input.quantity,
      unitLabel: input.unitLabel,
      baseQty: input.baseQty,
      createdAt: Date.now(),
    };
    await db.entries.add(entry);
    return entry;
  });
}

export async function updateEntry(id: string, patch: Partial<Pick<Entry, 'meal' | 'quantity' | 'unitLabel' | 'baseQty' | 'date'>>) {
  await db.entries.update(id, patch);
}

export async function deleteEntry(id: string) {
  await db.entries.delete(id);
}

/** Copia todas las entradas de una comida de un día a otro. */
export async function copyMeal(fromDate: string, meal: MealKey, toDate: string, toMeal: MealKey = meal) {
  const src = await db.entries.where('[date+meal]').equals([fromDate, meal]).toArray();
  const now = Date.now();
  await db.entries.bulkAdd(src.map((e, i) => ({ ...e, id: uid(), date: toDate, meal: toMeal, createdAt: now + i })));
  return src.length;
}

// ---------- Exportar / importar ----------

export interface Backup {
  app: 'macrotrack';
  version: 1;
  exportedAt: string;
  foods: Food[];
  entries: Entry[];
  tags: { name: string; createdAt: number }[];
  settings: Settings | undefined;
}

export async function exportAll(): Promise<Backup> {
  const [foods, entries, tags, settings] = await Promise.all([
    db.foods.toArray(),
    db.entries.toArray(),
    db.tags.toArray(),
    db.settings.get('app'),
  ]);
  // La clave de USDA no se incluye en el respaldo.
  return {
    app: 'macrotrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    foods,
    entries,
    tags,
    settings: settings ? { ...settings, usdaApiKey: '' } : undefined,
  };
}

export async function importAll(data: Backup, mode: 'merge' | 'replace') {
  if (!data || data.app !== 'macrotrack' || !Array.isArray(data.foods) || !Array.isArray(data.entries)) {
    throw new Error('El archivo no es un respaldo válido de MacroTrack.');
  }
  await db.transaction('rw', db.foods, db.entries, db.tags, db.settings, async () => {
    if (mode === 'replace') {
      await Promise.all([db.foods.clear(), db.entries.clear(), db.tags.clear()]);
    }
    await db.foods.bulkPut(data.foods);
    await db.entries.bulkPut(data.entries);
    await db.tags.bulkPut(data.tags || []);
    if (data.settings) {
      const cur = await getSettings();
      await db.settings.put({ ...cur, ...data.settings, id: 'app', usdaApiKey: cur.usdaApiKey });
    }
  });
}

export async function wipeAll() {
  await db.transaction('rw', db.foods, db.entries, db.tags, db.settings, async () => {
    await Promise.all([db.foods.clear(), db.entries.clear(), db.tags.clear(), db.settings.clear()]);
  });
}
