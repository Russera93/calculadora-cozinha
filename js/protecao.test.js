import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protectionNotice } from './protecao.js';

const agora = Date.parse('2026-10-15T12:00:00Z');
const dias = (n) => new Date(agora - n * 86400000).toISOString();
const base = { isIOS: false, standalone: false, totalReceitas: 5, ultimoBackup: dias(2), dispensadoAte: null, agora };

test('iPhone/iPad no navegador, com receitas: pedir para instalar', () => {
  assert.equal(protectionNotice({ ...base, isIOS: true }), 'ios');
  assert.equal(protectionNotice({ ...base, isIOS: true, totalReceitas: 1 }), 'ios');
  assert.equal(protectionNotice({ ...base, isIOS: true, standalone: true }), null);
  assert.equal(protectionNotice({ ...base, isIOS: true, totalReceitas: 0 }), null);
});

test('backup: com 3+ receitas e nunca salvo, ou salvo há mais de 30 dias', () => {
  assert.equal(protectionNotice({ ...base, ultimoBackup: null }), 'backup');
  assert.equal(protectionNotice({ ...base, ultimoBackup: dias(31) }), 'backup');
  assert.equal(protectionNotice({ ...base, ultimoBackup: dias(29) }), null);
  assert.equal(protectionNotice({ ...base, ultimoBackup: null, totalReceitas: 2 }), null);
});

test('fechado pela pessoa: some até a data combinada', () => {
  const noFuturo = new Date(agora + 86400000).toISOString();
  assert.equal(protectionNotice({ ...base, ultimoBackup: null, dispensadoAte: noFuturo }), null);
  assert.equal(protectionNotice({ ...base, ultimoBackup: null, dispensadoAte: dias(1) }), 'backup');
});
