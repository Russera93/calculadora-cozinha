import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store.js';

function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    setTimeoutFn: (fn) => { const id = next++; pending.set(id, fn); return id; },
    clearTimeoutFn: (id) => pending.delete(id),
    runAll: () => { const fns = [...pending.values()]; pending.clear(); fns.forEach((fn) => fn()); },
    get count() { return pending.size; }
  };
}

function setup(saveResult = true) {
  const saved = [];
  const timers = fakeTimers();
  const store = createStore({ save: (r) => { saved.push(structuredClone(r)); return saveResult; }, ...timers });
  return { store, saved, timers };
}

test('update applies the change immediately and saves once after the debounce', () => {
  const { store, saved, timers } = setup();
  store.load({ id: 'r', nome: '' });
  store.update((r) => { r.nome = 'B'; });
  store.update((r) => { r.nome = 'Bo'; });
  assert.equal(store.recipe.nome, 'Bo');
  assert.equal(store.status, 'salvando');
  assert.equal(saved.length, 0);
  assert.equal(timers.count, 1);
  timers.runAll();
  assert.deepEqual(saved.map((r) => r.nome), ['Bo']);
  assert.equal(store.status, 'salvo');
});

test('flush saves pending changes right away; without pending changes it does nothing', () => {
  const { store, saved } = setup();
  store.load({ id: 'r', nome: '' });
  store.flush();
  assert.equal(saved.length, 0);
  store.update((r) => { r.nome = 'X'; });
  store.flush();
  assert.equal(saved.length, 1);
});

test('a refused save sets status to erro', () => {
  const { store, timers } = setup(false);
  store.load({ id: 'r', nome: '' });
  store.update((r) => { r.nome = 'X'; });
  timers.runAll();
  assert.equal(store.status, 'erro');
});

test('load flushes the previous recipe before switching', () => {
  const { store, saved } = setup();
  store.load({ id: 'a', nome: '' });
  store.update((r) => { r.nome = 'A'; });
  store.load({ id: 'b', nome: '' });
  assert.deepEqual(saved.map((r) => r.id), ['a']);
  assert.equal(store.recipe.id, 'b');
  assert.equal(store.status, 'salvo');
});

test('subscribers are notified on update and status change; unsubscribe stops it', () => {
  const { store, timers } = setup();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.load({ id: 'r', nome: '' });
  store.update((r) => { r.nome = 'X'; });
  timers.runAll();
  assert.equal(calls, 3); // load, update, saved
  unsubscribe();
  store.update((r) => { r.nome = 'Y'; });
  assert.equal(calls, 3);
});

test('update and clear with no recipe open are safe no-ops', () => {
  const { store, saved } = setup();
  store.update((r) => { r.nome = 'X'; });
  store.clear();
  assert.equal(store.recipe, null);
  assert.equal(saved.length, 0);
});
