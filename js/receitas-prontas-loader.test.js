import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReceitasProntas } from './receitas-prontas-loader.js';

test('getReceitasProntas: a failed load is not cached (retry works), a good one is', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    return { ok: true, json: async () => ({ categorias: [], receitas: [] }) };
  };
  await assert.rejects(getReceitasProntas());
  assert.deepEqual(await getReceitasProntas(), { categorias: [], receitas: [] });
  await getReceitasProntas();
  assert.equal(calls, 2);
});
