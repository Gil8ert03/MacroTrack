import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { DEFAULT_SETTINGS } from './lib/repo';
import { todayKey } from './lib/dates';
import type { Entry, Food, FoodDraft, MealKey, Settings } from './types';

export type Tab = 'home' | 'history' | 'foods' | 'settings';

export type SheetSpec =
  | { type: 'add'; date: string; meal: MealKey }
  | { type: 'amount'; food: Food | FoodDraft; date: string; meal: MealKey; entry?: Entry; closeAddOnSave?: boolean }
  | { type: 'foodForm'; food?: Food; prefill?: Partial<FoodDraft>; note?: string; next?: (f: Food) => SheetSpec }
  | { type: 'tags' }
  | { type: 'scanner'; onCode: (code: string) => void }
  | {
      type: 'confirm';
      title: string;
      message?: string;
      confirmLabel: string;
      danger?: boolean;
      /** Cuántas hojas cerrar al confirmar (por defecto 1: solo la confirmación). */
      closeCount?: number;
      onConfirm: () => void | Promise<void>;
    };

interface ToastSpec {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  kind?: 'ok' | 'error';
}

interface AppCtx {
  settings: Settings;
  tab: Tab;
  setTab: (t: Tab) => void;
  homeDate: string;
  setHomeDate: (d: string) => void;
  sheets: SheetSpec[];
  openSheet: (s: SheetSpec) => void;
  closeSheet: () => void;
  closeSheets: (n: number) => void;
  /** Sustituye la hoja superior por otra, sin tocar el historial. */
  replaceSheet: (s: SheetSpec) => void;
  toast: (text: string, opts?: { action?: ToastSpec['action']; kind?: ToastSpec['kind'] }) => void;
  toasts: ToastSpec[];
}

const Ctx = createContext<AppCtx | null>(null);

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp fuera de AppProvider');
  return c;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(() => db.settings.get('app'), []);
  const settings = useMemo<Settings>(
    () => ({ ...DEFAULT_SETTINGS, ...stored, goals: { ...DEFAULT_SETTINGS.goals, ...stored?.goals } }),
    [stored],
  );

  const [tab, setTabState] = useState<Tab>(() => {
    const h = location.hash.replace('#', '') as Tab;
    return ['home', 'history', 'foods', 'settings'].includes(h) ? h : 'home';
  });
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    history.replaceState(history.state, '', `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  const [homeDate, setHomeDate] = useState(todayKey);

  // Al volver a la app otro día, mover "hoy" si el usuario estaba en el día anterior.
  const lastToday = useRef(todayKey());
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const t = todayKey();
      if (t !== lastToday.current) {
        setHomeDate((d) => (d === lastToday.current ? t : d));
        lastToday.current = t;
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Pila de hojas modales sincronizada con el historial: el botón "atrás" de Android cierra la hoja superior.
  const [sheets, setSheets] = useState<SheetSpec[]>([]);
  const depth = useRef(0);
  const openSheet = useCallback((s: SheetSpec) => {
    depth.current += 1;
    history.pushState({ sheet: depth.current }, '', location.hash || '#home');
    setSheets((cur) => [...cur, s]);
  }, []);
  const closeSheets = useCallback((n: number) => {
    const k = Math.min(n, depth.current);
    if (k > 0) history.go(-k);
  }, []);
  const closeSheet = useCallback(() => closeSheets(1), [closeSheets]);
  const replaceSheet = useCallback((s: SheetSpec) => setSheets((cur) => [...cur.slice(0, -1), s]), []);

  // history.go(-k) dispara un solo popstate: ajustar la pila al nivel real.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const level = typeof e.state?.sheet === 'number' ? e.state.sheet : 0;
      depth.current = level;
      setSheets((s) => s.slice(0, level));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [toasts, setToasts] = useState<ToastSpec[]>([]);
  const toast = useCallback<AppCtx['toast']>((text, opts) => {
    const id = Date.now() + Math.random();
    setToasts([{ id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts?.action ? 5000 : 2600);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
  }, [settings.theme]);

  const value: AppCtx = {
    settings,
    tab,
    setTab,
    homeDate,
    setHomeDate,
    sheets,
    openSheet,
    closeSheet,
    closeSheets,
    replaceSheet,
    toast,
    toasts,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
