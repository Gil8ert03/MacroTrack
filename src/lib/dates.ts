const pad = (n: number) => String(n).padStart(2, '0');

export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12); // mediodía: evita saltos por horario de verano
};

export const todayKey = () => toKey(new Date());

export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** Lunes de la semana de la fecha dada. */
export const weekStart = (k: string) => {
  const d = fromKey(k);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  return addDays(k, -dow);
};

export const weekDays = (k: string) => {
  const s = weekStart(k);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function relativeLabel(k: string): string | null {
  const t = todayKey();
  if (k === t) return 'Hoy';
  if (k === addDays(t, -1)) return 'Ayer';
  if (k === addDays(t, 1)) return 'Mañana';
  return null;
}

export const longDate = (k: string) =>
  cap(fromKey(k).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }));

export const shortDate = (k: string) =>
  fromKey(k).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace('.', '');

export const weekdayInitial = (k: string) =>
  cap(fromKey(k).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')).slice(0, 3);

/** Comida sugerida según la hora actual. */
export function mealForNow(): import('../types').MealKey {
  const h = new Date().getHours();
  if (h < 11) return 'desayuno';
  if (h < 13) return 'colacion_am';
  if (h < 17) return 'comida';
  if (h < 19) return 'colacion_pm';
  if (h < 23) return 'cena';
  return 'otros';
}
