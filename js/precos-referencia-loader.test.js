import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPrecosReferencia } from './precos-referencia-loader.js';

test('getPrecosReferencia: a failed load is not cached, a good one is', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ atualizadoEm: '2026-10-19', precos: {} }) };
  };
  await assert.rejects(getPrecosReferencia());
  assert.equal((await getPrecosReferencia()).atualizadoEm, '2026-10-19');
  await getPrecosReferencia();
  assert.equal(calls, 2);
});
