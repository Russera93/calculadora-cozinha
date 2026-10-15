import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandTokens, matchScore, aliasKey, suggestMatches } from './receipt-match.js';

const best = (descricao, nomes, apelidos = []) => {
  const [index] = suggestMatches([{ descricao }], nomes, apelidos);
  return index == null ? null : nomes[index];
};

const RECEITA = ['Leite', 'Leite condensado', 'Creme de leite', 'Farinha de trigo', 'Açúcar', 'Ovos', 'Chocolate em pó', 'Manteiga'];

test('expandTokens: abreviações de nota viram palavras; números e tamanhos saem', () => {
  assert.deepEqual(expandTokens('LEITE COND MOCA 395G'), ['leite', 'condensado', 'moca']);
  assert.deepEqual(expandTokens('CR LEITE NESTLE 200G'), ['creme', 'leite', 'nestle']);
  assert.deepEqual(expandTokens('ACUC REF UNIAO 1KG'), ['acucar', 'refinado', 'uniao']);
});

test('"LEITE COND" prefere Leite condensado; "LEITE INTEGRAL" fica com Leite', () => {
  assert.equal(best('LEITE COND MOCA 395G', ['Leite', 'Leite condensado']), 'Leite condensado');
  assert.equal(best('LEITE INTEGRAL ITALAC 1L', ['Leite', 'Leite condensado']), 'Leite');
});

test('abreviações comuns casam com o ingrediente certo', () => {
  assert.equal(best('CR LEITE NESTLE 200G', RECEITA), 'Creme de leite');
  assert.equal(best('FAR TRIGO DONA BENTA 1KG', RECEITA), 'Farinha de trigo');
  assert.equal(best('ACUC REF UNIAO 1KG', RECEITA), 'Açúcar');
  assert.equal(best('OVOS BRANCOS GRANDES C/12', RECEITA), 'Ovos');
  assert.equal(best('OVO VERMELHO DZ', RECEITA), 'Ovos');
  assert.equal(best('CHOC PO 50% NESTLE 200G', RECEITA), 'Chocolate em pó');
  assert.equal(best('MANT C/SAL AVIACAO 200G', RECEITA), 'Manteiga');
});

test('item que não é da receita fica sem par', () => {
  assert.equal(best('DETERGENTE YPE 500ML', RECEITA), null);
  assert.equal(best('PAPEL HIGIENICO NEVE', RECEITA), null);
});

test('ingrediente de várias palavras precisa de pelo menos metade delas', () => {
  // "trigo" sozinho (1 de 2) basta; "de" não conta.
  assert.ok(matchScore('TRIGO 1KG', 'Farinha de trigo') >= 0.5);
  assert.equal(matchScore('CHOCOLATE', 'Creme de leite'), 0);
});

test('1-para-1: dois itens disputando o mesmo ingrediente, só o melhor fica', () => {
  const itens = [{ descricao: 'LEITE COND PIRACANJUBA' }, { descricao: 'LEITE COND MOCA NESTLE' }];
  assert.deepEqual(suggestMatches(itens, ['Leite condensado'], []), [0, null]);
});

test('apelido aprendido vence a pontuação, se o ingrediente existir na receita', () => {
  const apelidos = [{ chave: aliasKey('BOMBOM GAROTO SERENATA 1KG'), nome: 'Chocolate ao leite' }];
  assert.equal(best('BOMBOM GAROTO SERENATA 1KG', ['Leite', 'Chocolate ao leite'], apelidos), 'Chocolate ao leite');
  assert.equal(best('BOMBOM GAROTO SERENATA 1KG', ['Leite'], apelidos), null);
});

test('aliasKey: ignora tamanho, números e acentos', () => {
  assert.equal(aliasKey('001 789100 LEITE COND MOÇA 395G'), aliasKey('LEITE COND MOCA 1KG'));
});
