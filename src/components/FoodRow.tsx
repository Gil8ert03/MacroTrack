import type { Food, FoodDraft } from '../types';
import { fmt2, fmtEnergy } from '../lib/format';
import { useApp } from '../state';
import { MacroLine } from './Summary';
import { Icon } from './Icon';

const SRC: Record<string, string> = { custom: 'Propio', off: 'Open Food Facts', usda: 'USDA' };

const PLURAL: Record<string, string> = { unidad: 'unidades', 'porción': 'porciones' };
export const baseLabel = (f: Pick<Food, 'baseAmount' | 'baseUnit'>) =>
  `por ${fmt2(f.baseAmount)} ${f.baseAmount !== 1 && PLURAL[f.baseUnit] ? PLURAL[f.baseUnit] : f.baseUnit}`;

export function FoodRow({
  food,
  note,
  incomplete,
  onClick,
  onStar,
  trailing,
}: {
  food: Food | FoodDraft;
  note?: string;
  incomplete?: boolean;
  onClick?: () => void;
  onStar?: () => void;
  trailing?: React.ReactNode;
}) {
  const { settings } = useApp();
  const u = settings.energyUnit;
  return (
    <div className={`food-row ${incomplete ? 'is-incomplete' : ''}`}>
      <button className="food-main" onClick={onClick}>
        <div className="food-name">
          {food.name}
          {food.favorite ? <Icon name="star" size={13} fill className="star-inline" /> : null}
        </div>
        <div className="food-sub">
          {food.brand && <span className="food-brand">{food.brand}</span>}
          <span className={`src src-${food.source}`}>{SRC[food.source]}</span>
          {'tags' in food && food.tags?.slice(0, 3).map((t) => (
            <span key={t} className="tag-mini">#{t}</span>
          ))}
        </div>
        {incomplete ? (
          <div className="food-missing">
            <Icon name="alert" size={13} /> {note || 'Sin datos nutricionales completos'} · toca para completarlo
          </div>
        ) : (
          <div className="food-nut">
            <b>
              {fmtEnergy(food.kcal, u)} {u}
            </b>
            <MacroLine n={food} />
            <span className="food-base">{note || baseLabel(food)}</span>
          </div>
        )}
      </button>
      {onStar && (
        <button className={`star-btn ${food.favorite ? 'on' : ''}`} onClick={onStar} aria-label={food.favorite ? 'Quitar de favoritos' : 'Marcar como favorito'}>
          <Icon name="star" size={20} fill={!!food.favorite} />
        </button>
      )}
      {trailing}
    </div>
  );
}
