/** Minúsculas y sin acentos para comparar búsquedas. */
export const norm = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** Todas las palabras de la consulta aparecen en alguno de los campos. */
export function matches(query: string, ...fields: string[]): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = norm(fields.join(' '));
  return words.every((w) => hay.includes(w));
}

export const cleanTag = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 40);
