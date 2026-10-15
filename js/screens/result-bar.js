// js/screens/result-bar.js — the always-visible cost / "você ganha" bar.

import { recipeResult } from '../results.js';
import { getNegocio } from '../storage.js';
import { formatBRL } from '../format.js';
import { html, setHtml } from '../ui/dom.js';

export function resultBarContent(r) {
  let main;
  if (r.kind === 'semRendimento') {
    main = html`<span class="result-bar-value">Defina quantas unidades a receita rende</span>`;
  } else if (r.kind === 'semIngredientes') {
    main = html`<span class="result-bar-value">Adicione ingredientes para ver o custo</span>`;
  } else {
    const custo = html`<span>Custo <strong>${formatBRL(r.gastoPorUnidade)}</strong>/un.</span>`;
    let direita;
    if (r.kind === 'semPreco') direita = html`<span class="result-bar-value">Defina seu preço ›</span>`;
    else if (r.kind === 'ganho') direita = html`<span class="result-bar-value profit">Você ganha ${formatBRL(r.ganhoPorUnidade)}/un.</span>`;
    else direita = html`<span class="result-bar-value loss">Você perde ${formatBRL(Math.abs(r.ganhoPorUnidade))}/un.</span>`;
    main = html`${custo}${direita}`;
  }

  let sub = '';
  if (r.ingredientesSemCusto > 0) {
    sub = html`<span class="result-bar-sub">${r.ingredientesSemCusto} ingrediente(s) sem preço</span>`;
  } else if (r.horaRendeu != null && (r.kind === 'ganho' || r.kind === 'prejuizo')) {
    const meta = r.bateuMeta === false ? ` — meta ${formatBRL(r.valorHora)}` : '';
    sub = html`<span class="result-bar-sub ${r.bateuMeta === false ? 'abaixo' : r.bateuMeta ? 'acima' : ''}">Sua hora rendeu ${formatBRL(r.horaRendeu)}${meta}</span>`;
  }
  return html`<span class="result-bar-main">${main}</span>${sub}`;
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
    update(recipe) { setHtml(live, resultBarContent(recipeResult(recipe, getNegocio()))); },
    setHidden(hidden) { bar.hidden = hidden; },
    destroy() { bar.remove(); }
  };
}
