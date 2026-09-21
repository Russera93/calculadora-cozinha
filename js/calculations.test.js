import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity } from './calculations.js';

test('parseQuantity: integer', () => {
  assert.equal(parseQuantity('2'), 2);
});

test('parseQuantity: decimal with dot', () => {
  assert.equal(parseQuantity('0.5'), 0.5);
});

test('parseQuantity: decimal with comma', () => {
  assert.equal(parseQuantity('0,5'), 0.5);
});

test('parseQuantity: simple fraction', () => {
  assert.equal(parseQuantity('1/2'), 0.5);
  assert.equal(parseQuantity('1/4'), 0.25);
  assert.equal(parseQuantity('3/4'), 0.75);
});

test('parseQuantity: mixed number', () => {
  assert.equal(parseQuantity('1 1/2'), 1.5);
});

test('parseQuantity: invalid input returns null', () => {
  assert.equal(parseQuantity('abc'), null);
  assert.equal(parseQuantity(''), null);
  assert.equal(parseQuantity('1/0'), null);
});
