// js/fotos.js
//
// One photo per recipe (the product picture for the cardápio), kept in
// IndexedDB — a photo is binary and can be a few hundred KB, too big for
// localStorage's small quota. Browser-only, so there is no unit test here
// (see scripts/smoke/18-cardapio.mjs); every call fails soft (resolves to
// null/false) where IndexedDB is unavailable (older Safari in private
// mode, some embedded webviews) instead of breaking the recipe.

const DB_NAME = 'calculadora-cozinha-fotos';
const STORE = 'fotos';
const VERSION = 1;

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) { reject(new Error('sem IndexedDB')); return; }
    const pedido = indexedDB.open(DB_NAME, VERSION);
    pedido.onupgradeneeded = () => { pedido.result.createObjectStore(STORE); };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export async function salvarFoto(recipeId, blob) {
  try {
    const db = await abrirBanco();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(blob, recipeId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function lerFoto(recipeId) {
  try {
    const db = await abrirBanco();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const pedido = tx.objectStore(STORE).get(recipeId);
      pedido.onsuccess = () => resolve(pedido.result ?? null);
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    return null;
  }
}

export async function removerFoto(recipeId) {
  try {
    const db = await abrirBanco();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(recipeId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}
