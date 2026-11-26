import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Hoja modal. En teléfono ocupa casi toda la pantalla y sube desde abajo;
 * en escritorio se muestra centrada. El pie (`footer`) queda fijo sobre el teclado.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  full = false,
  headerExtra,
  z = 0,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  full?: boolean;
  headerExtra?: ReactNode;
  z?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-layer" style={{ zIndex: 100 + z }}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className={`sheet ${full ? 'sheet-full' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" />
          </button>
          <h2 className="sheet-title">{title}</h2>
          <div className="sheet-head-extra">{headerExtra}</div>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}
