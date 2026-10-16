// js/ui/sugestoes.js
//
// Ingredient name suggestions under a text field, replacing the browser's
// <datalist> (which can't show categories and looks different on every
// phone). Empty field: category chips to browse. Typing: matching names,
// each with its category. Picking one fills the field and fires `change`,
// so the sheet's usual matching (fixed DB, known price, TACO) runs.

import { CATEGORIAS, buscarSugestoes, itensDaCategoria } from '../ingredientes-sugeridos.js';
import { html, setHtml } from './dom.js';

const AREAS = [...new Set(CATEGORIAS.map((c) => c.area))];

export function attachSugestoes(input, { getCustom, onPick }) {
  const panel = document.createElement('div');
  panel.className = 'ing-sug';
  panel.id = `sugestoes-${input.name}`;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Sugestões');
  panel.hidden = true;
  input.setAttribute('aria-controls', panel.id);
  input.setAttribute('aria-expanded', 'false');
  (input.closest('.field') || input).after(panel);

  function show(fragment) {
    setHtml(panel, fragment);
    panel.hidden = false;
    panel.scrollTop = 0;
    input.setAttribute('aria-expanded', 'true');
  }

  function hide() {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  }

  const chip = (id, nome) => html`<button type="button" class="chip" data-categoria="${id}">${nome}</button>`;
  const item = (nome, categoria) => html`
    <button type="button" class="ing-sug-item" data-nome="${nome}">
      <span>${nome}</span>${categoria ? html`<span class="ing-sug-cat">${categoria}</span>` : ''}
    </button>`;

  function renderCategorias() {
    const temMeus = getCustom().length > 0;
    show(html`
      ${temMeus ? html`<p class="ing-sug-area">Já usados por você</p><div class="chips">${chip('meus', 'Meus ingredientes')}</div>` : ''}
      ${AREAS.map((area) => html`
        <p class="ing-sug-area">${area}</p>
        <div class="chips">${CATEGORIAS.filter((c) => c.area === area).map((c) => chip(c.id, c.nome))}</div>`)}`);
  }

  function renderCategoria(id) {
    const nome = id === 'meus' ? 'Meus ingredientes' : CATEGORIAS.find((c) => c.id === id)?.nome;
    show(html`
      <button type="button" class="btn-link ing-sug-voltar" data-voltar>‹ Categorias</button>
      <p class="ing-sug-area">${nome}</p>
      ${itensDaCategoria(id, getCustom()).map((n) => item(n))}`);
  }

  function renderBusca(texto) {
    const found = buscarSugestoes(texto, getCustom());
    if (found.length === 0) { hide(); return; }
    show(html`${found.map((s) => item(s.nome, s.categoria))}`);
  }

  input.addEventListener('focus', () => { if (!input.value.trim()) renderCategorias(); });
  input.addEventListener('input', () => {
    if (input.value.trim()) renderBusca(input.value);
    else renderCategorias();
  });
  input.addEventListener('blur', hide);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      e.preventDefault();
      e.stopPropagation(); // close the list, not the sheet
      hide();
    }
  });

  // Keep the focus in the field: tapping a chip must not blur it (blur hides).
  panel.addEventListener('mousedown', (e) => e.preventDefault());
  panel.addEventListener('click', (e) => {
    const cat = e.target.closest('[data-categoria]');
    if (cat) { renderCategoria(cat.dataset.categoria); return; }
    if (e.target.closest('[data-voltar]')) { renderCategorias(); return; }
    const picked = e.target.closest('[data-nome]');
    if (picked) {
      input.value = picked.dataset.nome;
      hide();
      input.dispatchEvent(new Event('change', { bubbles: true }));
      onPick?.(picked.dataset.nome);
    }
  });
}
