// js/costing.js
//
// Per-ingredient cost math, moved out of app.js so it can be unit-tested.
// computeLineCost and quantidadeConvertidaEmGramas keep exactly the
// behavior they had in app.js (including the "whole package" rule for
// "1 lata" and the count-based rule for eggs bought by the dozen).

import { parseQuantity, toGrams, calculateIngredientCost } from './calculations.js';
import { formatBRL, formatDecimalInput, unitLabel, packageUnitShort } from './format.js';

export function computeLineCost(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  // Bought by the piece (a dozen eggs): compare both sides in units.
  if (item.unidadeEmbalagem === 'unidade') {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;

    let usadoEmUnidades;
    if (item.unidade === 'unidade') {
      usadoEmUnidades = quantidade;
    } else {
      // Recipe measures by weight/volume but it's bought by the piece:
      // convert back to a unit count via the average weight per unit.
      if (!item.pesoUnidadeG) return null;
      const gramas = toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
      if (gramas == null) return null;
      usadoEmUnidades = gramas / item.pesoUnidadeG;
    }

    return calculateIngredientCost({
      gramasUsadas: usadoEmUnidades,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
  }

  // "1 unidade" of something sold by weight/volume with no known weight
  // per unit (e.g. "1 lata de leite condensado"): one whole package.
  if (item.unidade === 'unidade' && item.pesoUnidadeG == null) {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;
    return calculateIngredientCost({
      gramasUsadas: quantidade * item.tamanhoEmbalagem,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
  }

  const gramas = toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
  if (gramas == null) return null;

  // An 'ml' package must be converted to grams via density first, or
  // 900 ml of oil would be costed as 900 g.
  const gramasEmbalagem = item.unidadeEmbalagem === 'ml'
    ? toGrams({ quantidade: item.tamanhoEmbalagem, unidade: 'ml', densidadeGml: item.densidadeGml, pesoUnidadeG: null })
    : item.tamanhoEmbalagem;

  return calculateIngredientCost({ gramasUsadas: gramas, gramasEmbalagem, precoEmbalagem: item.precoEmbalagem });
}

// The "≈ 60 g" hint: only for units where a hidden conversion happens.
export function quantidadeConvertidaEmGramas(item, quantidade) {
  if (quantidade == null) return null;
  if (item.unidade === 'xicara' || item.unidade === 'colherSopa' || item.unidade === 'colherCha') {
    if (item.densidadeGml == null) return null;
    return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml });
  }
  if (item.unidade === 'unidade' && item.unidadeEmbalagem !== 'unidade' && item.pesoUnidadeG != null) {
    return quantidade * item.pesoUnidadeG;
  }
  return null;
}

// Grams of this ingredient that go into the recipe, or null when unknown.
// Mirrors computeLineCost's "whole package" rule for "1 lata".
export function gramsUsed(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  if (item.unidade === 'unidade' && item.pesoUnidadeG == null) {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;
    if (item.unidadeEmbalagem === 'g') return quantidade * item.tamanhoEmbalagem;
    if (item.unidadeEmbalagem === 'ml') {
      return item.densidadeGml == null ? null : quantidade * item.tamanhoEmbalagem * item.densidadeGml;
    }
    return null;
  }

  return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
}

export const ISSUE_TEXT = {
  quantidade: 'falta a quantidade',
  quantidadeInvalida: 'quantidade não reconhecida (use 2, 1/2 ou 0,5)',
  preco: 'falta o preço',
  tamanho: 'falta o tamanho da embalagem',
  conversao: 'não dá para converter essa unidade — use g ou ml'
};

export function lineIssue(item) {
  if (String(item.quantidadeBruta ?? '').trim() === '') return 'quantidade';
  if (parseQuantity(item.quantidadeBruta) == null) return 'quantidadeInvalida';
  if (!(item.precoEmbalagem > 0)) return 'preco';
  if (!(item.tamanhoEmbalagem > 0)) return 'tamanho';
  if (computeLineCost(item) == null) return 'conversao';
  return null;
}

export function ingredientSummary(item) {
  const partes = [];
  const bruta = String(item.quantidadeBruta ?? '').trim();
  if (bruta) partes.push(`${bruta} ${unitLabel(item.unidade, parseQuantity(bruta))}`);
  if (item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) {
    partes.push(`${formatBRL(item.precoEmbalagem)} / ${formatDecimalInput(item.tamanhoEmbalagem)} ${packageUnitShort(item.unidadeEmbalagem)}`);
  }
  return partes.join(' · ');
}
