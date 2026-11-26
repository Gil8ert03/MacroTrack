import { addDays, longDate, relativeLabel, todayKey } from '../lib/dates';
import { Icon } from './Icon';

export function DateNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  const rel = relativeLabel(date);
  const isToday = date === todayKey();
  return (
    <div className="datenav">
      <button className="icon-btn" onClick={() => onChange(addDays(date, -1))} aria-label="Día anterior">
        <Icon name="left" />
      </button>
      <div className="datenav-center">
        <span className="datenav-rel">{rel ?? longDate(date).split(',')[0]}</span>
        <span className="datenav-full">
          {rel ? longDate(date) : longDate(date).split(', ').slice(1).join(', ')}
          <Icon name="down" size={14} />
        </span>
        {/* Input de fecha transparente encima: en iPhone y Android un toque abre el selector nativo. */}
        <input
          type="date"
          className="date-overlay"
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => {
            try {
              (e.currentTarget as any).showPicker?.();
            } catch {
              /* el navegador abre su selector por sí mismo */
            }
          }}
          aria-label="Elegir fecha"
        />
      </div>
      <button className="icon-btn" onClick={() => onChange(addDays(date, 1))} aria-label="Día siguiente">
        <Icon name="right" />
      </button>
      {!isToday && (
        <button className="today-pill" onClick={() => onChange(todayKey())}>
          Ir a hoy
        </button>
      )}
    </div>
  );
}
