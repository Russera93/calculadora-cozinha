// js/screens/editor/ingredientes.js — yield + ingredient rows.

import { calculateRecipeTotals } from '../../calculations.js';
import { computeLineCost, lineIssue, ISSUE_TEXT, ingredientSummary } from '../../costing.js';
import { formatBRL, parseInteger } from '../../format.js';
import { navigate, goBack } from '../../router.js';
import { html, setHtml } from '../../ui/dom.js';
import { openIngredientSheet } from './ingrediente-sheet.js';
import { openNotaSheet } from './nota-sheet.js';
import { openPreparoSheet } from './preparo-sheet.js';
import { referenciaAntiga, referenciasParaAtualizar, atualizarReferencias, redatarReferencias } from '../../precos-referencia.js';
import { getPrecosReferencia } from '../../precos-referencia-loader.js';
import { showToast } from '../../ui/toast.js';
import { compraResumoHtml } from './compra-resumo.js';
import { purchaseYield } from '../../purchase.js';

function rowHtml(item, index) {
  const custo = computeLineCost(item);
  const issue = lineIssue(item);
  const resumo = ingredientSummary(item);
  return html`
    <li>
      <button type="button" class="card ing-row" data-index="${index}">
        <span class="ing-row-top">
          <span class="ing-row-name">${item.nome}</span>
          ${item.semCusto ? html`<span class="muted">sem custo</span>` : html`<span class="text-cost">${custo != null ? formatBRL(custo) : '—'}</span>`}
        </span>
        ${resumo ? html`<span class="muted ing-row-detail">${resumo}${item.origemPreco === 'referencia' ? html` <span class="tag">${referenciaAntiga(item, new Date().toISOString().slice(0, 10)) ? 'referência antiga' : 'referência'}</span>` : ''}</span>` : ''}
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
      <label for="rendimento"><strong>Rende</strong> <span class="muted">unidades</span></label>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Diminuir unidades">−</button>
        <input id="rendimento" class="input" inputmode="numeric" pattern="[0-9]*" value="${store.recipe.rendimento}" autocomplete="off">
        <button type="button" data-step="1" aria-label="Aumentar unidades">+</button>
      </div>
    </div>
    <div data-slot="referencia"></div>
    <h2 class="section-title"><span>Ingredientes</span><span class="muted" data-total></span></h2>
    <ul class="ing-list stack" data-list></ul>
    <button type="button" class="add-row" data-action="add">+ Adicionar ingrediente</button>
    <button type="button" class="btn btn-secondary btn-block nota-btn" data-action="nota">📷 Ler nota de compra</button>
    <div data-slot="compra"></div>
    <h2 class="section-title"><span>Modo de preparo</span><button type="button" class="btn-link" data-action="preparo" data-preparo-editar hidden>Editar</button></h2>
    <div data-slot="preparo"></div>`);

  const rendInput = panel.querySelector('#rendimento');
  const list = panel.querySelector('[data-list]');
  const total = panel.querySelector('[data-total]');
  const compraSlot = panel.querySelector('[data-slot="compra"]');
  const preparoSlot = panel.querySelector('[data-slot="preparo"]');
  const referenciaSlot = panel.querySelector('[data-slot="referencia"]');
  let referencia = null;
  const preparoEditar = panel.querySelector('[data-preparo-editar]');

  // The last receipt applied to this recipe: what it uses, what it makes.
  function renderCompra() {
    const y = purchaseYield(store.recipe);
    if (!y) { compraSlot.innerHTML = ''; return; }
    const data = new Date(store.recipe.compra.lidaEm);
    setHtml(compraSlot, html`
      <div class="card compra-card">
        <div class="line-total"><h2 class="card-title">Sua última compra</h2>
          <button type="button" class="btn-link" data-action="remover-compra">Remover</button></div>
        ${Number.isNaN(data.getTime()) ? '' : html`<p class="muted">Nota lida em ${data.toLocaleDateString('pt-BR')}</p>`}
        ${compraResumoHtml(y)}
      </div>`);
  }

  function renderPreparo() {
    const passos = store.recipe.modoPreparo || [];
    preparoEditar.hidden = passos.length === 0;
    setHtml(preparoSlot, passos.length
      ? html`<div class="card"><ol class="passos">${passos.map((p) => html`<li>${p}</li>`)}</ol></div>`
      : html`<div class="card"><p class="muted">Ainda sem passo a passo.</p>
          <button type="button" class="btn btn-secondary btn-block" data-action="preparo" style="margin-top:8px">✏️ Escrever modo de preparo</button></div>`);
  }

  // Newer market reference: offer to update only the rows that came from it.
  function renderReferencia() {
    const n = referenciasParaAtualizar(store.recipe, referencia).length;
    if (!n) { referenciaSlot.innerHTML = ''; return; }
    const data = referencia.atualizadoEm.split('-').reverse().slice(0, 2).join('/');
    setHtml(referenciaSlot, html`
      <div class="card aviso-card" role="note">
        <p><strong>Preços de referência novos</strong> <span class="muted">(semana de ${data})</span></p>
        <button type="button" class="btn btn-secondary btn-block" data-action="atualizar-referencia" style="margin-top:8px">Atualizar ${n} ${n === 1 ? 'preço' : 'preços'}</button>
      </div>`);
  }

  function renderRows() {
    const { ingredientes } = store.recipe;
    setHtml(list, ingredientes.length
      ? html`${ingredientes.map(rowHtml)}`
      : html`<li class="muted" style="padding:8px 2px">Comece adicionando o primeiro ingrediente.</li>`);
    const { ingredientesCost } = calculateRecipeTotals(store.recipe, computeLineCost);
    total.textContent = ingredientes.length ? formatBRL(ingredientesCost) : '';
    renderCompra();
    renderPreparo();
    renderReferencia();
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
    else if (e.target.closest('[data-action="nota"]')) navigate({ ...tabRoute, item: 'nota' });
    else if (e.target.closest('[data-action="preparo"]')) navigate({ ...tabRoute, item: 'preparo' });
    else if (e.target.closest('[data-action="atualizar-referencia"]')) {
      let n = 0;
      store.update((r) => { n = atualizarReferencias(r, referencia); });
      showToast(n === 1 ? '1 preço atualizado' : `${n} preços atualizados`);
    }
    else if (e.target.closest('[data-action="remover-compra"]')) store.update((r) => { delete r.compra; });
  }, { signal: events.signal });

  let sheet = null;
  let sheetKey = null;

  function focusRow(index) {
    if (index == null) return;
    panel.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
  }

  renderRows();
  getPrecosReferencia()
    .then((ref) => {
      if (events.signal.aborted) return;
      referencia = ref;
      // Same price confirmed this week: re-date quietly (not "antiga").
      if (redatarReferencias(structuredClone(store.recipe), ref)) store.update((r) => { redatarReferencias(r, ref); });
      renderReferencia();
    })
    .catch(() => {});

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
      if (key !== 'novo' && key !== 'nota' && key !== 'preparo' && !store.recipe.ingredientes[key]) {
        navigate(tabRoute, { replace: true }); // e.g. a stale link to a removed ingredient
        return;
      }
      sheetKey = key;
      const openFn = key === 'nota' ? openNotaSheet : key === 'preparo' ? openPreparoSheet : openIngredientSheet;
      sheet = openFn({
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
