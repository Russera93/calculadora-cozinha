// js/screens/editor/ingredientes.js — yield + ingredient rows.

import { calculateRecipeTotals } from '../../calculations.js';
import { computeLineCost, lineIssue, ISSUE_TEXT, ingredientSummary } from '../../costing.js';
import { formatBRL, parseInteger } from '../../format.js';
import { navigate, goBack } from '../../router.js';
import { html, setHtml } from '../../ui/dom.js';
import { openIngredientSheet } from './ingrediente-sheet.js';

function rowHtml(item, index) {
  const custo = computeLineCost(item);
  const issue = lineIssue(item);
  const resumo = ingredientSummary(item);
  return html`
    <li>
      <button type="button" class="card ing-row" data-index="${index}">
        <span class="ing-row-top">
          <span class="ing-row-name">${item.nome}</span>
          <span class="text-cost">${custo != null ? formatBRL(custo) : '—'}</span>
        </span>
        ${resumo ? html`<span class="muted ing-row-detail">${resumo}</span>` : ''}
        ${issue ? html`<span class="ing-row-issue">${ISSUE_TEXT[issue]}</span>` : ''}
      </button>
    </li>`;
}

export function render(panel, { store }) {
  const events = new AbortController();
  const recipeId = store.recipe.id;
  const tabRoute = { screen: 'editor', recipeId, aba: 'ingredientes' };

  setHtml(panel, html`
    <div class="card rende-row">
      <label for="rendimento"><strong>Rende</strong> <span class="muted">porções</span></label>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Diminuir porções">−</button>
        <input id="rendimento" class="input" inputmode="numeric" pattern="[0-9]*" value="${store.recipe.rendimento}" autocomplete="off">
        <button type="button" data-step="1" aria-label="Aumentar porções">+</button>
      </div>
    </div>
    <h2 class="section-title"><span>Ingredientes</span><span class="muted" data-total></span></h2>
    <ul class="ing-list stack" data-list></ul>
    <button type="button" class="add-row" data-action="add">+ Adicionar ingrediente</button>`);

  const rendInput = panel.querySelector('#rendimento');
  const list = panel.querySelector('[data-list]');
  const total = panel.querySelector('[data-total]');

  function renderRows() {
    const { ingredientes } = store.recipe;
    setHtml(list, ingredientes.length
      ? html`${ingredientes.map(rowHtml)}`
      : html`<li class="muted" style="padding:8px 2px">Comece adicionando o primeiro ingrediente.</li>`);
    const { ingredientesCost } = calculateRecipeTotals(store.recipe, computeLineCost);
    total.textContent = ingredientes.length ? formatBRL(ingredientesCost) : '';
  }
  const unsubscribe = store.subscribe(renderRows);

  rendInput.addEventListener('input', () => {
    store.update((r) => { r.rendimento = parseInteger(rendInput.value); });
  }, { signal: events.signal });

  panel.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const next = Math.max(1, (store.recipe.rendimento || 0) + Number(step.dataset.step));
      rendInput.value = String(next);
      store.update((r) => { r.rendimento = next; });
      return;
    }
    const row = e.target.closest('[data-index]');
    if (row) navigate({ ...tabRoute, item: Number(row.dataset.index) });
    else if (e.target.closest('[data-action="add"]')) navigate({ ...tabRoute, item: 'novo' });
  }, { signal: events.signal });

  let sheet = null;
  let sheetKey = null;

  function focusRow(index) {
    if (index == null) return;
    panel.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
  }

  renderRows();

  return {
    update(route) {
      const key = route.item ?? null;
      if (key === sheetKey) return;
      if (sheet) {
        const open = sheet;
        sheet = null;
        sheetKey = null;
        open.close();
      }
      if (key == null) return;
      if (key !== 'novo' && !store.recipe.ingredientes[key]) {
        navigate(tabRoute, { replace: true }); // e.g. a stale link to a removed ingredient
        return;
      }
      sheetKey = key;
      sheet = openIngredientSheet({
        store,
        index: key,
        onRequestClose: () => goBack(tabRoute),
        onClose: (finalIndex) => {
          if (sheetKey === key) { sheet = null; sheetKey = null; }
          focusRow(finalIndex);
        }
      });
    },
    destroy() {
      sheet?.close();
      unsubscribe();
      events.abort();
    }
  };
}
