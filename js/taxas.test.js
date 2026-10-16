import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAXAS_PADRAO, normalizeTaxas, taxaDoCanal, campoDoCanal } from './taxas.js';

test('normalizeTaxas: padrão, inválidos viram 0, limite de 90%', () => {
  assert.deepEqual(normalizeTaxas(null), TAXAS_PADRAO);
  assert.deepEqual(normalizeTaxas({ taxaMaquininha: 'x', taxaIfood: 150 }), { taxaMaquininha: 0, taxaIfood: 90 });
  assert.deepEqual(normalizeTaxas({ taxaMaquininha: -2, taxaIfood: 27 }), { taxaMaquininha: 0, taxaIfood: 27 });
});

test('normalizeTaxas: lê o "Meu negócio" antigo e ignora o que não é taxa', () => {
  const antigo = { ganhoMensal: 2000, horasSemana: 24, contasFixas: { luz: 80 }, taxaMaquininha: 3.5, taxaIfood: 27, lucroExtra: 20 };
  assert.deepEqual(normalizeTaxas(antigo), { taxaMaquininha: 3.5, taxaIfood: 27 });
});

test('taxaDoCanal e campoDoCanal', () => {
  const taxas = normalizeTaxas({ taxaMaquininha: 3.5, taxaIfood: 27 });
  assert.equal(taxaDoCanal(taxas, 'direto'), 0);
  assert.equal(taxaDoCanal(taxas, 'maquininha'), 0.035);
  assert.equal(taxaDoCanal(taxas, 'ifood'), 0.27);
  assert.equal(taxaDoCanal(taxas, undefined), 0);
  assert.equal(campoDoCanal('ifood'), 'taxaIfood');
  assert.equal(campoDoCanal('direto'), null);
});
