// js/results.js
//
// Every number the screens show about a recipe, computed in one place:
// the list cards, the result bar and the Preço tab all read from here.

import {
  calculateRecipeTotals, calculateSuggestedPrices, calculateRealMargin,
  calculateMarkup, calculateCostPerPortion
} from './calculations.js';
import { computeLineCost } from './costing.js';

export function recipeResult(recipe) {
  const totals = calculateRecipeTotals(recipe, computeLineCost);
  const nomeados = recipe.ingredientes.filter((i) => i.nome && i.nome.trim() !== '').length;
  const comCusto = nomeados - totals.ingredientesSemCusto;
  const preco = recipe.precoVendaDesejado;
  const { custoPorPorcao } = totals;
  const temPreco = preco != null;

  const lucroPorPorcao = temPreco && custoPorPorcao != null ? preco - custoPorPorcao : null;

  let kind;
  if (!(recipe.rendimento > 0)) kind = 'semRendimento';
  else if (comCusto === 0) kind = 'semIngredientes';
  else if (!temPreco) kind = 'semPreco';
  else kind = lucroPorPorcao >= 0 ? 'lucro' : 'prejuizo';

  return {
    kind,
    ...totals,
    lucroPorPorcao,
    lucroTotal: lucroPorPorcao != null ? lucroPorPorcao * recipe.rendimento : null,
    vezesOCusto: temPreco && custoPorPorcao > 0 ? preco / custoPorPorcao : null,
    // margem (over the sale price) and markup (over the cost) are
    // deliberately separate indicators — see CLAUDE.md.
    margem: temPreco ? calculateRealMargin({ precoVenda: preco, custoPorPorcao }) : null,
    markup: temPreco ? calculateMarkup({ precoVenda: preco, custoPorPorcao }) : null,
    sugeridos: calculateSuggestedPrices({ custoPorPorcao }),
    embalagensPorPorcao: calculateCostPerPortion({ custoTotal: totals.embalagensCost, rendimento: recipe.rendimento }),
    gasPorPorcao: calculateCostPerPortion({ custoTotal: totals.gasCost, rendimento: recipe.rendimento })
  };
}
