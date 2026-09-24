// js/screens/lista.js — "Minhas Receitas".

import { getRecipes, createEmptyRecipe, saveRecipe, duplicateRecipe, deleteRecipe, restoreRecipe } from '../storage.js';
import { recipeResult } from '../results.js';
import { formatBRL } from '../format.js';
import { normalize } from '../text-utils.js';
import { buildRecipeShareText, whatsappUrl } from '../share.js';
import { html, setHtml, toElement } from '../ui/dom.js';
import { openMenu, closeMenu } from '../ui/menu.js';
import { showToast } from '../ui/toast.js';
import { openSheet } from '../ui/sheet.js';
import { navigate, goBack } from '../router.js';
import { toggleTheme, syncThemeUi } from '../theme.js';
import { markNewRecipe } from '../session.js';
import { openAjustesSheet } from './ajustes.js';

const SEARCH_MIN_RECIPES = 4;
const byName = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });

function cardHtml(recipe) {
  const r = recipeResult(recipe);
  const nome = recipe.nome?.trim() || '(sem nome)';
  const custo = r.custoPorPorcao != null && r.kind !== 'semIngredientes'
    ? `Custo ${formatBRL(r.custoPorPorcao)}/un.`
    : 'Custo ainda não calculado';
  let destaque = '';
  if (r.kind === 'lucro') destaque = html`<span class="text-profit">lucro ${formatBRL(r.lucroPorPorcao)}</span>`;
  else if (r.kind === 'prejuizo') destaque = html`<span class="tag tag-loss">prejuízo ${formatBRL(Math.abs(r.lucroPorPorcao))}</span>`;
  else if (recipe.precoVendaDesejado == null) destaque = html`<span class="tag">definir preço</span>`;

  return html`
    <article class="card recipe-card">
      <button type="button" class="recipe-card-main" data-open="${recipe.id}">
        <span class="recipe-card-name">${nome}</span>
        <span class="recipe-card-meta"><span class="muted">${custo}</span>${destaque}</span>
      </button>
      <button type="button" class="icon-btn" data-menu="${recipe.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Ações para ${nome}">⋯</button>
    </article>`;
}

export function renderLista(view) {
  const events = new AbortController();
  let query = '';
  let ajustes = null;

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <h1>Minhas Receitas</h1>
        <button type="button" class="icon-btn outlined" data-action="ajustes" aria-label="Ajustes e backup">⚙️</button>
        <button type="button" class="icon-btn outlined" data-action="tema" aria-label="Alternar tema claro/escuro"><span data-theme-icon aria-hidden="true">🌙</span></button>
      </header>
    </div>
    <div data-slot="search"></div>
    <div class="stack" data-slot="list"></div>
    <button type="button" class="fab" data-action="nova">+ Nova receita</button>`);
  syncThemeUi();

  const searchSlot = view.querySelector('[data-slot="search"]');
  const listSlot = view.querySelector('[data-slot="list"]');

  function renderSearch(total) {
    if (total < SEARCH_MIN_RECIPES) {
      searchSlot.innerHTML = '';
      query = '';
      return;
    }
    if (searchSlot.firstElementChild) return;
    setHtml(searchSlot, html`
      <label class="visually-hidden" for="busca">Buscar receita</label>
      <input id="busca" class="input search" type="search" placeholder="🔍 Buscar receita" enterkeyhint="search" autocomplete="off">`);
    searchSlot.querySelector('input').addEventListener('input', (e) => { query = e.target.value; renderList(); });
  }

  function renderList() {
    const all = getRecipes().sort(byName);
    renderSearch(all.length);
    if (all.length === 0) {
      setHtml(listSlot, html`
        <div class="card empty">
          <p class="font-display" style="font-size:1.25rem">Nenhuma receita ainda</p>
          <p class="muted" style="margin-top:8px">Cadastre os ingredientes e descubra quanto custa cada unidade e quanto você lucra.</p>
          <button type="button" class="btn btn-primary" data-action="nova">Criar minha primeira receita</button>
        </div>`);
      return;
    }
    const q = normalize(query);
    const visible = q ? all.filter((r) => normalize(r.nome || '').includes(q)) : all;
    setHtml(listSlot, visible.length
      ? html`${visible.map(cardHtml)}`
      : html`<p class="muted" style="text-align:center;padding:16px">Nenhuma receita com "${query}".</p>`);
  }

  function renameRecipe(recipe) {
    const content = toElement(html`
      <form>
        <h2 class="sheet-title">Renomear receita</h2>
        <label class="field"><span class="field-label">Nome</span>
          <input class="input" name="nome" value="${recipe.nome}" enterkeyhint="done" autocomplete="off"></label>
        <div class="sheet-actions">
          <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
          <button type="submit" class="btn btn-primary" style="flex:1">Salvar</button>
        </div>
      </form>`);
    const sheet = openSheet({ title: 'Renomear receita', content, initialFocus: 'input' });
    content.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
    content.addEventListener('submit', (e) => {
      e.preventDefault();
      recipe.nome = content.elements.nome.value.trim();
      saveRecipe(recipe);
      sheet.close();
      renderList();
    });
  }

  function openRecipeMenu(anchor, id) {
    const recipe = getRecipes().find((r) => r.id === id);
    if (!recipe) return;
    const nome = recipe.nome?.trim() || '(sem nome)';
    openMenu(anchor, [
      { label: '✏️ Renomear', onSelect: () => renameRecipe(recipe) },
      { label: '📄 Duplicar', onSelect: () => { duplicateRecipe(id); renderList(); showToast('Cópia criada'); } },
      { label: '💬 Enviar no WhatsApp', onSelect: () => window.open(whatsappUrl(buildRecipeShareText(recipe)), '_blank', 'noopener') },
      {
        label: '🗑️ Excluir',
        danger: true,
        onSelect: () => {
          const removed = deleteRecipe(id);
          renderList();
          if (!removed) return;
          showToast(`"${nome}" excluída`, {
            actionLabel: 'Desfazer',
            onAction: () => { restoreRecipe(removed.recipe, removed.index); renderList(); }
          });
        }
      }
    ]);
  }

  function createRecipe() {
    const recipe = createEmptyRecipe();
    saveRecipe(recipe);
    markNewRecipe(recipe.id);
    navigate({ screen: 'editor', recipeId: recipe.id, aba: 'ingredientes' });
  }

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-open], [data-menu]');
    if (!target) return;
    if (target.dataset.open) navigate({ screen: 'editor', recipeId: target.dataset.open, aba: 'ingredientes' });
    else if (target.dataset.menu) openRecipeMenu(target, target.dataset.menu);
    else if (target.dataset.action === 'nova') createRecipe();
    else if (target.dataset.action === 'ajustes') navigate({ screen: 'lista', sheet: 'ajustes' });
    else if (target.dataset.action === 'tema') toggleTheme();
  }, { signal: events.signal });

  renderList();

  return {
    update(route) {
      if (route.sheet === 'ajustes' && !ajustes) {
        ajustes = openAjustesSheet({
          onRequestClose: () => goBack({ screen: 'lista' }),
          onClose: () => { ajustes = null; },
          onDataChanged: renderList
        });
      } else if (route.sheet !== 'ajustes' && ajustes) {
        ajustes.close();
      }
    },
    destroy() {
      events.abort();
      closeMenu();
      ajustes?.close();
    }
  };
}
