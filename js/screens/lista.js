// js/screens/lista.js — "Minhas Receitas".

import {
  getRecipes, createEmptyRecipe, saveRecipe, duplicateRecipe, deleteRecipe, restoreRecipe, getTaxas,
  getUltimoBackup, getAvisoDispensadoAte, setAvisoDispensadoAte
} from '../storage.js';
import { listNotice, dispensaAte, DISPENSA_INSTALAR_DIAS, DISPENSA_BACKUP_DIAS } from '../protecao.js';
import { podeInstalar, instalar, onInstallChange, isIOSDevice, isStandalone } from '../instalar.js';
import { iosPassosHtml, POR_QUE_INSTALAR } from './instalar-passos.js';
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
import { openAjustesSheet, downloadBackup } from './ajustes.js';

const SEARCH_MIN_RECIPES = 4;
const byName = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });

function cardHtml(recipe, taxas) {
  const r = recipeResult(recipe, taxas);
  const nome = recipe.nome?.trim() || '(sem nome)';
  const custo = r.custoPorUnidade != null && r.kind !== 'semIngredientes'
    ? `Custo ${formatBRL(r.custoPorUnidade)}/un.`
    : 'Custo ainda não calculado';
  let destaque = '';
  if (r.kind === 'ganho') destaque = html`<span class="text-profit">ganha ${formatBRL(r.ganhoPorUnidade)}</span>`;
  else if (r.kind === 'prejuizo') destaque = html`<span class="tag tag-loss">prejuízo ${formatBRL(Math.abs(r.ganhoPorUnidade))}</span>`;
  else if (recipe.precoVendaDesejado == null) destaque = html`<span class="tag">definir preço</span>`;
  // A missing price makes every number on the card too low.
  const semPreco = r.ingredientesSemCusto > 0 && r.kind !== 'semIngredientes'
    ? html`<span class="tag tag-loss">${r.ingredientesSemCusto} sem preço</span>`
    : '';

  return html`
    <article class="card recipe-card">
      <button type="button" class="recipe-card-main" data-open="${recipe.id}">
        <span class="recipe-card-name">${nome}</span>
        <span class="recipe-card-meta"><span class="muted">${custo}</span>${destaque}${semPreco}</span>
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
    <div data-slot="aviso"></div>
    <div data-slot="search"></div>
    <div class="stack" data-slot="list"></div>
    <button type="button" class="fab" data-action="nova">+ Nova receita</button>`);
  syncThemeUi();

  const searchSlot = view.querySelector('[data-slot="search"]');
  const listSlot = view.querySelector('[data-slot="list"]');
  const avisoSlot = view.querySelector('[data-slot="aviso"]');

  // One card on top: install the app (button, or the iPhone steps), else
  // the backup reminder. See js/protecao.js for when each one shows.
  let totalAtual = 0;
  function renderAviso(totalReceitas = totalAtual) {
    totalAtual = totalReceitas;
    const aviso = listNotice({
      isIOS: isIOSDevice(),
      standalone: isStandalone(),
      podeInstalar: podeInstalar(),
      totalReceitas,
      ultimoBackup: getUltimoBackup(),
      instalarDispensadoAte: getAvisoDispensadoAte('instalar'),
      backupDispensadoAte: getAvisoDispensadoAte('backup'),
      agora: Date.now()
    });
    if (!aviso) { avisoSlot.innerHTML = ''; return; }
    let corpo;
    if (aviso === 'instalar') {
      corpo = html`<p><strong>Instale a Calculadora no celular.</strong> ${POR_QUE_INSTALAR}</p>
        <button type="button" class="btn btn-primary btn-block" data-action="instalar" style="margin-top:8px">📲 Instalar o app</button>`;
    } else if (aviso === 'ios') {
      corpo = html`<p><strong>Instale a Calculadora no iPhone.</strong> ${POR_QUE_INSTALAR}</p>${iosPassosHtml()}`;
    } else {
      corpo = html`<p><strong>${getUltimoBackup() ? 'Faz tempo que você não salva um backup.' : 'Você ainda não salvou um backup.'}</strong> Suas receitas ficam só neste aparelho — guarde uma cópia.</p>
        <button type="button" class="btn btn-secondary btn-block" data-action="backup" style="margin-top:8px">Salvar backup agora</button>`;
    }
    const qual = aviso === 'backup' ? 'backup' : 'instalar';
    setHtml(avisoSlot, html`
      <div class="card aviso-card" role="note">
        ${corpo}
        <button type="button" class="btn-link" data-action="dispensar-aviso" data-qual="${qual}">Agora não</button>
      </div>`);
  }
  // The browser decides when installing is possible (often after load).
  const offInstall = onInstallChange(() => renderAviso());

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
    renderAviso(all.length);
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
    const taxas = getTaxas();
    setHtml(listSlot, visible.length
      ? html`${visible.map((r) => cardHtml(r, taxas))}`
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
    // Asks the browser not to evict this site's data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
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
    else if (target.dataset.action === 'backup') { downloadBackup(); renderList(); showToast('Backup salvo — guarde o arquivo num lugar seguro.'); }
    else if (target.dataset.action === 'instalar') {
      instalar().then((aceitou) => { if (aceitou) showToast('Pronto! O app está na tela inicial do seu celular.'); renderAviso(); });
    } else if (target.dataset.action === 'dispensar-aviso') {
      const qual = target.dataset.qual;
      setAvisoDispensadoAte(qual, dispensaAte(Date.now(), qual === 'instalar' ? DISPENSA_INSTALAR_DIAS : DISPENSA_BACKUP_DIAS));
      renderList();
    }
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
      offInstall();
      events.abort();
      closeMenu();
      ajustes?.close();
    }
  };
}
