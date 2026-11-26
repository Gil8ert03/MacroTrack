import type { BaseUnit, Entry, Measure, Nutrients } from '../types';

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
export const OZ_IN_G = 28.349523125;
export const KJ_PER_KCAL = 4.184;

type Per = Nutrients & { baseAmount: number };

/** Nutrientes para `baseQty` unidades base. Sin redondeo: se redondea solo al mostrar. */
export function scale(food: Per, baseQty: number): Nutrients {
  const f = food.baseAmount > 0 ? baseQty / food.baseAmount : 0;
  return {
    kcal: food.kcal * f,
    protein: food.protein * f,
    carbs: food.carbs * f,
    fat: food.fat * f,
  };
}

export const entryNutrients = (e: Entry): Nutrients => scale(e.food, e.baseQty);

export function sum(list: Nutrients[]): Nutrients {
  return list.reduce(
    (a, n) => ({ kcal: a.kcal + n.kcal, protein: a.protein + n.protein, carbs: a.carbs + n.carbs, fat: a.fat + n.fat }),
    { ...ZERO },
  );
}

export const totalOf = (entries: Entry[]) => sum(entries.map(entryNutrients));

export interface UnitOption {
  label: string;
  /** Cuántas unidades base vale 1 de esta opción. */
  factor: number;
}

/** Opciones de unidad disponibles para registrar un alimento. */
export function unitOptions(baseUnit: BaseUnit, measures: Measure[]): UnitOption[] {
  const opts: UnitOption[] = [{ label: baseUnit, factor: 1 }];
  if (baseUnit === 'g') opts.push({ label: 'oz', factor: OZ_IN_G });
  if (baseUnit === 'ml') {
    opts.push({ label: 'taza (240 ml)', factor: 240 }, { label: 'cda (15 ml)', factor: 15 }, { label: 'cdita (5 ml)', factor: 5 });
  }
  for (const m of measures) {
    if (m.amount > 0 && m.label.trim()) opts.push({ label: m.label.trim(), factor: m.amount });
  }
  // sin duplicados por etiqueta
  return opts.filter((o, i) => opts.findIndex((x) => x.label === o.label) === i);
}

/** Proporción (0–∞) consumida respecto a la meta; null si no hay meta. */
export const ratio = (value: number, goal: number) => (goal > 0 ? value / goal : null);

/** kcal aportadas por macros (4/4/9) — útil para comparar metas. */
export const kcalFromMacros = (n: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>) => n.protein * 4 + n.carbs * 4 + n.fat * 9;
