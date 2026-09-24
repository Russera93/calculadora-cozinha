// js/screens/editor/nutricao.js — ANVISA-style table, computed on open.

import { nutritionPerPortion, nutritionTableHtml } from '../../nutrition-table.js';
import { html, setHtml } from '../../ui/dom.js';

export function render(panel, { store }) {
  const resultado = nutritionPerPortion(store.recipe);
  setHtml(panel, resultado
    ? nutritionTableHtml(resultado, store.recipe.rendimento)
    : html`<div class="card"><p class="text-loss">Defina um rendimento válido para calcular a tabela nutricional.</p></div>`);
  return { destroy() {} };
}
