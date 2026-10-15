import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compraResumoHtml } from './screens/editor/compra-resumo.js';
import { unwrap } from './ui/dom.js';

const texto = (y) => unwrap(compraResumoHtml(y)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const base = {
  itens: [
    { nome: 'Leite Condensado', receitas: 2, gasto: 7.49, valorTotal: 14.98 },
    { nome: 'Chocolate em pó', receitas: 200 / 30, gasto: 1.935, valorTotal: 12.9 }
  ],
  receitasPossiveis: 2, unidadesPossiveis: 40, limitante: 'Leite Condensado',
  gastoPorReceita: 9.425, totalNota: 27.88, faltando: ['Manteiga']
};

test('resumo: gasto por receita, quantas receitas e unidades, quem acaba primeiro', () => {
  const t = texto(base);
  assert.ok(t.includes('Esta receita gasta R$ 9,43 do que você comprou'), t);
  assert.ok(t.includes('dá para fazer 2 receitas = 40 unidades'), t);
  assert.ok(t.includes('Acaba primeiro: Leite Condensado'), t);
  assert.ok(t.includes('Chocolate em pó dá 6,7 receitas'), t);
  assert.ok(t.includes('Não vieram na nota: Manteiga'), t);
  assert.ok(t.includes('Total pago nesses itens: R$ 27,88'), t);
});

test('resumo: singular para 1 receita e 1 unidade', () => {
  const t = texto({ ...base, receitasPossiveis: 1, unidadesPossiveis: 1, faltando: [] });
  assert.ok(t.includes('dá para fazer 1 receita = 1 unidade'), t);
  assert.ok(!t.includes('Não vieram na nota'), t);
});

test('resumo: compra menor que uma receita', () => {
  const t = texto({ ...base, receitasPossiveis: 0, unidadesPossiveis: 0 });
  assert.ok(t.includes('não dá para uma receita inteira — falta Leite Condensado'), t);
  assert.ok(!t.includes('Acaba primeiro'), t);
});

test('resumo: item sem conversão aparece com "—"', () => {
  const t = texto({ ...base, itens: [...base.itens, { nome: 'Coco ralado', receitas: null, gasto: null, valorTotal: 5 }] });
  assert.ok(t.includes('Coco ralado —'), t);
  assert.ok(t.includes('não dá para converter'), t);
});

test('resumo: nomes com HTML são escapados', () => {
  const out = unwrap(compraResumoHtml({ ...base, limitante: '<b>x</b>', faltando: ['<i>y</i>'] }));
  assert.ok(!out.includes('<b>x</b>') && !out.includes('<i>y</i>'));
});
