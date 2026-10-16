import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS, buscarSugestoes, itensDaCategoria } from './ingredientes-sugeridos.js';
import { FIXED_INGREDIENTS } from './ingredients-db.js';
import { normalize } from './text-utils.js';

const todos = () => CATEGORIAS.flatMap((c) => c.itens);

test('CATEGORIAS: confeitaria and salgados groups, each category with items', () => {
  assert.deepEqual([...new Set(CATEGORIAS.map((c) => c.area))], ['Confeitaria', 'Salgados']);
  for (const c of CATEGORIAS) {
    assert.ok(c.id && c.nome && c.itens.length > 0, c.id);
    const nomes = c.itens.map(normalize);
    assert.equal(new Set(nomes).size, nomes.length, `nome repetido em ${c.id}`);
  }
  assert.equal(new Set(CATEGORIAS.map((c) => c.id)).size, CATEGORIAS.length);
});

test('CATEGORIAS: every fixed ingredient is in some category', () => {
  const nomes = new Set(todos().map(normalize));
  for (const ing of FIXED_INGREDIENTS) assert.ok(nomes.has(normalize(ing.nome)), ing.nome);
});

test('CATEGORIAS: removed by the user — no tuna, sardine or cod', () => {
  for (const nome of todos()) assert.doesNotMatch(normalize(nome), /atum|sardinha|bacalhau/);
});

test('buscarSugestoes: accent/case-insensitive, labelled with the first category', () => {
  const r = buscarSugestoes('ACUCAR MASC', []);
  assert.deepEqual(r, [{ nome: 'Açúcar mascavo', categoria: 'Base' }]);
});

test('buscarSugestoes: name start first, then word start, then anywhere', () => {
  const nomes = buscarSugestoes('coco', []).map((s) => s.nome);
  assert.deepEqual(nomes.slice(0, 2), ['Coco ralado', 'Leite de coco']);
  const leite = buscarSugestoes('leite co', []).map((s) => s.nome);
  assert.deepEqual(leite, ['Leite condensado']);
});

test('buscarSugestoes: an item in two categories shows up once', () => {
  const ovos = buscarSugestoes('ovos', []);
  assert.equal(ovos.length, 1);
  assert.equal(ovos[0].categoria, 'Base');
});

test('buscarSugestoes: custom ingredients first, labelled "Meus"; known names keep their category', () => {
  const custom = [{ nome: 'Leite de cabra' }, { nome: 'leite condensado' }];
  const r = buscarSugestoes('leite', custom);
  assert.deepEqual(r[0], { nome: 'Leite de cabra', categoria: 'Meus' });
  assert.equal(r.filter((s) => normalize(s.nome) === 'leite condensado').length, 1);
  assert.equal(r.find((s) => normalize(s.nome) === 'leite condensado').categoria, 'Lácteos');
});

test('buscarSugestoes: empty text gives nothing; limit caps the list', () => {
  assert.deepEqual(buscarSugestoes('  ', []), []);
  assert.equal(buscarSugestoes('a', [], 5).length, 5);
});

test('itensDaCategoria: the category items in order; "meus" lists custom ones sorted', () => {
  const temperos = CATEGORIAS.find((c) => c.id === 'temperos');
  assert.deepEqual(itensDaCategoria('temperos', []), temperos.itens);
  assert.deepEqual(itensDaCategoria('meus', [{ nome: 'Nutella' }, { nome: 'açaí' }]), ['açaí', 'Nutella']);
  assert.deepEqual(itensDaCategoria('nao-existe', []), []);
});
