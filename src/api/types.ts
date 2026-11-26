import type { FoodDraft } from '../types';

export interface SearchResult {
  draft: FoodDraft;
  /** true si la fuente no trae calorías y macros completos: no se puede registrar sin completarlo. */
  incomplete: boolean;
  /** Texto corto que describe el origen o tipo del dato. */
  note?: string;
}

export class ApiError extends Error {
  constructor(message: string, public kind: 'network' | 'auth' | 'rate' | 'server' | 'notfound' = 'server') {
    super(message);
  }
}

export async function fetchJson(url: string, signal?: AbortSignal, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => ctrl.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (res.status === 401 || res.status === 403) throw new ApiError('La clave de API no es válida o no tiene permiso.', 'auth');
    if (res.status === 429) throw new ApiError('Se alcanzó el límite de consultas. Intenta más tarde.', 'rate');
    if (res.status === 404) throw new ApiError('No encontrado.', 'notfound');
    if (!res.ok) throw new ApiError(`El servicio respondió con un error (${res.status}).`, 'server');
    return await res.json();
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (signal?.aborted) throw e;
    if (e?.name === 'TimeoutError' || ctrl.signal.aborted) throw new ApiError('El servicio tardó demasiado en responder.', 'network');
    if (!navigator.onLine) throw new ApiError('Sin conexión a internet.', 'network');
    throw new ApiError('No se pudo conectar con el servicio.', 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const toNum = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return isNum(n) ? n : undefined;
};
