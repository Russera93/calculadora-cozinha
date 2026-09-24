// js/screens/editor.js — recipe editor: header, tabs, result bar.

import { getRecipe, deleteRecipe } from '../storage.js';
import { store } from '../store.js';
import { navigate, goBack } from '../router.js';
import { isNewRecipe, forgetNewRecipe } from '../session.js';
import { buildRecipeShareText, whatsappUrl } from '../share.js';
import { html, raw, setHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { WHATSAPP_ICON } from '../ui/icons.js';
import { mountResultBar } from './result-bar.js';
import * as ingredientesTab from './editor/ingredientes.js';
import * as custosTab from './editor/custos.js';
import * as precoTab from './editor/preco.js';
import * as nutricaoTab from './editor/nutricao.js';

const TABS = [
  ['ingredientes', 'Ingredientes', ingredientesTab],
  ['custos', 'Custos', custosTab],
  ['preco', 'Preço', precoTab],
  ['nutricao', 'Nutrição', nutricaoTab]
];
const SAVE_LABELS = { salvo: '✓ Salvo', salvando: 'Salvando…', erro: '⚠ Não salvo' };

export function renderEditor(view, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;

  const events = new AbortController();
  store.load(recipe);

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar para Minhas Receitas">←</button>
        <label class="visually-hidden" for="nome-receita">Nome da receita</label>
        <input id="nome-receita" class="title-input" value="${recipe.nome}" placeholder="Nome da receita" enterkeyhint="done" autocomplete="off">
        <span class="save-badge" data-save-badge role="status"></span>
        <button type="button" class="icon-btn whatsapp-btn" data-action="whatsapp" aria-label="Enviar receita no WhatsApp">${raw(WHATSAPP_ICON)}</button>
      </header>
      <nav class="tabs" role="tablist" aria-label="Partes da receita">
        ${TABS.map(([aba, label]) => html`<button type="button" role="tab" class="tab" id="tab-${aba}" data-tab="${aba}" aria-controls="tab-panel" aria-selected="false" tabindex="-1">${label}</button>`)}
      </nav>
    </div>
    <section id="tab-panel" role="tabpanel"></section>
    <div data-slot="result-bar"></div>`);

  const panel = view.querySelector('#tab-panel');
  const badge = view.querySelector('[data-save-badge]');
  const nameInput = view.querySelector('#nome-receita');
  const tabButtons = [...view.querySelectorAll('[role="tab"]')];
  const resultBar = mountResultBar(view.querySelector('[data-slot="result-bar"]'), { onOpen: () => showTab('preco') });

  let currentAba = null;
  let tab = null;
  let lastStatus = store.status;

  function showTab(aba) {
    navigate({ screen: 'editor', recipeId, aba }, { replace: true });
  }

  function refresh() {
    badge.textContent = SAVE_LABELS[store.status];
    badge.dataset.status = store.status;
    if (store.status === 'erro' && lastStatus !== 'erro') {
      showToast('Não foi possível salvar. Exporte um backup em Ajustes.');
    }
    lastStatus = store.status;
    resultBar.update(store.recipe);
  }
  const unsubscribe = store.subscribe(refresh);

  nameInput.addEventListener('input', () => store.update((r) => { r.nome = nameInput.value; }), { signal: events.signal });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); }, { signal: events.signal });

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-tab]');
    if (!target || !view.contains(target)) return;
    if (target.dataset.tab) showTab(target.dataset.tab);
    else if (target.dataset.action === 'voltar') goBack({ screen: 'lista' });
    else if (target.dataset.action === 'whatsapp') {
      store.flush();
      window.open(whatsappUrl(buildRecipeShareText(store.recipe)), '_blank', 'noopener');
    }
  }, { signal: events.signal });

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  view.addEventListener('keydown', (e) => {
    const i = tabButtons.indexOf(e.target);
    if (i === -1 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    e.preventDefault();
    const next = tabButtons[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length];
    next.focus();
    showTab(next.dataset.tab);
  }, { signal: events.signal });

  function mountTab(aba) {
    tab?.destroy();
    currentAba = aba;
    for (const b of tabButtons) {
      const selected = b.dataset.tab === aba;
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', `tab-${aba}`);
    panel.innerHTML = '';
    const module = TABS.find(([key]) => key === aba)[2];
    tab = module.render(panel, { store });
    resultBar.setHidden(aba === 'preco');
    window.scrollTo(0, 0);
  }

  refresh();
  if (isNewRecipe(recipeId)) requestAnimationFrame(() => nameInput.focus());

  return {
    update(route) {
      if (route.aba !== currentAba) mountTab(route.aba);
      tab.update?.(route);
    },
    destroy() {
      tab?.destroy();
      tab = null;
      unsubscribe();
      events.abort();
      resultBar.destroy();
      store.flush();
      const r = store.recipe;
      if (r && isNewRecipe(r.id)) {
        forgetNewRecipe(r.id);
        if (!r.nome.trim() && r.ingredientes.length === 0) deleteRecipe(r.id);
      }
      store.clear();
    }
  };
}
