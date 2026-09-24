import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBRL, formatNumber, formatCurrencyInput, formatDecimalInput,
  maskCurrencyDigits, parseDecimal, parseInteger, unitLabel, packageUnitShort,
  UNIT_CHIPS, PACKAGE_UNIT_CHIPS
} from './format.js';

test('formatBRL: pt-BR currency with a plain space and comma decimals', () => {
  assert.equal(formatBRL(33.51), 'R$ 33,51');
  assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
  assert.equal(formatBRL(0), 'R$ 0,00');
  assert.equal(formatBRL(-2), '-R$ 2,00');
});

test('formatBRL: non-numbers render as R$ 0,00 instead of NaN', () => {
  assert.equal(formatBRL(null), 'R$ 0,00');
  assert.equal(formatBRL(undefined), 'R$ 0,00');
});

test('formatNumber: pt-BR grouping and rounding', () => {
  assert.equal(formatNumber(903.65, 0), '904');
  assert.equal(formatNumber(13.65, 1), '13,7');
  assert.equal(formatNumber(1234.5, 1), '1.234,5');
  assert.equal(formatNumber(60), '60');
});

test('formatCurrencyInput: two decimals, comma, no grouping', () => {
  assert.equal(formatCurrencyInput(10), '10,00');
  assert.equal(formatCurrencyInput(1234.5), '1234,50');
  assert.equal(formatCurrencyInput(null), '0,00');
});

test('formatDecimalInput: comma decimal, trims float noise, no grouping', () => {
  assert.equal(formatDecimalInput(1.5), '1,5');
  assert.equal(formatDecimalInput(395), '395');
  assert.equal(formatDecimalInput(1000), '1000');
  assert.equal(formatDecimalInput(0.1 + 0.2), '0,3');
});

test('maskCurrencyDigits: digits shift in from the right (bank-app style)', () => {
  assert.deepEqual(maskCurrencyDigits('050'), { value: 0.5, text: '0,50' });
  assert.deepEqual(maskCurrencyDigits('1000'), { value: 10, text: '10,00' });
  assert.deepEqual(maskCurrencyDigits('7,499'), { value: 74.99, text: '74,99' });
});

test('maskCurrencyDigits: pasted "R$ 1.234,56" becomes 1234.56', () => {
  assert.deepEqual(maskCurrencyDigits('R$ 1.234,56'), { value: 1234.56, text: '1234,56' });
});

test('maskCurrencyDigits: empty input is 0 by default, null with allowEmpty', () => {
  assert.deepEqual(maskCurrencyDigits(''), { value: 0, text: '0,00' });
  assert.deepEqual(maskCurrencyDigits('', { allowEmpty: true }), { value: null, text: '' });
  assert.deepEqual(maskCurrencyDigits('R$ ', { allowEmpty: true }), { value: null, text: '' });
});

test('parseDecimal: comma or dot, invalid is 0', () => {
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal('2.25'), 2.25);
  assert.equal(parseDecimal('abc'), 0);
  assert.equal(parseDecimal(''), 0);
});

test('parseInteger: keeps digits only, empty is 0', () => {
  assert.equal(parseInteger('30'), 30);
  assert.equal(parseInteger(' 3a0 '), 30);
  assert.equal(parseInteger(''), 0);
});

test('unitLabel: readable pt-BR names, plural above 1', () => {
  assert.equal(unitLabel('colherSopa', 1), 'colher de sopa');
  assert.equal(unitLabel('colherSopa', 2), 'colheres de sopa');
  assert.equal(unitLabel('colherCha', 0.5), 'colher de chá');
  assert.equal(unitLabel('xicara', 1.5), 'xícaras');
  assert.equal(unitLabel('unidade', 2), 'unidades');
  assert.equal(unitLabel('unidade', null), 'unidade');
  assert.equal(unitLabel('g', 100), 'g');
  assert.equal(unitLabel('ml', 200), 'ml');
  assert.equal(unitLabel('litro', 2), 'litro');
});

test('packageUnitShort: g, ml, un.', () => {
  assert.equal(packageUnitShort('g'), 'g');
  assert.equal(packageUnitShort('ml'), 'ml');
  assert.equal(packageUnitShort('unidade'), 'un.');
});

test('chip lists cover every stored unit value', () => {
  assert.deepEqual(UNIT_CHIPS.map((c) => c.value), ['g', 'ml', 'xicara', 'colherSopa', 'colherCha', 'unidade']);
  assert.deepEqual(PACKAGE_UNIT_CHIPS.map((c) => c.value), ['g', 'ml', 'unidade']);
});
