import { fmt0, fmtG } from '../lib/format';
import { todayKey, weekdayInitial } from '../lib/dates';

export interface DayPoint {
  date: string;
  value: number;
  hasData: boolean;
}

/**
 * Barras diarias de una sola serie con línea de meta. Tocar una barra selecciona el día.
 * Los días sin registros no se dibujan como 0 "real": se marcan con un guion.
 */
export function WeekChart({
  points,
  goal,
  unit,
  selected,
  onSelect,
  color,
}: {
  points: DayPoint[];
  goal: number;
  unit: string;
  selected: string;
  onSelect: (d: string) => void;
  color: string;
}) {
  const H = 150;
  const max = Math.max(goal, ...points.map((p) => p.value), 1) * 1.08;
  const y = (v: number) => H - (v / max) * H;
  const today = todayKey();
  const fmtV = unit === 'g' ? fmtG : fmt0;
  return (
    <div className="wchart" role="group" aria-label="Gráfica semanal">
      <div className="wchart-plot" style={{ height: H }}>
        {goal > 0 && (
          <div className="wchart-goal" style={{ top: y(goal) }}>
            <span>Meta {fmtV(goal)}</span>
          </div>
        )}
        {points.map((p) => {
          const h = p.hasData ? Math.max((p.value / max) * H, 3) : 0;
          const over = goal > 0 && p.value > goal;
          const sel = p.date === selected;
          return (
            <button
              key={p.date}
              className={`wbar ${sel ? 'sel' : ''}`}
              onClick={() => onSelect(p.date)}
              aria-label={`${weekdayInitial(p.date)}: ${p.hasData ? `${fmtV(p.value)} ${unit}` : 'sin registros'}`}
              aria-pressed={sel}
            >
              {sel && p.hasData && (
                <span className="wbar-val" style={{ bottom: h + 4 }}>
                  {fmtV(p.value)}
                </span>
              )}
              {p.hasData ? (
                <span className={`wbar-fill ${over ? 'over' : ''}`} style={{ height: h, background: over ? undefined : color }} />
              ) : (
                <span className="wbar-empty" />
              )}
            </button>
          );
        })}
      </div>
      <div className="wchart-x">
        {points.map((p) => (
          <span key={p.date} className={`${p.date === selected ? 'sel' : ''} ${p.date === today ? 'today' : ''}`}>
            {weekdayInitial(p.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
