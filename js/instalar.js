// js/instalar.js — "Instalar o app". Chrome/Edge on Android (and desktop)
// fire `beforeinstallprompt` when the site can be installed; it is kept
// here so a button can show the browser's own install dialog with one tap.
// iPhone has no such event: there the screens show the steps instead.
// Only touches `window`/`navigator` when called.

let pedido = null; // the deferred beforeinstallprompt event
const ouvintes = new Set();
const avisar = () => { for (const fn of ouvintes) fn(); };

export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no mini-infobar; our own button asks instead
    pedido = e;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    pedido = null;
    avisar();
  });
}

export function podeInstalar() {
  return pedido != null;
}

// Shows the browser's install dialog. true when the person accepted.
export async function instalar() {
  if (!pedido) return false;
  const e = pedido;
  pedido = null; // an event can be used only once
  avisar();
  await e.prompt();
  const { outcome } = await e.userChoice;
  return outcome === 'accepted';
}

export function onInstallChange(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Opened from the home-screen icon (already installed).
export function isStandalone() {
  return navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}
