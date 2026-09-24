import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateRecipe, getRecipes, saveRecipe, deleteRecipe, restoreRecipe, createEmptyRecipe
} from './storage.js';

// Node has no localStorage; install an in-memory one per test.
function installMemoryStorage({ failWrites = false } = {}) {
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)); },
    removeItem: (k) => data.delete(k)
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return data;
}

beforeEach(() => installMemoryStorage());

test('migrateRecipe: backfills quantidadeEmbalagens from rendimento', () => {
  const migrated = migrateRecipe({ id: 'r', rendimento: 20, ingredientes: [] });
  assert.equal(migrated.quantidadeEmbalagens, 20);
});

test('migrateRecipe: keeps an existing quantidadeEmbalagens, including 0', () => {
  assert.equal(migrateRecipe({ id: 'r', rendimento: 20, quantidadeEmbalagens: 5, ingredientes: [] }).quantidadeEmbalagens, 5);
  assert.equal(migrateRecipe({ id: 'r', rendimento: 20, quantidadeEmbalagens: 0, ingredientes: [] }).quantidadeEmbalagens, 0);
});

test('migrateRecipe: drops blank ingredient rows saved by the old editor', () => {
  const migrated = migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [{ nome: 'Farinha' }, { nome: '' }, { nome: '   ' }] });
  assert.deepEqual(migrated.ingredientes.map((i) => i.nome), ['Farinha']);
});

test('migrateRecipe: is idempotent and does not mutate its input', () => {
  const original = { id: 'r', rendimento: 3, ingredientes: [{ nome: 'A' }, { nome: '' }] };
  const once = migrateRecipe(original);
  assert.deepEqual(migrateRecipe(once), once);
  assert.equal(original.ingredientes.length, 2);
  assert.equal('quantidadeEmbalagens' in original, false);
});

test('getRecipes: returns migrated recipes', () => {
  localStorage.setItem('calculadora-cozinha:recipes', JSON.stringify([{ id: 'r', nome: 'Velha', rendimento: 4, ingredientes: [{ nome: '' }] }]));
  const [recipe] = getRecipes();
  assert.equal(recipe.quantidadeEmbalagens, 4);
  assert.equal(recipe.ingredientes.length, 0);
});

test('saveRecipe: returns true on success and false when storage refuses', () => {
  assert.equal(saveRecipe(createEmptyRecipe()), true);
  installMemoryStorage({ failWrites: true });
  assert.equal(saveRecipe(createEmptyRecipe()), false);
});

test('deleteRecipe + restoreRecipe: undo puts the recipe back at the same position', () => {
  const a = { ...createEmptyRecipe(), nome: 'A' };
  const b = { ...createEmptyRecipe(), nome: 'B' };
  const c = { ...createEmptyRecipe(), nome: 'C' };
  [a, b, c].forEach(saveRecipe);

  const removed = deleteRecipe(b.id);
  assert.equal(removed.index, 1);
  assert.equal(removed.recipe.nome, 'B');
  assert.deepEqual(getRecipes().map((r) => r.nome), ['A', 'C']);

  restoreRecipe(removed.recipe, removed.index);
  assert.deepEqual(getRecipes().map((r) => r.nome), ['A', 'B', 'C']);
});

test('deleteRecipe: unknown id returns null', () => {
  assert.equal(deleteRecipe('recipe:nope'), null);
});
