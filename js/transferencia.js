// js/transferencia.js — moving recipes from Safari into the installed app.
// On iPhone a home-screen app gets its own storage, separate from Safari's,
// so it starts empty. Safari copies a full backup to the clipboard; the app
// reads it back. The marker keeps an unrelated pasted text from being
// mistaken for recipes. A plain backup file's JSON is accepted too.

const MARCA = 'DOCE-LUCRO-RECEITAS:';

export function encodeTransfer(data) {
  return MARCA + JSON.stringify(data);
}

export function decodeTransfer(texto) {
  let t = String(texto ?? '').trim();
  if (t.startsWith(MARCA)) t = t.slice(MARCA.length);
  if (!t.startsWith('{')) return null;
  try {
    const data = JSON.parse(t);
    return data && Array.isArray(data.recipes) ? data : null;
  } catch {
    return null;
  }
}
