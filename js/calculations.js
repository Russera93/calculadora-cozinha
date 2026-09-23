export function parseQuantity(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;

  // Mixed number: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Simple fraction: "1/2"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (den === 0) return null;
    return num / den;
  }

  // Plain number (integer or decimal)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}

export const VOLUME_ML = {
  xicara: 240,
  colherSopa: 15,
  colherCha: 5
};

export function toGrams({ quantidade, unidade, densidadeGml, pesoUnidadeG }) {
  if (typeof quantidade !== 'number' || Number.isNaN(quantidade)) return null;

  if (unidade === 'g') {
    return quantidade;
  }

  if (unidade === 'ml') {
    if (densidadeGml == null) return null;
    return quantidade * densidadeGml;
  }

  if (unidade === 'xicara' || unidade === 'colherSopa' || unidade === 'colherCha') {
    if (densidadeGml == null) return null;
    return quantidade * VOLUME_ML[unidade] * densidadeGml;
  }

  if (unidade === 'unidade') {
    if (pesoUnidadeG == null) return null;
    return quantidade * pesoUnidadeG;
  }

  return null;
}

export function calculateIngredientCost({ gramasUsadas, gramasEmbalagem, precoEmbalagem }) {
  if (typeof gramasUsadas !== 'number' || Number.isNaN(gramasUsadas)) return null;
  if (typeof gramasEmbalagem !== 'number' || gramasEmbalagem <= 0) return null;
  if (typeof precoEmbalagem !== 'number' || precoEmbalagem < 0) return null;

  return (gramasUsadas / gramasEmbalagem) * precoEmbalagem;
}

const GAS_CYLINDER_MINUTES = 3000;

export function calculateGasCost({ valorBotijao, tempoPreparoMinutos }) {
  if (typeof valorBotijao !== 'number' || valorBotijao < 0) return null;
  if (typeof tempoPreparoMinutos !== 'number' || tempoPreparoMinutos < 0) return null;

  const custoPorMinuto = valorBotijao / GAS_CYLINDER_MINUTES;
  return custoPorMinuto * tempoPreparoMinutos;
}

export function calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost }) {
  return (ingredientesCost || 0) + (gasCost || 0) + (embalagensCost || 0);
}

export function calculateCostPerPortion({ custoTotal, rendimento }) {
  if (typeof rendimento !== 'number' || rendimento <= 0) return null;
  return custoTotal / rendimento;
}

export function calculateSuggestedPrices({ custoTotal }) {
  return {
    preco2x: custoTotal * 2,
    preco3x: custoTotal * 3
  };
}

export function calculateRealMargin({ precoVenda, custoPorPorcao }) {
  if (typeof precoVenda !== 'number' || precoVenda <= 0) return null;
  if (typeof custoPorPorcao !== 'number') return null;
  return ((precoVenda - custoPorPorcao) / precoVenda) * 100;
}

// Markup (lucro sobre o custo), unlike calculateRealMargin (margem sobre a
// venda), is unbounded above 100% — selling at 3x cost is 200% markup but
// only 66.7% margin. Confectioners commonly think in markup terms ("lucro
// de mais de 100%"), so this is offered as a second, separate indicator
// rather than replacing calculateRealMargin.
export function calculateMarkup({ precoVenda, custoPorPorcao }) {
  if (typeof precoVenda !== 'number' || precoVenda <= 0) return null;
  if (typeof custoPorPorcao !== 'number' || custoPorPorcao <= 0) return null;
  return ((precoVenda - custoPorPorcao) / custoPorPorcao) * 100;
}

// Single source of truth for "how much does this whole recipe cost" math.
// Both the recipe-list preview and the editor dashboard call this with their
// own cost-per-ingredient function injected (computeIngredientCost), so the
// summation/gas/embalagem logic only lives here once instead of being
// duplicated (and drifting) between the two call sites.
export function calculateRecipeTotals(recipe, computeIngredientCost) {
  let ingredientesCost = 0;
  let ingredientesSemCusto = 0;
  for (const item of recipe.ingredientes) {
    if (!item.nome || item.nome.trim() === '') continue;
    const cost = computeIngredientCost(item);
    if (cost == null) {
      ingredientesSemCusto += 1;
    } else {
      ingredientesCost += cost;
    }
  }
  const gasCost = calculateGasCost({ valorBotijao: recipe.valorBotijao, tempoPreparoMinutos: recipe.tempoPreparoMinutos }) ?? 0;
  const embalagensCost = (recipe.embalagemUnitaria || 0) * (recipe.quantidadeEmbalagens || 0);
  const custoTotal = calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost });
  const custoPorPorcao = calculateCostPerPortion({ custoTotal, rendimento: recipe.rendimento });
  return { ingredientesCost, gasCost, embalagensCost, custoTotal, custoPorPorcao, ingredientesSemCusto };
}

// gordurasSaturadas and acucaresAdicionados are deliberately sparse: only
// TACO-sourced ingredients carry gordurasSaturadas, and only a few
// fixed/custom ingredients carry acucaresAdicionados (see ingredients-db.js
// and the custom-ingredient modal). An ingredient missing just these two
// sub-fields still contributes its other nutrients normally and is NOT
// counted in ingredientesSemDados — that counter is reserved for
// ingredients with no nutrition data at all.
const NUTRIENT_KEYS = ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio', 'gordurasSaturadas', 'acucaresAdicionados'];

export function calculateNutritionPerPortion({ itens, rendimento }) {
  if (typeof rendimento !== 'number' || rendimento <= 0) return null;

  const totals = { kcal: 0, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0, gordurasSaturadas: 0, acucaresAdicionados: 0 };
  let ingredientesSemDados = 0;
  let totalGramas = 0;

  for (const item of itens) {
    totalGramas += item.gramas || 0;
    if (!item.nutricao100g) {
      ingredientesSemDados += 1;
      continue;
    }
    for (const key of NUTRIENT_KEYS) {
      const valorPor100g = item.nutricao100g[key];
      if (typeof valorPor100g === 'number') {
        totals[key] += (valorPor100g / 100) * item.gramas;
      }
    }
  }

  const perPortion = {};
  for (const key of NUTRIENT_KEYS) {
    perPortion[key] = totals[key] / rendimento;
  }
  perPortion.ingredientesSemDados = ingredientesSemDados;
  perPortion.totalGramas = totalGramas;
  perPortion.pesoPorcao = totalGramas / rendimento;

  return perPortion;
}

// %VD (Percentual de Valores Diários) per ANVISA IN 75/2020: the portion's
// nutrient amount as a percentage of the daily reference value, rounded to
// the nearest whole number — e.g. 110mg sódio / 2400mg reference * 100 =
// 4.58 -> 5%. Returns null when there's no reference value to compare
// against (e.g. gordurasSaturadas/acucaresAdicionados data was entirely
// absent for this recipe) rather than reporting a misleading 0%.
export function calculateVD(quantidadeNaPorcao, valorDiarioReferencia) {
  if (typeof quantidadeNaPorcao !== 'number' || !Number.isFinite(quantidadeNaPorcao)) return null;
  if (typeof valorDiarioReferencia !== 'number' || valorDiarioReferencia <= 0) return null;
  return Math.round((quantidadeNaPorcao * 100) / valorDiarioReferencia);
}

// Valores Diários de Referência para adultos, ANVISA IN 75/2020.
export const VALORES_DIARIOS_REFERENCIA = {
  kcal: 2000,
  carboidratos: 300,
  proteinas: 75,
  gorduras: 55,
  gordurasSaturadas: 22,
  fibras: 25,
  sodio: 2400,
  acucaresAdicionados: 50
};
