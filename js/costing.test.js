import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLineCost, quantidadeConvertidaEmGramas, gramsUsed, lineIssue, ISSUE_TEXT, ingredientSummary } from './costing.js';

function item(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null,
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

test('computeLineCost: grams used from a gram package', () => {
  assert.equal(round2(computeLineCost(item({ quantidadeBruta: '240', precoEmbalagem: 5, tamanhoEmbalagem: 1000 }))), 1.2);
});

test('computeLineCost: ml package is converted through density', () => {
  // 900 ml of oil (0.92 g/ml) = 828 g for R$ 9; using 92 g -> R$ 1,00
  const oil = item({ quantidadeBruta: '92', precoEmbalagem: 9, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml', densidadeGml: 0.92 });
  assert.equal(round2(computeLineCost(oil)), 1);
});

test('computeLineCost: "2 unidades" of a can bought by weight = 2 whole cans', () => {
  const lata = item({ quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 });
  assert.equal(round2(computeLineCost(lata)), 14.98);
});

test('computeLineCost: eggs by the unit from a dozen', () => {
  const ovos = item({ quantidadeBruta: '3', unidade: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade', pesoUnidadeG: 50 });
  assert.equal(computeLineCost(ovos), 3);
});

test('computeLineCost: eggs by weight from a dozen uses the average egg weight', () => {
  const ovos = item({ quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade', pesoUnidadeG: 50 });
  assert.equal(computeLineCost(ovos), 2);
});

test('computeLineCost: fraction "1/2" of a xícara via density', () => {
  // 1/2 xícara (120 ml) of flour at 0.5 g/ml = 60 g; 1 kg costs R$ 5 -> R$ 0,30
  const farinha = item({ quantidadeBruta: '1/2', unidade: 'xicara', densidadeGml: 0.5, precoEmbalagem: 5, tamanhoEmbalagem: 1000 });
  assert.equal(round2(computeLineCost(farinha)), 0.3);
});

test('computeLineCost: impossible conversions return null', () => {
  assert.equal(computeLineCost(item({ quantidadeBruta: '1', unidade: 'xicara', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), null);
  assert.equal(computeLineCost(item({ quantidadeBruta: '100', unidade: 'g', unidadeEmbalagem: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12 })), null);
  assert.equal(computeLineCost(item({ quantidadeBruta: 'meia', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), null);
});

test('quantidadeConvertidaEmGramas: only when a real conversion happens', () => {
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'xicara', densidadeGml: 0.5 }), 0.5), 60);
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'unidade', pesoUnidadeG: 50, unidadeEmbalagem: 'g' }), 2), 100);
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'unidade', pesoUnidadeG: 50, unidadeEmbalagem: 'unidade' }), 2), null);
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'g' }), 100), null);
});

test('gramsUsed: direct, converted, and whole-package cases', () => {
  assert.equal(gramsUsed(item({ quantidadeBruta: '100', unidade: 'g' })), 100);
  assert.equal(gramsUsed(item({ quantidadeBruta: '1', unidade: 'colherSopa', densidadeGml: 1 })), 15);
  assert.equal(gramsUsed(item({ quantidadeBruta: '2', unidade: 'unidade', tamanhoEmbalagem: 395, unidadeEmbalagem: 'g' })), 790);
  assert.equal(Math.round(gramsUsed(item({ quantidadeBruta: '1', unidade: 'unidade', tamanhoEmbalagem: 200, unidadeEmbalagem: 'ml', densidadeGml: 1.03 }))), 206);
  assert.equal(gramsUsed(item({ quantidadeBruta: '2', unidade: 'unidade', pesoUnidadeG: 50 })), 100);
});

test('gramsUsed: unknown when it cannot be computed', () => {
  assert.equal(gramsUsed(item({ quantidadeBruta: '', unidade: 'g' })), null);
  assert.equal(gramsUsed(item({ quantidadeBruta: '1', unidade: 'xicara' })), null);
  assert.equal(gramsUsed(item({ quantidadeBruta: '1', unidade: 'unidade', tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade' })), null);
});

test('lineIssue: first missing piece, in the order a person fills the form', () => {
  assert.equal(lineIssue(item({})), 'quantidade');
  assert.equal(lineIssue(item({ quantidadeBruta: 'meia' })), 'quantidadeInvalida');
  assert.equal(lineIssue(item({ quantidadeBruta: '100' })), 'preco');
  assert.equal(lineIssue(item({ quantidadeBruta: '100', precoEmbalagem: 5 })), 'tamanho');
  assert.equal(lineIssue(item({ quantidadeBruta: '1', unidade: 'xicara', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), 'conversao');
  assert.equal(lineIssue(item({ quantidadeBruta: '100', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), null);
});

test('ISSUE_TEXT has a message for every issue', () => {
  for (const key of ['quantidade', 'quantidadeInvalida', 'preco', 'tamanho', 'conversao']) {
    assert.equal(typeof ISSUE_TEXT[key], 'string');
  }
});

test('ingredientSummary: quantity with readable unit and what was paid', () => {
  const lata = item({ quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 });
  assert.equal(ingredientSummary(lata), '2 unidades · R$ 7,49 / 395 g');
  const manteiga = item({ quantidadeBruta: '1', unidade: 'colherSopa', precoEmbalagem: 11.5, tamanhoEmbalagem: 200 });
  assert.equal(ingredientSummary(manteiga), '1 colher de sopa · R$ 11,50 / 200 g');
  const ovos = item({ quantidadeBruta: '3', unidade: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade' });
  assert.equal(ingredientSummary(ovos), '3 unidades · R$ 12,00 / 12 un.');
});

test('ingredientSummary: partial data shows only what exists', () => {
  assert.equal(ingredientSummary(item({ quantidadeBruta: '100' })), '100 g');
  assert.equal(ingredientSummary(item({ precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), 'R$ 5,00 / 1000 g');
  assert.equal(ingredientSummary(item({})), '');
});

test('computeLineCost: kg package (1 kg of flour for R$ 5, uses 500 g -> R$ 2,50)', () => {
  assert.equal(round2(computeLineCost(item({ quantidadeBruta: '500', precoEmbalagem: 5, tamanhoEmbalagem: 1, unidadeEmbalagem: 'kg' }))), 2.5);
});

test('computeLineCost: litre package goes through density (1 L oil R$ 9,20, 100 ml -> R$ 0,92)', () => {
  const oil = item({ quantidadeBruta: '100', unidade: 'ml', precoEmbalagem: 9.2, tamanhoEmbalagem: 1, unidadeEmbalagem: 'l', densidadeGml: 0.92 });
  assert.equal(round2(computeLineCost(oil)), 0.92);
});

test('computeLineCost: mg package', () => {
  // 10 g used of a 500 000 mg (500 g) package for R$ 10 -> R$ 0,20
  assert.equal(round2(computeLineCost(item({ quantidadeBruta: '10', precoEmbalagem: 10, tamanhoEmbalagem: 500000, unidadeEmbalagem: 'mg' }))), 0.2);
});

test('computeLineCost: kg package measured in xícaras uses density', () => {
  // 1 xícara of flour (0.5 g/ml) = 120 g of a 1 kg bag for R$ 5 -> R$ 0,60
  const farinha = item({ quantidadeBruta: '1', unidade: 'xicara', densidadeGml: 0.5, precoEmbalagem: 5, tamanhoEmbalagem: 1, unidadeEmbalagem: 'kg' });
  assert.equal(round2(computeLineCost(farinha)), 0.6);
});

test('"1 unidade" of a can sized in kg is one whole can (cost and grams)', () => {
  const lata = item({ quantidadeBruta: '1', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 0.395, unidadeEmbalagem: 'kg' });
  assert.equal(round2(computeLineCost(lata)), 7.49);
  assert.equal(round2(gramsUsed(lata)), 395);
});

test('quantidadeConvertidaEmGramas: "1 unidade" bought by weight shows the package grams', () => {
  const lata = item({ quantidadeBruta: '1', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 });
  assert.equal(quantidadeConvertidaEmGramas(lata, 1), 395);
});

test('ingredientSummary: litre package shows "L"', () => {
  const leite = item({ quantidadeBruta: '200', unidade: 'ml', precoEmbalagem: 4.79, tamanhoEmbalagem: 1, unidadeEmbalagem: 'l' });
  assert.equal(ingredientSummary(leite), '200 ml · R$ 4,79 / 1 L');
});
