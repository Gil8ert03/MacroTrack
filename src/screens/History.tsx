import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useApp } from '../state';
import { MEALS, type Entry } from '../types';
import { totalOf } from '../lib/nutrition';
import { addDays, longDate, relativeLabel, shortDate, todayKey, weekDays } from '../lib/dates';
import { fmt0, fmtEnergy, fmtG, energyValue } from '../lib/format';
import { WeekChart } from '../components/WeekChart';
import { EntryRow } from '../components/EntryRow';
import { DateNav } from '../components/DateNav';
import { MacroCards, MACROS } from '../components/Summary';
import { ProgressBar } from '../components/Progress';
import { Icon } from '../components/Icon';

type Metric = 'kcal' | 'protein';

export function History() {
  const { settings, setTab, setHomeDate } = useApp();
  const [date, setDate] = useState(() => addDays(todayKey(), 0));
  const [metric, setMetric] = useState<Metric>('kcal');
  const days = weekDays(date);
  const weekEntries = useLiveQuery(() => db.entries.where('date').between(days[0], days[6], true, true).toArray(), [days[0]]);
  const totalDays = useLiveQuery(async () => (await db.entries.orderBy('date').uniqueKeys()).length, []);

  const u = settings.energyUnit;
  const byDay = (d: string) => (weekEntries ?? []).filter((e) => e.date === d);
  const points = days.map((d) => {
    const es = byDay(d);
    const t = totalOf(es);
    return { date: d, hasData: es.length > 0, value: metric === 'kcal' ? energyValue(t.kcal, u) : t.protein };
  });
  const logged = points.filter((p) => p.hasData);
  const avg = logged.length ? logged.reduce((a, p) => a + p.value, 0) / logged.length : 0;
  const goal = metric === 'kcal' ? energyValue(settings.goals.kcal, u) : settings.goals.protein;

  const dayEntries: Entry[] = byDay(date).sort((a, b) => a.createdAt - b.createdAt);
  const totals = totalOf(dayEntries);

  const openInHome = () => {
    setHomeDate(date);
    setTab('home');
  };

  return (
    <div className="screen">
      <header className="top">
        <h1>Historial</h1>
      </header>

      <section className="card">
        <div className="week-head">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -7))} aria-label="Semana anterior">
            <Icon name="left" />
          </button>
          <div className="week-title">
            {shortDate(days[0])} – {shortDate(days[6])}
          </div>
          <button className="icon-btn" onClick={() => setDate(addDays(date, 7))} aria-label="Semana siguiente">
            <Icon name="right" />
          </button>
        </div>
        <div className="seg seg-full sm">
          <button className={metric === 'kcal' ? 'on' : ''} onClick={() => setMetric('kcal')}>
            Calorías ({u})
          </button>
          <button className={metric === 'protein' ? 'on' : ''} onClick={() => setMetric('protein')}>
            Proteína (g)
          </button>
        </div>
        {logged.length === 0 ? (
          <div className="empty-state compact">
            <div className="empty-ico">
              <Icon name="calendar" size={24} />
            </div>
            <h3>Sin registros esta semana</h3>
            <p>{totalDays ? 'Cambia de semana o registra alimentos para ver tu gráfica.' : 'Cuando registres alimentos, aquí verás tu consumo diario.'}</p>
          </div>
        ) : (
          <>
            <WeekChart
              points={points}
              goal={goal}
              unit={metric === 'kcal' ? u : 'g'}
              selected={date}
              onSelect={setDate}
              color={metric === 'kcal' ? 'var(--accent)' : 'var(--protein)'}
            />
            <div className="week-stats">
              <div>
                <span>Promedio</span>
                <b>
                  {metric === 'kcal' ? fmt0(avg) : fmtG(avg)} {metric === 'kcal' ? u : 'g'}
                </b>
              </div>
              <div>
                <span>Días registrados</span>
                <b>{logged.length} / 7</b>
              </div>
              <div>
                <span>Días en meta ±10%</span>
                <b>{goal > 0 ? logged.filter((p) => Math.abs(p.value - goal) <= goal * 0.1).length : '–'}</b>
              </div>
            </div>
          </>
        )}
      </section>

      <DateNav date={date} onChange={setDate} />

      <section className="card day-sum">
        <div className="day-sum-head">
          <div>
            <div className="muted small">{relativeLabel(date) ?? 'Total del día'}</div>
            <div className="day-kcal">
              {fmtEnergy(totals.kcal, u)} <small>/ {fmtEnergy(settings.goals.kcal, u)} {u}</small>
            </div>
          </div>
          <button className="btn btn-ghost sm" onClick={openInHome}>
            <Icon name="edit" size={15} /> Editar día
          </button>
        </div>
        <ProgressBar value={totals.kcal} goal={settings.goals.kcal} color="var(--accent)" />
        <div className="day-macros">
          {MACROS.map((m) => (
            <div key={m.key}>
              <span className="dot" style={{ background: m.color }} />
              {m.label} <b>{fmtG(totals[m.key])} g</b>
            </div>
          ))}
        </div>
      </section>

      {dayEntries.length === 0 ? (
        <div className="empty-state compact">
          <p>No hay alimentos registrados el {longDate(date).toLowerCase()}.</p>
        </div>
      ) : (
        <>
          <details className="macro-details">
            <summary>Detalle de macros vs. meta</summary>
            <MacroCards totals={totals} goals={settings.goals} />
          </details>
          {MEALS.map((m) => {
            const items = dayEntries.filter((e) => e.meal === m.key);
            if (!items.length) return null;
            return (
              <section key={m.key} className="card meal-card">
                <header className="meal-head">
                  <span className={`meal-ico meal-${m.key}`}>
                    <Icon name={m.icon} size={18} />
                  </span>
                  <div className="meal-title">
                    <h3>{m.label}</h3>
                    <span className="meal-kcal">
                      {fmtEnergy(totalOf(items).kcal, u)} {u}
                    </span>
                  </div>
                </header>
                <div className="entries">
                  {items.map((e) => (
                    <EntryRow key={e.id} entry={e} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
