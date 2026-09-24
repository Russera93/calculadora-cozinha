// js/screens/editor.js — minimal version; Task 13 replaces it with tabs.

import { getRecipe } from '../storage.js';
import { goBack } from '../router.js';
import { html, setHtml } from '../ui/dom.js';

export function renderEditor(view, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;
  const events = new AbortController();
  setHtml(view, html`
    <div class="sticky-head"><header class="topbar">
      <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar para Minhas Receitas">←</button>
      <h1>${recipe.nome || 'Nova receita'}</h1>
    </header></div>`);
  view.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="voltar"]')) goBack({ screen: 'lista' });
  }, { signal: events.signal });
  return { update() {}, destroy() { events.abort(); } };
}
