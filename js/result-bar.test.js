import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultBarContent } from './screens/result-bar.js';
import { unwrap } from './ui/dom.js';

// Closing spans become a space (they are separate visual pieces); other tags vanish.
const text = (fragment) => unwrap(fragment).replace(/<\/span>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('resultBarContent: each state has its message', () => {
  assert.equal(text(resultBarContent({ kind: 'semRendimento', ingredientesSemCusto: 0 })), 'Defina quantas porções a receita rende');
  assert.equal(text(resultBarContent({ kind: 'semIngredientes', ingredientesSemCusto: 0 })), 'Adicione ingredientes para ver o custo');
  assert.equal(text(resultBarContent({ kind: 'semPreco', custoPorPorcao: 1.12, ingredientesSemCusto: 0 })), 'Custo R$ 1,12/un. Defina seu preço ›');
  assert.equal(text(resultBarContent({ kind: 'lucro', custoPorPorcao: 1.12, lucroPorPorcao: 2.38, ingredientesSemCusto: 0 })), 'Custo R$ 1,12/un. Lucro R$ 2,38/un.');
  assert.equal(text(resultBarContent({ kind: 'prejuizo', custoPorPorcao: 3.2, lucroPorPorcao: -0.2, ingredientesSemCusto: 0 })), 'Custo R$ 3,20/un. Prejuízo R$ 0,20/un.');
});

test('resultBarContent: profit and loss use their color classes', () => {
  assert.ok(unwrap(resultBarContent({ kind: 'lucro', custoPorPorcao: 1, lucroPorPorcao: 1, ingredientesSemCusto: 0 })).includes('profit'));
  assert.ok(unwrap(resultBarContent({ kind: 'prejuizo', custoPorPorcao: 1, lucroPorPorcao: -1, ingredientesSemCusto: 0 })).includes('loss'));
});

test('resultBarContent: warns about ingredients without cost', () => {
  assert.ok(text(resultBarContent({ kind: 'semPreco', custoPorPorcao: 1, ingredientesSemCusto: 2 })).endsWith('2 ingrediente(s) sem preço'));
});
