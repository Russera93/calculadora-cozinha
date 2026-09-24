import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeResult } from './results.js';

function item(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null, ...overrides
  };
}
function recipe(overrides) {
  return {
    rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 0, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null,
    // 500 g of a R$ 10/kg ingredient = R$ 5,00 -> R$ 0,50 per portion
    ingredientes: [item({ nome: 'Farinha', quantidadeBruta: '500', precoEmbalagem: 10, tamanhoEmbalagem: 1000 })],
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

test('recipeResult: cost per portion and per-portion suggestions', () => {
  const r = recipeResult(recipe());
  assert.equal(r.kind, 'semPreco');
  assert.equal(r.custoTotal, 5);
  assert.equal(r.custoPorPorcao, 0.5);
  assert.deepEqual(r.sugeridos, { preco2x: 1, preco3x: 1.5, preco4x: 2 });
  assert.equal(r.lucroPorPorcao, null);
});

test('recipeResult: profit per portion and for the whole recipe', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 2 }));
  assert.equal(r.kind, 'lucro');
  assert.equal(r.lucroPorPorcao, 1.5);
  assert.equal(r.lucroTotal, 15);
  assert.equal(r.vezesOCusto, 4);
  assert.equal(r.margem, 75);
  assert.equal(r.markup, 300);
});

test('recipeResult: selling below cost is prejuizo', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 0.3 }));
  assert.equal(r.kind, 'prejuizo');
  assert.equal(round2(r.lucroPorPorcao), -0.2);
});

test('recipeResult: an explicit price of 0 is still a price (prejuizo), not "semPreco"', () => {
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 0 })).kind, 'prejuizo');
});

test('recipeResult: zero yield wins over everything else', () => {
  const r = recipeResult(recipe({ rendimento: 0, precoVendaDesejado: 2 }));
  assert.equal(r.kind, 'semRendimento');
  assert.equal(r.custoPorPorcao, null);
  assert.equal(r.sugeridos, null);
});

test('recipeResult: no ingredient with a computable cost is semIngredientes', () => {
  assert.equal(recipeResult(recipe({ ingredientes: [] })).kind, 'semIngredientes');
  assert.equal(recipeResult(recipe({ ingredientes: [item({ nome: 'Sal' })] })).kind, 'semIngredientes');
});

test('recipeResult: counts ingredients without cost and per-portion extras', () => {
  const r = recipeResult(recipe({
    ingredientes: [...recipe().ingredientes, item({ nome: 'Sal' })],
    embalagemUnitaria: 0.5, quantidadeEmbalagens: 10,
    valorBotijao: 120, tempoPreparoMinutos: 25
  }));
  assert.equal(r.ingredientesSemCusto, 1);
  assert.equal(r.embalagensPorPorcao, 0.5);
  assert.equal(round2(r.gasPorPorcao), 0.1);
});
