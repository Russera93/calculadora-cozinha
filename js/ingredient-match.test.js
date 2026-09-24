import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyIngredientItem, findKnownIngredient, applyIngredientMatch,
  buildCustomIngredient, NUTRIENT_LABELS, ingredientNameSuggestions
} from './ingredient-match.js';

test('emptyIngredientItem: blank row with grams defaults', () => {
  assert.deepEqual(emptyIngredientItem(), {
    ingredientId: null, nome: '', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null
  });
});

test('findKnownIngredient: fixed DB first, then custom, accent/case-insensitive', () => {
  assert.equal(findKnownIngredient('acucar', []).nome, 'Açúcar');
  const custom = [{ id: 'custom:1', nome: 'Nutella', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null }];
  assert.equal(findKnownIngredient('NUTELLA', custom).id, 'custom:1');
  assert.equal(findKnownIngredient('Granulado', custom), null);
});

test('applyIngredientMatch: eggs default both units to "unidade"', () => {
  const item = emptyIngredientItem();
  item.nome = 'Ovos';
  const matched = applyIngredientMatch(item, { known: findKnownIngredient('Ovos', []), precoConhecido: null });
  assert.equal(matched, true);
  assert.equal(item.ingredientId, 'fixed:ovos');
  assert.equal(item.pesoUnidadeG, 50);
  assert.equal(item.unidade, 'unidade');
  assert.equal(item.unidadeEmbalagem, 'unidade');
});

test('applyIngredientMatch: unmatched name clears stale data from a previous match', () => {
  const item = { ...emptyIngredientItem(), ingredientId: 'fixed:ovos', nutricao100g: { kcal: 1 }, densidadeGml: 1, pesoUnidadeG: 50 };
  const matched = applyIngredientMatch(item, { known: null, precoConhecido: null });
  assert.equal(matched, false);
  assert.equal(item.ingredientId, null);
  assert.equal(item.nutricao100g, null);
  assert.equal(item.densidadeGml, null);
  assert.equal(item.pesoUnidadeG, null);
});

test('applyIngredientMatch: known price fills untouched price fields, matched or not', () => {
  const preco = { nome: 'Granulado', precoEmbalagem: 8, tamanhoEmbalagem: 500, unidadeEmbalagem: 'g' };
  const item = emptyIngredientItem();
  applyIngredientMatch(item, { known: null, precoConhecido: preco });
  assert.equal(item.precoEmbalagem, 8);
  assert.equal(item.tamanhoEmbalagem, 500);
});

test('applyIngredientMatch: never overwrites a price the person already typed', () => {
  const preco = { nome: 'Granulado', precoEmbalagem: 8, tamanhoEmbalagem: 500, unidadeEmbalagem: 'g' };
  const item = { ...emptyIngredientItem(), precoEmbalagem: 9.9 };
  applyIngredientMatch(item, { known: null, precoConhecido: preco });
  assert.equal(item.precoEmbalagem, 9.9);
  assert.equal(item.tamanhoEmbalagem, 0);
});

test('buildCustomIngredient: typed nutrition, ml packages get density 1', () => {
  const ing = buildCustomIngredient({
    id: 'custom:x', nome: 'Leite de coco', unidadeEmbalagem: 'ml',
    nutricaoDigitada: { kcal: 166, carboidratos: null }, nutricaoTaco: null
  });
  assert.equal(ing.densidadeGml, 1);
  assert.equal(ing.categoria, 'outro');
  assert.equal(ing.pesoUnidadeG, null);
  assert.equal(ing.nutricao100g.kcal, 166);
  assert.equal(ing.nutricao100g.carboidratos, null);
});

test('buildCustomIngredient: nothing typed and no TACO data -> nutricao100g null', () => {
  const ing = buildCustomIngredient({ id: 'custom:x', nome: 'X', unidadeEmbalagem: 'g', nutricaoDigitada: {}, nutricaoTaco: null });
  assert.equal(ing.nutricao100g, null);
  assert.equal(ing.densidadeGml, null);
});

test('buildCustomIngredient: keeps gordurasSaturadas from TACO (not user-editable)', () => {
  const ing = buildCustomIngredient({ id: 'custom:x', nome: 'X', unidadeEmbalagem: 'g', nutricaoDigitada: {}, nutricaoTaco: { gordurasSaturadas: 3.2 } });
  assert.equal(ing.nutricao100g.gordurasSaturadas, 3.2);
});

test('NUTRIENT_LABELS: user-editable nutrients only', () => {
  assert.deepEqual(Object.keys(NUTRIENT_LABELS), ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio', 'acucaresAdicionados']);
});

test('ingredientNameSuggestions: fixed + custom, sorted pt-BR, no duplicates', () => {
  const names = ingredientNameSuggestions([{ nome: 'Nutella' }, { nome: 'açúcar' }]);
  assert.ok(names.includes('Nutella'));
  assert.equal(names.filter((n) => n.toLowerCase().startsWith('a') && n.toLowerCase().includes('car')).length, 1);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
});
