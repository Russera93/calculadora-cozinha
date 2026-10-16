// js/ingredient-match.js
//
// Recognizing an ingredient by name and turning an unknown one into a
// saved custom ingredient. Same rules the old app.js had
// (applyIngredientMatch + the custom-ingredient modal), made pure: storage
// lookups are passed in, so all of it is unit-tested.

import { normalize } from './text-utils.js';
import { findFixedIngredient } from './ingredients-db.js';
import { limparOrigem } from './precos-referencia.js';

export function emptyIngredientItem() {
  return {
    ingredientId: null,
    nome: '',
    quantidadeBruta: '',
    unidade: 'g',
    precoEmbalagem: 0,
    tamanhoEmbalagem: 0,
    unidadeEmbalagem: 'g',
    nutricao100g: null,
    densidadeGml: null,
    pesoUnidadeG: null
  };
}

export function findKnownIngredient(nome, customIngredients) {
  const target = normalize(nome);
  return findFixedIngredient(nome) || customIngredients.find((i) => normalize(i.nome) === target) || null;
}

export function applyIngredientMatch(item, { known, precoConhecido }) {
  // Always clear stale data first: renaming "Ovos" to something unknown
  // must not keep egg nutrition/weight under the new name.
  item.ingredientId = null;
  item.nutricao100g = null;
  item.densidadeGml = null;
  item.pesoUnidadeG = null;

  // Price learned from earlier recipes fills the row only while it is
  // still untouched — never over a value typed for this recipe.
  if (precoConhecido && item.precoEmbalagem === 0 && item.tamanhoEmbalagem === 0) {
    item.precoEmbalagem = precoConhecido.precoEmbalagem;
    item.tamanhoEmbalagem = precoConhecido.tamanhoEmbalagem;
    item.unidadeEmbalagem = precoConhecido.unidadeEmbalagem;
    limparOrigem(item); // her own price, not the market reference
  }

  if (!known) return false;

  item.ingredientId = known.id;
  item.nutricao100g = known.nutricao100g;
  item.densidadeGml = known.densidadeGml;
  item.pesoUnidadeG = known.pesoUnidadeG;

  // Counted by the piece (eggs, bananas) -> used and bought by the piece.
  if (known.pesoUnidadeG != null && known.densidadeGml == null) {
    item.unidade = 'unidade';
    item.unidadeEmbalagem = 'unidade';
  }
  return true;
}

// gordurasSaturadas is deliberately absent: it only comes from TACO lab
// data, never typed by hand.
export const NUTRIENT_LABELS = {
  kcal: 'Kcal',
  carboidratos: 'Carboidratos (g)',
  proteinas: 'Proteínas (g)',
  gorduras: 'Gorduras (g)',
  fibras: 'Fibras (g)',
  sodio: 'Sódio (mg)',
  acucaresAdicionados: 'Açúcares adicionados (g)'
};

// densidadeTaco: the density of the TACO match (by category), so a custom
// ingredient bought in g can still be measured in xícaras/colheres.
export function buildCustomIngredient({ id, nome, unidadeEmbalagem, nutricaoDigitada, nutricaoTaco, densidadeTaco = null }) {
  const nutricao100g = {};
  let anyFilled = false;
  for (const key of Object.keys(NUTRIENT_LABELS)) {
    const value = nutricaoDigitada[key] ?? null;
    nutricao100g[key] = value;
    if (value != null) anyFilled = true;
  }
  if (nutricaoTaco && typeof nutricaoTaco.gordurasSaturadas === 'number') {
    nutricao100g.gordurasSaturadas = nutricaoTaco.gordurasSaturadas;
    anyFilled = true;
  }
  return {
    id,
    nome,
    categoria: 'outro',
    densidadeGml: densidadeTaco ?? (unidadeEmbalagem === 'ml' || unidadeEmbalagem === 'l' ? 1.0 : null),
    pesoUnidadeG: null,
    nutricao100g: anyFilled ? nutricao100g : null
  };
}
