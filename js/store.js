// js/store.js
//
// Holds the recipe open in the editor. Screens change it through update(),
// which saves after a short debounce and notifies subscribers so they can
// refresh derived numbers without re-creating inputs (re-creating inputs
// on every keystroke is what made the phone keyboard close).

import { saveRecipe } from './storage.js';

export function createStore({ save, delay = 400, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
  let recipe = null;
  let timer = null;
  let status = 'salvo';
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn(recipe);
  }

  function runSave() {
    timer = null;
    if (!recipe) return;
    status = save(recipe) === false ? 'erro' : 'salvo';
    notify();
  }

  const api = {
    get recipe() { return recipe; },
    get status() { return status; },

    load(next) {
      api.flush();
      recipe = next;
      status = 'salvo';
      notify();
    },

    update(mutator) {
      if (!recipe) return;
      mutator(recipe);
      status = 'salvando';
      if (timer != null) clearTimeoutFn(timer);
      timer = setTimeoutFn(runSave, delay);
      notify();
    },

    flush() {
      if (timer == null) return;
      clearTimeoutFn(timer);
      runSave();
    },

    clear() {
      api.flush();
      recipe = null;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
  return api;
}

export const store = createStore({ save: saveRecipe });
