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
  const embalagensCost = (recipe.embalagemUnitaria || 0) * (recipe.rendimento || 0);
  const custoTotal = calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost });
  const custoPorPorcao = calculateCostPerPortion({ custoTotal, rendimento: recipe.rendimento });
  return { ingredientesCost, gasCost, embalagensCost, custoTotal, custoPorPorcao, ingredientesSemCusto };
}

const NUTRIENT_KEYS = ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio'];

export function calculateNutritionPerPortion({ itens, rendimento }) {
  if (typeof rendimento !== 'number' || rendimento <= 0) return null;

  const totals = { kcal: 0, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0 };
  let ingredientesSemDados = 0;

  for (const item of itens) {
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

  return perPortion;
}
