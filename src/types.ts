export type MealKey = 'desayuno' | 'colacion_am' | 'comida' | 'colacion_pm' | 'cena' | 'otros';

export const MEALS: { key: MealKey; label: string; icon: string }[] = [
  { key: 'desayuno', label: 'Desayuno', icon: 'sunrise' },
  { key: 'colacion_am', label: 'Colación matutina', icon: 'apple' },
  { key: 'comida', label: 'Comida', icon: 'sun' },
  { key: 'colacion_pm', label: 'Colación vespertina', icon: 'cookie' },
  { key: 'cena', label: 'Cena', icon: 'moon' },
  { key: 'otros', label: 'Otros', icon: 'dots' },
];

export const mealLabel = (k: MealKey) => MEALS.find((m) => m.key === k)?.label ?? k;

/** Unidad en la que se expresan los valores nutricionales de referencia. */
export type BaseUnit = 'g' | 'ml' | 'unidad' | 'porción';
export const BASE_UNITS: BaseUnit[] = ['g', 'ml', 'unidad', 'porción'];

export type FoodSource = 'custom' | 'off' | 'usda';

/** Valores nutricionales por cada `baseAmount` `baseUnit` (p. ej. por 100 g). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Medida personalizada: "1 taza" equivale a `amount` unidades base. */
export interface Measure {
  label: string;
  amount: number;
}

export interface Food extends Nutrients {
  id: string;
  source: FoodSource;
  /** Código de barras (OFF) o fdcId (USDA). Vacío para alimentos propios. */
  sourceId: string;
  name: string;
  brand: string;
  baseAmount: number;
  baseUnit: BaseUnit;
  measures: Measure[];
  tags: string[];
  favorite: 0 | 1;
  /** Categoría de comida sugerida (opcional). */
  category: MealKey | '';
  useCount: number;
  lastUsed: number;
  createdAt: number;
  updatedAt: number;
}

/** Alimento en memoria (p. ej. resultado de búsqueda externa) que aún no se guarda. */
export type FoodDraft = Omit<Food, 'id' | 'useCount' | 'lastUsed' | 'createdAt' | 'updatedAt'> & { id?: string };

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD (fecha local)
  meal: MealKey;
  foodId: string;
  /** Copia del alimento al registrar, para que el historial no cambie si se edita o borra el alimento. */
  food: Pick<Food, 'name' | 'brand' | 'baseAmount' | 'baseUnit' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'measures' | 'source'>;
  quantity: number;
  /** Etiqueta de la unidad elegida: la unidad base o la etiqueta de una medida. */
  unitLabel: string;
  /** Cantidad equivalente en unidades base (p. ej. gramos). */
  baseQty: number;
  createdAt: number;
}

export interface Goals extends Nutrients {}

export interface Settings {
  id: 'app';
  goals: Goals;
  theme: 'light' | 'dark' | 'system';
  energyUnit: 'kcal' | 'kJ';
  weightUnit: 'g' | 'oz';
  usdaApiKey: string;
}

export interface Tag {
  name: string;
  createdAt: number;
}
