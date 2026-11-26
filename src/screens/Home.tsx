import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../state';
import { MEALS, type Entry, type MealKey } from '../types';
import { totalOf } from '../lib/nutrition';
import { addDays } from '../lib/dates';
import { fmtEnergy } from '../lib/format';
import { copyMeal } from '../lib/repo';
import { DateNav } from '../components/DateNav';
import { CalorieCard, MacroCards } from '../components/Summary';
import { EntryRow } from '../components/EntryRow';
import { Icon } from '../components/Icon';

export function Home() {
  const { homeDate, setHomeDate, settings, openSheet, toast } = useApp();
  const entries = useLiveQuery(() => db.entries.where('date').equals(homeDate).sortBy('createdAt'), [homeDate]);
  const prevDay = addDays(homeDate, -1);
  const prevEntries = useLiveQuery(() => db.entries.where('date').equals(prevDay).toArray(), [prevDay]);

  const list = entries ?? [];
  const totals = totalOf(list);
  const byMeal = (k: MealKey) => list.filter((e) => e.meal === k);

  const edit = (e: Entry) => openSheet({ type: 'amount', food: { ...e.food, id: e.foodId } as any, date: e.date, meal: e.meal, entry: e });

  const copyFromPrev = async (k: MealKey) => {
    const n = await copyMeal(prevDay, k, homeDate);
    toast(`${n} ${n === 1 ? 'alimento copiado' : 'alimentos copiados'} del día anterior`);
  };

  return (
    <div className="screen">
      <header className="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          MacroTrack
        </div>
      </header>
      <DateNav date={homeDate} onChange={setHomeDate} />

      <CalorieCard totals={totals} goals={settings.goals} />
      <MacroCards totals={totals} goals={settings.goals} />

      <h2 className="section-title">Comidas del día</h2>
      {MEALS.map((m) => {
        const items = byMeal(m.key);
        // "Otros" solo aparece si tiene registros, para no saturar.
        if (m.key === 'otros' && items.length === 0) return null;
        const sub = totalOf(items);
        const prevCount = (prevEntries ?? []).filter((e) => e.meal === m.key).length;
        return (
          <section key={m.key} className="card meal-card" aria-label={m.label}>
            <header className="meal-head">
              <span className={`meal-ico meal-${m.key}`}>
                <Icon name={m.icon} size={18} />
              </span>
              <div className="meal-title">
                <h3>{m.label}</h3>
                <span className="meal-kcal">
                  {items.length ? `${fmtEnergy(sub.kcal, settings.energyUnit)} ${settings.energyUnit}` : 'Sin registros'}
                </span>
              </div>
              <button
                className="add-btn"
                onClick={() => openSheet({ type: 'add', date: homeDate, meal: m.key })}
                aria-label={`Agregar a ${m.label}`}
              >
                <Icon name="plus" size={20} />
              </button>
            </header>
            {items.length > 0 && (
              <div className="entries">
                {items.map((e) => (
                  <EntryRow key={e.id} entry={e} onClick={() => edit(e)} />
                ))}
              </div>
            )}
            {items.length === 0 && prevCount > 0 && (
              <button className="link-btn copy-prev" onClick={() => copyFromPrev(m.key)}>
                <Icon name="copy" size={15} /> Copiar {prevCount} del día anterior
              </button>
            )}
          </section>
        );
      })}
      {list.length === 0 && entries && (
        <p className="hint center">Toca <b>+</b> para registrar tu primer alimento del día.</p>
      )}
    </div>
  );
}
