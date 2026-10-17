// js/meus-ingredientes.js
//
// "Meus ingredientes": every ingredient name used across the person's
// recipes, in one list, so prices can be reviewed from a single place
// instead of hunting through each recipe.

import { normalize } from './text-utils.js';

// Distinct names (first spelling seen), skipping free rows and blanks.
export function nomesIngredientes(recipes) {
  const vistos = new Map(); // normalized -> first spelling
  for (const r of recipes || []) {
    for (const item of r.ingredientes || []) {
      const nome = (item.nome || '').trim();
      if (!nome || item.semCusto) continue;
      const key = normalize(nome);
      if (!vistos.has(key)) vistos.set(key, nome);
    }
  }
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}

// The price to show for a name: her own confirmed price (the price bank)
// first; otherwise whatever a recipe row already has — it may be a
// market reference auto-filled in (origemPreco: 'referencia'), still
// worth showing even before she has confirmed it as her own.
export function precoEfetivo(nome, recipes, precoBanco) {
  if (precoBanco) return { precoEmbalagem: precoBanco.precoEmbalagem, tamanhoEmbalagem: precoBanco.tamanhoEmbalagem, unidadeEmbalagem: precoBanco.unidadeEmbalagem };
  const alvo = normalize(nome);
  for (const r of recipes || []) {
    for (const item of r.ingredientes || []) {
      if (normalize(item.nome || '') === alvo && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) {
        return { precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem, origemPreco: item.origemPreco };
      }
    }
  }
  return null;
}
