import type { Goals, Nutrients } from '../types';
import { fmt0, fmtEnergy, fmtG } from '../lib/format';
import { useApp } from '../state';
import { ProgressBar, Ring } from './Progress';
import { Icon } from './Icon';

export const MACROS = [
  { key: 'protein', label: 'Proteínas', card: 'Proteínas', short: 'P', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbohidratos', card: 'Carbos', short: 'C', color: 'var(--carbs)' },
  { key: 'fat', label: 'Grasas', card: 'Grasas', short: 'G', color: 'var(--fat)' },
] as const;

export function CalorieCard({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  const { settings } = useApp();
  const u = settings.energyUnit;
  const remaining = goals.kcal - totals.kcal;
  const over = remaining < 0;
  const pct = goals.kcal > 0 ? (totals.kcal / goals.kcal) * 100 : 0;
  return (
    <section className="card cal-card" aria-label="Resumen de calorías">
      <Ring value={totals.kcal} goal={goals.kcal} size={124} stroke={12}>
        <div className={`ring-num ${over ? 'is-over' : ''}`}>{fmtEnergy(Math.abs(remaining), u)}</div>
        <div className="ring-lbl">{over ? `${u} de más` : `${u} restantes`}</div>
      </Ring>
      <div className="cal-stats">
        <div className="cal-row">
          <span className="cal-ico eaten"><Icon name="flame" size={16} /></span>
          <div>
            <div className="cal-lbl">Consumidas</div>
            <div className="cal-val">{fmtEnergy(totals.kcal, u)} <small>{u}</small></div>
          </div>
        </div>
        <div className="cal-row">
          <span className="cal-ico goal"><Icon name="target" size={16} /></span>
          <div>
            <div className="cal-lbl">Meta</div>
            <div className="cal-val">{fmtEnergy(goals.kcal, u)} <small>{u}</small></div>
          </div>
        </div>
        <ProgressBar value={totals.kcal} goal={goals.kcal} color="var(--accent)" height={8} />
        <div className={`cal-pct ${over ? 'is-over' : ''}`}>{fmt0(pct)} % de la meta</div>
      </div>
    </section>
  );
}

export function MacroCards({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  return (
    <div className="macro-grid">
      {MACROS.map((m) => {
        const v = totals[m.key];
        const g = goals[m.key];
        const rem = g - v;
        const pct = g > 0 ? (v / g) * 100 : 0;
        const over = g > 0 && v > g;
        return (
          <section key={m.key} className="card macro-card" aria-label={m.label}>
            <div className="macro-head">
              <span className="dot" style={{ background: m.color }} />
              <span className="macro-name" title={m.label}>{m.card}</span>
            </div>
            <div className="macro-val">
              {fmtG(v)}
              <span className="macro-goal"> / {fmt0(g)} g</span>
            </div>
            <ProgressBar value={v} goal={g} color={m.color} height={6} />
            <div className="macro-foot">
              <span className={over ? 'is-over' : ''}>{over ? `+${fmtG(-rem)} g` : `${fmtG(rem)} g restan`}</span>
              <span className={`macro-pct ${over ? 'is-over' : ''}`}>{fmt0(pct)}%</span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Línea compacta P · C · G */
export function MacroLine({ n, className = '' }: { n: Nutrients; className?: string }) {
  return (
    <span className={`macro-line ${className}`}>
      <span><i style={{ background: 'var(--protein)' }} />P {fmtG(n.protein)}</span>
      <span><i style={{ background: 'var(--carbs)' }} />C {fmtG(n.carbs)}</span>
      <span><i style={{ background: 'var(--fat)' }} />G {fmtG(n.fat)}</span>
    </span>
  );
}
