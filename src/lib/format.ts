import { KJ_PER_KCAL } from './nutrition';

const nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** Redondeo solo para presentación. */
export const fmt0 = (n: number) => nf0.format(Math.round(n) === 0 ? 0 : n);
export const fmt1 = (n: number) => nf1.format(Math.abs(n) < 0.05 ? 0 : n);
export const fmt2 = (n: number) => nf2.format(n);

export type EnergyUnit = 'kcal' | 'kJ';
export const energyValue = (kcal: number, u: EnergyUnit) => (u === 'kJ' ? kcal * KJ_PER_KCAL : kcal);
export const fmtEnergy = (kcal: number, u: EnergyUnit) => fmt0(energyValue(kcal, u));

/** Gramos con 1 decimal si < 10, si no entero. */
export const fmtG = (g: number) => (Math.abs(g) < 10 ? fmt1(g) : fmt0(g));

/** Interpreta números escritos con coma o punto decimal. */
export function parseNum(s: string): number {
  const v = parseFloat(String(s).replace(',', '.').trim());
  return Number.isFinite(v) ? v : NaN;
}
