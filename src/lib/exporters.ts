import { exportAll } from './repo';
import { entryNutrients } from './nutrition';
import { mealLabel } from '../types';
import { db } from '../db';

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function downloadBackup() {
  const data = await exportAll();
  download(`macrotrack-respaldo-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
  return data.entries.length;
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function downloadCsv() {
  const entries = await db.entries.orderBy('date').toArray();
  const head = ['fecha', 'comida', 'alimento', 'marca', 'cantidad', 'unidad', 'cantidad_base', 'unidad_base', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasas_g'];
  const rows = entries.map((e) => {
    const n = entryNutrients(e);
    return [e.date, mealLabel(e.meal), e.food.name, e.food.brand, e.quantity, e.unitLabel, e.baseQty, e.food.baseUnit, n.kcal.toFixed(1), n.protein.toFixed(2), n.carbs.toFixed(2), n.fat.toFixed(2)];
  });
  const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  download(`macrotrack-registros-${stamp()}.csv`, csv, 'text/csv;charset=utf-8');
  return entries.length;
}
