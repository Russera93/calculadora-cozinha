import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEGOCIO_PADRAO, normalizeNegocio, horasPorMes, valorHora, totalFixos, fixosPorHora, isConfigurado, taxaDoCanal
} from './negocio.js';

const exemplo = normalizeNegocio({
  ganhoMensal: 2000, horasSemana: 24,
  contasFixas: { luz: 80, agua: 40, internet: 60, aluguel: 0, mei: 76, outros: 4 },
  taxaMaquininha: 3.5, taxaIfood: 27, lucroExtra: 20
});

test('normalizeNegocio: padrões para o que falta ou está inválido', () => {
  assert.deepEqual(normalizeNegocio(null), NEGOCIO_PADRAO);
  const n = normalizeNegocio({ ganhoMensal: 'x', horasSemana: -3, contasFixas: { luz: 50, foo: 9 }, taxaIfood: 150 });
  assert.equal(n.ganhoMensal, 0);
  assert.equal(n.horasSemana, 0);
  assert.equal(n.contasFixas.luz, 50);
  assert.equal(n.contasFixas.foo, undefined);
  assert.equal(n.taxaIfood, 90); // limitada: 100% tornaria o preço impossível
  assert.equal(n.lucroExtra, 20);
});

test('horas por mês, valor da hora e contas fixas por hora', () => {
  assert.equal(Math.round(horasPorMes(exemplo) * 100) / 100, 104); // 24 × 52 ÷ 12
  assert.equal(Math.round(valorHora(exemplo) * 100) / 100, 19.23);
  assert.equal(totalFixos(exemplo), 260);
  assert.equal(Math.round(fixosPorHora(exemplo) * 100) / 100, 2.5);
});

test('isConfigurado: precisa de meta mensal e horas', () => {
  assert.equal(isConfigurado(exemplo), true);
  assert.equal(isConfigurado(NEGOCIO_PADRAO), false);
  assert.equal(isConfigurado(normalizeNegocio({ ganhoMensal: 2000 })), false);
  assert.equal(valorHora(NEGOCIO_PADRAO), 0);
  assert.equal(fixosPorHora(normalizeNegocio({ contasFixas: { luz: 100 } })), 0); // sem horas não dá para ratear
});

test('taxaDoCanal: fração do preço que fica com a maquininha/iFood', () => {
  assert.equal(taxaDoCanal(exemplo, 'direto'), 0);
  assert.equal(taxaDoCanal(exemplo, 'maquininha'), 0.035);
  assert.equal(taxaDoCanal(exemplo, 'ifood'), 0.27);
  assert.equal(taxaDoCanal(exemplo, 'outro'), 0);
});
