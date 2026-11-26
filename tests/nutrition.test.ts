import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { scale, sum, unitOptions, totalOf } from '../src/lib/nutrition';
import { mapProduct } from '../src/api/openFoodFacts';
import { mapFood } from '../src/api/usda';
import { db } from '../src/db';
import { logFood, upsertFood, updateEntry, deleteTag, copyMeal, exportAll, importAll, wipeAll } from '../src/lib/repo';
import { addDays, weekStart } from '../src/lib/dates';

const food100 = { baseAmount: 100, kcal: 200, protein: 10, carbs: 20, fat: 5 };

describe('cálculos', () => {
  it('escala por 100 g (ejemplo de la especificación)', () => {
    expect(scale(food100, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
  });
  it('no redondea internamente', () => {
    const n = scale({ baseAmount: 30, kcal: 113, protein: 3.3, carbs: 21.7, fat: 1.9 }, 45);
    expect(n.kcal).toBeCloseTo(169.5, 10);
    expect(n.fat).toBeCloseTo(2.85, 10);
  });
  it('base por unidad', () => {
    expect(scale({ baseAmount: 1, kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 }, 3).kcal).toBe(216);
  });
  it('suma', () => {
    expect(sum([scale(food100, 50), scale(food100, 50)])).toEqual(scale(food100, 100));
  });
  it('opciones de unidad incluyen medidas y oz', () => {
    const o = unitOptions('g', [{ label: '1 taza', amount: 245 }]);
    expect(o.map((x) => x.label)).toEqual(['g', 'oz', '1 taza']);
  });
});

describe('fechas', () => {
  it('semana empieza en lunes', () => {
    expect(weekStart('2026-11-26')).toBe('2026-11-23');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('mapeo de APIs', () => {
  it('OFF con datos por 100 g', () => {
    const r = mapProduct({ code: '123', product_name: 'Yogurt griego', brands: 'Chobani,Otra', quantity: '907 g', serving_quantity: 170, serving_size: '170 g', nutriments: { 'energy-kcal_100g': 59, proteins_100g: 10, carbohydrates_100g: 3.6, fat_100g: 0.4 } })!;
    expect(r.incomplete).toBe(false);
    expect(r.draft).toMatchObject({ brand: 'Chobani', baseAmount: 100, baseUnit: 'g', kcal: 59 });
    expect(r.draft.measures[0].amount).toBe(170);
  });
  it('OFF sin macros se marca incompleto (no inventa valores)', () => {
    const r = mapProduct({ code: '1', product_name: 'X', nutriments: { 'energy-kcal_100g': 100 } })!;
    expect(r.incomplete).toBe(true);
  });
  it('OFF bebidas en ml', () => {
    const r = mapProduct({ code: '2', product_name: 'Leche', quantity: '1 L', nutriments: { 'energy-kcal_100g': 42, proteins_100g: 3.4, carbohydrates_100g: 5, fat_100g: 1 } })!;
    expect(r.draft.baseUnit).toBe('ml');
  });
  it('USDA: energía Atwater en Foundation', () => {
    const r = mapFood({ fdcId: 9, description: 'CHICKEN BREAST', dataType: 'Foundation', foodNutrients: [
      { nutrientNumber: '203', value: 22.5, unitName: 'G' }, { nutrientNumber: '204', value: 1.9, unitName: 'G' },
      { nutrientNumber: '205', value: 0, unitName: 'G' }, { nutrientNumber: '957', value: 106, unitName: 'KCAL' },
    ] })!;
    expect(r.incomplete).toBe(false);
    expect(r.draft).toMatchObject({ name: 'Chicken breast', kcal: 106, protein: 22.5 });
  });
  it('USDA: ignora energía en kJ', () => {
    const r = mapFood({ fdcId: 1, description: 'x', foodNutrients: [{ nutrientNumber: '208', value: 400, unitName: 'kJ' }] })!;
    expect(r.incomplete).toBe(true);
  });
});

describe('almacenamiento', () => {
  beforeEach(() => wipeAll());

  it('registra, edita y totaliza', async () => {
    const f = await upsertFood({ source: 'custom', sourceId: '', name: 'Avena', brand: '', baseAmount: 100, baseUnit: 'g', kcal: 380, protein: 13, carbs: 67, fat: 7, measures: [], tags: ['Desayuno'], favorite: 1, category: '' });
    const e = await logFood({ food: f, date: '2026-11-26', meal: 'desayuno', quantity: 40, unitLabel: 'g', baseQty: 40 });
    let list = await db.entries.where('date').equals('2026-11-26').toArray();
    expect(totalOf(list).kcal).toBeCloseTo(152);
    await updateEntry(e.id, { quantity: 60, baseQty: 60, meal: 'cena' });
    list = await db.entries.toArray();
    expect(list[0].meal).toBe('cena');
    expect(totalOf(list).protein).toBeCloseTo(7.8);
    expect((await db.foods.get(f.id))!.useCount).toBe(1);
  });

  it('deduplica alimentos externos y conserva etiquetas del usuario', async () => {
    const draft = { source: 'off' as const, sourceId: '750', name: 'Yogurt', brand: 'Kirkland', baseAmount: 100, baseUnit: 'g' as const, kcal: 60, protein: 10, carbs: 4, fat: 0, measures: [], tags: [], favorite: 0 as const, category: '' as const };
    await logFood({ food: draft, date: '2026-11-26', meal: 'desayuno', quantity: 100, unitLabel: 'g', baseQty: 100 });
    const saved = (await db.foods.toArray())[0];
    await upsertFood({ ...saved, tags: ['Kirkland'] });
    await logFood({ food: draft, date: '2026-11-26', meal: 'cena', quantity: 50, unitLabel: 'g', baseQty: 50 });
    const foods = await db.foods.toArray();
    expect(foods).toHaveLength(1);
    expect(foods[0].tags).toEqual(['Kirkland']);
    expect(foods[0].useCount).toBe(2);
  });

  it('borrar etiqueta la quita de los alimentos', async () => {
    const f = await upsertFood({ source: 'custom', sourceId: '', name: 'A', brand: '', baseAmount: 100, baseUnit: 'g', kcal: 1, protein: 1, carbs: 1, fat: 1, measures: [], tags: ['x', 'y'], favorite: 0, category: '' });
    await deleteTag('x');
    expect((await db.foods.get(f.id))!.tags).toEqual(['y']);
    expect(await db.tags.get('x')).toBeUndefined();
  });

  it('copia comida y respaldo ida y vuelta', async () => {
    const f = await upsertFood({ source: 'custom', sourceId: '', name: 'A', brand: '', baseAmount: 1, baseUnit: 'unidad', kcal: 70, protein: 6, carbs: 0, fat: 5, measures: [], tags: [], favorite: 0, category: '' });
    await logFood({ food: f, date: '2026-11-25', meal: 'desayuno', quantity: 2, unitLabel: 'unidad', baseQty: 2 });
    expect(await copyMeal('2026-11-25', 'desayuno', '2026-11-26')).toBe(1);
    const backup = await exportAll();
    await wipeAll();
    await importAll(JSON.parse(JSON.stringify(backup)), 'replace');
    expect(await db.entries.count()).toBe(2);
  });
});
