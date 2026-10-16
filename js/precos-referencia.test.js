import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenciaDe, aplicarReferencia, limparOrigem, referenciasParaAtualizar, atualizarReferencias, referenciaAntiga } from './precos-referencia.js';

const REF = {
  atualizadoEm: '2026-10-19',
  fonte: { nome: 'Savegnago', regiao: 'interior de SP', url: 'x' },
  precos: { 'leite condensado': { nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3 } }
};
const linha = (o) => ({ nome: 'Leite condensado', quantidadeBruta: '1', unidade: 'unidade', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', ...o });

test('referenciaDe: by name, accents/case aside', () => {
  assert.equal(referenciaDe('LEITE CONDENSADO', REF).precoEmbalagem, 8.79);
  assert.equal(referenciaDe('Farinha', REF), null);
  assert.equal(referenciaDe('Leite condensado', null), null);
});

test('aplicarReferencia: fills an unpriced row and marks it', () => {
  const item = linha();
  assert.equal(aplicarReferencia(item, REF), true);
  assert.deepEqual([item.precoEmbalagem, item.tamanhoEmbalagem, item.unidadeEmbalagem, item.origemPreco, item.referenciaEm], [8.79, 395, 'g', 'referencia', '2026-10-19']);
});

test('aplicarReferencia: never over a price, never on a free line, nothing without a reference', () => {
  const dela = linha({ precoEmbalagem: 7, tamanhoEmbalagem: 395 });
  assert.equal(aplicarReferencia(dela, REF), false);
  assert.equal(dela.precoEmbalagem, 7);
  assert.equal(aplicarReferencia(linha({ semCusto: true }), REF), false);
  assert.equal(aplicarReferencia(linha({ nome: 'Farinha' }), REF), false);
});

test('limparOrigem: the price becomes hers', () => {
  const item = linha({ origemPreco: 'referencia', referenciaEm: '2026-10-12' });
  limparOrigem(item);
  assert.ok(!('origemPreco' in item) && !('referenciaEm' in item));
});

test('referenciasParaAtualizar / atualizarReferencias: only reference rows from an older week whose price changed', () => {
  const recipe = { ingredientes: [
    linha({ precoEmbalagem: 8.5, tamanhoEmbalagem: 395, origemPreco: 'referencia', referenciaEm: '2026-10-12' }),  // changed
    linha({ precoEmbalagem: 8.79, tamanhoEmbalagem: 395, origemPreco: 'referencia', referenciaEm: '2026-10-12' }), // same price
    linha({ precoEmbalagem: 6, tamanhoEmbalagem: 395 }),                                                          // hers
    linha({ precoEmbalagem: 8.5, tamanhoEmbalagem: 395, origemPreco: 'referencia', referenciaEm: '2026-10-19' })   // already this week
  ] };
  assert.equal(referenciasParaAtualizar(recipe, REF).length, 1);
  assert.equal(atualizarReferencias(recipe, REF), 1);
  assert.equal(recipe.ingredientes[0].precoEmbalagem, 8.79);
  assert.equal(recipe.ingredientes[0].referenciaEm, '2026-10-19');
  assert.equal(recipe.ingredientes[2].precoEmbalagem, 6);
  assert.equal(referenciasParaAtualizar(recipe, REF).length, 0);
  assert.deepEqual(referenciasParaAtualizar(recipe, null), []);
});

test('referenciaAntiga: more than 30 days', () => {
  assert.equal(referenciaAntiga({ origemPreco: 'referencia', referenciaEm: '2026-09-01' }, '2026-10-19'), true);
  assert.equal(referenciaAntiga({ origemPreco: 'referencia', referenciaEm: '2026-10-01' }, '2026-10-19'), false);
  assert.equal(referenciaAntiga({ referenciaEm: '2026-01-01' }, '2026-10-19'), false);
});
