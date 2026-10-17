// js/screens/home-header.js — title and the Minhas receitas / Receitas
// prontas switch shared by both home screens. The tabs switch screens
// (routes), so they are links in spirit: aria-current, not role="tab".

import { html } from '../ui/dom.js';

export function homeHeaderHtml(ativa) {
  const tab = (id, label) => html`<button type="button" class="tab" data-home-tab="${id}" aria-current="${ativa === id ? 'page' : 'false'}">${label}</button>`;
  return html`
    <div class="sticky-head">
      <header class="topbar">
        <h1>Doce Valor</h1>
        <button type="button" class="icon-btn outlined" data-action="ajustes" aria-label="Ajustes e backup">⚙️</button>
        <button type="button" class="icon-btn outlined" data-action="tema" aria-label="Alternar tema claro/escuro"><span data-theme-icon aria-hidden="true">🌙</span></button>
      </header>
      <nav class="tabs" aria-label="Receitas">
        ${tab('minhas', 'Minhas receitas')}
        ${tab('prontas', 'Receitas prontas')}
      </nav>
    </div>`;
}
