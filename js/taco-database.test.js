// js/taco-database.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTacoDatabase, findInTaco, DENSITY_BY_CATEGORY } from './taco-database.js';

const rawTaco = JSON.parse(readFileSync(new URL('../data/taco.json', import.meta.url)));

test('data/taco.json is non-empty', () => {
  assert.ok(rawTaco.length > 10, 'expected a real dataset, not an empty/placeholder file');
});

test('loadTacoDatabase: normalizes raw rows into full Ingredient records', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  assert.equal(ingredients.length, rawTaco.length);
  for (const ing of ingredients.slice(0, 5)) {
    assert.ok(ing.id.startsWith('taco:'));
    assert.ok(ing.nome);
    assert.ok(ing.categoria);
    assert.ok(ing.nutricao100g);
  }
});

test('loadTacoDatabase: assigns density from category', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  for (const ing of ingredients) {
    assert.equal(ing.densidadeGml, DENSITY_BY_CATEGORY[ing.categoria] ?? null);
  }
});

test('findInTaco: exact name match', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  const target = ingredients[0];
  const found = findInTaco(target.nome, ingredients);
  assert.equal(found.id, target.id);
});

test('findInTaco: case/accent-insensitive partial match', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  const target = ingredients[0];
  const query = target.nome.slice(0, 5).toUpperCase();
  const found = findInTaco(query, ingredients);
  assert.ok(found, 'expected a fuzzy match for a partial, differently-cased query');
});

test('findInTaco: no match returns null', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  assert.equal(findInTaco('zzzzznaoexistequalquercoisa', ingredients), null);
});
