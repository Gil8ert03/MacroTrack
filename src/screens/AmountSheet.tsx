import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../state';
import { MEALS, mealLabel, type Entry, type Food, type FoodDraft, type MealKey } from '../types';
import { scale, unitOptions } from '../lib/nutrition';
import { fmt2, fmtEnergy, fmtG, parseNum } from '../lib/format';
import { deleteEntry, logFood, toggleFavorite, updateEntry } from '../lib/repo';
import { longDate, relativeLabel } from '../lib/dates';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { baseLabel } from '../components/FoodRow';
import { MACROS } from '../components/Summary';

const QUICK: Record<string, number[]> = {
  g: [30, 50, 100, 150, 200, 250],
  ml: [100, 200, 250, 355, 500],
  oz: [1, 2, 4, 6, 8],
};

export function AmountSheet({
  food,
  date,
  meal: initialMeal,
  entry,
  closeAddOnSave,
  z,
}: {
  food: Food | FoodDraft;
  date: string;
  meal: MealKey;
  entry?: Entry;
  closeAddOnSave?: boolean;
  z: number;
}) {
  const { settings, closeSheet, closeSheets, toast, openSheet } = useApp();
  // En modo edición se usan los valores guardados en el registro.
  const basis = entry ? entry.food : food;
  const options = useMemo(() => unitOptions(basis.baseUnit, basis.measures || []), [basis]);

  const defaultUnit = () => {
    if (entry) return options.find((o) => o.label === entry.unitLabel) ?? options[0];
    if (basis.baseUnit === 'g' && settings.weightUnit === 'oz') return options.find((o) => o.label === 'oz') ?? options[0];
    // Si hay una porción definida, se sugiere esa.
    const portion = options.find((o) => o.label.startsWith('porción'));
    return portion ?? options[0];
  };
  const [unit, setUnit] = useState(defaultUnit);
  const [qtyText, setQtyText] = useState(() => {
    if (entry) return String(entry.quantity);
    if (unit.label === 'oz') return '1';
    if (unit.factor === 1 && (basis.baseUnit === 'g' || basis.baseUnit === 'ml')) return String(basis.baseAmount || 100);
    return '1';
  });
  const [meal, setMeal] = useState<MealKey>(entry?.meal ?? initialMeal);
  const [busy, setBusy] = useState(false);

  const saved = useLiveQuery(async () => {
    const id = entry?.foodId ?? (food as FoodDraft).id;
    if (id) return db.foods.get(id);
    if (food.source !== 'custom' && food.sourceId) return db.foods.where('[source+sourceId]').equals([food.source, food.sourceId]).first();
    return undefined;
  }, [entry?.foodId, (food as FoodDraft).id, food.source, food.sourceId]);

  const qty = parseNum(qtyText);
  const valid = Number.isFinite(qty) && qty > 0;
  const baseQty = valid ? qty * unit.factor : 0;
  const n = scale(basis, baseQty);

  const step = (dir: 1 | -1) => {
    const cur = valid ? qty : 0;
    const inc = unit.factor === 1 && (basis.baseUnit === 'g' || basis.baseUnit === 'ml') ? (cur >= 100 ? 25 : 10) : unit.label === 'oz' ? 1 : 0.5;
    const next = Math.max(0, Math.round((cur + dir * inc) * 100) / 100);
    setQtyText(String(next));
  };

  const changeUnit = (label: string) => {
    const o = options.find((x) => x.label === label);
    if (!o) return;
    // Conserva la cantidad equivalente al cambiar de unidad.
    if (valid) setQtyText(String(Math.round(((qty * unit.factor) / o.factor) * 100) / 100));
    setUnit(o);
  };

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (entry) {
        await updateEntry(entry.id, { quantity: qty, unitLabel: unit.label, baseQty, meal });
        toast('Registro actualizado');
        closeSheet();
      } else {
        await logFood({ food: saved ?? food, date, meal, quantity: qty, unitLabel: unit.label, baseQty });
        toast(`${food.name} agregado a ${mealLabel(meal)}`);
        closeSheets(closeAddOnSave ? 2 : 1);
      }
    } catch (e: any) {
      toast(`No se pudo guardar: ${e?.message || e}`, { kind: 'error' });
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    await deleteEntry(entry.id);
    closeSheet();
    toast('Registro eliminado', {
      action: { label: 'Deshacer', run: () => db.entries.add(entry) },
    });
  };

  const quick = unit.factor === 1 ? QUICK[basis.baseUnit] : unit.label === 'oz' ? QUICK.oz : [0.5, 1, 1.5, 2, 3];
  const rel = relativeLabel(date);
  const u = settings.energyUnit;

  return (
    <Sheet
      title={entry ? 'Editar registro' : 'Cantidad'}
      onClose={closeSheet}
      z={z}
      headerExtra={
        saved && (
          <button className={`icon-btn star-btn ${saved.favorite ? 'on' : ''}`} onClick={() => toggleFavorite(saved)} aria-label="Favorito">
            <Icon name="star" fill={!!saved.favorite} />
          </button>
        )
      }
      footer={
        <div className="foot-row">
          {entry && (
            <button className="btn btn-danger-ghost" onClick={remove} aria-label="Eliminar registro">
              <Icon name="trash" size={20} />
            </button>
          )}
          <button className="btn btn-primary grow" onClick={submit} disabled={!valid || busy}>
            {entry ? 'Guardar cambios' : `Agregar a ${mealLabel(meal)}`}
          </button>
        </div>
      }
    >
      <div className="amount-food">
        <h3>{basis.name}</h3>
        <div className="muted">
          {basis.brand && <>{basis.brand} · </>}
          {fmtEnergy(basis.kcal, u)} {u} {baseLabel(basis)}
        </div>
        {saved && (
          <button className="link-btn" onClick={() => openSheet({ type: 'foodForm', food: saved })}>
            <Icon name="edit" size={14} /> Editar alimento y etiquetas
          </button>
        )}
      </div>

      <div className="qty-box">
        <button className="step-btn" onClick={() => step(-1)} aria-label="Menos">
          <Icon name="minus" />
        </button>
        <input
          className="qty-input"
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={qtyText}
          onChange={(e) => setQtyText(e.target.value.replace(/[^0-9.,]/g, ''))}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Cantidad"
        />
        <button className="step-btn" onClick={() => step(1)} aria-label="Más">
          <Icon name="plus" />
        </button>
      </div>
      {!valid && <p className="field-error center">Escribe una cantidad mayor que cero.</p>}

      <div className="label-sm">Unidad</div>
      <div className="chips wrap">
        {options.map((o) => (
          <button key={o.label} className={`chip ${unit.label === o.label ? 'on' : ''}`} onClick={() => changeUnit(o.label)}>
            {o.label}
            {o.factor !== 1 && o.label !== 'oz' && !o.label.includes('(') && (
              <small>
                {' '}
                ({fmt2(o.factor)} {basis.baseUnit})
              </small>
            )}
          </button>
        ))}
      </div>
      {quick && (
        <div className="chips wrap quick">
          {quick.map((v) => (
            <button key={v} className={`chip sm ${qty === v ? 'on' : ''}`} onClick={() => setQtyText(String(v))}>
              {fmt2(v)}
            </button>
          ))}
        </div>
      )}
      {unit.factor !== 1 && valid && (
        <p className="muted small">
          = {fmt2(baseQty)} {basis.baseUnit}
        </p>
      )}

      <div className="label-sm">Comida</div>
      <div className="chips wrap">
        {MEALS.map((m) => (
          <button key={m.key} className={`chip ${meal === m.key ? 'on' : ''}`} onClick={() => setMeal(m.key)}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="preview card-flat" aria-live="polite">
        <div className="preview-kcal">
          <span>{fmtEnergy(n.kcal, u)}</span>
          <small>{u}</small>
        </div>
        <div className="preview-macros">
          {MACROS.map((m) => (
            <div key={m.key} className="pm">
              <span className="dot" style={{ background: m.color }} />
              <span className="pm-l">{m.label}</span>
              <b>{fmtG(n[m.key])} g</b>
            </div>
          ))}
        </div>
        <div className="preview-foot">
          {rel ?? longDate(date)} · {mealLabel(meal)}
        </div>
      </div>
    </Sheet>
  );
}
