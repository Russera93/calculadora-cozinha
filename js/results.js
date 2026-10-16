// js/results.js
//
// Every number the screens show about a recipe, computed in one place:
// the list cards, the result bar and the Preço tab all read from here.
//
// Cost = ingredients + packaging + gas, the things the Custos tab asks
// for. The sale channel's fee (card machine, iFood) comes off the price,
// and the 2×/3×/4× suggestions already make up for it.

import { calculateRecipeTotals, calculateRealMargin, calculateMarkup, calculateCostPerPortion } from './calculations.js';
import { computeLineCost } from './costing.js';
import { precoBonito } from './format.js';
import { TAXAS_PADRAO, taxaDoCanal } from './taxas.js';

const MULTIPLICADORES = [['preco2x', 2], ['preco3x', 3], ['preco4x', 4]];

export function recipeResult(recipe, taxas = TAXAS_PADRAO) {
  const { custoPorPorcao: custoPorUnidade, ...totals } = calculateRecipeTotals(recipe, computeLineCost);
  const rendimento = recipe.rendimento;
  const nomeados = recipe.ingredientes.filter((i) => i.nome && i.nome.trim() !== '').length;
  const comCusto = nomeados - totals.ingredientesSemCusto;
  const taxa = taxaDoCanal(taxas, recipe.canalVenda);

  // N× the cost is what she keeps after the fee, so the price is grossed up.
  const sugeridos = custoPorUnidade != null
    ? Object.fromEntries(MULTIPLICADORES.map(([key, mult]) => [key, precoBonito((custoPorUnidade * mult) / (1 - taxa))]))
    : null;

  const preco = recipe.precoVendaDesejado;
  const temPreco = preco != null;
  const taxaPorUnidade = temPreco ? preco * taxa : null;
  const gastoPorUnidade = custoPorUnidade != null ? custoPorUnidade + (taxaPorUnidade ?? 0) : null;
  const ganhoPorUnidade = temPreco && gastoPorUnidade != null ? preco - gastoPorUnidade : null;

  let kind;
  if (!(rendimento > 0)) kind = 'semRendimento';
  else if (comCusto === 0) kind = 'semIngredientes';
  else if (!temPreco) kind = 'semPreco';
  else kind = ganhoPorUnidade >= 0 ? 'ganho' : 'prejuizo';

  const porUnidade = (valor) => calculateCostPerPortion({ custoTotal: valor, rendimento });
  return {
    kind,
    ...totals,
    custoPorUnidade,
    taxa,
    sugeridos,
    taxaPorUnidade,
    gastoPorUnidade,
    ganhoPorUnidade,
    ganhoTotal: ganhoPorUnidade != null ? ganhoPorUnidade * rendimento : null,
    // margem (over the sale price) and markup (over the cost) are
    // deliberately separate indicators — see CLAUDE.md.
    margem: temPreco && gastoPorUnidade != null ? calculateRealMargin({ precoVenda: preco, custoPorPorcao: gastoPorUnidade }) : null,
    markup: temPreco && gastoPorUnidade != null ? calculateMarkup({ precoVenda: preco, custoPorPorcao: gastoPorUnidade }) : null,
    ingredientesPorUnidade: porUnidade(totals.ingredientesCost),
    embalagensPorUnidade: porUnidade(totals.embalagensCost),
    gasPorUnidade: porUnidade(totals.gasCost)
  };
}
