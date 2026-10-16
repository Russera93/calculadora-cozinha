// js/precos-referencia.js
//
// Market reference prices (data/precos-referencia.json, weekly robot).
// A row filled from the reference is marked (origemPreco/referenciaEm) so
// it can be updated next week and shown as an estimate. Any price that
// comes from her (typed, receipt, price bank) clears the mark.

import { normalize } from './text-utils.js';

const DIA = 24 * 60 * 60 * 1000;

export function referenciaDe(nome, ref) {
  return ref?.precos?.[normalize(nome || '')] ?? null;
}

function preencher(item, entrada, ref) {
  item.precoEmbalagem = entrada.precoEmbalagem;
  item.tamanhoEmbalagem = entrada.tamanhoEmbalagem;
  item.unidadeEmbalagem = entrada.unidadeEmbalagem;
  item.origemPreco = 'referencia';
  item.referenciaEm = ref.atualizadoEm;
}

export function aplicarReferencia(item, ref) {
  if (item.semCusto || item.precoEmbalagem !== 0 || item.tamanhoEmbalagem !== 0) return false;
  const entrada = referenciaDe(item.nome, ref);
  if (!entrada) return false;
  preencher(item, entrada, ref);
  return true;
}

export function limparOrigem(item) {
  delete item.origemPreco;
  delete item.referenciaEm;
}

export function referenciasParaAtualizar(recipe, ref) {
  if (!ref) return [];
  return recipe.ingredientes.filter((item) => {
    if (item.origemPreco !== 'referencia' || !(item.referenciaEm < ref.atualizadoEm)) return false;
    const e = referenciaDe(item.nome, ref);
    return !!e && (e.precoEmbalagem !== item.precoEmbalagem || e.tamanhoEmbalagem !== item.tamanhoEmbalagem || e.unidadeEmbalagem !== item.unidadeEmbalagem);
  });
}

export function atualizarReferencias(recipe, ref) {
  const linhas = referenciasParaAtualizar(recipe, ref);
  for (const item of linhas) preencher(item, referenciaDe(item.nome, ref), ref);
  return linhas.length;
}

export function referenciaAntiga(item, hojeISO) {
  if (item.origemPreco !== 'referencia' || !item.referenciaEm) return false;
  return Date.parse(hojeISO) - Date.parse(item.referenciaEm) > 30 * DIA;
}
