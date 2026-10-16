// js/costing.js
//
// Per-ingredient cost math, moved out of app.js so it can be unit-tested.
// Includes the "whole package" rule for "1 lata" and the count-based rule
// for eggs bought by the dozen. Package sizes are read through
// packageInBase, so a 1 kg bag or a 1 L bottle costs like 1000 g / 1000 ml.

import { parseQuantity, toGrams, calculateIngredientCost } from './calculations.js';
import { formatBRL, formatDecimalInput, unitLabel, packageUnitShort } from './format.js';
import { packageInBase } from './units.js';
import { normalize } from './text-utils.js';

// The package in grams (ml packages through density), pieces for a
// piece package, or null when that can't be known.
function packageAmount(item) {
  if (!(item.tamanhoEmbalagem > 0)) return null;
  const pkg = packageInBase(item.tamanhoEmbalagem, item.unidadeEmbalagem);
  if (!pkg) return null;
  if (pkg.base === 'ml') {
    return item.densidadeGml == null ? null : { gramas: pkg.valor * item.densidadeGml, base: 'g' };
  }
  return pkg.base === 'g' ? { gramas: pkg.valor, base: 'g' } : { unidades: pkg.valor, base: 'unidade' };
}

export function computeLineCost(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  // Shown in the recipe but free (tap water, from a ready-made recipe).
  if (item.semCusto) return 0;

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
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0 || !packageInBase(item.tamanhoEmbalagem, item.unidadeEmbalagem)) return null;
    return calculateIngredientCost({
      gramasUsadas: quantidade,
      gramasEmbalagem: 1,
      precoEmbalagem: item.precoEmbalagem
    });
  }

  const gramas = toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
  if (gramas == null) return null;

  // An 'ml'/'l' package must be converted to grams via density first, or
  // 900 ml of oil would be costed as 900 g.
  const pkg = packageAmount(item);
  if (!pkg || pkg.base !== 'g') return null;
  return calculateIngredientCost({ gramasUsadas: gramas, gramasEmbalagem: pkg.gramas, precoEmbalagem: item.precoEmbalagem });
}

// Grams of this ingredient that go into the recipe, or null when unknown.
// Mirrors computeLineCost's "whole package" rule for "1 lata".
export function gramsUsed(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  if (item.unidade === 'unidade' && item.pesoUnidadeG == null) {
    const pkg = packageAmount(item);
    return pkg && pkg.base === 'g' ? quantidade * pkg.gramas : null;
  }

  return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
}

// The "≈ 60 g" hint: only for units where a hidden conversion happens.
export function quantidadeConvertidaEmGramas(item, quantidade) {
  if (quantidade == null) return null;
  if (item.unidade === 'xicara' || item.unidade === 'colherSopa' || item.unidade === 'colherCha') {
    if (item.densidadeGml == null) return null;
    return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml });
  }
  if (item.unidade === 'unidade' && item.unidadeEmbalagem !== 'unidade') {
    if (item.pesoUnidadeG != null) return quantidade * item.pesoUnidadeG;
    const pkg = packageAmount(item); // whole packages ("1 lata" ≈ 395 g)
    return pkg && pkg.base === 'g' ? quantidade * pkg.gramas : null;
  }
  return null;
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
  if (item.semCusto) return null;
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

// "Água" renamed to "Farinha" must cost again; retyping the same name
// (accents/case aside) keeps it free.
export function limparSemCustoAoRenomear(item, nomeAnterior) {
  if (!item.semCusto || normalize(item.nome) === normalize(nomeAnterior)) return false;
  delete item.semCusto;
  return true;
}

// Ready-made recipes repeat an ingredient (Óleo to sauté and to fry): it is
// one product, so a complete price typed on one row goes to its namesakes.
// An incomplete one (still typing) never wipes them.
export function sincronizarPrecoMesmoNome(ingredientes, item) {
  if (!(item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) || !item.nome?.trim()) return 0;
  const nome = normalize(item.nome);
  let n = 0;
  for (const outra of ingredientes) {
    if (outra === item || outra.semCusto || normalize(outra.nome || '') !== nome) continue;
    outra.precoEmbalagem = item.precoEmbalagem;
    outra.tamanhoEmbalagem = item.tamanhoEmbalagem;
    outra.unidadeEmbalagem = item.unidadeEmbalagem;
    n += 1;
  }
  return n;
}
