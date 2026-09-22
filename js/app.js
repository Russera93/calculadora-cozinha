import {
  getRecipes,
  getRecipe,
  duplicateRecipe,
  deleteRecipe,
  createEmptyRecipe,
  saveRecipe
} from './storage.js';
import { toGrams, calculateIngredientCost, calculateRecipeTotals } from './calculations.js';

function showScreen(screenId) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.toggle('active', el.id === screenId);
  }
}

// Escapes user-supplied text before interpolating it into innerHTML template
// literals, closing the self-XSS gap where a recipe/ingredient name typed by
// the user could otherwise be interpreted as markup.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Parses a decimal typed with either a comma or a dot (both are common in
// pt-BR input, since the browser no longer enforces one via type="number").
function parseDecimal(raw) {
  const numeric = Number(String(raw).replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : 0;
}

// Renders a number as "10,00"-style pt-BR currency text for a field's value
// attribute. Used as the template's baseline so every currency field shows
// two decimal places by default; the field the user is actively typing in
// still shows their literal in-progress text instead, via preserveFocus's
// restore (see its comment above) — this only affects fields nobody is
// mid-keystroke in.
function formatCurrency(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

// "Money mask" for currency fields — the pattern used by Brazilian banking/
// delivery apps: every digit the user types shifts in from the right, always
// filling the cents position, so typing "0","5","0" reads as "0,50" and
// typing "1","0","0","0" reads as "10,00". No comma to type, no invalid
// intermediate state to fight — the field's raw text is only ever digits
// plus the formatting *we* just wrote, so re-extracting digits on every
// keystroke and reformatting is always well-defined.
//
// Call this from the field's own 'input' listener, passing the input
// element; it mutates el.value in place (cursor pinned to the end, matching
// how a numeric keypad naturally feels) and returns the numeric value to
// store in the recipe's state. With `allowEmpty: true` (used only for the
// optional "preço de venda" field), clearing the field all the way back to
// no digits leaves it visually empty and returns null instead of 0 — this
// preserves "not set" as a distinct state from "R$ 0,00", which the
// dashboard's margin calculation depends on.
function applyCurrencyMask(inputEl, { allowEmpty = false } = {}) {
  const digits = inputEl.value.replace(/\D/g, '');

  if (allowEmpty && digits === '') {
    inputEl.value = '';
    return null;
  }

  const cents = parseInt(digits || '0', 10);
  const numeric = cents / 100;
  inputEl.value = formatCurrency(numeric);
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  return numeric;
}

// Uses the same calculateRecipeTotals + computeLineCost pipeline as the
// editor dashboard (see finding 1 in the final review: this used to be a
// separate, buggy stub that didn't understand fractional quantities like
// "1/2"). computeLineCost is declared further down in this file but, being a
// function declaration, is hoisted within the module so it's safe to
// reference here.
function previewRecipeCost(recipe) {
  return calculateRecipeTotals(recipe, computeLineCost).custoTotal;
}

function renderRecipeList() {
  const container = document.getElementById('lista-receitas');
  const recipes = getRecipes();
  container.innerHTML = '';

  if (recipes.length === 0) {
    container.innerHTML = '<p class="text-[var(--color-text-muted)] text-center py-8">Nenhuma receita ainda. Crie a primeira!</p>';
    return;
  }

  for (const recipe of recipes) {
    const custoTotal = previewRecipeCost(recipe);
    const card = document.createElement('div');
    card.className = 'bg-[var(--color-surface)] rounded-2xl shadow-sm p-4 flex items-center justify-between';
    card.innerHTML = `
      <div>
        <h2 class="font-display text-lg font-semibold text-[var(--color-text)]">${escapeHtml(recipe.nome || '(sem nome)')}</h2>
        <p class="text-sm text-[var(--color-text-muted)]">Atualizado em ${new Date(recipe.atualizadoEm).toLocaleDateString('pt-BR')}</p>
        <p class="text-sm text-[var(--color-danger-text)] font-semibold">Custo total: R$ ${custoTotal.toFixed(2)}</p>
      </div>
      <div class="flex gap-2">
        <button data-action="abrir" class="text-[var(--color-primary-text)] font-semibold">Abrir</button>
        <button data-action="duplicar" class="text-[var(--color-text-muted)]">Duplicar</button>
        <button data-action="excluir" class="text-[var(--color-danger-text)]">Excluir</button>
      </div>
    `;
    card.querySelector('[data-action="abrir"]').addEventListener('click', () => openRecipeEditor(recipe.id));
    card.querySelector('[data-action="duplicar"]').addEventListener('click', () => {
      duplicateRecipe(recipe.id);
      renderRecipeList();
    });
    card.querySelector('[data-action="excluir"]').addEventListener('click', () => {
      if (confirm(`Excluir a receita "${recipe.nome}"?`)) {
        deleteRecipe(recipe.id);
        renderRecipeList();
      }
    });
    container.appendChild(card);
  }
}

function openRecipeEditor(recipeId) {
  // Implemented in Task 12 (renderRecipeEditor). Placeholder call kept for wiring.
  window.__openRecipeEditor(recipeId);
}

document.getElementById('btn-nova-receita').addEventListener('click', () => {
  const recipe = createEmptyRecipe();
  saveRecipe(recipe);
  openRecipeEditor(recipe.id);
});

document.getElementById('btn-voltar').addEventListener('click', () => {
  window.__closeIngredientModal?.();
  flushAutosave();
  showScreen('screen-lista');
  renderRecipeList();
});

// Dark mode: index.html's inline head script already applies any saved
// choice before first paint (avoids a flash of the wrong theme). This wires
// the toggle button and keeps the moon/sun icon in sync with the current
// theme, including on first load when no choice has been saved yet (in
// which case the OS preference drives it via the CSS media query, and the
// icon should reflect that rather than assuming light).
const THEME_KEY = 'calculadora-cozinha:tema';

function currentTheme() {
  const saved = document.documentElement.getAttribute('data-theme');
  if (saved) return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  document.getElementById('btn-tema-icone').textContent = theme === 'dark' ? '☀️' : '🌙';
}

document.getElementById('btn-tema').addEventListener('click', () => {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
});

applyTheme(currentTheme());

renderRecipeList();
showScreen('screen-lista');

export { showScreen, renderRecipeList };

let currentRecipe = null;
let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null;
    saveRecipe(currentRecipe);
  }, 400);
}

// A debounced autosave can leave up to 400ms of edits unsaved. If the user
// navigates back to the recipe list or reloads/closes the page inside that
// window, those edits would be silently lost. Flushing immediately in both
// cases guarantees the list screen and a page reload always reflect the
// latest inputs, not a stale pre-debounce snapshot.
function flushAutosave() {
  if (autosaveTimer == null) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = null;
  if (currentRecipe) saveRecipe(currentRecipe);
}

window.addEventListener('beforeunload', flushAutosave);

function renderRecipeEditor(recipeId) {
  // Guards against finding 8: the ingredient modal lives outside the
  // .screen sections, so showScreen() never hides it. If it was left open
  // while switching recipes, its Salvar/Cancelar closures would still
  // reference the PREVIOUS recipe's item/currentRecipe. Force it closed
  // before we swap currentRecipe out from under it.
  window.__closeIngredientModal?.();

  currentRecipe = getRecipe(recipeId);
  if (!currentRecipe) return;

  const container = document.getElementById('editor-conteudo');
  container.innerHTML = `
    <div class="bg-[var(--color-surface)] rounded-2xl shadow-sm p-4 mb-4">
      <label class="block text-sm font-semibold mb-1">Nome do Produto Final</label>
      <input id="input-nome" type="text" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${escapeHtml(currentRecipe.nome)}" placeholder="Ex: Bolo de Chocolate">

      <label class="block text-sm font-semibold mb-1">Rendimento (porções)</label>
      <input id="input-rendimento" type="number" min="0" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2"
             value="${currentRecipe.rendimento}">
    </div>

    <div id="secao-ingredientes"></div>
    <div id="secao-custos-extras"></div>
    <div id="secao-dashboard"></div>
    <div id="secao-nutricao"></div>
  `;

  container.querySelector('#input-nome').addEventListener('input', (e) => {
    currentRecipe.nome = e.target.value;
    scheduleAutosave();
  });

  container.querySelector('#input-rendimento').addEventListener('input', (e) => {
    currentRecipe.rendimento = Number(e.target.value) || 0;
    scheduleAutosave();
    window.__onRendimentoChange?.();
  });

  showScreen('screen-editor');

  window.__onIngredientesRender?.();
  window.__onCustosExtrasRender?.();
  window.__onDashboardRender?.();
  window.__onNutricaoRender?.();
}

window.__openRecipeEditor = renderRecipeEditor;

export { currentRecipe, scheduleAutosave, renderRecipeEditor };

window.__onIngredientesRender = window.__onIngredientesRender || (() => {});
window.__onCustosExtrasRender = window.__onCustosExtrasRender || (() => {});
window.__onDashboardRender = window.__onDashboardRender || (() => {});
window.__onNutricaoRender = window.__onNutricaoRender || (() => {});
window.__onRendimentoChange = window.__onRendimentoChange || (() => {});
window.__onIngredientNotFound = window.__onIngredientNotFound || (() => {});
window.__closeIngredientModal = window.__closeIngredientModal || (() => {});

import { FIXED_INGREDIENTS, findFixedIngredient } from './ingredients-db.js';
import { loadTacoDatabase, findInTaco } from './taco-database.js';
import { getCustomIngredients, saveCustomIngredient } from './storage.js';
import { parseQuantity } from './calculations.js';

let tacoIngredientsCache = null;

async function getTacoIngredients() {
  if (tacoIngredientsCache) return tacoIngredientsCache;
  const response = await fetch('data/taco.json');
  if (!response.ok) {
    throw new Error('TACO fetch failed: ' + response.status);
  }
  const raw = await response.json();
  tacoIngredientsCache = loadTacoDatabase(raw);
  return tacoIngredientsCache;
}

function getAllIngredientsSync() {
  return [...FIXED_INGREDIENTS, ...getCustomIngredients()];
}

function findIngredientByName(nome) {
  return findFixedIngredient(nome) || getCustomIngredients().find((i) => i.nome.toLowerCase() === nome.toLowerCase()) || null;
}

function computeLineCost(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;
  const gramas = toGrams({
    quantidade,
    unidade: item.unidade,
    densidadeGml: item.densidadeGml,
    pesoUnidadeG: item.pesoUnidadeG
  });
  if (gramas == null) return null;

  // The package size (tamanhoEmbalagem) is stored in whatever unit the user
  // bought it in (item.unidadeEmbalagem: 'g' or 'ml'). calculateIngredientCost
  // always expects grams, so an 'ml' package must be converted via density
  // first (finding 5) — otherwise e.g. 900ml of oil gets costed as 900g.
  // If density is unknown, toGrams correctly returns null, and that null
  // propagates to calculateIngredientCost -> null, which the rest of the
  // app already treats as "cost unknown" (finding 6).
  const gramasEmbalagem = item.unidadeEmbalagem === 'ml'
    ? toGrams({ quantidade: item.tamanhoEmbalagem, unidade: 'ml', densidadeGml: item.densidadeGml, pesoUnidadeG: null })
    : item.tamanhoEmbalagem;

  return calculateIngredientCost({
    gramasUsadas: gramas,
    gramasEmbalagem,
    precoEmbalagem: item.precoEmbalagem
  });
}

function ensureTrailingEmptyRow() {
  const last = currentRecipe.ingredientes[currentRecipe.ingredientes.length - 1];
  if (!last || last.nome.trim() !== '') {
    currentRecipe.ingredientes.push({
      ingredientId: null,
      nome: '',
      quantidadeBruta: '',
      unidade: 'g',
      precoEmbalagem: 0,
      tamanhoEmbalagem: 0,
      unidadeEmbalagem: 'g',
      nutricao100g: null,
      densidadeGml: null,
      pesoUnidadeG: null
    });
  }
}

async function applyIngredientMatch(item, nome) {
  // Finding 4: always clear any stale match data first. Sequence this
  // guards against: ingredient matches "Ovos" (sets egg nutrition +
  // pesoUnidadeG) -> user renames it to something unmatched -> without this
  // reset the row would keep carrying egg nutrition/weight under the new
  // name even if the user cancels the modal, silently corrupting cost and
  // nutrition calculations.
  item.ingredientId = null;
  item.nutricao100g = null;
  item.densidadeGml = null;
  item.pesoUnidadeG = null;

  // Only the fixed DB and previously-saved custom ingredients carry real
  // price/package data already on file, so only those two sources are
  // allowed to short-circuit before the modal (finding 2). A bare TACO
  // nutrition hit is deliberately NOT treated as sufficient here — TACO
  // never has price/package info, so accepting it silently would leave the
  // modal (and its "encontrado automaticamente" auto-fill message)
  // permanently unreachable. Falling through to the modal lets its own
  // TACO lookup populate the nutrition fields while still asking the user
  // for price/package size.
  const fixedOrCustom = findIngredientByName(nome);
  if (fixedOrCustom) {
    item.ingredientId = fixedOrCustom.id;
    item.nutricao100g = fixedOrCustom.nutricao100g;
    item.densidadeGml = fixedOrCustom.densidadeGml;
    item.pesoUnidadeG = fixedOrCustom.pesoUnidadeG;
    return true;
  }

  return false; // caller opens the custom-ingredient modal, which does its own TACO lookup
}

// Re-rendering a section replaces its DOM nodes wholesale, which drops focus
// from whatever input the user was typing in. This wrapper snapshots the
// focused field (by row index + field name, or by id), its cursor position,
// AND its literal text value before re-rendering, then restores all three
// afterwards.
//
// The value restore matters for <input type="number">: the input listeners
// coerce e.target.value with Number(...) and store that back into the
// recipe's state, then re-render from that coerced state. Intermediate
// typing like "12." or a temporarily-empty field reads back as "" via
// Number(), so a naive re-render would set value="" on the very next
// keystroke, appearing to erase what the user just typed (finding 3).
// Restoring the exact pre-render text the user had on screen — captured
// before our own render touches anything — means the field the user is
// actively typing in never visibly changes underneath them, regardless of
// what the freshly-coerced numeric state looks like.
function preserveFocus(container, renderFn) {
  const active = document.activeElement;
  let snapshot = null;

  if (active && container.contains(active)) {
    const row = active.closest('[data-row-index]');
    snapshot = {
      rowIndex: row ? row.dataset.rowIndex : null,
      field: active.dataset.field || active.id || null,
      value: 'value' in active ? active.value : null,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  renderFn();

  if (snapshot && snapshot.field) {
    const selector = snapshot.rowIndex != null
      ? `[data-row-index="${snapshot.rowIndex}"] [data-field="${snapshot.field}"]`
      : `#${snapshot.field}`;
    const el = container.querySelector(selector);
    if (el) {
      if (snapshot.value != null && 'value' in el && el.value !== snapshot.value) {
        el.value = snapshot.value;
      }
      el.focus();
      if (snapshot.selectionStart != null && typeof el.setSelectionRange === 'function') {
        try {
          el.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
        } catch {
          // some input types (e.g. number) don't support selection ranges
        }
      }
    }
  }
}

function renderIngredientesSection() {
  ensureTrailingEmptyRow();
  const container = document.getElementById('secao-ingredientes');
  container.innerHTML = `
    <div class="bg-[var(--color-surface)] rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Ingredientes</h2>
      <div class="hidden md:grid md:grid-cols-7 gap-2 text-xs font-semibold text-[var(--color-text-muted)] mb-1 px-1">
        <span class="col-span-2">Ingrediente</span>
        <span>Quantidade</span>
        <span>Unidade</span>
        <span>Preço (R$)</span>
        <span>Tamanho</span>
        <span>Unid. Embalagem</span>
      </div>
      <div id="linhas-ingredientes" class="space-y-3"></div>
    </div>
    <datalist id="ingredientes-datalist">
      ${getAllIngredientsSync().map((i) => `<option value="${escapeHtml(i.nome)}">`).join('')}
    </datalist>
  `;
  const linhas = container.querySelector('#linhas-ingredientes');

  currentRecipe.ingredientes.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-2 md:grid-cols-7 gap-2 items-center border-b border-[var(--color-border)] pb-2';
    row.dataset.rowIndex = String(index);
    const custo = computeLineCost(item);
    row.innerHTML = `
      <input data-field="nome" list="ingredientes-datalist" class="col-span-2 md:col-span-2 border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Ingrediente" value="${escapeHtml(item.nome)}">
      <input data-field="quantidadeBruta" class="border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Qtd (ex: 1/2)" value="${escapeHtml(item.quantidadeBruta)}">
      <select data-field="unidade" class="border border-[var(--color-border)] rounded-lg px-2 py-1">
        ${['xicara', 'colherSopa', 'colherCha', 'g', 'ml', 'unidade'].map((u) =>
          `<option value="${u}" ${item.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
      <input data-field="precoEmbalagem" type="text" inputmode="numeric" class="border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Preço R$" value="${formatCurrency(item.precoEmbalagem)}">
      <input data-field="tamanhoEmbalagem" type="text" inputmode="decimal" class="border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Tam. embalagem" value="${item.tamanhoEmbalagem}">
      <select data-field="unidadeEmbalagem" class="border border-[var(--color-border)] rounded-lg px-2 py-1">
        <option value="g" ${item.unidadeEmbalagem !== 'ml' ? 'selected' : ''}>g</option>
        <option value="ml" ${item.unidadeEmbalagem === 'ml' ? 'selected' : ''}>ml</option>
      </select>
      <span class="text-sm font-semibold text-[var(--color-danger-text)] md:col-span-7">
        Custo: ${custo != null ? `R$ ${custo.toFixed(2)}` : '—'}
      </span>
    `;

    row.querySelector('[data-field="nome"]').addEventListener('change', async (e) => {
      item.nome = e.target.value;
      if (item.nome.trim() !== '') {
        const matched = await applyIngredientMatch(item, item.nome);
        if (!matched) {
          window.__onIngredientNotFound?.(item, index);
        }
      }
      scheduleAutosave();
      renderIngredientesSection();
      window.__onDashboardRender?.();
    });

    for (const field of ['quantidadeBruta', 'unidade', 'tamanhoEmbalagem', 'unidadeEmbalagem']) {
      row.querySelector(`[data-field="${field}"]`).addEventListener('input', (e) => {
        item[field] = field === 'tamanhoEmbalagem' ? parseDecimal(e.target.value) : e.target.value;
        scheduleAutosave();
        preserveFocus(container, renderIngredientesSection);
        window.__onDashboardRender?.();
      });
    }

    row.querySelector('[data-field="precoEmbalagem"]').addEventListener('input', (e) => {
      item.precoEmbalagem = applyCurrencyMask(e.target);
      scheduleAutosave();
      preserveFocus(container, renderIngredientesSection);
      window.__onDashboardRender?.();
    });

    linhas.appendChild(row);
  });
}

window.__onIngredientesRender = renderIngredientesSection;

export { getAllIngredientsSync, findIngredientByName, computeLineCost, getTacoIngredients };

const NUTRIENT_LABELS = { kcal: 'Kcal', carboidratos: 'Carboidratos (g)', proteinas: 'Proteínas (g)', gorduras: 'Gorduras (g)', fibras: 'Fibras (g)', sodio: 'Sódio (mg)' };

function renderModalNutricaoFields(fieldsContainer, nutricao) {
  fieldsContainer.innerHTML = Object.entries(NUTRIENT_LABELS).map(([key, label]) => `
    <div>
      <label class="block text-xs">${label}</label>
      <input data-nutriente="${key}" type="number" step="0.1" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1"
             value="${nutricao ? nutricao[key] : ''}">
    </div>
  `).join('');
}

// Finding 8: the modal lives outside the .screen sections in index.html, so
// showScreen() never hides it. Without this, leaving a recipe open in the
// modal and then opening a DIFFERENT recipe would leave the modal's Salvar
// closure pointing at the OLD item/currentRecipe, corrupting data across
// recipes if the user then clicked Salvar. Called before navigation (from
// #btn-voltar) and before swapping currentRecipe (renderRecipeEditor).
function closeIngredientModal() {
  const modal = document.getElementById('modal-ingrediente');
  const content = document.getElementById('modal-ingrediente-conteudo');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  if (content) content.innerHTML = '';
}

window.__closeIngredientModal = closeIngredientModal;

function openIngredientModal(item, rowIndex) {
  const modal = document.getElementById('modal-ingrediente');
  const content = document.getElementById('modal-ingrediente-conteudo');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  content.innerHTML = `
    <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Cadastrar "${escapeHtml(item.nome)}"</h2>
    <p id="taco-status" class="text-sm text-[var(--color-text-muted)] mb-2">Buscando na tabela nutricional...</p>
    <label class="block text-sm font-semibold mb-1">Unidade de compra</label>
    <select id="modal-unidade-embalagem" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1 mb-2">
      <option value="g">Gramas (g)</option>
      <option value="ml">Mililitros (ml)</option>
    </select>
    <label class="block text-sm font-semibold mb-1">Preço pago (R$)</label>
    <input id="modal-preco" type="number" step="0.01" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1 mb-2">
    <label class="block text-sm font-semibold mb-1">Tamanho da embalagem</label>
    <input id="modal-tamanho" type="number" step="1" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1 mb-4">
    <div id="modal-nutricao-fields" class="grid grid-cols-2 gap-2 mb-4"></div>
    <div class="flex justify-end gap-2">
      <button id="modal-cancelar" class="text-[var(--color-text-muted)]">Cancelar</button>
      <button id="modal-salvar" class="bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl font-semibold">Salvar</button>
    </div>
  `;

  let nutricaoEncontrada = null;

  getTacoIngredients().then((taco) => {
    const match = findInTaco(item.nome, taco);
    const status = content.querySelector('#taco-status');
    const fieldsContainer = content.querySelector('#modal-nutricao-fields');
    if (!status || !fieldsContainer) return; // modal was closed/reopened before this resolved
    nutricaoEncontrada = match ? match.nutricao100g : null;
    status.textContent = match
      ? `Nutrição encontrada automaticamente para "${match.nome}" (ajustável abaixo).`
      : 'Não encontrado na base nutricional — preencha manualmente se desejar (opcional).';

    renderModalNutricaoFields(fieldsContainer, nutricaoEncontrada);
  }).catch((err) => {
    console.error('Falha ao buscar base TACO:', err);
    const status = content.querySelector('#taco-status');
    const fieldsContainer = content.querySelector('#modal-nutricao-fields');
    if (!status || !fieldsContainer) return; // modal was closed/reopened before this rejected
    status.textContent = 'Base nutricional indisponível — verifique sua conexão ou tente novamente.';
    renderModalNutricaoFields(fieldsContainer, null);
  });

  content.querySelector('#modal-cancelar').addEventListener('click', () => {
    closeIngredientModal();
  });

  content.querySelector('#modal-salvar').addEventListener('click', () => {
    const unidadeEmbalagem = content.querySelector('#modal-unidade-embalagem').value;
    const preco = Number(content.querySelector('#modal-preco').value) || 0;
    const tamanho = Number(content.querySelector('#modal-tamanho').value) || 0;

    const nutricao100g = {};
    let anyFilled = false;
    content.querySelectorAll('[data-nutriente]').forEach((input) => {
      const value = input.value === '' ? null : Number(input.value);
      nutricao100g[input.dataset.nutriente] = value;
      if (value != null) anyFilled = true;
    });

    const densidadeGml = unidadeEmbalagem === 'ml' ? 1.0 : null;

    const customIngredient = {
      id: `custom:${crypto.randomUUID()}`,
      nome: item.nome,
      categoria: 'outro',
      densidadeGml,
      pesoUnidadeG: null,
      nutricao100g: anyFilled ? nutricao100g : null
    };
    saveCustomIngredient(customIngredient);

    item.ingredientId = customIngredient.id;
    item.precoEmbalagem = preco;
    item.tamanhoEmbalagem = tamanho;
    item.unidadeEmbalagem = unidadeEmbalagem;
    item.nutricao100g = customIngredient.nutricao100g;
    item.densidadeGml = customIngredient.densidadeGml;
    // Finding 4: the Salvar path was setting ingredientId/nutricao100g/
    // densidadeGml but not pesoUnidadeG, so a stale count-based weight from
    // a prior match (e.g. "unidade" ingredients like eggs) could survive
    // even this happy path. customIngredient.pesoUnidadeG is always null
    // here (the modal has no UI for it), which is correct: TACO/custom
    // ingredients saved through this modal don't carry a per-unit weight.
    item.pesoUnidadeG = customIngredient.pesoUnidadeG;

    closeIngredientModal();
    scheduleAutosave();
    window.__onIngredientesRender?.();
    window.__onDashboardRender?.();
  });
}

window.__onIngredientNotFound = openIngredientModal;

function renderCustosExtrasSection() {
  const container = document.getElementById('secao-custos-extras');
  container.innerHTML = `
    <div class="bg-[var(--color-surface)] rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Custos Extras e Operacionais</h2>

      <label class="block text-sm font-semibold mb-1">Custo da embalagem unitária (R$)</label>
      <input id="input-embalagem" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${formatCurrency(currentRecipe.embalagemUnitaria)}">

      <label class="block text-sm font-semibold mb-1">Tempo de forno/fogo (minutos)</label>
      <input id="input-tempo-preparo" type="text" inputmode="decimal" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.tempoPreparoMinutos}">

      <label class="block text-sm font-semibold mb-1">Valor pago no botijão de 13kg (R$)</label>
      <input id="input-valor-botijao" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2"
             value="${formatCurrency(currentRecipe.valorBotijao)}">
    </div>
  `;

  container.querySelector('#input-embalagem').addEventListener('input', (e) => {
    currentRecipe.embalagemUnitaria = applyCurrencyMask(e.target);
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
  container.querySelector('#input-tempo-preparo').addEventListener('input', (e) => {
    currentRecipe.tempoPreparoMinutos = parseDecimal(e.target.value);
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
  container.querySelector('#input-valor-botijao').addEventListener('input', (e) => {
    currentRecipe.valorBotijao = applyCurrencyMask(e.target);
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
}

window.__onCustosExtrasRender = renderCustosExtrasSection;

import { calculateCostPerPortion, calculateSuggestedPrices, calculateRealMargin } from './calculations.js';

function renderDashboardSection() {
  const container = document.getElementById('secao-dashboard');

  // Finding 1: single shared implementation with the list-screen preview
  // (previewRecipeCost), instead of duplicating the ingredient/gas/embalagem
  // summation here. computeLineCost is the real cost function (uses
  // parseQuantity, so fractions like "1/2" are handled correctly) and also
  // now accounts for ml-based package sizes (finding 5).
  const { custoTotal, custoPorPorcao, ingredientesSemCusto } = calculateRecipeTotals(currentRecipe, computeLineCost);
  const sugeridos = calculateSuggestedPrices({ custoTotal });
  // Finding 10: != null (not truthy) so an explicit sale price of R$0,00 is
  // still passed through to calculateRealMargin, which already knows how to
  // render that as a (correctly, sharply negative) margin instead of hiding
  // the block entirely.
  const margem = currentRecipe.precoVendaDesejado != null
    ? calculateRealMargin({ precoVenda: currentRecipe.precoVendaDesejado, custoPorPorcao })
    : null;

  container.innerHTML = `
    <div class="bg-[var(--color-surface)] rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Resultados</h2>
      <p class="font-display text-3xl font-semibold text-[var(--color-danger-text)]">R$ ${custoTotal.toFixed(2)}</p>
      <p class="text-sm text-[var(--color-text-muted)] mb-2">Custo total da receita</p>
      <p class="text-[var(--color-danger-text)]">Custo por Porção: ${custoPorPorcao != null ? `R$ ${custoPorPorcao.toFixed(2)}` : '—'}</p>
      <p class="text-[var(--color-accent-text)] font-semibold mt-2">Preço sugerido (2x): R$ ${sugeridos.preco2x.toFixed(2)}</p>
      <p class="text-[var(--color-accent-text)] font-semibold">Preço sugerido (3x): R$ ${sugeridos.preco3x.toFixed(2)}</p>

      <label class="block text-sm font-semibold mt-3 mb-1">Preço que deseja vender (por porção, R$)</label>
      <input id="input-preco-venda" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2"
             value="${currentRecipe.precoVendaDesejado != null ? formatCurrency(currentRecipe.precoVendaDesejado) : ''}">

      ${margem != null ? `<p class="mt-2 font-bold ${margem >= 0 ? 'text-[var(--color-accent-text)]' : 'text-[var(--color-danger-text)]'}">Margem real: ${margem.toFixed(1)}%</p>` : ''}
      ${ingredientesSemCusto > 0
        ? `<p class="text-sm text-[var(--color-danger-text)] mt-2">Atenção: ${ingredientesSemCusto} ingrediente(s) sem custo calculável (dados incompletos).</p>`
        : ''}
    </div>
  `;

  container.querySelector('#input-preco-venda').addEventListener('input', (e) => {
    currentRecipe.precoVendaDesejado = applyCurrencyMask(e.target, { allowEmpty: true });
    scheduleAutosave();
    preserveFocus(container, renderDashboardSection);
  });
}

window.__onDashboardRender = renderDashboardSection;
window.__onRendimentoChange = renderDashboardSection;

import { calculateNutritionPerPortion } from './calculations.js';

function renderNutricaoSection() {
  const container = document.getElementById('secao-nutricao');
  container.innerHTML = `
    <div class="bg-[var(--color-surface)] rounded-2xl shadow-sm p-4 mb-4">
      <button id="btn-gerar-nutricao" class="w-full bg-[var(--color-accent)] text-white font-bold py-3 rounded-2xl">
        Gerar Tabela Nutricional Média
      </button>
      <div id="resultado-nutricao" class="mt-4"></div>
    </div>
  `;

  container.querySelector('#btn-gerar-nutricao').addEventListener('click', () => {
    const itens = currentRecipe.ingredientes
      .filter((item) => item.nome.trim() !== '')
      .map((item) => {
        const quantidade = parseQuantity(item.quantidadeBruta);
        const gramas = quantidade == null ? null : toGrams({
          quantidade,
          unidade: item.unidade,
          densidadeGml: item.densidadeGml,
          pesoUnidadeG: item.pesoUnidadeG
        });
        return { gramas: gramas ?? 0, nutricao100g: gramas != null ? item.nutricao100g : null };
      });

    const resultado = calculateNutritionPerPortion({ itens, rendimento: currentRecipe.rendimento });
    const resultDiv = container.querySelector('#resultado-nutricao');

    if (!resultado) {
      resultDiv.innerHTML = '<p class="text-[var(--color-danger-text)]">Defina um rendimento válido para calcular a tabela nutricional.</p>';
      return;
    }

    resultDiv.innerHTML = `
      <div class="border-2 border-[var(--color-text)] rounded-xl p-4">
        <h3 class="font-display font-semibold text-lg text-[var(--color-text)] border-b-4 border-[var(--color-text)] pb-1 mb-2">Informação Nutricional (por porção)</h3>
        <p>Valor Energético: <strong>${resultado.kcal.toFixed(0)} kcal</strong></p>
        <p>Carboidratos: <strong>${resultado.carboidratos.toFixed(1)} g</strong></p>
        <p>Proteínas: <strong>${resultado.proteinas.toFixed(1)} g</strong></p>
        <p>Gorduras Totais: <strong>${resultado.gorduras.toFixed(1)} g</strong></p>
        <p>Fibra Alimentar: <strong>${resultado.fibras.toFixed(1)} g</strong></p>
        <p>Sódio: <strong>${resultado.sodio.toFixed(0)} mg</strong></p>
        ${resultado.ingredientesSemDados > 0
          ? `<p class="text-sm text-[var(--color-danger-text)] mt-2">Cálculo incompleto — ${resultado.ingredientesSemDados} ingrediente(s) sem dados nutricionais.</p>`
          : ''}
      </div>
    `;
  });
}

window.__onNutricaoRender = renderNutricaoSection;
