// js/screens/prontas.js — "Receitas prontas": search, category chips and
// cards. Loaded on demand (data/receitas-prontas.json).

import { getReceitasProntas } from '../receitas-prontas-loader.js';
import { rendeTexto, contarIngredientes } from '../receitas-prontas.js';
import { normalize } from '../text-utils.js';
import { html, setHtml } from '../ui/dom.js';
import { navigate, goBack } from '../router.js';
import { toggleTheme, syncThemeUi } from '../theme.js';
import { homeHeaderHtml } from './home-header.js';

const TODAS = 'todas';

function cardHtml(r) {
  return html`
    <button type="button" class="card pronta-card" data-pronta="${r.id}">
      <span class="recipe-card-name">${r.nome}</span>
      <span class="muted">${rendeTexto(r)} · ${contarIngredientes(r)} ingredientes</span>
      <span class="pronta-card-seta" aria-hidden="true">›</span>
    </button>`;
}

export function renderProntas(view) {
  const events = new AbortController();
  let catalogo = null;
  let query = '';
  let categoria = TODAS;

  setHtml(view, html`
    ${homeHeaderHtml('prontas')}
    <div data-slot="filtros"></div>
    <div data-slot="lista"></div>`);
  syncThemeUi();
  const filtrosSlot = view.querySelector('[data-slot="filtros"]');
  const listaSlot = view.querySelector('[data-slot="lista"]');

  function mensagem(texto) {
    return html`<p class="muted" style="text-align:center;padding:16px">${texto}</p>`;
  }

  function renderFiltros() {
    const usadas = new Set(catalogo.receitas.map((r) => r.categoria));
    const cats = catalogo.categorias.filter((c) => usadas.has(c.id));
    setHtml(filtrosSlot, html`
      <label class="visually-hidden" for="busca-prontas">Buscar receita pronta</label>
      <input id="busca-prontas" class="input search" type="search" placeholder="🔍 Buscar receita pronta" enterkeyhint="search" autocomplete="off">
      <div class="chips prontas-chips" role="group" aria-label="Categorias">
        <button type="button" class="chip" data-categoria="${TODAS}" aria-pressed="true">Todas</button>
        ${cats.map((c) => html`<button type="button" class="chip" data-categoria="${c.id}" aria-pressed="false">${c.nome}</button>`)}
      </div>`);
    filtrosSlot.querySelector('input').addEventListener('input', (e) => { query = e.target.value; renderLista(); }, { signal: events.signal });
  }

  function renderLista() {
    if (catalogo.receitas.length === 0) {
      setHtml(listaSlot, mensagem('Em breve: receitas prontas para você usar.'));
      return;
    }
    const q = normalize(query);
    const visiveis = catalogo.receitas.filter((r) =>
      (categoria === TODAS || r.categoria === categoria) && (!q || normalize(r.nome).includes(q)));
    if (visiveis.length === 0) {
      setHtml(listaSlot, mensagem(`Nenhuma receita com "${query}".`));
      return;
    }
    if (categoria === TODAS && !q) {
      setHtml(listaSlot, html`${catalogo.categorias.map((c) => {
        const daCategoria = visiveis.filter((r) => r.categoria === c.id);
        if (daCategoria.length === 0) return '';
        return html`
          <h2 class="section-title"><span>${c.nome}</span><span class="muted">${daCategoria.length}</span></h2>
          <div class="stack">${daCategoria.map(cardHtml)}</div>`;
      })}`);
      return;
    }
    setHtml(listaSlot, html`<div class="stack prontas-filtradas">${visiveis.map(cardHtml)}</div>`);
  }

  function carregar() {
    setHtml(listaSlot, mensagem('Carregando receitas…'));
    getReceitasProntas()
      .then((data) => {
        if (events.signal.aborted) return;
        catalogo = data;
        renderFiltros();
        renderLista();
      })
      .catch(() => {
        if (events.signal.aborted) return;
        setHtml(listaSlot, html`
          <div class="card empty">
            <p>Não foi possível carregar as receitas prontas — verifique sua conexão.</p>
            <button type="button" class="btn btn-secondary" data-action="tentar">Tentar de novo</button>
          </div>`);
      });
  }

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-home-tab], [data-action], [data-categoria], [data-pronta]');
    if (!target) return;
    if (target.dataset.homeTab === 'minhas') goBack({ screen: 'lista' });
    else if (target.dataset.pronta) navigate({ screen: 'pronta', prontaId: target.dataset.pronta });
    else if (target.dataset.categoria) {
      categoria = target.dataset.categoria;
      for (const chip of filtrosSlot.querySelectorAll('[data-categoria]')) {
        chip.setAttribute('aria-pressed', String(chip.dataset.categoria === categoria));
      }
      renderLista();
    } else if (target.dataset.action === 'ajustes') navigate({ screen: 'lista', sheet: 'ajustes' });
    else if (target.dataset.action === 'tema') toggleTheme();
    else if (target.dataset.action === 'tentar') carregar();
  }, { signal: events.signal });

  carregar();

  return {
    update() {},
    destroy() { events.abort(); }
  };
}
