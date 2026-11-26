import { useApp, type Tab } from './state';
import { Home } from './screens/Home';
import { History } from './screens/History';
import { Foods } from './screens/Foods';
import { Settings } from './screens/Settings';
import { AddFood } from './screens/AddFood';
import { AmountSheet } from './screens/AmountSheet';
import { FoodForm } from './screens/FoodForm';
import { ConfirmSheet, ScannerSheet, TagManager } from './screens/MiscSheets';
import { Icon } from './components/Icon';
import { mealForNow } from './lib/dates';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'history', label: 'Historial', icon: 'calendar' },
  { key: 'foods', label: 'Alimentos', icon: 'book' },
  { key: 'settings', label: 'Ajustes', icon: 'settings' },
];

export default function App() {
  const { tab, setTab, sheets, openSheet, homeDate, toasts } = useApp();
  const add = () => openSheet({ type: 'add', date: homeDate, meal: mealForNow() });

  return (
    <div className={`app ${sheets.length ? 'has-sheet' : ''}`}>
      <main className="main" aria-hidden={sheets.length > 0 || undefined}>
        {tab === 'home' && <Home />}
        {tab === 'history' && <History />}
        {tab === 'foods' && <Foods />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="tabbar" aria-label="Navegación principal">
        {TABS.slice(0, 2).map((t) => (
          <TabBtn key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
        <button className="fab" onClick={add} aria-label="Agregar alimento">
          <Icon name="plus" size={28} strokeWidth={2.4} />
        </button>
        {TABS.slice(2).map((t) => (
          <TabBtn key={t.key} t={t} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </nav>

      {sheets.map((s, i) => {
        const key = `${i}-${s.type}`;
        switch (s.type) {
          case 'add':
            return <AddFood key={key} date={s.date} meal={s.meal} z={i} />;
          case 'amount':
            return <AmountSheet key={key} food={s.food} date={s.date} meal={s.meal} entry={s.entry} closeAddOnSave={s.closeAddOnSave} z={i} />;
          case 'foodForm':
            return <FoodForm key={key} food={s.food} prefill={s.prefill} note={s.note} next={s.next} z={i} />;
          case 'tags':
            return <TagManager key={key} z={i} />;
          case 'scanner':
            return <ScannerSheet key={key} onCode={s.onCode} z={i} />;
          case 'confirm':
            return <ConfirmSheet key={key} spec={s} z={i} />;
        }
      })}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'err' : ''}`}>
            <span>{t.text}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ t, active, onClick }: { t: (typeof TABS)[number]; active: boolean; onClick: () => void }) {
  return (
    <button className={`tab ${active ? 'on' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <Icon name={t.icon} size={23} strokeWidth={active ? 2.3 : 1.9} />
      <span>{t.label}</span>
    </button>
  );
}
