import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp, type SheetSpec } from '../state';
import { allTags, deleteTag, ensureTags, renameTag } from '../lib/repo';
import { cleanTag } from '../lib/text';
import { db } from '../db';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';

export function ConfirmSheet({ spec, z }: { spec: Extract<SheetSpec, { type: 'confirm' }>; z: number }) {
  const { closeSheet, closeSheets } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title={spec.title} onClose={closeSheet} z={z}>
      {spec.message && <p className="confirm-msg">{spec.message}</p>}
      <div className="foot-row">
        <button className="btn btn-ghost grow" onClick={closeSheet}>
          Cancelar
        </button>
        <button
          className={`btn grow ${spec.danger ? 'btn-danger' : 'btn-primary'}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await spec.onConfirm();
            closeSheets(spec.closeCount ?? 1);
          }}
        >
          {spec.confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}

export function TagManager({ z }: { z: number }) {
  const { closeSheet, openSheet, toast } = useApp();
  const tags = useLiveQuery(allTags, []) ?? [];
  const counts = useLiveQuery(async () => {
    const m: Record<string, number> = {};
    (await db.foods.toArray()).forEach((f) => f.tags.forEach((t) => (m[t] = (m[t] || 0) + 1)));
    return m;
  }, []) ?? {};
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const create = async () => {
    const t = cleanTag(text);
    if (!t) return;
    await ensureTags([t]);
    setText('');
    toast(`Etiqueta “${t}” creada`);
  };

  return (
    <Sheet title="Etiquetas" onClose={closeSheet} z={z} full>
      <p className="fine">Las etiquetas te ayudan a organizar y filtrar alimentos (marcas, tipo, momento del día…). Un alimento puede tener varias.</p>
      <form
        className="tag-input big"
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <Icon name="tag" size={18} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nueva etiqueta" enterKeyHint="done" aria-label="Nueva etiqueta" />
        <button className="btn btn-primary sm" disabled={!text.trim()}>
          Crear
        </button>
      </form>
      {tags.length === 0 && <div className="empty-row">Todavía no hay etiquetas.</div>}
      <ul className="tag-list">
        {tags.map((t) => (
          <li key={t}>
            {editing === t ? (
              <form
                className="tag-edit"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await renameTag(t, editText);
                  setEditing(null);
                }}
              >
                <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} aria-label="Nuevo nombre" />
                <button className="icon-btn sm" aria-label="Guardar">
                  <Icon name="check" size={18} />
                </button>
              </form>
            ) : (
              <>
                <span className="tag-name">#{t}</span>
                <span className="tag-count">{counts[t] || 0}</span>
                <button
                  className="icon-btn sm"
                  onClick={() => {
                    setEditing(t);
                    setEditText(t);
                  }}
                  aria-label={`Renombrar ${t}`}
                >
                  <Icon name="edit" size={17} />
                </button>
                <button
                  className="icon-btn sm danger"
                  onClick={() =>
                    openSheet({
                      type: 'confirm',
                      title: `¿Eliminar #${t}?`,
                      message: counts[t] ? `Se quitará de ${counts[t]} alimento(s). Los alimentos no se borran.` : undefined,
                      confirmLabel: 'Eliminar',
                      danger: true,
                      onConfirm: () => deleteTag(t),
                    })
                  }
                  aria-label={`Eliminar ${t}`}
                >
                  <Icon name="trash" size={17} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * Escáner experimental con la API BarcodeDetector del navegador (Chrome para Android).
 * Solo se ofrece si el navegador la soporta.
 */
export function ScannerSheet({ onCode, z }: { onCode: (code: string) => void; z: number }) {
  const { closeSheet } = useApp();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let stream: MediaStream | undefined;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        const Detector = (window as any).BarcodeDetector;
        const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const codes = await detector.detect(v);
            if (codes.length) {
              stopped = true;
              closeSheet();
              onCode(codes[0].rawValue);
              return;
            }
          } catch {
            /* frame sin datos */
          }
          raf = window.setTimeout(tick, 250);
        };
        tick();
      } catch (e: any) {
        setError(e?.name === 'NotAllowedError' ? 'Permiso de cámara denegado.' : 'No se pudo iniciar la cámara en este dispositivo.');
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [closeSheet, onCode]);
  return (
    <Sheet title="Escanear código" onClose={closeSheet} z={z}>
      {error ? (
        <div className="error-row">
          <Icon name="alert" size={16} /> {error} Puedes escribir el código en el buscador.
        </div>
      ) : (
        <div className="scanner">
          <video ref={video} playsInline muted />
          <div className="scanner-frame" />
        </div>
      )}
      <p className="fine center">Apunta al código de barras del producto. Función experimental.</p>
    </Sheet>
  );
}
