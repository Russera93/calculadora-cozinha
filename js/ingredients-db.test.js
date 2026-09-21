import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_INGREDIENTS, findFixedIngredient } from './ingredients-db.js';

test('FIXED_INGREDIENTS has the 11 ingredients from the product spec', () => {
  assert.equal(FIXED_INGREDIENTS.length, 11);
});

test('every fixed ingredient has a complete nutrition profile', () => {
  for (const ing of FIXED_INGREDIENTS) {
    assert.ok(ing.nutricao100g, `${ing.nome} should have nutricao100g`);
    for (const key of ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio']) {
      assert.equal(typeof ing.nutricao100g[key], 'number', `${ing.nome}.${key}`);
    }
  }
});

test('findFixedIngredient: exact match', () => {
  const flour = findFixedIngredient('Farinha de trigo');
  assert.ok(flour);
  assert.equal(flour.id, 'fixed:farinha-de-trigo');
});

test('findFixedIngredient: case and accent insensitive', () => {
  const flour = findFixedIngredient('farinha de trigo');
  assert.ok(flour);
  assert.equal(flour.id, 'fixed:farinha-de-trigo');
});

test('findFixedIngredient: no match returns null', () => {
  assert.equal(findFixedIngredient('Ingrediente Inexistente'), null);
});

test('egg has pesoUnidadeG for "unidade" conversion', () => {
  const egg = findFixedIngredient('Ovos');
  assert.equal(egg.pesoUnidadeG, 50);
});

test('flour has densidadeGml for volume conversion', () => {
  const flour = findFixedIngredient('Farinha de trigo');
  assert.equal(flour.densidadeGml, 0.5);
});
