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
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes', item: 'novo' }
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(buildHash(route)), route);
  }
  assert.equal(buildHash({ screen: 'lista' }), '#/');
  assert.equal(buildHash({ screen: 'editor', recipeId: 'recipe:1', aba: 'custos' }), '#/receita/recipe%3A1/custos');
});
