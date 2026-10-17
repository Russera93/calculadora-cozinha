import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nomesIngredientes, precoEfetivo } from './meus-ingredientes.js';

const receita = (ingredientes) => ({ ingredientes });

test('nomesIngredientes: distinct names across recipes, first spelling kept, pt-BR sorted', () => {
  const recipes = [
    receita([{ nome: 'Farinha de trigo' }, { nome: 'Açúcar' }]),
    receita([{ nome: 'farinha de trigo' }, { nome: 'Leite condensado' }])
  ];
  assert.deepEqual(nomesIngredientes(recipes), ['Açúcar', 'Farinha de trigo', 'Leite condensado']);
});

test('nomesIngredientes: free rows and blank names are skipped', () => {
  const recipes = [receita([{ nome: 'Água', semCusto: true }, { nome: '' }, { nome: '   ' }, { nome: 'Sal' }])];
  assert.deepEqual(nomesIngredientes(recipes), ['Sal']);
});

test('nomesIngredientes: no recipes or no ingredients is an empty list', () => {
  assert.deepEqual(nomesIngredientes([]), []);
  assert.deepEqual(nomesIngredientes([receita([])]), []);
  assert.deepEqual(nomesIngredientes(undefined), []);
});

test('precoEfetivo: her own price (the bank) wins over anything in a recipe', () => {
  const recipes = [receita([{ nome: 'Óleo', precoEmbalagem: 99, tamanhoEmbalagem: 1, unidadeEmbalagem: 'g' }])];
  const banco = { nome: 'Óleo', precoEmbalagem: 7, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml' };
  assert.deepEqual(precoEfetivo('Óleo', recipes, banco), { precoEmbalagem: 7, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml' });
});

test('precoEfetivo: no bank entry falls back to a priced recipe row (keeps its origemPreco)', () => {
  const recipes = [
    receita([{ nome: 'Leite condensado', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g' }]),
    receita([{ nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', origemPreco: 'referencia' }])
  ];
  assert.deepEqual(precoEfetivo('leite condensado', recipes, null), { precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', origemPreco: 'referencia' });
});

test('precoEfetivo: nothing priced anywhere is null', () => {
  const recipes = [receita([{ nome: 'Fermento', precoEmbalagem: 0, tamanhoEmbalagem: 0 }])];
  assert.equal(precoEfetivo('Fermento', recipes, null), null);
  assert.equal(precoEfetivo('Fermento', [], null), null);
});
