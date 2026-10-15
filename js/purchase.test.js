import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitPrice, applyPurchase, purchaseYield } from './purchase.js';

function line(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null,
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

const leiteCondensado = (q = '1') => line({ nome: 'Leite Condensado', quantidadeBruta: q, unidade: 'unidade', densidadeGml: 1.3 });
const chocolate = () => line({ nome: 'Chocolate em pó', quantidadeBruta: '30', unidade: 'g', densidadeGml: 0.5 });
const manteiga = () => line({ nome: 'Manteiga', quantidadeBruta: '20', unidade: 'g', precoEmbalagem: 11.5, tamanhoEmbalagem: 200 });

const notaLeite = { descricao: 'LEITE COND MOCA 395G', quantidade: 2, tamanho: 395, unidade: 'g', valorTotal: 14.98 };
const notaChoc = { descricao: 'CHOC PO 200G', quantidade: 1, tamanho: 200, unidade: 'g', valorTotal: 12.9 };

function brigadeiro() {
  return { rendimento: 20, ingredientes: [leiteCondensado(), chocolate(), manteiga()] };
}

test('unitPrice: total dividido pela quantidade, em centavos', () => {
  assert.equal(unitPrice(notaLeite), 7.49);
  assert.equal(unitPrice({ quantidade: 3, valorTotal: 10 }), 3.33);
});

test('applyPurchase: preenche preço por embalagem, tamanho e unidade, e guarda a compra', () => {
  const recipe = brigadeiro();
  const aplicados = applyPurchase(recipe, [{ item: notaLeite, ingredienteIndex: 0 }, { item: notaChoc, ingredienteIndex: 1 }], '2026-10-15T10:00:00.000Z');
  assert.deepEqual(
    [recipe.ingredientes[0].precoEmbalagem, recipe.ingredientes[0].tamanhoEmbalagem, recipe.ingredientes[0].unidadeEmbalagem],
    [7.49, 395, 'g']
  );
  assert.equal(recipe.ingredientes[1].precoEmbalagem, 12.9);
  assert.deepEqual(aplicados.map((a) => a.nome), ['Leite Condensado', 'Chocolate em pó']);
  assert.deepEqual(recipe.compra, {
    lidaEm: '2026-10-15T10:00:00.000Z',
    itens: [
      { nome: 'Leite Condensado', descricao: 'LEITE COND MOCA 395G', quantidade: 2, tamanho: 395, unidade: 'g', valorTotal: 14.98 },
      { nome: 'Chocolate em pó', descricao: 'CHOC PO 200G', quantidade: 1, tamanho: 200, unidade: 'g', valorTotal: 12.9 }
    ]
  });
});

test('purchaseYield: quantas receitas, quem acaba primeiro, quanto gasta por receita', () => {
  const recipe = brigadeiro();
  applyPurchase(recipe, [{ item: notaLeite, ingredienteIndex: 0 }, { item: notaChoc, ingredienteIndex: 1 }], 'agora');
  const y = purchaseYield(recipe);
  assert.deepEqual(y.itens.map((i) => [i.nome, round2(i.receitas)]), [['Leite Condensado', 2], ['Chocolate em pó', 6.67]]);
  assert.equal(y.receitasPossiveis, 2);
  assert.equal(y.unidadesPossiveis, 40);
  assert.equal(y.limitante, 'Leite Condensado');
  assert.equal(round2(y.gastoPorReceita), round2(7.49 + 12.9 * 30 / 200));
  assert.equal(y.totalNota, 27.88);
  assert.deepEqual(y.faltando, ['Manteiga']);
});

test('purchaseYield: dúzia de ovos, 3 por receita = 4 receitas', () => {
  const recipe = { rendimento: 1, ingredientes: [line({ nome: 'Ovos', quantidadeBruta: '3', unidade: 'unidade', unidadeEmbalagem: 'unidade', pesoUnidadeG: 50 })] };
  applyPurchase(recipe, [{ item: { descricao: 'OVOS C/12', quantidade: 1, tamanho: 12, unidade: 'unidade', valorTotal: 11.9 }, ingredienteIndex: 0 }], 'agora');
  assert.equal(purchaseYield(recipe).receitasPossiveis, 4);
});

test('purchaseYield: óleo comprado em litro e medido em xícara usa a densidade', () => {
  const recipe = { rendimento: 1, ingredientes: [line({ nome: 'Óleo', quantidadeBruta: '1', unidade: 'xicara', densidadeGml: 0.92 })] };
  applyPurchase(recipe, [{ item: { descricao: 'OLEO SOJA 1L', quantidade: 1, tamanho: 1, unidade: 'l', valorTotal: 9.2 }, ingredienteIndex: 0 }], 'agora');
  const y = purchaseYield(recipe);
  assert.equal(round2(y.itens[0].receitas), 4.17); // 1000 ml / 240 ml
  assert.equal(y.receitasPossiveis, 4);
});

test('purchaseYield: compra menor que uma receita', () => {
  const recipe = { rendimento: 20, ingredientes: [leiteCondensado('2')] };
  applyPurchase(recipe, [{ item: { ...notaLeite, quantidade: 1, valorTotal: 7.49 }, ingredienteIndex: 0 }], 'agora');
  const y = purchaseYield(recipe);
  assert.equal(y.receitasPossiveis, 0);
  assert.equal(y.unidadesPossiveis, 0);
  assert.equal(y.limitante, 'Leite Condensado');
  assert.equal(y.itens[0].receitas, 0.5);
});

test('purchaseYield: ingrediente removido depois de aplicar é ignorado, sem quebrar', () => {
  const recipe = brigadeiro();
  applyPurchase(recipe, [{ item: notaLeite, ingredienteIndex: 0 }, { item: notaChoc, ingredienteIndex: 1 }], 'agora');
  recipe.ingredientes.splice(0, 1);
  const y = purchaseYield(recipe);
  assert.deepEqual(y.itens.map((i) => i.nome), ['Chocolate em pó']);
  assert.equal(y.limitante, 'Chocolate em pó');
  assert.equal(y.receitasPossiveis, 6);
});

test('purchaseYield: item sem conversão possível fica "—" e não entra no mínimo', () => {
  const recipe = { rendimento: 1, ingredientes: [line({ nome: 'Coco ralado', quantidadeBruta: '1', unidade: 'xicara' }), chocolate()] };
  applyPurchase(recipe, [
    { item: { descricao: 'COCO RALADO 100G', quantidade: 1, tamanho: 100, unidade: 'g', valorTotal: 5 }, ingredienteIndex: 0 },
    { item: notaChoc, ingredienteIndex: 1 }
  ], 'agora');
  const y = purchaseYield(recipe);
  assert.equal(y.itens[0].receitas, null);
  assert.equal(y.itens[0].gasto, null);
  assert.equal(y.receitasPossiveis, 6);
});

test('purchaseYield: sem compra guardada é null', () => {
  assert.equal(purchaseYield(brigadeiro()), null);
  assert.equal(purchaseYield({ ...brigadeiro(), compra: { lidaEm: 'x', itens: [] } }), null);
});
