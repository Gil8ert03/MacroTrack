import type { Entry } from '../types';
import { entryNutrients } from '../lib/nutrition';
import { fmt2, fmtEnergy } from '../lib/format';
import { useApp } from '../state';
import { MacroLine } from './Summary';

export const qtyLabel = (e: Pick<Entry, 'quantity' | 'unitLabel'>) => {
  const u = e.unitLabel;
  const short = u.length <= 7 && !u.includes('(');
  return short ? `${fmt2(e.quantity)} ${u}` : `${fmt2(e.quantity)} × ${u}`;
};

export function EntryRow({ entry, onClick }: { entry: Entry; onClick?: () => void }) {
  const { settings } = useApp();
  const n = entryNutrients(entry);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`entry-row ${onClick ? 'tappable' : ''}`} onClick={onClick}>
      <div className="entry-main">
        <div className="entry-name">{entry.food.name}</div>
        <div className="entry-sub">
          {entry.food.brand && <span className="entry-brand">{entry.food.brand} · </span>}
          {qtyLabel(entry)}
        </div>
        <MacroLine n={n} />
      </div>
      <div className="entry-kcal">
        {fmtEnergy(n.kcal, settings.energyUnit)}
        <small>{settings.energyUnit}</small>
      </div>
    </Tag>
  );
}
