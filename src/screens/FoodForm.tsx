import { useState } from 'react';
import { useApp } from '../state';
import { BASE_UNITS, MEALS, type BaseUnit, type Food, type FoodDraft, type Measure, type MealKey } from '../types';
import { fmt0, parseNum } from '../lib/format';
import { deleteFood, upsertFood } from '../lib/repo';
import { kcalFromMacros } from '../lib/nutrition';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { TagPicker } from '../components/TagPicker';

type Num = string;
const s = (n: number | undefined) => (n === undefined || n === null || Number.isNaN(n) ? '' : String(Math.round(n * 1000) / 1000));

export function FoodForm({ food, prefill, note, next, z }: { food?: Food; prefill?: Partial<FoodDraft>; note?: string; next?: (f: Food) => any; z: number }) {
  const { closeSheet, replaceSheet, openSheet, toast } = useApp();
  const init = { ...prefill, ...food };
  const [name, setName] = useState(init.name ?? '');
  const [brand, setBrand] = useState(init.brand ?? '');
  const [baseAmount, setBaseAmount] = useState<Num>(s(init.baseAmount ?? 100));
  const [baseUnit, setBaseUnit] = useState<BaseUnit>(init.baseUnit ?? 'g');
  const [kcal, setKcal] = useState<Num>(s(init.kcal));
  const [protein, setProtein] = useState<Num>(s(init.protein));
  const [carbs, setCarbs] = useState<Num>(s(init.carbs));
  const [fat, setFat] = useState<Num>(s(init.fat));
  const [measures, setMeasures] = useState<{ label: string; amount: Num }[]>((init.measures ?? []).map((m) => ({ label: m.label, amount: s(m.amount) })));
  const [category, setCategory] = useState<MealKey | ''>(init.category ?? '');
  const [tags, setTags] = useState<string[]>(init.tags ?? []);
  const [favorite, setFavorite] = useState<boolean>(!!init.favorite);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const nums = {
    baseAmount: parseNum(baseAmount),
    kcal: parseNum(kcal),
    protein: parseNum(protein),
    carbs: parseNum(carbs),
    fat: parseNum(fat),
  };
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Escribe el nombre.';
  if (!(nums.baseAmount > 0)) errors.baseAmount = 'Debe ser mayor que 0.';
  (['kcal', 'protein', 'carbs', 'fat'] as const).forEach((k) => {
    if (!(nums[k] >= 0)) errors[k] = 'Requerido (0 o más).';
  });
  const valid = Object.keys(errors).length === 0;
  const macroKcal = valid ? kcalFromMacros(nums) : 0;

  const save = async () => {
    setTried(true);
    if (!valid || busy) return;
    setBusy(true);
    const ms: Measure[] = measures
      .map((m) => ({ label: m.label.trim(), amount: parseNum(m.amount) }))
      .filter((m) => m.label && m.amount > 0);
    const draft: FoodDraft = {
      id: food?.id,
      source: food?.source ?? prefill?.source ?? 'custom',
      sourceId: food?.sourceId ?? prefill?.sourceId ?? '',
      name,
      brand,
      baseAmount: nums.baseAmount,
      baseUnit,
      kcal: nums.kcal,
      protein: nums.protein,
      carbs: nums.carbs,
      fat: nums.fat,
      measures: ms,
      tags,
      favorite: favorite ? 1 : 0,
      category,
    };
    try {
      const saved = await upsertFood(draft);
      toast(food ? 'Alimento actualizado' : 'Alimento guardado');
      if (next) replaceSheet(next(saved));
      else closeSheet();
    } catch (e: any) {
      toast(`No se pudo guardar: ${e?.message || e}`, { kind: 'error' });
      setBusy(false);
    }
  };

  const remove = () =>
    food &&
    openSheet({
      type: 'confirm',
      title: `¿Eliminar “${food.name}”?`,
      message: 'Se quitará de tus alimentos. Los registros que ya hiciste con él se conservan en el historial.',
      confirmLabel: 'Eliminar',
      danger: true,
      closeCount: 2,
      onConfirm: async () => {
        await deleteFood(food.id);
        toast('Alimento eliminado');
      },
    });

  const err = (k: string) => tried && errors[k] && <span className="field-error">{errors[k]}</span>;
  const unitWord = baseUnit === 'g' || baseUnit === 'ml' ? baseUnit : baseUnit === 'unidad' ? 'unidad(es)' : 'porción(es)';

  return (
    <Sheet
      title={food ? 'Editar alimento' : 'Nuevo alimento'}
      onClose={closeSheet}
      full
      z={z}
      footer={
        <div className="foot-row">
          {food && (
            <button className="btn btn-danger-ghost" onClick={remove} aria-label="Eliminar alimento">
              <Icon name="trash" size={20} />
            </button>
          )}
          <button className="btn btn-primary grow" onClick={save} disabled={busy}>
            {next ? 'Guardar y continuar' : 'Guardar alimento'}
          </button>
        </div>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {note && (
          <div className="notice">
            <Icon name="info" size={16} /> {note}
          </div>
        )}
        <label className="field">
          <span>Nombre *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="p. ej. Yogurt griego natural" autoCapitalize="sentences" enterKeyHint="next" />
          {err('name')}
        </label>
        <label className="field">
          <span>Marca (opcional)</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="p. ej. Chobani" enterKeyHint="next" />
        </label>

        <fieldset className="field">
          <span>Valores nutricionales por</span>
          <div className="base-row">
            <input className="base-amt" inputMode="decimal" value={baseAmount} onChange={(e) => setBaseAmount(e.target.value)} aria-label="Cantidad de referencia" />
            <div className="seg">
              {BASE_UNITS.map((u) => (
                <button type="button" key={u} className={baseUnit === u ? 'on' : ''} onClick={() => setBaseUnit(u)}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div className="chips">
            {baseUnit === 'g' || baseUnit === 'ml' ? (
              <>
                <button type="button" className={`chip sm ${baseAmount === '100' ? 'on' : ''}`} onClick={() => setBaseAmount('100')}>
                  100 {baseUnit}
                </button>
                <span className="fine">o escribe el tamaño de la porción de la etiqueta</span>
              </>
            ) : (
              <span className="fine">p. ej. 1 unidad = 1 huevo, 1 porción = 1 barra</span>
            )}
          </div>
          {err('baseAmount')}
        </fieldset>

        <div className="nut-grid">
          <label className="field nut kcal">
            <span>Calorías (kcal) *</span>
            <input inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="0" />
            {err('kcal')}
          </label>
          <label className="field nut">
            <span><i className="dot" style={{ background: 'var(--protein)' }} /> Proteínas (g) *</span>
            <input inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="0" />
            {err('protein')}
          </label>
          <label className="field nut">
            <span><i className="dot" style={{ background: 'var(--carbs)' }} /> Carbohidratos (g) *</span>
            <input inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" />
            {err('carbs')}
          </label>
          <label className="field nut">
            <span><i className="dot" style={{ background: 'var(--fat)' }} /> Grasas (g) *</span>
            <input inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="0" />
            {err('fat')}
          </label>
        </div>
        {valid && nums.kcal > 0 && (
          <p className="fine">
            Con 4/4/9 kcal por gramo, los macros suman ≈ {fmt0(macroKcal)} kcal (la fibra y el alcohol explican diferencias).
          </p>
        )}

        <fieldset className="field">
          <span>Medidas personalizadas (opcional)</span>
          <p className="fine">Ej.: “1 taza” = 240 {unitWord}, “1 pieza” = 50 {unitWord}. Aparecerán como unidades al registrar.</p>
          {measures.map((m, i) => (
            <div key={i} className="measure-row">
              <input
                value={m.label}
                placeholder="Nombre (p. ej. 1 taza)"
                onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                aria-label="Nombre de la medida"
              />
              <span>=</span>
              <input
                className="m-amt"
                inputMode="decimal"
                value={m.amount}
                placeholder="0"
                onChange={(e) => setMeasures(measures.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                aria-label="Cantidad equivalente"
              />
              <span className="m-unit">{baseUnit}</span>
              <button type="button" className="icon-btn sm" onClick={() => setMeasures(measures.filter((_, j) => j !== i))} aria-label="Quitar medida">
                <Icon name="x" size={18} />
              </button>
            </div>
          ))}
          <button type="button" className="link-btn" onClick={() => setMeasures([...measures, { label: '', amount: '' }])}>
            <Icon name="plus" size={15} /> Agregar medida
          </button>
        </fieldset>

        <label className="field">
          <span>Categoría de comida (opcional)</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as MealKey | '')}>
            <option value="">Sin categoría</option>
            {MEALS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Etiquetas</span>
          <TagPicker value={tags} onChange={setTags} />
        </div>

        <label className="switch-row">
          <span>
            <Icon name="star" size={18} fill={favorite} className={favorite ? 'star-on' : ''} /> Guardar como favorito
          </span>
          <input type="checkbox" className="switch" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        </label>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
