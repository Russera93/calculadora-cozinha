import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecipeShareText, whatsappUrl } from './share.js';

function item(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null, ...overrides
  };
}

const brigadeiro = {
  nome: 'Brigadeiro Gourmet',
  rendimento: 30,
  precoVendaDesejado: 3.5,
  ingredientes: [
    item({ nome: 'Leite condensado', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 }),
    item({ nome: 'Chocolate 50%', quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 12.9, tamanhoEmbalagem: 200 }),
    item({ nome: 'Manteiga', quantidadeBruta: '1', unidade: 'colherSopa', precoEmbalagem: 11.5, tamanhoEmbalagem: 200, densidadeGml: 0.91 })
  ]
};

test('buildRecipeShareText: recipe only — ingredients, yield and total weight', () => {
  assert.equal(buildRecipeShareText(brigadeiro), [
    '*Brigadeiro Gourmet*',
    '',
    'Ingredientes:',
    '- 2 unidades de Leite condensado',
    '- 100 g de Chocolate 50%',
    '- 1 colher de sopa de Manteiga',
    '',
    'Rende: 30 porções (≈ 904 g no total)',
    '',
    'Enviado pela Calculadora de Cozinha'
  ].join('\n'));
});

test('buildRecipeShareText: never includes costs or prices', () => {
  const text = buildRecipeShareText(brigadeiro);
  assert.ok(!text.includes('R$'));
  assert.ok(!/custo|preço|margem|lucro/i.test(text));
});

test('buildRecipeShareText: total weight omitted when any ingredient weight is unknown', () => {
  const recipe = { ...brigadeiro, ingredientes: [...brigadeiro.ingredientes, item({ nome: 'Farinha misteriosa', quantidadeBruta: '1', unidade: 'xicara' })] };
  assert.ok(buildRecipeShareText(recipe).includes('\nRende: 30 porções\n'));
});

test('buildRecipeShareText: ingredient without quantity, singular portion, blank rows, no name', () => {
  const recipe = { nome: '  ', rendimento: 1, ingredientes: [item({ nome: 'Sal' }), item({ nome: '' })] };
  const text = buildRecipeShareText(recipe);
  assert.ok(text.startsWith('*(sem nome)*'));
  assert.ok(text.includes('\n- Sal\n'));
  assert.ok(text.includes('Rende: 1 porção\n'));
});

test('buildRecipeShareText: no ingredients', () => {
  const text = buildRecipeShareText({ nome: 'Bolo', rendimento: 8, ingredientes: [] });
  assert.ok(text.includes('(nenhum ingrediente cadastrado)'));
  assert.ok(text.includes('Rende: 8 porções\n'));
});

test('whatsappUrl: wa.me link with encoded text', () => {
  assert.equal(whatsappUrl('*Bolo*\nRende: 8'), 'https://wa.me/?text=*Bolo*%0ARende%3A%208');
});
