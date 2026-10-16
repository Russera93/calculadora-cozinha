import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeResult } from './results.js';
import { TAXAS_PADRAO, normalizeTaxas } from './taxas.js';

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
    precoVendaDesejado: null, canalVenda: 'direto',
    // 500 g of a R$ 10/kg ingredient = R$ 5,00 -> R$ 0,50 per unit
    ingredientes: [item({ nome: 'Farinha', quantidadeBruta: '500', precoEmbalagem: 10, tamanhoEmbalagem: 1000 })],
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;
const taxas = normalizeTaxas({ taxaMaquininha: 5, taxaIfood: 20 });

test('custo por unidade = ingredientes + embalagem + gás, dividido pelo rendimento', () => {
  const r = recipeResult(recipe({ embalagemUnitaria: 0.5, quantidadeEmbalagens: 10, valorBotijao: 120, tempoPreparoMinutos: 25 }));
  assert.equal(r.kind, 'semPreco');
  assert.equal(r.custoTotal, 5 + 5 + 1);
  assert.equal(round2(r.custoPorUnidade), 1.1);
  assert.equal(r.ingredientesPorUnidade, 0.5);
  assert.equal(r.embalagensPorUnidade, 0.5);
  assert.equal(round2(r.gasPorUnidade), 0.1);
});

test('sugestões 2×, 3×, 4× o custo, arredondadas para cima', () => {
  // 0,50 × 2/3/4 = 1,00 / 1,50 / 2,00 (já são preços "bonitos")
  assert.deepEqual(recipeResult(recipe()).sugeridos, { preco2x: 1, preco3x: 1.5, preco4x: 2 });
  // 0,85 × 2/3/4 = 1,70 / 2,55 / 3,40 -> 2,00 / 3,00 / 3,50
  const r = recipeResult(recipe({ embalagemUnitaria: 0.25, quantidadeEmbalagens: 10, valorBotijao: 120, tempoPreparoMinutos: 25 }));
  assert.deepEqual(r.sugeridos, { preco2x: 2, preco3x: 3, preco4x: 3.5 });
});

test('você ganha = preço − custo, por unidade e na receita toda', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 2 }));
  assert.equal(r.kind, 'ganho');
  assert.equal(r.gastoPorUnidade, 0.5);
  assert.equal(r.ganhoPorUnidade, 1.5);
  assert.equal(r.ganhoTotal, 15);
  assert.equal(r.margem, 75);
  assert.equal(r.markup, 300);
});

test('taxa do canal sai do preço e as sugestões já a compensam', () => {
  const r = recipeResult(recipe({ canalVenda: 'ifood', precoVendaDesejado: 2 }), taxas);
  assert.equal(r.taxa, 0.2);
  assert.equal(round2(r.taxaPorUnidade), 0.4);
  assert.equal(round2(r.gastoPorUnidade), 0.9);
  assert.equal(round2(r.ganhoPorUnidade), 1.1);
  // 2× = 1,00 / 0,8 = 1,25 -> 1,50; 3× = 1,875 -> 2,00; 4× = 2,50
  assert.deepEqual(r.sugeridos, { preco2x: 1.5, preco3x: 2, preco4x: 2.5 });
  // Pix/cash: no fee even with fees typed
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 2 }), taxas).taxaPorUnidade, 0);
});

test('preço abaixo do custo é prejuízo; preço 0 ainda é preço', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 0.3 }));
  assert.equal(r.kind, 'prejuizo');
  assert.equal(round2(r.ganhoPorUnidade), -0.2);
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 0 })).kind, 'prejuizo');
});

test('rendimento zero vence tudo; sem ingrediente com custo é semIngredientes', () => {
  const r = recipeResult(recipe({ rendimento: 0, precoVendaDesejado: 2 }));
  assert.equal(r.kind, 'semRendimento');
  assert.equal(r.custoPorUnidade, null);
  assert.equal(r.sugeridos, null);
  assert.equal(recipeResult(recipe({ ingredientes: [] })).kind, 'semIngredientes');
  assert.equal(recipeResult(recipe({ ingredientes: [item({ nome: 'Sal' })] })).kind, 'semIngredientes');
});

test('conta ingredientes sem preço', () => {
  const r = recipeResult(recipe({ ingredientes: [...recipe().ingredientes, item({ nome: 'Sal' })] }));
  assert.equal(r.ingredientesSemCusto, 1);
});

test('campos antigos (tempo de trabalho, perda) não mudam mais a conta', () => {
  const antiga = recipe({ tempoTrabalhoMinutos: 90, perdaPercent: 10, precoVendaDesejado: 2 });
  assert.equal(recipeResult(antiga, TAXAS_PADRAO).custoPorUnidade, 0.5);
  assert.equal(recipeResult(antiga).ganhoPorUnidade, 1.5);
});
