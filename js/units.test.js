import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packageInBase, PACKAGE_UNITS } from './units.js';

test('packageInBase: weight units become grams', () => {
  assert.deepEqual(packageInBase(1, 'kg'), { valor: 1000, base: 'g' });
  assert.deepEqual(packageInBase(395, 'g'), { valor: 395, base: 'g' });
  assert.deepEqual(packageInBase(500, 'mg'), { valor: 0.5, base: 'g' });
});

test('packageInBase: volume units become ml', () => {
  assert.deepEqual(packageInBase(1.5, 'l'), { valor: 1500, base: 'ml' });
  assert.deepEqual(packageInBase(200, 'ml'), { valor: 200, base: 'ml' });
});

test('packageInBase: pieces stay pieces; unknown unit is null', () => {
  assert.deepEqual(packageInBase(12, 'unidade'), { valor: 12, base: 'unidade' });
  assert.equal(packageInBase(1, 'xicara'), null);
  assert.equal(packageInBase(1, undefined), null);
});

test('PACKAGE_UNITS: every unit maps to g, ml or unidade', () => {
  assert.deepEqual(Object.keys(PACKAGE_UNITS), ['g', 'kg', 'mg', 'ml', 'l', 'unidade']);
  for (const { base } of Object.values(PACKAGE_UNITS)) assert.ok(['g', 'ml', 'unidade'].includes(base));
});
