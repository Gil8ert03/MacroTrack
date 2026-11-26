// Captura el evento de instalación de la PWA (Chrome/Edge en Android y escritorio).
let deferred: any = null;
const listeners = new Set<() => void>();
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((l) => l());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((l) => l());
});
export const canInstall = () => !!deferred;
export const onInstallChange = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export async function promptInstall() {
  if (!deferred) return false;
  deferred.prompt();
  const r = await deferred.userChoice.catch(() => null);
  deferred = null;
  listeners.forEach((l) => l());
  return r?.outcome === 'accepted';
}
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
