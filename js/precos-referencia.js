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

// Renaming a reference row (Margarina -> Manteiga) must not keep the old
// product's market price: the row becomes unpriced, so her bank price for
// the new name can fill it.
export function soltarReferenciaAoRenomear(item, nomeAnterior) {
  if (item.origemPreco !== 'referencia' || normalize(item.nome || '') === normalize(nomeAnterior || '')) return false;
  item.precoEmbalagem = 0;
  item.tamanhoEmbalagem = 0;
  limparOrigem(item);
  return true;
}

// The robot confirmed the same price this week: move the date forward
// quietly, so a stable price never shows as "referência antiga".
export function redatarReferencias(recipe, ref) {
  if (!ref) return 0;
  let n = 0;
  for (const item of recipe.ingredientes) {
    if (item.origemPreco !== 'referencia' || !(item.referenciaEm < ref.atualizadoEm)) continue;
    const e = referenciaDe(item.nome, ref);
    if (!e || e.precoEmbalagem !== item.precoEmbalagem || e.tamanhoEmbalagem !== item.tamanhoEmbalagem || e.unidadeEmbalagem !== item.unidadeEmbalagem) continue;
    item.referenciaEm = ref.atualizadoEm;
    n += 1;
  }
  return n;
}
