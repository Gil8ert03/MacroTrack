import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../state';
import { MEALS, type Food, type MealKey } from '../types';
import { matches } from '../lib/text';
import { toggleFavorite } from '../lib/repo';
import { searchOFF, lookupBarcode, isBarcode } from '../api/openFoodFacts';
import { searchUSDA, resolveUsdaKey } from '../api/usda';
import type { SearchResult } from '../api/types';
import { Sheet } from '../components/Sheet';
import { FoodRow } from '../components/FoodRow';
import { Icon } from '../components/Icon';
import { longDate, relativeLabel } from '../lib/dates';

type Filter = 'all' | 'fav' | 'mine';
interface Remote {
  status: 'idle' | 'loading' | 'done' | 'error';
  results: SearchResult[];
  error?: string;
}
const IDLE: Remote = { status: 'idle', results: [] };

export const sortLocal = (a: Food, b: Food) =>
  b.favorite - a.favorite || (b.useCount || 0) - (a.useCount || 0) || (b.lastUsed || 0) - (a.lastUsed || 0) || a.name.localeCompare(b.name);

export function AddFood({ date, meal: initialMeal, z }: { date: string; meal: MealKey; z: number }) {
  const { openSheet, closeSheet, settings } = useApp();
  const [meal, setMeal] = useState<MealKey>(initialMeal);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [off, setOff] = useState<Remote>(IDLE);
  const [usda, setUsda] = useState<Remote>(IDLE);
  const [searched, setSearched] = useState('');
  const abort = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];

  const local = useMemo(() => {
    let list = foods.filter((f) => matches(q, f.name, f.brand, f.tags.join(' ')));
    if (filter === 'fav') list = list.filter((f) => f.favorite);
    if (filter === 'mine') list = list.filter((f) => f.source === 'custom');
    return list.sort(sortLocal);
  }, [foods, q, filter]);

  const mine = local.filter((f) => f.source === 'custom');
  const saved = local.filter((f) => f.source !== 'custom');
  const savedKeys = useMemo(() => new Set(foods.map((f) => `${f.source}:${f.sourceId}`)), [foods]);
  const fresh = (rs: SearchResult[]) => rs.filter((r) => !savedKeys.has(`${r.draft.source}:${r.draft.sourceId}`));

  useEffect(() => () => abort.current?.abort(), []);

  const runRemote = async (raw: string) => {
    const query = raw.trim();
    if (query.length < 2) return;
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setSearched(query);
    inputRef.current?.blur();

    if (isBarcode(query)) {
      setUsda(IDLE);
      setOff({ status: 'loading', results: [] });
      try {
        const r = await lookupBarcode(query, ctrl.signal);
        if (!ctrl.signal.aborted) setOff({ status: 'done', results: r ? [r] : [] });
      } catch (e: any) {
        if (!ctrl.signal.aborted) setOff({ status: 'error', results: [], error: e.message });
      }
      return;
    }

    setOff({ status: 'loading', results: [] });
    setUsda({ status: 'loading', results: [] });
    const { key } = resolveUsdaKey(settings.usdaApiKey);
    const go = async (fn: () => Promise<SearchResult[]>, set: (r: Remote) => void) => {
      try {
        const results = await fn();
        if (!ctrl.signal.aborted) set({ status: 'done', results });
      } catch (e: any) {
        if (!ctrl.signal.aborted) set({ status: 'error', results: [], error: e?.message || 'Error desconocido' });
      }
    };
    await Promise.all([
      go(() => searchOFF(query, ctrl.signal), setOff),
      go(() => searchUSDA(query, key, ctrl.signal), setUsda),
    ]);
  };

  // Al cambiar el texto, los resultados externos anteriores dejan de corresponder.
  useEffect(() => {
    if (q.trim() !== searched) {
      abort.current?.abort();
      setOff(IDLE);
      setUsda(IDLE);
      setSearched('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pick = (food: Food | SearchResult) => {
    if ('draft' in food) {
      if (food.incomplete) {
        openSheet({
          type: 'foodForm',
          prefill: { ...food.draft, source: 'custom', sourceId: '' },
          note: 'La fuente no trae todos los valores nutricionales. Complétalos con la etiqueta del producto y se guardará como alimento propio.',
          next: (f) => ({ type: 'amount', food: f, date, meal, closeAddOnSave: true }),
        });
        return;
      }
      openSheet({ type: 'amount', food: food.draft, date, meal, closeAddOnSave: true });
    } else {
      openSheet({ type: 'amount', food, date, meal, closeAddOnSave: true });
    }
  };

  const createNew = () =>
    openSheet({
      type: 'foodForm',
      prefill: { name: isBarcode(q) ? '' : q.trim(), category: meal },
      next: (f) => ({ type: 'amount', food: f, date, meal, closeAddOnSave: true }),
    });

  const scan = () =>
    openSheet({
      type: 'scanner',
      onCode: (code) => {
        setQ(code);
        setTimeout(() => runRemote(code), 0);
      },
    });

  const hasQuery = q.trim().length > 0;
  const recent = !hasQuery ? [...foods].filter((f) => f.lastUsed && !f.favorite).sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 12) : [];
  const favs = !hasQuery ? foods.filter((f) => f.favorite).sort(sortLocal) : [];
  const canBarcode = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  const rel = relativeLabel(date);

  const remoteSection = (title: string, r: Remote, extra?: React.ReactNode) => {
    if (r.status === 'idle') return null;
    const list = fresh(r.results);
    return (
      <section className="results-sec">
        <h3 className="results-title">
          <Icon name="globe" size={15} /> {title}
          {r.status === 'done' && <span className="count">{list.length}</span>}
        </h3>
        {r.status === 'loading' && (
          <div className="loading-row">
            <span className="spinner" /> Buscando…
          </div>
        )}
        {r.status === 'error' && (
          <div className="error-row">
            <Icon name="alert" size={16} /> {r.error}
            <button className="link-btn" onClick={() => runRemote(searched || q)}>
              Reintentar
            </button>
          </div>
        )}
        {r.status === 'done' && list.length === 0 && <div className="empty-row">Sin resultados nuevos.</div>}
        {list.map((res) => (
          <FoodRow key={res.draft.source + res.draft.sourceId} food={res.draft} note={res.note} incomplete={res.incomplete} onClick={() => pick(res)} />
        ))}
        {extra}
      </section>
    );
  };

  const usdaDemo = resolveUsdaKey(settings.usdaApiKey).isDemo;

  return (
    <Sheet title="Agregar alimento" onClose={closeSheet} full z={z}>
      <div className="add-top">
        <div className="add-meta">
          <label className="meal-select">
            <span>Agregar a</span>
            <select value={meal} onChange={(e) => setMeal(e.target.value as MealKey)} aria-label="Comida">
              {MEALS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <Icon name="down" size={14} />
          </label>
          <span className="add-date">{rel ?? longDate(date)}</span>
        </div>
        <form
          className="searchbar"
          onSubmit={(e) => {
            e.preventDefault();
            runRemote(q);
          }}
          role="search"
        >
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Buscar alimento, marca o código de barras"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          {q && (
            <button type="button" className="icon-btn sm" onClick={() => setQ('')} aria-label="Borrar búsqueda">
              <Icon name="x" size={18} />
            </button>
          )}
          {canBarcode && (
            <button type="button" className="icon-btn sm" onClick={scan} aria-label="Escanear código de barras">
              <Icon name="barcode" size={20} />
            </button>
          )}
        </form>
        <div className="chips">
          {(
            [
              ['all', 'Todos'],
              ['fav', 'Favoritos'],
              ['mine', 'Míos'],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
          <button className="chip chip-accent" onClick={createNew}>
            <Icon name="plus" size={14} /> Crear alimento
          </button>
        </div>
      </div>

      <div className="add-results">
        {!hasQuery && (
          <>
            {favs.length > 0 && filter !== 'mine' && (
              <section className="results-sec">
                <h3 className="results-title">
                  <Icon name="star" size={15} /> Favoritos
                </h3>
                {favs.map((f) => (
                  <FoodRow key={f.id} food={f} onClick={() => pick(f)} onStar={() => toggleFavorite(f)} />
                ))}
              </section>
            )}
            {filter === 'all' && recent.length > 0 && (
              <section className="results-sec">
                <h3 className="results-title">
                  <Icon name="calendar" size={15} /> Recientes
                </h3>
                {recent.map((f) => (
                  <FoodRow key={f.id} food={f} onClick={() => pick(f)} onStar={() => toggleFavorite(f)} />
                ))}
              </section>
            )}
            {filter === 'mine' && (
              <section className="results-sec">
                {mine.map((f) => (
                  <FoodRow key={f.id} food={f} onClick={() => pick(f)} onStar={() => toggleFavorite(f)} />
                ))}
                {mine.length === 0 && <div className="empty-row">Aún no has creado alimentos propios.</div>}
              </section>
            )}
            {foods.length === 0 && (
              <div className="empty-state">
                <div className="empty-ico">
                  <Icon name="search" size={28} />
                </div>
                <h3>Busca tu primer alimento</h3>
                <p>
                  Escribe un nombre y toca <b>Buscar</b> en el teclado para consultar Open Food Facts y USDA, o crea un alimento propio.
                </p>
              </div>
            )}
            {foods.length > 0 && favs.length === 0 && recent.length === 0 && filter !== 'mine' && (
              <div className="empty-row">Tus alimentos frecuentes y favoritos aparecerán aquí.</div>
            )}
          </>
        )}

        {hasQuery && (
          <>
            {mine.length > 0 && (
              <section className="results-sec">
                <h3 className="results-title">
                  <Icon name="user" size={15} /> Mis alimentos <span className="count">{mine.length}</span>
                </h3>
                {mine.map((f) => (
                  <FoodRow key={f.id} food={f} onClick={() => pick(f)} onStar={() => toggleFavorite(f)} />
                ))}
              </section>
            )}
            {saved.length > 0 && (
              <section className="results-sec">
                <h3 className="results-title">
                  <Icon name="star" size={15} /> Favoritos y frecuentes <span className="count">{saved.length}</span>
                </h3>
                {saved.map((f) => (
                  <FoodRow key={f.id} food={f} onClick={() => pick(f)} onStar={() => toggleFavorite(f)} />
                ))}
              </section>
            )}
            {mine.length === 0 && saved.length === 0 && filter !== 'all' && <div className="empty-row">Sin coincidencias en tus alimentos.</div>}

            {filter === 'all' && off.status === 'idle' && usda.status === 'idle' && (
              <button className="online-btn" onClick={() => runRemote(q)} disabled={q.trim().length < 2}>
                <Icon name="globe" size={18} />
                <span>
                  {isBarcode(q) ? 'Buscar código de barras' : 'Buscar en bases de datos'}
                  <small>{isBarcode(q) ? 'Open Food Facts' : 'Open Food Facts y USDA'}</small>
                </span>
                <Icon name="right" size={18} />
              </button>
            )}
            {filter === 'all' && remoteSection('Open Food Facts · productos', off)}
            {filter === 'all' &&
              remoteSection(
                'USDA · alimentos genéricos',
                usda,
                usda.status !== 'idle' && (
                  <p className="fine">
                    USDA usa nombres en inglés (p. ej. “chicken breast”, “rice cooked”).
                    {usdaDemo && ' Estás usando la clave de demostración, que permite pocas búsquedas por hora; agrega tu clave gratuita en Ajustes.'}
                  </p>
                ),
              )}
            {filter === 'all' && (off.status === 'done' || off.status === 'error') && (
              <button className="create-cta" onClick={createNew}>
                ¿No lo encuentras? <b>Crear “{q.trim()}”</b>
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

