import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeResult } from './results.js';
import { NEGOCIO_PADRAO, normalizeNegocio } from './negocio.js';

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
    precoVendaDesejado: null, tempoTrabalhoMinutos: null, perdaPercent: 0, canalVenda: 'direto',
    // 500 g of a R$ 10/kg ingredient = R$ 5,00 -> R$ 0,50 per unit
    ingredientes: [item({ nome: 'Farinha', quantidadeBruta: '500', precoEmbalagem: 10, tamanhoEmbalagem: 1000 })],
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

// R$ 2.080/mês, 24 h/semana = 104 h/mês -> R$ 20/h; R$ 208 de contas = R$ 2/h.
const negocio = normalizeNegocio({
  ganhoMensal: 2080, horasSemana: 24, contasFixas: { luz: 208 },
  taxaMaquininha: 5, taxaIfood: 20, lucroExtra: 20
});

test('sem negócio configurado: custo e ganho como antes (só material)', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 2 }), NEGOCIO_PADRAO);
  assert.equal(r.kind, 'ganho');
  assert.equal(r.custoPorUnidade, 0.5);
  assert.equal(r.ganhoPorUnidade, 1.5);
  assert.equal(r.ganhoTotal, 15);
  assert.equal(r.horaRendeu, null);
  assert.equal(r.margem, 75);
  assert.equal(r.markup, 300);
});

test('sem negócio: Mínimo existe, Justo e Com lucro pedem configuração', () => {
  const r = recipeResult(recipe(), NEGOCIO_PADRAO);
  assert.equal(r.kind, 'semPreco');
  assert.deepEqual(r.sugeridos, { minimo: 0.5, justo: null, comLucro: null });
  assert.equal(r.motivoSemJusto, 'negocio');
});

test('negócio configurado mas sem tempo: Justo pede o tempo', () => {
  const r = recipeResult(recipe(), negocio);
  assert.equal(r.motivoSemJusto, 'tempo');
  assert.equal(r.sugeridos.justo, null);
});

test('tempo de trabalho traz contas fixas para o custo e mão de obra para o preço justo', () => {
  // 90 min = 1,5 h -> fixos R$ 3, mão de obra R$ 30
  const r = recipeResult(recipe({ tempoTrabalhoMinutos: 90 }), negocio);
  assert.equal(r.horas, 1.5);
  assert.equal(r.fixosCost, 3);
  assert.equal(r.maoDeObraCost, 30);
  assert.equal(r.custoTotal, 8); // 5 de material + 3 de fixos
  assert.equal(r.custoPorUnidade, 0.8);
  // Justo = (5 + 3 + 30) / 10 = 3,80; Com lucro = 4,56 -> 5,00; Mínimo 0,80
  assert.deepEqual(r.sugeridos, { minimo: 1, justo: 4, comLucro: 5 });
  assert.equal(round2(r.precoJustoExato), 3.8);
  assert.equal(r.motivoSemJusto, null);
});

test('ganho com o preço cobrado e quanto a hora rendeu', () => {
  const r = recipeResult(recipe({ tempoTrabalhoMinutos: 90, precoVendaDesejado: 4 }), negocio);
  assert.equal(round2(r.gastoPorUnidade), 0.8);
  assert.equal(round2(r.ganhoPorUnidade), 3.2);
  assert.equal(round2(r.ganhoTotal), 32);
  assert.equal(round2(r.horaRendeu), 21.33);
  assert.equal(r.valorHora, 20);
  assert.equal(r.bateuMeta, true);
  const barato = recipeResult(recipe({ tempoTrabalhoMinutos: 90, precoVendaDesejado: 2 }), negocio);
  assert.equal(barato.bateuMeta, false);
  assert.equal(barato.kind, 'ganho'); // ainda sobra algo, só não paga a hora toda
});

test('taxa do canal sai do preço e aumenta as sugestões', () => {
  const r = recipeResult(recipe({ canalVenda: 'ifood', precoVendaDesejado: 2 }), negocio);
  assert.equal(r.taxa, 0.2);
  assert.equal(round2(r.taxaPorUnidade), 0.4);
  assert.equal(round2(r.ganhoPorUnidade), 1.1); // 2 - 0,50 - 0,40
  assert.equal(r.sugeridos.minimo, 1); // 0,50 / 0,8 = 0,625 -> 1,00
  assert.equal(round2(r.precoMinimoExato), 0.63);
});

test('perda (%) encarece os ingredientes', () => {
  const r = recipeResult(recipe({ perdaPercent: 10 }), NEGOCIO_PADRAO);
  assert.equal(round2(r.perdaCost), 0.5);
  assert.equal(round2(r.custoPorUnidade), 0.55);
});

test('preço abaixo do gasto é prejuízo; preço 0 ainda é preço', () => {
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 0.3 }), NEGOCIO_PADRAO).kind, 'prejuizo');
  assert.equal(round2(recipeResult(recipe({ precoVendaDesejado: 0.3 }), NEGOCIO_PADRAO).ganhoPorUnidade), -0.2);
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 0 }), NEGOCIO_PADRAO).kind, 'prejuizo');
});

test('rendimento zero vence tudo; sem ingrediente com custo é semIngredientes', () => {
  const r = recipeResult(recipe({ rendimento: 0, precoVendaDesejado: 2 }), negocio);
  assert.equal(r.kind, 'semRendimento');
  assert.equal(r.custoPorUnidade, null);
  assert.equal(r.sugeridos, null);
  assert.equal(recipeResult(recipe({ ingredientes: [] }), negocio).kind, 'semIngredientes');
  assert.equal(recipeResult(recipe({ ingredientes: [item({ nome: 'Sal' })] }), negocio).kind, 'semIngredientes');
});

test('conta ingredientes sem preço e extras por unidade', () => {
  const r = recipeResult(recipe({
    ingredientes: [...recipe().ingredientes, item({ nome: 'Sal' })],
    embalagemUnitaria: 0.5, quantidadeEmbalagens: 10,
    valorBotijao: 120, tempoPreparoMinutos: 25, tempoTrabalhoMinutos: 60
  }), negocio);
  assert.equal(r.ingredientesSemCusto, 1);
  assert.equal(r.embalagensPorUnidade, 0.5);
  assert.equal(round2(r.gasPorUnidade), 0.1);
  assert.equal(round2(r.fixosPorUnidade), 0.2);
  assert.equal(round2(r.maoDeObraPorUnidade), 2);
});

test('negócio omitido = padrão (lista e telas antigas continuam funcionando)', () => {
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 2 })).ganhoPorUnidade, 1.5);
});
