import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerTamanho, paraBase, precoReferencia, produtosValidos, montarSaida, passaProtecao, manterFalhas } from './calculo.js';

const p = (productName, Price) => ({ productName, items: [{ sellers: [{ commertialOffer: { Price } }] }] });
const LEITE_CONDENSADO = {
  nome: 'Leite condensado', busca: 'leite condensado', incluir: ['leite condensado'],
  excluir: ['pudim', 'bolo', 'suspiro', 'doce', 'zero', 'semidesnatado'],
  embalagem: { tamanho: 395, unidade: 'g' }, janela: [350, 400]
};

test('lerTamanho: sizes in the name, also glued to the next word or with a comma', () => {
  assert.deepEqual(lerTamanho('Leite Condensado Itambé 395gLata'), { tamanho: 395, unidade: 'g' });
  assert.deepEqual(lerTamanho('Farinha de Trigo Dona Benta 1kg'), { tamanho: 1, unidade: 'kg' });
  assert.deepEqual(lerTamanho('Óleo de Soja Liza 900ml'), { tamanho: 900, unidade: 'ml' });
  assert.deepEqual(lerTamanho('Ovos Brancos 12 Unidades'), { tamanho: 12, unidade: 'unidade' });
  assert.equal(lerTamanho('Cebola Kg'), null);
});

test('paraBase: kg/L/mg to g/ml, pieces stay', () => {
  assert.deepEqual(paraBase(1, 'kg'), { valor: 1000, base: 'g' });
  assert.deepEqual(paraBase(1.5, 'l'), { valor: 1500, base: 'ml' });
  assert.deepEqual(paraBase(500, 'mg'), { valor: 0.5, base: 'g' });
  assert.deepEqual(paraBase(12, 'unidade'), { valor: 12, base: 'unidade' });
  assert.equal(paraBase(1, 'xicara'), null);
});

test('precoReferencia: filters words (whole words), reads size, keeps the window, median of the typical package', () => {
  const produtos = [
    p('Pudim de Leite Condensado Moça 500g', 49.9),        // excluded word
    p('Leite Condensado Itambé 395gLata', 8.79),
    p('Leite Condensado Piracanjuba 395g', 7.49),
    p('Leite Condensado Moça 395g', 9.99),
    p('Leite Condensado Moça Caixa 1kg', 24.9),             // outside the window
    p('Suspiro Leite Condensado 200g', 13.95),               // excluded
    p('Leite Condensado Italac 395g', 0)                     // no price
  ];
  assert.deepEqual(precoReferencia(LEITE_CONDENSADO, produtos), {
    nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3
  });
});

test('precoReferencia: other sizes inside the window are scaled to the typical package', () => {
  const farinha = { nome: 'Farinha de trigo', busca: 'farinha de trigo', incluir: ['farinha', 'trigo'], excluir: ['integral'],
    embalagem: { tamanho: 1, unidade: 'kg' }, janela: [1000, 5000] };
  const r = precoReferencia(farinha, [p('Farinha de Trigo Dona Benta 1kg', 6), p('Farinha de Trigo Renata 5kg', 25), p('Farinha de Trigo Integral 1kg', 9)]);
  assert.equal(r.precoEmbalagem, 5.5); // median of 6.00 and 5.00
  assert.equal(r.tamanhoEmbalagem, 1);
  assert.equal(r.unidadeEmbalagem, 'kg');
  assert.equal(r.produtos, 2);
});

test('precoReferencia: whole words — "mel" is not inside "caramelo"', () => {
  const mel = { nome: 'Mel', busca: 'mel', incluir: ['mel'], excluir: [], embalagem: { tamanho: 500, unidade: 'g' }, janela: [200, 1000] };
  assert.equal(precoReferencia(mel, [p('Calda de Caramelo 500g', 10), p('Bala de Caramelo 300g', 5)]), null);
  assert.equal(precoReferencia(mel, [p('Mel de Abelha Puro 500g', 30), p('Mel Silvestre 280g', 16.8)]).precoEmbalagem, 30);
});

test('precoReferencia: fewer than 2 products, no reference', () => {
  assert.equal(precoReferencia(LEITE_CONDENSADO, [p('Leite Condensado Moça 395g', 9.99)]), null);
  assert.equal(precoReferencia(LEITE_CONDENSADO, []), null);
});

test('montarSaida: keyed by normalized name, only found ingredients', () => {
  const r = { nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3 };
  const fonte = { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' };
  assert.deepEqual(montarSaida([r, null], { hoje: '2026-10-19', fonte }), { atualizadoEm: '2026-10-19', fonte, precos: { 'leite condensado': r } });
});

test('passaProtecao: needs at least 70% of last week; first run always passes', () => {
  const com = (n) => ({ precos: Object.fromEntries(Array.from({ length: n }, (_, i) => [`i${i}`, {}])) });
  assert.equal(passaProtecao(com(7), com(10)), true);
  assert.equal(passaProtecao(com(6), com(10)), false);
  assert.equal(passaProtecao(com(3), null), true);
  assert.equal(passaProtecao(com(0), null), false);
});

test('lerTamanho: counts written as "Com 30" / "C/12" (eggs)', () => {
  assert.deepEqual(lerTamanho('Ovo Branco Mantiqueira Com 30 Gde Pvc'), { tamanho: 30, unidade: 'unidade' });
  assert.deepEqual(lerTamanho('Ovos Vermelhos C/12'), { tamanho: 12, unidade: 'unidade' });
  assert.equal(lerTamanho('Biscoito Com Recheio'), null);
});

test('precoReferencia: "comeca" anchors the name ("Alho" is not "Pão de Alho")', () => {
  const alho = { nome: 'Alho', busca: 'alho', comeca: 'alho', incluir: ['alho'], excluir: [], embalagem: { tamanho: 200, unidade: 'g' }, janela: [100, 1000] };
  const r = precoReferencia(alho, [p('Pão de Alho Santa Massa 400g', 15), p('Alho Nacional 200g', 8), p('Alho Roxo 200g', 10), p('Maionese com Alho 200g', 9)]);
  assert.equal(r.produtos, 2);
  assert.equal(r.precoEmbalagem, 9);
});

test('precoReferencia: outliers (outside 0.5x-2x of the median) are dropped before the final median', () => {
  const choco = { nome: 'Chocolate ao leite', busca: 'x', incluir: ['chocolate'], excluir: [], embalagem: { tamanho: 1, unidade: 'kg' }, janela: [500, 2100] };
  const r = precoReferencia(choco, [p('Chocolate Cobertura A 1kg', 60), p('Chocolate Cobertura B 1kg', 64), p('Chocolate Cobertura C 1kg', 62), p('Chocolate Cobertura D 1kg', 9.5), p('Chocolate Premium 1kg', 300)]);
  assert.equal(r.produtos, 3);
  assert.equal(r.precoEmbalagem, 62);
});

test('produtosValidos: lists what feeds the median (audit with --detalhe)', () => {
  const lc = { nome: 'Leite condensado', busca: 'x', incluir: ['leite condensado'], excluir: ['pudim'], embalagem: { tamanho: 395, unidade: 'g' }, janela: [350, 400] };
  assert.deepEqual(produtosValidos(lc, [p('Pudim Leite Condensado 395g', 5), p('Leite Condensado Moça 395g', 9.99)]), [{ nome: 'Leite Condensado Moça 395g', preco: 9.99 }]);
});

test('manterFalhas: an ingredient whose search failed keeps last week (no silent shrinking)', () => {
  const anterior = { precos: { sal: { nome: 'Sal', precoEmbalagem: 3 }, mel: { nome: 'Mel', precoEmbalagem: 50 } } };
  const saida = { atualizadoEm: '2026-10-26', precos: { mel: { nome: 'Mel', precoEmbalagem: 52 } } };
  manterFalhas(saida, anterior, ['Sal', 'Leite']);
  assert.deepEqual(Object.keys(saida.precos).sort(), ['mel', 'sal']);
  assert.equal(saida.precos.mel.precoEmbalagem, 52);
  assert.equal(saida.precos.sal.precoEmbalagem, 3);
  manterFalhas(saida, null, ['Sal']); // first run: nothing to keep
});
