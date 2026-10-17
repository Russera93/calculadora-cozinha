import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, buildHash, TABS } from './router.js';

test('parseRoute: list and settings', () => {
  assert.deepEqual(parseRoute(''), { screen: 'lista' });
  assert.deepEqual(parseRoute('#/'), { screen: 'lista' });
  assert.deepEqual(parseRoute('#/ajustes'), { screen: 'lista', sheet: 'ajustes' });
});

test('parseRoute: editor defaults to the Ingredientes tab', () => {
  assert.deepEqual(parseRoute('#/receita/abc'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes' });
});

test('parseRoute: every tab', () => {
  for (const aba of TABS) {
    assert.deepEqual(parseRoute(`#/receita/abc/${aba}`), { screen: 'editor', recipeId: 'abc', aba });
  }
});

test('parseRoute: ingredient sheet by index or new', () => {
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/2'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 2 });
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/novo'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 'novo' });
});

test('parseRoute: links to the removed "Meu negócio" fall back safely', () => {
  assert.deepEqual(parseRoute('#/negocio'), { screen: 'lista' });
  assert.deepEqual(parseRoute('#/receita/abc/preco/negocio'), { screen: 'lista' });
});

test('parseRoute: receipt sheet', () => {
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/nota'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 'nota' });
  assert.deepEqual(parseRoute('#/receita/abc/custos/nota'), { screen: 'lista' });
});

test('parseRoute: anything unknown falls back to the list', () => {
  for (const hash of ['#/xyz', '#/receita', '#/receita/abc/lucro', '#/receita/abc/custos/2', '#/receita/abc/ingredientes/-1', '#/receita/abc/ingredientes/x', '#/receita/%E0%A4%A']) {
    assert.deepEqual(parseRoute(hash), { screen: 'lista' }, hash);
  }
});

test('buildHash: round-trips, including recipe ids with ":"', () => {
  const routes = [
    { screen: 'lista' },
    { screen: 'lista', sheet: 'ajustes' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'preco' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes', item: 0 },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes', item: 'novo' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes', item: 'nota' }
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(buildHash(route)), route);
  }
  assert.equal(buildHash({ screen: 'lista' }), '#/');
  assert.equal(buildHash({ screen: 'editor', recipeId: 'recipe:1', aba: 'custos' }), '#/receita/recipe%3A1/custos');
});

test('parseRoute/buildHash: meus ingredientes', () => {
  assert.deepEqual(parseRoute('#/meus-ingredientes'), { screen: 'meus-ingredientes' });
  assert.equal(buildHash({ screen: 'meus-ingredientes' }), '#/meus-ingredientes');
});

test('parseRoute/buildHash: cardápio', () => {
  assert.deepEqual(parseRoute('#/cardapio'), { screen: 'cardapio' });
  assert.equal(buildHash({ screen: 'cardapio' }), '#/cardapio');
});

test('parseRoute/buildHash: ready-made recipes catalog and detail', () => {
  assert.deepEqual(parseRoute('#/prontas'), { screen: 'prontas' });
  assert.deepEqual(parseRoute('#/prontas/brigadeiro'), { screen: 'pronta', prontaId: 'brigadeiro' });
  assert.deepEqual(parseRoute('#/prontas/a/b'), { screen: 'lista' });
  assert.equal(buildHash({ screen: 'prontas' }), '#/prontas');
  assert.equal(buildHash({ screen: 'pronta', prontaId: 'bolo de pote' }), '#/prontas/bolo%20de%20pote');
  assert.deepEqual(parseRoute(buildHash({ screen: 'pronta', prontaId: 'bolo de pote' })), { screen: 'pronta', prontaId: 'bolo de pote' });
});

test('parseRoute/buildHash: modo de preparo sheet', () => {
  const route = { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 'preparo' };
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/preparo'), route);
  assert.equal(buildHash(route), '#/receita/abc/ingredientes/preparo');
  assert.deepEqual(parseRoute('#/receita/abc/custos/preparo'), { screen: 'lista' });
});

test('parseRoute/buildHash: modo cozinhando, na receita da pessoa e na receita pronta', () => {
  const naReceita = { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 'cozinhar' };
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/cozinhar'), naReceita);
  assert.equal(buildHash(naReceita), '#/receita/abc/ingredientes/cozinhar');

  const naPronta = { screen: 'pronta', prontaId: 'brigadeiro', cozinhar: true };
  assert.deepEqual(parseRoute('#/prontas/brigadeiro/cozinhar'), naPronta);
  assert.equal(buildHash(naPronta), '#/prontas/brigadeiro/cozinhar');
  assert.deepEqual(parseRoute(buildHash(naPronta)), naPronta);
});
