import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultBarContent } from './screens/result-bar.js';
import { unwrap } from './ui/dom.js';

// Closing spans become a space (they are separate visual pieces); other tags vanish.
const text = (fragment) => unwrap(fragment).replace(/<\/span>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const base = { ingredientesSemCusto: 0 };

test('resultBarContent: each state has its message', () => {
  assert.equal(text(resultBarContent({ ...base, kind: 'semRendimento' })), 'Defina quantas unidades a receita rende');
  assert.equal(text(resultBarContent({ ...base, kind: 'semIngredientes' })), 'Adicione ingredientes para ver o custo');
  assert.equal(text(resultBarContent({ ...base, kind: 'semPreco', gastoPorUnidade: 1.12 })), 'Custo R$ 1,12/un. Defina seu preço ›');
  assert.equal(text(resultBarContent({ ...base, kind: 'ganho', gastoPorUnidade: 1.12, ganhoPorUnidade: 2.38 })), 'Custo R$ 1,12/un. Você ganha R$ 2,38/un.');
  assert.equal(text(resultBarContent({ ...base, kind: 'prejuizo', gastoPorUnidade: 3.2, ganhoPorUnidade: -0.2 })), 'Custo R$ 3,20/un. Você perde R$ 0,20/un.');
});

test('resultBarContent: gain and loss use their color classes', () => {
  assert.ok(unwrap(resultBarContent({ ...base, kind: 'ganho', gastoPorUnidade: 1, ganhoPorUnidade: 1 })).includes('profit'));
  assert.ok(unwrap(resultBarContent({ ...base, kind: 'prejuizo', gastoPorUnidade: 1, ganhoPorUnidade: -1 })).includes('loss'));
});

test('resultBarContent: warns about ingredients without cost', () => {
  assert.ok(text(resultBarContent({ ...base, kind: 'semPreco', gastoPorUnidade: 1, ingredientesSemCusto: 2 })).endsWith('2 ingrediente(s) sem preço'));
});
