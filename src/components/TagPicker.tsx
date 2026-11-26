import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { allTags } from '../lib/repo';
import { cleanTag, norm } from '../lib/text';
import { Icon } from './Icon';

const SUGGESTED = ['Desayuno', 'Cena', 'Colación', 'Alto en proteína', 'Casero'];

/** Selector de etiquetas libres: elige existentes o crea nuevas. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState('');
  const existing = useLiveQuery(allTags, []) ?? [];
  const pool = [...new Set([...existing, ...SUGGESTED])];
  const available = pool.filter((t) => !value.includes(t) && (!text || norm(t).includes(norm(text))));

  const add = (t: string) => {
    const c = cleanTag(t);
    if (!c) return;
    const dup = value.find((v) => norm(v) === norm(c));
    if (!dup) {
      // reutiliza la forma ya existente si coincide sin acentos/mayúsculas
      const same = existing.find((x) => norm(x) === norm(c));
      onChange([...value, same ?? c]);
    }
    setText('');
  };

  return (
    <div className="tagpicker">
      <div className="chips wrap">
        {value.map((t) => (
          <button type="button" key={t} className="chip on removable" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Quitar etiqueta ${t}`}>
            #{t} <Icon name="x" size={13} />
          </button>
        ))}
      </div>
      <div className="tag-input">
        <Icon name="tag" size={16} />
        <input
          type="text"
          value={text}
          placeholder="Escribe una etiqueta y toca Enter"
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            }
          }}
          aria-label="Nueva etiqueta"
        />
        {text.trim() && (
          <button type="button" className="chip chip-accent sm" onClick={() => add(text)}>
            Crear
          </button>
        )}
      </div>
      {available.length > 0 && (
        <div className="chips wrap">
          {available.slice(0, 14).map((t) => (
            <button type="button" key={t} className="chip sm ghost" onClick={() => add(t)}>
              + {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
