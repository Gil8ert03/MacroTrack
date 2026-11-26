import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../state';
import { matches, norm } from '../lib/text';
import { allTags, toggleFavorite } from '../lib/repo';
import { mealForNow } from '../lib/dates';
import { FoodRow } from '../components/FoodRow';
import { Icon } from '../components/Icon';
import { sortLocal } from './AddFood';

type View = 'all' | 'fav' | 'mine' | 'freq';

export function Foods() {
  const { openSheet, homeDate } = useApp();
  const foods = useLiveQuery(() => db.foods.toArray(), []);
  const tags = useLiveQuery(allTags, []) ?? [];
  const [q, setQ] = useState('');
  const [view, setView] = useState<View>('all');
  const [tagSel, setTagSel] = useState<string[]>([]);

  const list = useMemo(() => {
    let l = (foods ?? []).filter((f) => matches(q, f.name, f.brand, f.tags.join(' ')));
    if (view === 'fav') l = l.filter((f) => f.favorite);
    if (view === 'mine') l = l.filter((f) => f.source === 'custom');
    if (view === 'freq') l = l.filter((f) => f.useCount > 0);
    if (tagSel.length) l = l.filter((f) => tagSel.every((t) => f.tags.includes(t)));
    if (view === 'freq') return l.sort((a, b) => b.useCount - a.useCount);
    return l.sort((a, b) => (view === 'all' ? norm(a.name).localeCompare(norm(b.name)) : sortLocal(a, b)));
  }, [foods, q, view, tagSel]);

  const toggleTag = (t: string) => setTagSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <div className="screen">
      <header className="top">
        <h1>Alimentos</h1>
        <button className="btn btn-primary sm" onClick={() => openSheet({ type: 'foodForm' })}>
          <Icon name="plus" size={16} /> Nuevo
        </button>
      </header>

      <div className="searchbar">
        <Icon name="search" size={19} />
        <input type="search" placeholder="Buscar en mis alimentos" value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" aria-label="Buscar en mis alimentos" />
        {q && (
          <button className="icon-btn sm" onClick={() => setQ('')} aria-label="Borrar búsqueda">
            <Icon name="x" size={18} />
          </button>
        )}
      </div>

      <div className="seg seg-full">
        {(
          [
            ['all', 'Todos'],
            ['fav', 'Favoritos'],
            ['mine', 'Propios'],
            ['freq', 'Frecuentes'],
          ] as [View, string][]
        ).map(([k, l]) => (
          <button key={k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
            {l}
          </button>
        ))}
      </div>

      <div className="tag-filter">
        <div className="chips scroll">
          {tags.map((t) => (
            <button key={t} className={`chip sm ${tagSel.includes(t) ? 'on' : ''}`} onClick={() => toggleTag(t)}>
              #{t}
            </button>
          ))}
          {tags.length === 0 && <span className="fine">Sin etiquetas aún</span>}
        </div>
        <button className="icon-btn sm" onClick={() => openSheet({ type: 'tags' })} aria-label="Gestionar etiquetas">
          <Icon name="tag" size={18} />
        </button>
      </div>
      {tagSel.length > 0 && (
        <button className="link-btn" onClick={() => setTagSel([])}>
          Quitar filtros de etiqueta ({tagSel.length})
        </button>
      )}

      <div className="card list-card">
        {list.map((f) => (
          <FoodRow
            key={f.id}
            food={f}
            onClick={() => openSheet({ type: 'foodForm', food: f })}
            onStar={() => toggleFavorite(f)}
            trailing={
              <button
                className="add-btn sm"
                onClick={() => openSheet({ type: 'amount', food: f, date: homeDate, meal: (f.category || mealForNow()) as any })}
                aria-label={`Registrar ${f.name}`}
              >
                <Icon name="plus" size={18} />
              </button>
            }
          />
        ))}
        {foods && list.length === 0 && (
          <div className="empty-state">
            <div className="empty-ico">
              <Icon name="book" size={28} />
            </div>
            {foods.length === 0 ? (
              <>
                <h3>Tu biblioteca está vacía</h3>
                <p>Los alimentos que crees o registres desde las búsquedas se guardan aquí para reutilizarlos.</p>
                <button className="btn btn-primary" onClick={() => openSheet({ type: 'foodForm' })}>
                  Crear alimento
                </button>
              </>
            ) : (
              <>
                <h3>Sin coincidencias</h3>
                <p>Prueba con otro texto, vista o etiqueta.</p>
              </>
            )}
          </div>
        )}
      </div>
      {foods && foods.length > 0 && <p className="fine center">{foods.length} alimentos guardados</p>}
    </div>
  );
}
