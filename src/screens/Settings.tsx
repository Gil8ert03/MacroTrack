import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state';
import { importAll, saveSettings, wipeAll, type Backup } from '../lib/repo';
import { downloadBackup, downloadCsv } from '../lib/exporters';
import { energyValue, fmt0, parseNum } from '../lib/format';
import { KJ_PER_KCAL, kcalFromMacros } from '../lib/nutrition';
import { requestPersistence } from '../db';
import { resolveUsdaKey, searchUSDA, ENV_USDA_KEY } from '../api/usda';
import { canInstall, isIOS, isStandalone, onInstallChange, promptInstall } from '../lib/install';
import { Icon } from '../components/Icon';
import type { Goals, Settings as S } from '../types';

function Group({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="card set-group">
      <h2 className="set-title">
        <span className="set-ico">
          <Icon name={icon} size={17} />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg seg-full">
      {options.map(([k, l]) => (
        <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const { settings, toast, openSheet } = useApp();
  const u = settings.energyUnit;
  const toForm = (g: Goals) => ({
    kcal: String(Math.round(energyValue(g.kcal, u))),
    protein: String(g.protein),
    carbs: String(g.carbs),
    fat: String(g.fat),
  });
  const [goals, setGoals] = useState(() => toForm(settings.goals));
  useEffect(() => setGoals(toForm(settings.goals)), [settings.goals.kcal, settings.goals.protein, settings.goals.carbs, settings.goals.fat, u]);

  const parsed = {
    kcal: parseNum(goals.kcal) / (u === 'kJ' ? KJ_PER_KCAL : 1),
    protein: parseNum(goals.protein),
    carbs: parseNum(goals.carbs),
    fat: parseNum(goals.fat),
  };
  const goalsValid = Object.values(parsed).every((v) => Number.isFinite(v) && v >= 0);
  const dirty = goalsValid && (['kcal', 'protein', 'carbs', 'fat'] as const).some((k) => Math.abs(parsed[k] - settings.goals[k]) > 0.01);
  const macroKcal = goalsValid ? kcalFromMacros(parsed) : 0;

  const saveGoals = async () => {
    if (!goalsValid) return;
    await saveSettings({ goals: parsed });
    toast('Metas guardadas');
  };

  const set = (patch: Partial<S>) => saveSettings(patch);

  // USDA
  const [key, setKey] = useState(settings.usdaApiKey);
  const [showKey, setShowKey] = useState(false);
  const [keyTest, setKeyTest] = useState<'idle' | 'testing' | 'ok' | string>('idle');
  useEffect(() => setKey(settings.usdaApiKey), [settings.usdaApiKey]);
  const usda = resolveUsdaKey(settings.usdaApiKey);
  const testKey = async () => {
    setKeyTest('testing');
    try {
      await saveSettings({ usdaApiKey: key.trim() });
      const r = await searchUSDA('apple', resolveUsdaKey(key).key);
      setKeyTest(r.length ? 'ok' : 'La consulta funcionó pero no devolvió datos.');
    } catch (e: any) {
      setKeyTest(e?.message || 'Error');
    }
  };

  // Persistencia
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${((e.usage || 0) / 1024 / 1024).toFixed(1)} MB usados`));
  }, []);

  // Instalación
  const [, force] = useState(0);
  useEffect(() => {
    const off = onInstallChange(() => force((n) => n + 1));
    return () => {
      off();
    };
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const onImport = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      openSheet({
        type: 'confirm',
        title: 'Importar respaldo',
        message: `El archivo tiene ${data.entries?.length ?? 0} registros y ${data.foods?.length ?? 0} alimentos. “Combinar” conserva lo actual y agrega/actualiza lo del archivo.`,
        confirmLabel: 'Combinar',
        onConfirm: async () => {
          try {
            await importAll(data, 'merge');
            toast('Respaldo importado');
          } catch (e: any) {
            toast(e?.message || 'No se pudo importar', { kind: 'error' });
          }
        },
      });
    } catch {
      toast('El archivo no es un JSON válido.', { kind: 'error' });
    }
  };

  return (
    <div className="screen">
      <header className="top">
        <h1>Ajustes</h1>
      </header>

      <Group icon="target" title="Metas diarias">
        <p className="fine">Valores iniciales solo ilustrativos. Ajústalos a tus propios objetivos.</p>
        <div className="goal-grid">
          <label className="field">
            <span>Calorías ({u})</span>
            <input inputMode="decimal" value={goals.kcal} onChange={(e) => setGoals({ ...goals, kcal: e.target.value })} />
          </label>
          <label className="field">
            <span>
              <i className="dot" style={{ background: 'var(--protein)' }} /> Proteínas (g)
            </span>
            <input inputMode="decimal" value={goals.protein} onChange={(e) => setGoals({ ...goals, protein: e.target.value })} />
          </label>
          <label className="field">
            <span>
              <i className="dot" style={{ background: 'var(--carbs)' }} /> Carbohidratos (g)
            </span>
            <input inputMode="decimal" value={goals.carbs} onChange={(e) => setGoals({ ...goals, carbs: e.target.value })} />
          </label>
          <label className="field">
            <span>
              <i className="dot" style={{ background: 'var(--fat)' }} /> Grasas (g)
            </span>
            <input inputMode="decimal" value={goals.fat} onChange={(e) => setGoals({ ...goals, fat: e.target.value })} />
          </label>
        </div>
        {goalsValid ? (
          <p className="fine">
            Tus macros suman ≈ {fmt0(energyValue(macroKcal, u))} {u}
            {parsed.kcal > 0 && macroKcal > 0 && ` (${fmt0((macroKcal / parsed.kcal) * 100)} % de la meta de calorías)`}.
          </p>
        ) : (
          <p className="field-error">Revisa que todos los valores sean números.</p>
        )}
        <button className="btn btn-primary full" onClick={saveGoals} disabled={!dirty}>
          {dirty ? 'Guardar metas' : 'Metas guardadas'}
        </button>
      </Group>

      <Group icon="palette" title="Apariencia">
        <Seg
          value={settings.theme}
          options={[
            ['light', 'Claro'],
            ['dark', 'Oscuro'],
            ['system', 'Sistema'],
          ]}
          onChange={(theme) => set({ theme })}
        />
      </Group>

      <Group icon="ruler" title="Unidades">
        <div className="set-row">
          <span>Energía</span>
          <Seg
            value={settings.energyUnit}
            options={[
              ['kcal', 'kcal'],
              ['kJ', 'kJ'],
            ]}
            onChange={(energyUnit) => set({ energyUnit })}
          />
        </div>
        <div className="set-row">
          <span>Peso al registrar</span>
          <Seg
            value={settings.weightUnit}
            options={[
              ['g', 'gramos'],
              ['oz', 'onzas'],
            ]}
            onChange={(weightUnit) => set({ weightUnit })}
          />
        </div>
      </Group>

      <Group icon="database" title="Bases de datos de alimentos">
        <div className="db-status">
          <div>
            <b>Open Food Facts</b>
            <span className="badge ok">Activa · sin clave</span>
          </div>
          <p className="fine">Productos comerciales y códigos de barras. Datos aportados por la comunidad: revisa la etiqueta si algo no cuadra.</p>
        </div>
        <div className="db-status">
          <div>
            <b>USDA FoodData Central</b>
            <span className={`badge ${usda.isDemo ? 'warn' : 'ok'}`}>{usda.isDemo ? 'Clave de demostración' : settings.usdaApiKey ? 'Tu clave' : 'Clave del build'}</span>
          </div>
          <p className="fine">
            Alimentos genéricos (en inglés). La clave es gratuita:{' '}
            <a href="https://fdc.nal.usda.gov/api-key-signup" target="_blank" rel="noreferrer">
              solicítala aquí
            </a>{' '}
            y llega por correo. Se guarda solo en este dispositivo.
          </p>
          <div className="key-row">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setKeyTest('idle');
              }}
              placeholder={ENV_USDA_KEY ? 'Usando la clave del build' : 'Pega tu API key de USDA'}
              autoComplete="off"
              spellCheck={false}
              aria-label="API key de USDA"
            />
            <button className="icon-btn sm" onClick={() => setShowKey(!showKey)} aria-label={showKey ? 'Ocultar' : 'Mostrar'}>
              <Icon name="key" size={18} />
            </button>
          </div>
          <div className="foot-row">
            <button className="btn btn-ghost grow" onClick={testKey} disabled={keyTest === 'testing'}>
              {keyTest === 'testing' ? 'Probando…' : 'Guardar y probar'}
            </button>
          </div>
          {keyTest === 'ok' && (
            <p className="ok-text">
              <Icon name="check" size={15} /> Conexión con USDA correcta.
            </p>
          )}
          {keyTest !== 'idle' && keyTest !== 'ok' && keyTest !== 'testing' && <p className="field-error">{keyTest}</p>}
        </div>
      </Group>

      <Group icon="download" title="Tus datos">
        <p className="fine">
          Todo se guarda en este dispositivo (IndexedDB del navegador). Nada se envía a ningún servidor.
          {persisted === true && ' Almacenamiento persistente activado.'}
          {usage && ` ${usage}.`}
        </p>
        {persisted === false && (
          <button
            className="btn btn-ghost full"
            onClick={async () => {
              const ok = await requestPersistence();
              setPersisted(ok);
              toast(ok ? 'Almacenamiento persistente activado' : 'El navegador no lo concedió; instala la app para mayor protección');
            }}
          >
            Proteger datos contra borrado automático
          </button>
        )}
        <div className="btn-grid">
          <button className="btn btn-ghost" onClick={async () => toast(`Respaldo descargado (${await downloadBackup()} registros)`)}>
            <Icon name="download" size={17} /> Respaldo JSON
          </button>
          <button className="btn btn-ghost" onClick={async () => toast(`CSV descargado (${await downloadCsv()} registros)`)}>
            <Icon name="download" size={17} /> Registros CSV
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={17} /> Importar respaldo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <button
            className="btn btn-danger-ghost"
            onClick={() =>
              openSheet({
                type: 'confirm',
                title: '¿Borrar todos los datos?',
                message: 'Se eliminarán registros, alimentos, etiquetas y ajustes de este dispositivo. Descarga un respaldo antes si lo necesitas. No se puede deshacer.',
                confirmLabel: 'Borrar todo',
                danger: true,
                onConfirm: async () => {
                  await wipeAll();
                  toast('Datos borrados');
                },
              })
            }
          >
            <Icon name="trash" size={17} /> Borrar todo
          </button>
        </div>
      </Group>

      <Group icon="info" title="Instalar en el teléfono">
        {isStandalone() ? (
          <p className="ok-text">
            <Icon name="check" size={15} /> MacroTrack ya está instalada como app.
          </p>
        ) : canInstall() ? (
          <button className="btn btn-primary full" onClick={promptInstall}>
            Instalar MacroTrack
          </button>
        ) : isIOS() ? (
          <p className="fine">
            En iPhone: abre esta página en <b>Safari</b>, toca <b>Compartir</b> y luego <b>Agregar a pantalla de inicio</b>.
          </p>
        ) : (
          <p className="fine">
            En Android (Chrome): menú <b>⋮</b> → <b>Instalar app</b> o <b>Agregar a pantalla principal</b>.
          </p>
        )}
        <p className="fine">MacroTrack v1.0 · funciona sin conexión; solo las búsquedas en línea requieren internet.</p>
      </Group>
    </div>
  );
}
