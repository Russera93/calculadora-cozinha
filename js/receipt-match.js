// js/receipt-match.js
//
// Which recipe ingredient each receipt item is. Receipt names are
// abbreviated ("LEITE COND MOCA 395G", "CR LEITE", "FAR TRIGO"), so words
// match by prefix after expanding common abbreviations. Only a suggestion:
// the review screen always lets the person change it, and what they pick
// is remembered as an alias for the next receipt.

import { normalize } from './text-utils.js';

const ABREVIACOES = {
  lt: 'leite', lte: 'leite', leit: 'leite', cond: 'condensado', cr: 'creme', crem: 'creme',
  far: 'farinha', farin: 'farinha', trig: 'trigo', trg: 'trigo', acuc: 'acucar', acu: 'acucar',
  ref: 'refinado', crist: 'cristal', mant: 'manteiga', marg: 'margarina', choc: 'chocolate',
  achoc: 'achocolatado', ferm: 'fermento', ol: 'oleo', ral: 'ralado', gran: 'granulado',
  granul: 'granulado', amend: 'amendoim', req: 'requeijao', ess: 'essencia', baun: 'baunilha',
  int: 'integral', desn: 'desnatado', mor: 'morango', amd: 'amido', polv: 'polvilho',
  cast: 'castanha', qj: 'queijo', qjo: 'queijo', iog: 'iogurte', hig: 'higienico'
};

const STOPWORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'com', 'e', 'ao', 'a', 'o', 'para', 'sem']);

function words(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
}

// Receipt description -> meaningful words: abbreviations expanded,
// anything with a digit (sizes, codes, "50%") and single letters dropped.
export function expandTokens(descricao) {
  return words(descricao)
    .filter((w) => w.length > 1 && !/\d/.test(w))
    .map((w) => ABREVIACOES[w] ?? w);
}

function ingredientTokens(nome) {
  return words(nome).filter((w) => !STOPWORDS.has(w));
}

// "ovo" ~ "ovos", "cond" was already expanded, "choc" ~ "chocolate".
function tokenMatches(r, t) {
  if (r === t) return true;
  if (r.length >= 3 && t.startsWith(r)) return true;
  return t.length >= 3 && r.startsWith(t) && r.length - t.length <= 2;
}

// Share of the ingredient's words found in the description (0..1), plus a
// small tiebreak for how much of the description was used — so "LEITE
// COND" scores higher for "Leite condensado" than for "Leite".
export function matchScore(descricao, nomeIngrediente) {
  const rec = expandTokens(descricao);
  const ing = ingredientTokens(nomeIngrediente);
  if (rec.length === 0 || ing.length === 0) return 0;
  const achados = ing.filter((t) => rec.some((r) => tokenMatches(r, t))).length;
  const principal = achados / ing.length;
  if (principal < 0.5) return 0;
  const usados = rec.filter((r) => ing.some((t) => tokenMatches(r, t))).length;
  return principal + 0.1 * (usados / rec.length);
}

// What an alias is keyed by: the description without sizes/codes, so the
// same product in another size still hits.
export function aliasKey(descricao) {
  return expandTokens(descricao).join(' ');
}

// For each item, the index (in nomesIngredientes) it goes to, or null.
// Aliases first, then the highest scores, each ingredient used once.
export function suggestMatches(itens, nomesIngredientes, apelidos) {
  const result = itens.map(() => null);
  const usado = new Set();
  const porNome = new Map(nomesIngredientes.map((nome, i) => [normalize(nome), i]));

  const pares = [];
  itens.forEach((item, i) => {
    const chave = aliasKey(item.descricao);
    const apelido = chave && apelidos.find((a) => a.chave === chave);
    const alvo = apelido ? porNome.get(normalize(apelido.nome)) : undefined;
    if (alvo !== undefined) pares.push({ i, j: alvo, score: 10 });
    nomesIngredientes.forEach((nome, j) => {
      const score = matchScore(item.descricao, nome);
      if (score > 0) pares.push({ i, j, score });
    });
  });

  // Stable sort: on a tie, the earlier item keeps the ingredient.
  pares.sort((a, b) => b.score - a.score);
  for (const { i, j } of pares) {
    if (result[i] != null || usado.has(j)) continue;
    result[i] = j;
    usado.add(j);
  }
  return result;
}
