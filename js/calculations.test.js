import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity, toGrams, VOLUME_ML } from './calculations.js';

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

test('VOLUME_ML has the spec-defined base units', () => {
  assert.equal(VOLUME_ML.xicara, 240);
  assert.equal(VOLUME_ML.colherSopa, 15);
  assert.equal(VOLUME_ML.colherCha, 5);
});

test('toGrams: direct grams passthrough', () => {
  assert.equal(toGrams({ quantidade: 240, unidade: 'g', densidadeGml: null, pesoUnidadeG: null }), 240);
});

test('toGrams: ml converted via density', () => {
  // densidade 1 g/ml: 100ml -> 100g
  assert.equal(toGrams({ quantidade: 100, unidade: 'ml', densidadeGml: 1, pesoUnidadeG: null }), 100);
});

test('toGrams: xicara converted via density (flour example)', () => {
  // flour density 0.5 g/ml -> 1 xicara (240ml) = 120g
  assert.equal(toGrams({ quantidade: 1, unidade: 'xicara', densidadeGml: 0.5, pesoUnidadeG: null }), 120);
});

test('toGrams: colherSopa and colherCha use the same density path', () => {
  assert.equal(toGrams({ quantidade: 1, unidade: 'colherSopa', densidadeGml: 1, pesoUnidadeG: null }), 15);
  assert.equal(toGrams({ quantidade: 1, unidade: 'colherCha', densidadeGml: 1, pesoUnidadeG: null }), 5);
});

test('toGrams: unidade (count) uses pesoUnidadeG', () => {
  // 2 eggs at 50g each -> 100g
  assert.equal(toGrams({ quantidade: 2, unidade: 'unidade', densidadeGml: null, pesoUnidadeG: 50 }), 100);
});

test('toGrams: missing density/weight needed for the given unit returns null', () => {
  assert.equal(toGrams({ quantidade: 1, unidade: 'xicara', densidadeGml: null, pesoUnidadeG: null }), null);
  assert.equal(toGrams({ quantidade: 1, unidade: 'unidade', densidadeGml: null, pesoUnidadeG: null }), null);
});

test('toGrams: unknown unit returns null', () => {
  assert.equal(toGrams({ quantidade: 1, unidade: 'litro', densidadeGml: 1, pesoUnidadeG: null }), null);
});

// calculateIngredientCost tests
import { calculateIngredientCost } from './calculations.js';

test('calculateIngredientCost: spec reference example (flour)', () => {
  // 1000g bought for R$5.00, 240g used -> R$1.20
  const cost = calculateIngredientCost({ gramasUsadas: 240, gramasEmbalagem: 1000, precoEmbalagem: 5 });
  assert.equal(Math.round(cost * 100) / 100, 1.2);
});

test('calculateIngredientCost: zero or negative package size returns null', () => {
  assert.equal(calculateIngredientCost({ gramasUsadas: 100, gramasEmbalagem: 0, precoEmbalagem: 5 }), null);
  assert.equal(calculateIngredientCost({ gramasUsadas: 100, gramasEmbalagem: -10, precoEmbalagem: 5 }), null);
});

test('calculateIngredientCost: negative price returns null', () => {
  assert.equal(calculateIngredientCost({ gramasUsadas: 100, gramasEmbalagem: 1000, precoEmbalagem: -5 }), null);
});

test('calculateIngredientCost: missing gramasUsadas returns null', () => {
  assert.equal(calculateIngredientCost({ gramasUsadas: null, gramasEmbalagem: 1000, precoEmbalagem: 5 }), null);
});

// calculateGasCost tests
import { calculateGasCost } from './calculations.js';

test('calculateGasCost: standard example', () => {
  // R$100 cylinder / 3000 min * 30 min preparo = R$1.00
  assert.equal(calculateGasCost({ valorBotijao: 100, tempoPreparoMinutos: 30 }), 1);
});

test('calculateGasCost: zero prep time is valid and costs zero', () => {
  assert.equal(calculateGasCost({ valorBotijao: 100, tempoPreparoMinutos: 0 }), 0);
});

test('calculateGasCost: negative values return null', () => {
  assert.equal(calculateGasCost({ valorBotijao: -100, tempoPreparoMinutos: 30 }), null);
  assert.equal(calculateGasCost({ valorBotijao: 100, tempoPreparoMinutos: -1 }), null);
});

// calculateRecipeCost, calculateCostPerPortion, calculateSuggestedPrices, calculateRealMargin tests
import {
  calculateRecipeCost,
  calculateCostPerPortion,
  calculateSuggestedPrices,
  calculateRealMargin
} from './calculations.js';

test('calculateRecipeCost: sums the three cost components', () => {
  assert.equal(calculateRecipeCost({ ingredientesCost: 10, gasCost: 2, embalagensCost: 3 }), 15);
});

test('calculateCostPerPortion: divides total by yield', () => {
  assert.equal(calculateCostPerPortion({ custoTotal: 20, rendimento: 4 }), 5);
});

test('calculateCostPerPortion: zero or missing yield returns null', () => {
  assert.equal(calculateCostPerPortion({ custoTotal: 20, rendimento: 0 }), null);
  assert.equal(calculateCostPerPortion({ custoTotal: 20, rendimento: null }), null);
});

test('calculateSuggestedPrices: returns 2x and 3x total cost', () => {
  assert.deepEqual(calculateSuggestedPrices({ custoTotal: 10 }), { preco2x: 20, preco3x: 30 });
});

test('calculateRealMargin: percentage above cost per portion', () => {
  // sell at 10, cost per portion 4 -> margin = (10-4)/10 * 100 = 60%
  assert.equal(calculateRealMargin({ precoVenda: 10, custoPorPorcao: 4 }), 60);
});

test('calculateRealMargin: zero or missing sell price returns null', () => {
  assert.equal(calculateRealMargin({ precoVenda: 0, custoPorPorcao: 4 }), null);
  assert.equal(calculateRealMargin({ precoVenda: null, custoPorPorcao: 4 }), null);
});

// calculateNutritionPerPortion tests
import { calculateNutritionPerPortion } from './calculations.js';

test('calculateNutritionPerPortion: single ingredient, single portion', () => {
  const itens = [{
    gramas: 200,
    nutricao100g: { kcal: 100, carboidratos: 20, proteinas: 5, gorduras: 2, fibras: 1, sodio: 10 }
  }];
  const result = calculateNutritionPerPortion({ itens, rendimento: 1 });
  assert.equal(result.kcal, 200);
  assert.equal(result.carboidratos, 40);
  assert.equal(result.proteinas, 10);
  assert.equal(result.gorduras, 4);
  assert.equal(result.fibras, 2);
  assert.equal(result.sodio, 20);
  assert.equal(result.ingredientesSemDados, 0);
});

test('calculateNutritionPerPortion: divides by yield', () => {
  const itens = [{
    gramas: 100,
    nutricao100g: { kcal: 100, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0 }
  }];
  const result = calculateNutritionPerPortion({ itens, rendimento: 4 });
  assert.equal(result.kcal, 25);
});

test('calculateNutritionPerPortion: ignores ingredients with no nutrition data but counts them', () => {
  const itens = [
    { gramas: 100, nutricao100g: { kcal: 100, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0 } },
    { gramas: 50, nutricao100g: null }
  ];
  const result = calculateNutritionPerPortion({ itens, rendimento: 1 });
  assert.equal(result.kcal, 100);
  assert.equal(result.ingredientesSemDados, 1);
});

test('calculateNutritionPerPortion: zero yield returns null', () => {
  assert.equal(calculateNutritionPerPortion({ itens: [], rendimento: 0 }), null);
});
