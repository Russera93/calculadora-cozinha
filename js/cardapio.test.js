import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemPadrao, itensProntos } from './cardapio.js';

test('itemPadrao: starts at 1 unidade, price from precoVendaDesejado', () => {
  assert.deepEqual(itemPadrao({ id: 'r1', nome: 'Brigadeiro', precoVendaDesejado: 2.5 }), {
    recipeId: 'r1', nome: 'Brigadeiro', quantidade: '1 unidade', precoCliente: 2.5
  });
});

test('itemPadrao: no price yet is zero, not null; blank name falls back', () => {
  assert.equal(itemPadrao({ id: 'r1', nome: 'Bolo', precoVendaDesejado: null }).precoCliente, 0);
  assert.equal(itemPadrao({ id: 'r1', nome: '  ' }).nome, '(sem nome)');
});

test('itensProntos: only checked, named and priced rows go to the client', () => {
  const itens = [
    { incluido: true, nome: 'Brigadeiro', precoCliente: 2.5 },
    { incluido: false, nome: 'Beijinho', precoCliente: 2.5 }, // not checked
    { incluido: true, nome: '', precoCliente: 2.5 },          // no name
    { incluido: true, nome: 'Bolo', precoCliente: 0 }         // not priced
  ];
  assert.deepEqual(itensProntos(itens), [{ incluido: true, nome: 'Brigadeiro', precoCliente: 2.5 }]);
});
