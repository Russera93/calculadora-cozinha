import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listNotice, dispensaAte } from './protecao.js';

const agora = Date.parse('2026-10-15T12:00:00Z');
const dias = (n) => new Date(agora - n * 86400000).toISOString();
const futuro = new Date(agora + 86400000).toISOString();
const base = {
  isIOS: false, standalone: false, podeInstalar: false, totalReceitas: 5, ultimoBackup: dias(2),
  instalarDispensadoAte: null, backupDispensadoAte: null, agora
};

test('Android/Chrome com o pedido de instalação disponível: botão Instalar', () => {
  assert.equal(listNotice({ ...base, podeInstalar: true }), 'instalar');
  assert.equal(listNotice({ ...base, podeInstalar: true, totalReceitas: 0 }), 'instalar'); // já no primeiro acesso
});

test('iPhone/iPad no navegador: passo a passo para adicionar à Tela de Início', () => {
  assert.equal(listNotice({ ...base, isIOS: true }), 'ios');
  assert.equal(listNotice({ ...base, isIOS: true, totalReceitas: 0 }), 'ios');
});

test('app já instalado (aberto pela tela inicial): nada de instalar', () => {
  assert.equal(listNotice({ ...base, isIOS: true, standalone: true }), null);
  assert.equal(listNotice({ ...base, podeInstalar: true, standalone: true }), null);
});

test('"Agora não" no instalar some até a data; aí aparece o backup, se for o caso', () => {
  const r = { ...base, isIOS: true, instalarDispensadoAte: futuro, ultimoBackup: null };
  assert.equal(listNotice(r), 'backup');
  assert.equal(listNotice({ ...r, ultimoBackup: dias(2) }), null);
  assert.equal(listNotice({ ...r, instalarDispensadoAte: dias(1) }), 'ios');
});

test('backup: com 3+ receitas e nunca salvo, ou salvo há mais de 30 dias', () => {
  assert.equal(listNotice({ ...base, ultimoBackup: null }), 'backup');
  assert.equal(listNotice({ ...base, ultimoBackup: dias(31) }), 'backup');
  assert.equal(listNotice({ ...base, ultimoBackup: dias(29) }), null);
  assert.equal(listNotice({ ...base, ultimoBackup: null, totalReceitas: 2 }), null);
  assert.equal(listNotice({ ...base, ultimoBackup: null, backupDispensadoAte: futuro }), null);
});

test('um cartão por vez: instalar vem antes do backup', () => {
  assert.equal(listNotice({ ...base, podeInstalar: true, ultimoBackup: null }), 'instalar');
});

test('dispensaAte: N dias à frente', () => {
  assert.equal(dispensaAte(agora, 14), new Date(agora + 14 * 86400000).toISOString());
});

test('app recém-instalado no iPhone, ainda vazio: trazer as receitas do Safari', () => {
  const app = { ...base, isIOS: true, standalone: true, totalReceitas: 0 };
  assert.equal(listNotice(app), 'trazer');
  assert.equal(listNotice({ ...app, totalReceitas: 1 }), null); // já tem receitas
  assert.equal(listNotice({ ...app, trazerDispensadoAte: futuro }), null);
  assert.equal(listNotice({ ...app, isIOS: false }), null); // Android usa o mesmo armazenamento do Chrome
});
