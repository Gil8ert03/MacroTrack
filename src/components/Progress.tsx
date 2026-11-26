/**
 * Barra de progreso que no se limita al 100 %: si se supera la meta, la escala crece
 * y una marca indica dónde estaba la meta; el exceso se pinta con otro tono.
 */
export function ProgressBar({ value, goal, color, height = 8 }: { value: number; goal: number; color: string; height?: number }) {
  const over = goal > 0 && value > goal;
  const max = over ? value : goal || 1;
  const pctGoal = goal > 0 ? (Math.min(value, goal) / max) * 100 : 0;
  const pctOver = over ? ((value - goal) / max) * 100 : 0;
  return (
    <div className="pbar" style={{ height, ['--c' as any]: color }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemax={Math.round(goal)}>
      <div className="pbar-fill" style={{ width: `${pctGoal}%` }} />
      {over && <div className="pbar-over" style={{ width: `${pctOver}%` }} />}
      {over && <div className="pbar-mark" style={{ left: `${(goal / max) * 100}%` }} />}
    </div>
  );
}

/** Anillo de calorías: da una vuelta hasta la meta; el exceso se dibuja como segunda vuelta en otro color. */
export function Ring({ value, goal, size = 128, stroke = 12, children }: { value: number; goal: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = goal > 0 ? value / goal : 0;
  const first = Math.min(ratio, 1);
  const extra = Math.min(Math.max(ratio - 1, 0), 1);
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${first * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .5s ease' }}
          opacity={first > 0 ? 1 : 0}
        />
        {extra > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--over)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${extra * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray .5s ease' }}
          />
        )}
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--accent-2)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}
