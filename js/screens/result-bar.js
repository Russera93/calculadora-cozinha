// js/screens/result-bar.js — the always-visible cost/profit bar.

import { recipeResult } from '../results.js';
import { formatBRL } from '../format.js';
import { html, setHtml } from '../ui/dom.js';

export function resultBarContent(r) {
  let main;
  if (r.kind === 'semRendimento') {
    main = html`<span class="result-bar-value">Defina quantas porções a receita rende</span>`;
  } else if (r.kind === 'semIngredientes') {
    main = html`<span class="result-bar-value">Adicione ingredientes para ver o custo</span>`;
  } else {
    const custo = html`<span>Custo <strong>${formatBRL(r.custoPorPorcao)}</strong>/un.</span>`;
    let direita;
    if (r.kind === 'semPreco') direita = html`<span class="result-bar-value">Defina seu preço ›</span>`;
    else if (r.kind === 'lucro') direita = html`<span class="result-bar-value profit">Lucro ${formatBRL(r.lucroPorPorcao)}/un.</span>`;
    else direita = html`<span class="result-bar-value loss">Prejuízo ${formatBRL(Math.abs(r.lucroPorPorcao))}/un.</span>`;
    main = html`${custo}${direita}`;
  }
  return html`
    <span class="result-bar-main">${main}</span>
    ${r.ingredientesSemCusto > 0 ? html`<span class="result-bar-sub">${r.ingredientesSemCusto} ingrediente(s) sem preço</span>` : ''}`;
}

export function mountResultBar(slot, { onOpen }) {
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'result-bar';
  bar.setAttribute('aria-label', 'Resultado — abrir a aba Preço');
  const live = document.createElement('span');
  live.setAttribute('aria-live', 'polite');
  bar.append(live);
  slot.append(bar);
  bar.addEventListener('click', onOpen);

  return {
    update(recipe) { setHtml(live, resultBarContent(recipeResult(recipe))); },
    setHidden(hidden) { bar.hidden = hidden; },
    destroy() { bar.remove(); }
  };
}
