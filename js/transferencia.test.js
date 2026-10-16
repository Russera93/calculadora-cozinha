import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeTransfer, decodeTransfer } from './transferencia.js';

const dados = { version: 1, recipes: [{ id: 'recipe:1', nome: 'Brigadeiro', ingredientes: [] }], customIngredients: [], precos: [] };

test('ida e volta: o que foi copiado no Safari é reconhecido no app', () => {
  const texto = encodeTransfer(dados);
  assert.ok(texto.startsWith('DOCE-LUCRO-RECEITAS:'));
  assert.deepEqual(decodeTransfer(texto), dados);
});

test('aceita espaços/quebras em volta e o conteúdo de um arquivo de backup colado', () => {
  assert.deepEqual(decodeTransfer(`\n  ${encodeTransfer(dados)}  \n`), dados);
  assert.deepEqual(decodeTransfer(JSON.stringify(dados)), dados);
});

test('qualquer outra coisa colada não é tratada como receitas', () => {
  for (const t of ['', 'oi', 'DOCE-LUCRO-RECEITAS:{quebrado', '{"a":1}', '[1,2]', null, undefined]) {
    assert.equal(decodeTransfer(t), null, String(t));
  }
});
