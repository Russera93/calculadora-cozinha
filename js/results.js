// js/results.js
//
// Every number the screens show about a recipe, computed in one place:
// the list cards, the result bar and the Preço tab all read from here.
//
// "Lucro de verdade": besides material (ingredients + waste, packaging,
// gas), a recipe carries its share of the monthly fixed bills and, for the
// fair price, the cook's own hour — both by the working time it takes.
// The sale channel's fee (card machine, iFood) comes off the price. With
// no "Meu negócio" set up and no time, this is exactly the old math.

import {
  calculateRecipeTotals, calculateRealMargin, calculateMarkup, calculateCostPerPortion
} from './calculations.js';
import { computeLineCost } from './costing.js';
import { precoBonito } from './format.js';
import { NEGOCIO_PADRAO, isConfigurado, valorHora, fixosPorHora, taxaDoCanal } from './negocio.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function recipeResult(recipe, negocio = NEGOCIO_PADRAO) {
  const totals = calculateRecipeTotals(recipe, computeLineCost);
  const rendimento = recipe.rendimento;
  const temRendimento = rendimento > 0;
  const nomeados = recipe.ingredientes.filter((i) => i.nome && i.nome.trim() !== '').length;
  const comCusto = nomeados - totals.ingredientesSemCusto;

  const perdaCost = totals.ingredientesCost * clamp(recipe.perdaPercent || 0, 0, 90) / 100;
  const materialCost = totals.ingredientesCost + perdaCost + totals.gasCost + totals.embalagensCost;
  const horas = recipe.tempoTrabalhoMinutos > 0 ? recipe.tempoTrabalhoMinutos / 60 : 0;
  const configurado = isConfigurado(negocio);
  const hora = valorHora(negocio);
  const fixosCost = fixosPorHora(negocio) * horas;
  const maoDeObraCost = hora * horas;
  const custoTotal = materialCost + fixosCost;
  const custoPorUnidade = temRendimento ? custoTotal / rendimento : null;
  const taxa = taxaDoCanal(negocio, recipe.canalVenda);

  const porUnidade = (valor) => calculateCostPerPortion({ custoTotal: valor, rendimento });

  // Suggestions (per unit), before and after rounding to an easy price.
  let motivoSemJusto = null;
  if (!configurado) motivoSemJusto = 'negocio';
  else if (horas === 0) motivoSemJusto = 'tempo';
  const precoMinimoExato = custoPorUnidade != null ? custoPorUnidade / (1 - taxa) : null;
  const precoJustoExato = custoPorUnidade != null && !motivoSemJusto
    ? (custoTotal + maoDeObraCost) / rendimento / (1 - taxa)
    : null;
  const precoComLucroExato = precoJustoExato != null ? precoJustoExato * (1 + negocio.lucroExtra / 100) : null;
  const sugeridos = custoPorUnidade != null
    ? { minimo: precoBonito(precoMinimoExato), justo: precoBonito(precoJustoExato), comLucro: precoBonito(precoComLucroExato) }
    : null;

  // What the price actually charged leaves.
  const preco = recipe.precoVendaDesejado;
  const temPreco = preco != null;
  const taxaPorUnidade = temPreco ? preco * taxa : null;
  const gastoPorUnidade = custoPorUnidade != null ? custoPorUnidade + (taxaPorUnidade ?? 0) : null;
  const ganhoPorUnidade = temPreco && gastoPorUnidade != null ? preco - gastoPorUnidade : null;
  const ganhoTotal = ganhoPorUnidade != null ? ganhoPorUnidade * rendimento : null;
  const horaRendeu = ganhoTotal != null && horas > 0 ? ganhoTotal / horas : null;

  let kind;
  if (!temRendimento) kind = 'semRendimento';
  else if (comCusto === 0) kind = 'semIngredientes';
  else if (!temPreco) kind = 'semPreco';
  else kind = ganhoPorUnidade >= 0 ? 'ganho' : 'prejuizo';

  // custoPorPorcao (material only) is replaced by custoPorUnidade below.
  const { custoPorPorcao: _materialPorUnidade, ...outros } = totals;
  return {
    kind,
    ...outros,
    perdaCost, materialCost, horas, fixosCost, maoDeObraCost, custoTotal, custoPorUnidade,
    configurado, valorHora: configurado ? hora : null, taxa,
    sugeridos, motivoSemJusto, precoMinimoExato, precoJustoExato,
    taxaPorUnidade, gastoPorUnidade, ganhoPorUnidade, ganhoTotal, horaRendeu,
    bateuMeta: horaRendeu != null && configurado ? horaRendeu >= hora : null,
    // margem (over the sale price) and markup (over the cost) are
    // deliberately separate indicators — see CLAUDE.md.
    margem: temPreco && gastoPorUnidade != null ? calculateRealMargin({ precoVenda: preco, custoPorPorcao: gastoPorUnidade }) : null,
    markup: temPreco && gastoPorUnidade != null ? calculateMarkup({ precoVenda: preco, custoPorPorcao: gastoPorUnidade }) : null,
    embalagensPorUnidade: porUnidade(totals.embalagensCost),
    gasPorUnidade: porUnidade(totals.gasCost),
    perdaPorUnidade: porUnidade(perdaCost),
    ingredientesPorUnidade: porUnidade(totals.ingredientesCost),
    fixosPorUnidade: porUnidade(fixosCost),
    maoDeObraPorUnidade: porUnidade(maoDeObraCost)
  };
}
