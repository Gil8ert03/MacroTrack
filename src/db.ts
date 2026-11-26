import Dexie, { type Table } from 'dexie';
import type { Entry, Food, Settings, Tag } from './types';

export class MacroDB extends Dexie {
  foods!: Table<Food, string>;
  entries!: Table<Entry, string>;
  tags!: Table<Tag, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('macrotrack');
    this.version(1).stores({
      foods: 'id, [source+sourceId], name, favorite, *tags, useCount, lastUsed, updatedAt',
      entries: 'id, date, foodId, [date+meal]',
      tags: 'name',
      settings: 'id',
    });
  }
}

export const db = new MacroDB();

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/** Pide al navegador que no borre los datos por falta de espacio. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* sin soporte */
  }
  return false;
}
