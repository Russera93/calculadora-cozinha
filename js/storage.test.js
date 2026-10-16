import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  migrateRecipe, getRecipes, saveRecipe, deleteRecipe, restoreRecipe, createEmptyRecipe, applyPricingToAllRecipes
} from './storage.js';

// Node has no localStorage; install an in-memory one per test.
function installMemoryStorage({ failWrites = false } = {}) {
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)); },
    removeItem: (k) => data.delete(k)
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return data;
}

beforeEach(() => installMemoryStorage());

test('migrateRecipe: backfills quantidadeEmbalagens from rendimento', () => {
  const migrated = migrateRecipe({ id: 'r', rendimento: 20, ingredientes: [] });
  assert.equal(migrated.quantidadeEmbalagens, 20);
});

test('migrateRecipe: keeps an existing quantidadeEmbalagens, including 0', () => {
  assert.equal(migrateRecipe({ id: 'r', rendimento: 20, quantidadeEmbalagens: 5, ingredientes: [] }).quantidadeEmbalagens, 5);
  assert.equal(migrateRecipe({ id: 'r', rendimento: 20, quantidadeEmbalagens: 0, ingredientes: [] }).quantidadeEmbalagens, 0);
});

test('migrateRecipe: drops blank ingredient rows saved by the old editor', () => {
  const migrated = migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [{ nome: 'Farinha' }, { nome: '' }, { nome: '   ' }] });
  assert.deepEqual(migrated.ingredientes.map((i) => i.nome), ['Farinha']);
});

test('migrateRecipe: is idempotent and does not mutate its input', () => {
  const original = { id: 'r', rendimento: 3, ingredientes: [{ nome: 'A' }, { nome: '' }] };
  const once = migrateRecipe(original);
  assert.deepEqual(migrateRecipe(once), once);
  assert.equal(original.ingredientes.length, 2);
  assert.equal('quantidadeEmbalagens' in original, false);
});

test('getRecipes: returns migrated recipes', () => {
  localStorage.setItem('calculadora-cozinha:recipes', JSON.stringify([{ id: 'r', nome: 'Velha', rendimento: 4, ingredientes: [{ nome: '' }] }]));
  const [recipe] = getRecipes();
  assert.equal(recipe.quantidadeEmbalagens, 4);
  assert.equal(recipe.ingredientes.length, 0);
});

test('saveRecipe: returns true on success and false when storage refuses', () => {
  assert.equal(saveRecipe(createEmptyRecipe()), true);
  installMemoryStorage({ failWrites: true });
  assert.equal(saveRecipe(createEmptyRecipe()), false);
});

test('deleteRecipe + restoreRecipe: undo puts the recipe back at the same position', () => {
  const a = { ...createEmptyRecipe(), nome: 'A' };
  const b = { ...createEmptyRecipe(), nome: 'B' };
  const c = { ...createEmptyRecipe(), nome: 'C' };
  [a, b, c].forEach(saveRecipe);

  const removed = deleteRecipe(b.id);
  assert.equal(removed.index, 1);
  assert.equal(removed.recipe.nome, 'B');
  assert.deepEqual(getRecipes().map((r) => r.nome), ['A', 'C']);

  restoreRecipe(removed.recipe, removed.index);
  assert.deepEqual(getRecipes().map((r) => r.nome), ['A', 'B', 'C']);
});

test('deleteRecipe: unknown id returns null', () => {
  assert.equal(deleteRecipe('recipe:nope'), null);
});

test('apelidos da nota: salvar, substituir pela mesma chave, entrar no backup', async () => {
  const { getApelidosNota, saveApelidoNota, exportAllData } = await import('./storage.js');
  saveApelidoNota('LEITE COND MOCA 395G', 'Leite condensado');
  saveApelidoNota('LEITE COND MOCA 1KG', 'Leite condensado (lata)');
  saveApelidoNota('CR LEITE NESTLE', 'Creme de leite');
  assert.deepEqual(getApelidosNota().map((a) => [a.chave, a.nome]), [
    ['leite condensado moca', 'Leite condensado (lata)'],
    ['creme leite nestle', 'Creme de leite']
  ]);
  assert.equal(exportAllData().apelidosNota.length, 2);
});

test('apelidos da nota: importar backup não sobrescreve os que já existem', async () => {
  const { getApelidosNota, saveApelidoNota, importBackup } = await import('./storage.js');
  saveApelidoNota('CR LEITE NESTLE', 'Creme de leite');
  importBackup({ apelidosNota: [{ chave: 'creme leite nestle', nome: 'Outro' }, { chave: 'far trigo', nome: 'Farinha' }] });
  assert.deepEqual(getApelidosNota().map((a) => a.nome), ['Creme de leite', 'Farinha']);
});

test('apelidos da nota: chave vazia (só números) não é salva', async () => {
  const { getApelidosNota, saveApelidoNota } = await import('./storage.js');
  saveApelidoNota('001 7891000 395G', 'Leite condensado');
  assert.deepEqual(getApelidosNota(), []);
});

test('migrateRecipe: receitas antigas são vendidas no Pix/dinheiro; canal salvo é mantido', () => {
  assert.equal(migrateRecipe({ id: 'r', rendimento: 10, ingredientes: [] }).canalVenda, 'direto');
  assert.equal(migrateRecipe({ id: 'r', rendimento: 10, ingredientes: [], canalVenda: 'ifood' }).canalVenda, 'ifood');
});

test('createEmptyRecipe: começa vendida no Pix/dinheiro', () => {
  assert.equal(createEmptyRecipe().canalVenda, 'direto');
});

test('taxas: padrão zero, salvar, ler o "Meu negócio" antigo, entrar no backup', async () => {
  const { getTaxas, saveTaxas, exportAllData } = await import('./storage.js');
  assert.deepEqual(getTaxas(), { taxaMaquininha: 0, taxaIfood: 0 });
  // what the removed "Meu negócio" saved under the same key
  localStorage.setItem('calculadora-cozinha:negocio', JSON.stringify({ ganhoMensal: 2000, taxaIfood: 27 }));
  assert.deepEqual(getTaxas(), { taxaMaquininha: 0, taxaIfood: 27 });
  saveTaxas({ taxaMaquininha: 3.5, taxaIfood: 27 });
  assert.deepEqual(exportAllData().taxas, { taxaMaquininha: 3.5, taxaIfood: 27 });
});

test('taxas: importar backup (novo ou do "Meu negócio") só preenche se as daqui estiverem zeradas', async () => {
  const { getTaxas, saveTaxas, importBackup } = await import('./storage.js');
  importBackup({ negocio: { ganhoMensal: 3000, taxaMaquininha: 4 } });
  assert.equal(getTaxas().taxaMaquininha, 4);
  saveTaxas({ taxaMaquininha: 2, taxaIfood: 0 });
  importBackup({ taxas: { taxaMaquininha: 9, taxaIfood: 30 } });
  assert.deepEqual(getTaxas(), { taxaMaquininha: 2, taxaIfood: 0 });
});

test('último backup: exportar grava a data', async () => {
  const { exportAllData, getUltimoBackup } = await import('./storage.js');
  assert.equal(getUltimoBackup(), null);
  exportAllData();
  assert.ok(Date.parse(getUltimoBackup()) > 0);
});

test('botijão: receita nova já vem com o último preço de botijão usado', async () => {
  const { lembrarBotijao, createEmptyRecipe: criar } = await import('./storage.js');
  assert.equal(criar().valorBotijao, 0);
  lembrarBotijao(120);
  assert.equal(criar().valorBotijao, 120);
  lembrarBotijao(0); // apagar o campo numa receita não esquece o preço
  assert.equal(criar().valorBotijao, 120);
});

test('copiar para o app instalado não conta como backup salvo', async () => {
  const { exportAllData, getUltimoBackup } = await import('./storage.js');
  exportAllData({ marcarBackup: false });
  assert.equal(getUltimoBackup(), null);
});

test('createEmptyRecipe and migrateRecipe: modoPreparo is always an array', () => {
  assert.deepEqual(createEmptyRecipe().modoPreparo, []);
  assert.deepEqual(migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [] }).modoPreparo, []);
  assert.deepEqual(migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [], modoPreparo: ['Misture'] }).modoPreparo, ['Misture']);
  assert.deepEqual(migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [], modoPreparo: 'lixo' }).modoPreparo, []);
});

test('applyPricingToAllRecipes: a price propagated by her clears the reference mark', () => {
  saveRecipe({ id: 'r1', nome: 'A', rendimento: 1, ingredientes: [{ nome: 'Óleo', quantidadeBruta: '1', unidade: 'g', precoEmbalagem: 8, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml', origemPreco: 'referencia', referenciaEm: '2026-10-12' }] });
  applyPricingToAllRecipes('óleo', { precoEmbalagem: 7, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml' }, 'outra');
  const item = getRecipes()[0].ingredientes[0];
  assert.equal(item.precoEmbalagem, 7);
  assert.ok(!('origemPreco' in item));
});
