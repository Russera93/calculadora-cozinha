import {
  getRecipes,
  getRecipe,
  duplicateRecipe,
  deleteRecipe,
  createEmptyRecipe,
  saveRecipe,
  exportAllData,
  importBackup,
  getPreco,
  savePreco,
  applyPricingToAllRecipes
} from './storage.js';
import { toGrams, calculateIngredientCost, calculateRecipeTotals } from './calculations.js';
import { normalize } from './text-utils.js';

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
  const recipes = getRecipes().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  container.innerHTML = '';

  if (recipes.length === 0) {
    container.innerHTML = '<p class="text-[var(--color-text-muted)] text-center py-8">Nenhuma receita ainda. Crie a primeira!</p>';
    return;
  }

  for (const recipe of recipes) {
    const custoTotal = previewRecipeCost(recipe);
    const card = document.createElement('div');
    card.className = 'bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-sm p-4 flex items-center justify-between';
    card.innerHTML = `
      <div>
        <h2 class="font-display text-lg font-semibold text-[var(--color-text)]">${escapeHtml(recipe.nome || '(sem nome)')}</h2>
        <p class="text-sm text-[var(--color-text-muted)]">Atualizado em ${new Date(recipe.atualizadoEm).toLocaleDateString('pt-BR')}</p>
        <p class="text-sm text-[var(--color-danger-text)] font-semibold">Custo total: R$ ${custoTotal.toFixed(2)}</p>
      </div>
      <div class="flex flex-col items-end gap-2">
        <div class="flex items-center gap-2">
          <button data-action="abrir" class="text-[var(--color-primary-text)] font-semibold">Abrir</button>
          <button data-action="duplicar" class="text-[var(--color-text-muted)]">Duplicar</button>
          <button data-action="excluir" class="text-[var(--color-danger-text)]">Excluir</button>
        </div>
        <button data-action="whatsapp" type="button"
                class="flex items-center gap-1 whitespace-nowrap bg-[var(--color-whatsapp-bg)] text-[var(--color-whatsapp-text)] font-semibold text-sm px-3 py-1.5 rounded-full">
          <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M16.001 3C9.11 3 3.5 8.611 3.5 15.502c0 2.376.657 4.66 1.902 6.652L3 29l7.02-2.352a12.46 12.46 0 0 0 5.981 1.524h.006C22.898 28.172 28.5 22.561 28.5 15.67 28.5 8.779 22.898 3 16.001 3zm0 22.727a10.2 10.2 0 0 1-5.2-1.43l-.373-.222-3.868 1.296 1.276-3.77-.243-.387a10.147 10.147 0 0 1-1.567-5.412c0-5.646 4.596-10.24 10.245-10.24 2.737 0 5.31 1.066 7.243 3.002a10.166 10.166 0 0 1 2.995 7.238c0 5.646-4.596 10.925-10.508 10.925z"/>
            <path d="M21.437 18.184c-.297-.148-1.758-.868-2.03-.967-.272-.099-.47-.148-.669.149-.198.297-.767.968-.94 1.166-.173.198-.347.223-.644.075-.297-.149-1.254-.462-2.389-1.475-.883-.788-1.48-1.76-1.653-2.058-.173-.298-.019-.459.13-.607.133-.133.297-.347.446-.52.149-.174.198-.298.297-.496.1-.199.05-.372-.025-.52-.074-.149-.669-1.612-.916-2.208-.242-.578-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01a1.094 1.094 0 0 0-.793.372c-.272.298-1.04 1.017-1.04 2.48 0 1.462 1.066 2.875 1.214 3.073.148.199 2.096 3.201 5.077 4.489.71.306 1.262.489 1.694.625.712.226 1.36.195 1.871.118.571-.085 1.759-.719 2.006-1.413.248-.694.248-1.29.174-1.413-.075-.124-.273-.199-.57-.348z"/>
          </svg>
          Compartilhar WhatsApp
        </button>
      </div>
    `;
    card.querySelector('[data-action="whatsapp"]').addEventListener('click', () => compartilharReceitaNoWhatsApp(recipe));
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

function openRecipeEditor(recipeId, isNew = false) {
  // Implemented in Task 12 (renderRecipeEditor). Placeholder call kept for wiring.
  window.__openRecipeEditor(recipeId, isNew);
}

document.getElementById('btn-nova-receita').addEventListener('click', () => {
  const recipe = createEmptyRecipe();
  saveRecipe(recipe);
  openRecipeEditor(recipe.id, true);
});

document.getElementById('btn-exportar').addEventListener('click', () => {
  const data = exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `calculadora-cozinha-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-importar').addEventListener('click', () => {
  document.getElementById('input-importar-arquivo').click();
});

document.getElementById('input-importar-arquivo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = ''; // allow re-selecting the same file later
  if (!file) return;

  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('Arquivo inválido — não foi possível ler o backup.');
    return;
  }

  const resultado = importBackup(data);
  renderRecipeList();
  alert(
    `Importação concluída:\n` +
    `${resultado.receitasImportadas} receita(s) adicionada(s), ${resultado.receitasIgnoradas} já existiam.\n` +
    `${resultado.ingredientesImportados} ingrediente(s) customizado(s) adicionado(s), ${resultado.ingredientesIgnorados} já existiam.`
  );
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
// Whether the editor's fields are read-only. A recipe just created via
// "+ Nova Receita" opens unlocked (nothing to protect yet); reopening an
// existing recipe opens locked, so browsing an old recipe never risks
// nudging a number by accident — "Editar" explicitly opts into changing it.
let isLocked = false;

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

function renderRecipeEditor(recipeId, isNew = false) {
  // Guards against finding 8: the ingredient modal lives outside the
  // .screen sections, so showScreen() never hides it. If it was left open
  // while switching recipes, its Salvar/Cancelar closures would still
  // reference the PREVIOUS recipe's item/currentRecipe. Force it closed
  // before we swap currentRecipe out from under it.
  window.__closeIngredientModal?.();

  currentRecipe = getRecipe(recipeId);
  if (!currentRecipe) return;

  // Migration: recipes saved before "quantidade de embalagens" existed
  // implicitly assumed 1 embalagem per porção. Backfill that same value so
  // the packaging cost calculation doesn't silently change for them.
  if (currentRecipe.quantidadeEmbalagens == null) {
    currentRecipe.quantidadeEmbalagens = currentRecipe.rendimento;
  }

  isLocked = !isNew;
  updateTopEditButton();

  const container = document.getElementById('editor-conteudo');
  container.innerHTML = `
    <div class="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-sm p-4 mb-4">
      <label class="block text-sm font-semibold mb-1">Nome do Produto Final</label>
      <input id="input-nome" type="text" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${escapeHtml(currentRecipe.nome)}" placeholder="Ex: Bolo de Chocolate" ${isLocked ? 'disabled' : ''}>

      <label class="block text-sm font-semibold mb-1">Rendimento (porções)</label>
      <input id="input-rendimento" type="number" min="0" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2"
             value="${currentRecipe.rendimento}" ${isLocked ? 'disabled' : ''}>
    </div>

    <div id="secao-ingredientes"></div>
    <div id="secao-custos-extras"></div>
    <div id="secao-dashboard"></div>
    <div id="secao-salvar-editar"></div>
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
  window.__onSalvarEditarRender?.();
  window.__onNutricaoRender?.();
}

window.__openRecipeEditor = renderRecipeEditor;

export { currentRecipe, scheduleAutosave, renderRecipeEditor };

window.__onIngredientesRender = window.__onIngredientesRender || (() => {});
window.__onCustosExtrasRender = window.__onCustosExtrasRender || (() => {});
window.__onDashboardRender = window.__onDashboardRender || (() => {});
window.__onSalvarEditarRender = window.__onSalvarEditarRender || (() => {});
window.__onNutricaoRender = window.__onNutricaoRender || (() => {});
window.__onRendimentoChange = window.__onRendimentoChange || (() => {});
window.__onIngredientNotFound = window.__onIngredientNotFound || (() => {});
window.__closeIngredientModal = window.__closeIngredientModal || (() => {});

// Re-renders every section that has field-level lock/unlock state, after
// toggling isLocked — each section reads the shared isLocked flag itself
// when building its inputs' `disabled` attribute.
function rerenderEditorAfterLockChange() {
  window.__onIngredientesRender?.();
  window.__onCustosExtrasRender?.();
  window.__onDashboardRender?.();
  window.__onSalvarEditarRender?.();
  const inputNome = document.getElementById('input-nome');
  const inputRendimento = document.getElementById('input-rendimento');
  if (inputNome) inputNome.disabled = isLocked;
  if (inputRendimento) inputRendimento.disabled = isLocked;
  updateTopEditButton();
}

// Shortcut next to "← Minhas Receitas" so unlocking an existing recipe
// doesn't require scrolling down to the Salvar/Editar buttons past
// Resultados. Only shown while locked — once editing, the bottom "Salvar"
// is the natural next action, so the shortcut would be redundant chrome.
function updateTopEditButton() {
  document.getElementById('btn-editar-topo')?.classList.toggle('hidden', !isLocked);
}

document.getElementById('btn-editar-topo').addEventListener('click', () => {
  if (!isLocked) return;
  isLocked = false;
  rerenderEditorAfterLockChange();
});

function renderSalvarEditarSection() {
  const container = document.getElementById('secao-salvar-editar');
  if (!container) return;

  container.innerHTML = `
    <div class="flex gap-3 mb-4">
      <button id="btn-salvar-receita" type="button"
              class="flex-1 py-3 rounded-2xl font-bold ${isLocked
                ? 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-white'}"
              ${isLocked ? 'disabled' : ''}>
        Salvar
      </button>
      <button id="btn-editar-receita" type="button"
              class="flex-1 py-3 rounded-2xl font-bold ${!isLocked
                ? 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                : 'bg-[var(--color-primary)] text-white'}"
              ${!isLocked ? 'disabled' : ''}>
        Editar
      </button>
    </div>
  `;

  container.querySelector('#btn-salvar-receita').addEventListener('click', () => {
    if (isLocked) return;
    flushAutosave();
    saveRecipe(currentRecipe);
    isLocked = true;
    rerenderEditorAfterLockChange();
  });

  container.querySelector('#btn-editar-receita').addEventListener('click', () => {
    if (!isLocked) return;
    isLocked = false;
    rerenderEditorAfterLockChange();
  });
}

window.__onSalvarEditarRender = renderSalvarEditarSection;

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
  const target = normalize(nome);
  return findFixedIngredient(nome) || getCustomIngredients().find((i) => normalize(i.nome) === target) || null;
}

function computeLineCost(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  // Ingredients bought by the piece (eggs, bananas...) are sold in
  // count-based packages — a dozen, half a dozen, a tray of 30 — never in
  // grams or ml. When the package itself is counted in units, compare both
  // sides of the ratio in units instead of forcing everything through a
  // weight conversion (which is how "12" in "Tamanho" used to get read as
  // "12 grams" for a dozen eggs, producing a wildly wrong cost).
  if (item.unidadeEmbalagem === 'unidade') {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;

    let usadoEmUnidades;
    if (item.unidade === 'unidade') {
      usadoEmUnidades = quantidade;
    } else {
      // Recipe measures this ingredient by weight/volume (e.g. "150g de
      // ovo batido") but it's still bought by the piece — convert the
      // amount used back into an equivalent unit count via the
      // ingredient's average weight per unit, so it can be compared
      // against the unit-counted package.
      if (!item.pesoUnidadeG) return null;
      const gramas = toGrams({
        quantidade,
        unidade: item.unidade,
        densidadeGml: item.densidadeGml,
        pesoUnidadeG: item.pesoUnidadeG
      });
      if (gramas == null) return null;
      usadoEmUnidades = gramas / item.pesoUnidadeG;
    }

    return calculateIngredientCost({
      gramasUsadas: usadoEmUnidades,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
  }

  // The reverse case: recipe uses "unidade" (ex.: "1 lata de leite
  // condensado") but the package itself is sold by weight/volume (g/ml),
  // and this ingredient has no known average per-unit weight (pesoUnidadeG
  // is only set for pieces like egg/banana). The natural reading of "1
  // unidade" here is "one whole package as purchased" — so treat quantidade
  // as a package-count ratio instead of failing for lack of a weight
  // conversion.
  if (item.unidade === 'unidade' && item.pesoUnidadeG == null) {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;
    return calculateIngredientCost({
      gramasUsadas: quantidade * item.tamanhoEmbalagem,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
  }

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

// Surfaces the "hidden" volume->weight conversion that computeLineCost does
// internally, so the user can sanity-check it (e.g. "1/2 xícara ≈ 60g")
// instead of trusting a black box. Only covers the units where a real
// conversion happens: xícara/colher always go through density, and
// "unidade" only converts through pesoUnidadeG when the package itself
// ISN'T also counted in units (that case, e.g. a dozen eggs, is already a
// plain unit-to-unit ratio with no grams involved — see computeLineCost).
function quantidadeConvertidaEmGramas(item, quantidade) {
  if (quantidade == null) return null;
  if (item.unidade === 'xicara' || item.unidade === 'colherSopa' || item.unidade === 'colherCha') {
    if (item.densidadeGml == null) return null;
    return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml });
  }
  if (item.unidade === 'unidade' && item.unidadeEmbalagem !== 'unidade' && item.pesoUnidadeG != null) {
    return quantidade * item.pesoUnidadeG;
  }
  return null;
}

function formatGrams(gramas) {
  return Number(gramas.toFixed(1)).toString();
}

// Prefills price/package fields from the central price bank (see
// storage.js's getPreco/savePreco) — but only when this row is still at
// its untouched defaults (precoEmbalagem 0, tamanhoEmbalagem 0), so it
// never silently overwrites a value the user already typed for this
// specific line.
function aplicarPrecoConhecido(item, nome) {
  if (item.precoEmbalagem !== 0 || item.tamanhoEmbalagem !== 0) return;
  const preco = getPreco(nome);
  if (!preco) return;
  item.precoEmbalagem = preco.precoEmbalagem;
  item.tamanhoEmbalagem = preco.tamanhoEmbalagem;
  item.unidadeEmbalagem = preco.unidadeEmbalagem;
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

    // Ingredients that are naturally counted by the piece (eggs, bananas —
    // pesoUnidadeG set, no densidadeGml) are bought that way too: a dozen,
    // half a dozen, a tray of 30, never "N grams". Default both the recipe
    // usage unit and the package unit to "unidade" so the fields already
    // make sense for this ingredient; the user can still change either one.
    if (fixedOrCustom.pesoUnidadeG != null && fixedOrCustom.densidadeGml == null) {
      item.unidade = 'unidade';
      item.unidadeEmbalagem = 'unidade';
    }

    aplicarPrecoConhecido(item, nome);
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
  if (!isLocked) ensureTrailingEmptyRow(); // no point offering a fresh blank row in read-only view
  const container = document.getElementById('secao-ingredientes');
  container.innerHTML = `
    <div class="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Ingredientes</h2>
      <div class="hidden md:grid md:grid-cols-7 gap-2 text-xs text-[var(--color-text-muted)] px-1">
        <span class="col-span-4 font-semibold">Usado na receita</span>
        <span class="col-span-3 font-semibold border-l border-[var(--color-border)] pl-2">Embalagem comprada</span>
      </div>
      <div class="hidden md:grid md:grid-cols-7 gap-2 text-xs font-semibold text-[var(--color-text-muted)] mb-1 px-1">
        <span class="col-span-2">Ingrediente</span>
        <span>Quantidade Utilizada</span>
        <span>Unidade (Ingrediente)</span>
        <span class="border-l border-[var(--color-border)] pl-2">Valor Total<br>Pago (R$)</span>
        <span>Tamanho (Embalagem)</span>
        <span>Unid. Embalagem</span>
      </div>
      <div id="linhas-ingredientes" class="space-y-3"></div>
    </div>
    <datalist id="ingredientes-datalist">
      ${getAllIngredientsSync()
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
        .map((i) => `<option value="${escapeHtml(i.nome)}">`).join('')}
    </datalist>
  `;
  const linhas = container.querySelector('#linhas-ingredientes');

  currentRecipe.ingredientes.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-2 md:grid-cols-7 gap-2 items-start border-b border-[var(--color-border)] pb-2';
    row.dataset.rowIndex = String(index);
    const custo = computeLineCost(item);
    const quantidadeNumero = parseQuantity(item.quantidadeBruta);
    const gramasEquivalente = quantidadeConvertidaEmGramas(item, quantidadeNumero);
    row.innerHTML = `
      <div class="col-span-2 md:col-span-2">
        <label for="ing-${index}-nome" class="block text-xs font-semibold text-[var(--color-text-muted)] mb-0.5 md:hidden">Ingrediente</label>
        <input id="ing-${index}-nome" data-field="nome" list="ingredientes-datalist" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Ingrediente" value="${escapeHtml(item.nome)}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div>
        <label for="ing-${index}-qtd" class="block text-xs font-semibold text-[var(--color-text-muted)] mb-0.5 md:hidden">Quantidade Utilizada</label>
        <input id="ing-${index}-qtd" data-field="quantidadeBruta" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Qtd (ex: 1/2)" value="${escapeHtml(item.quantidadeBruta)}" ${isLocked ? 'disabled' : ''}>
        ${gramasEquivalente != null ? `<p class="text-xs text-[var(--color-text-muted)] mt-0.5">≈ ${formatGrams(gramasEquivalente)}g</p>` : ''}
      </div>
      <div>
        <label for="ing-${index}-unidade" class="block text-xs font-semibold text-[var(--color-text-muted)] mb-0.5 md:hidden">Unidade (Ingrediente)</label>
        <select id="ing-${index}-unidade" data-field="unidade" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1" ${isLocked ? 'disabled' : ''}>
          ${['xicara', 'colherSopa', 'colherCha', 'g', 'ml', 'unidade'].map((u) =>
            `<option value="${u}" ${item.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}
        </select>
      </div>
      <p class="col-span-2 md:hidden text-xs font-semibold text-[var(--color-text-muted)] mt-1 pt-1 border-t border-[var(--color-border)]">Embalagem comprada</p>
      <div class="md:border-l md:border-[var(--color-border)] md:pl-2">
        <label for="ing-${index}-preco" class="block text-xs font-semibold text-[var(--color-text-muted)] mb-0.5 md:hidden">Valor Total<br>Pago (R$)</label>
        <input id="ing-${index}-preco" data-field="precoEmbalagem" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Valor total pago" value="${formatCurrency(item.precoEmbalagem)}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div>
        <label for="ing-${index}-tamanho" class="block text-xs font-semibold text-[var(--color-text-muted)] mb-0.5 md:hidden">Tamanho (Embalagem)</label>
        <input id="ing-${index}-tamanho" data-field="tamanhoEmbalagem" type="text" inputmode="decimal" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1" placeholder="Tam. embalagem" value="${item.tamanhoEmbalagem}" ${isLocked ? 'disabled' : ''}>
      </div>
      <div>
        <label for="ing-${index}-unidembalagem" class="block text-xs font-semibold text-[var(--color-text-muted)] mb-0.5 md:hidden">Unid. Embalagem</label>
        <select id="ing-${index}-unidembalagem" data-field="unidadeEmbalagem" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1" ${isLocked ? 'disabled' : ''}>
          <option value="g" ${item.unidadeEmbalagem === 'g' ? 'selected' : ''}>g</option>
          <option value="ml" ${item.unidadeEmbalagem === 'ml' ? 'selected' : ''}>ml</option>
          <option value="unidade" ${item.unidadeEmbalagem === 'unidade' ? 'selected' : ''}>unidade(s)</option>
        </select>
      </div>
      <span class="text-sm font-semibold text-[var(--color-danger-text)] md:col-span-7">
        Custo: ${custo != null ? `R$ ${custo.toFixed(2)}` : '—'}
      </span>
      ${item.nome.trim() && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0 && !isLocked
        ? `<button type="button" data-action="usar-preco-outras-receitas" class="text-xs text-[var(--color-primary-text)] md:col-span-7 text-left">🔄 Usar este preço em outras receitas</button>`
        : ''}
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

    // Learn this ingredient's current price silently, once the user is done
    // editing (blur) rather than on every keystroke — feeds aplicarPrecoConhecido
    // and the modal's prefill for the NEXT time this ingredient is added to
    // any recipe. Never touches other, already-saved recipes on its own;
    // that only happens via the explicit "Usar em outras receitas" button.
    for (const field of ['precoEmbalagem', 'tamanhoEmbalagem', 'unidadeEmbalagem']) {
      row.querySelector(`[data-field="${field}"]`).addEventListener('blur', () => {
        if (item.nome.trim() && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) {
          savePreco({ nome: item.nome, precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem });
        }
      });
    }

    row.querySelector('[data-action="usar-preco-outras-receitas"]')?.addEventListener('click', () => {
      const confirmado = confirm(
        `Atualizar o preço de "${item.nome}" (R$ ${formatCurrency(item.precoEmbalagem)} por ${item.tamanhoEmbalagem}${item.unidadeEmbalagem}) ` +
        `em todas as outras receitas que também usam esse ingrediente?`
      );
      if (!confirmado) return;
      const quantidade = applyPricingToAllRecipes(
        item.nome,
        { precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem },
        currentRecipe.id
      );
      alert(quantidade > 0
        ? `Preço atualizado em ${quantidade} outra(s) receita(s).`
        : 'Nenhuma outra receita usa esse ingrediente ainda.');
    });

    linhas.appendChild(row);
  });
}

window.__onIngredientesRender = renderIngredientesSection;

export { getAllIngredientsSync, findIngredientByName, computeLineCost, getTacoIngredients };

// gordurasSaturadas is deliberately NOT here — that field only comes from
// TACO (which has real per-ingredient lab data for it); asking users to
// guess a saturated-fat breakdown by hand for a custom ingredient would
// produce a number that looks precise but isn't, so it's left TACO-only.
const NUTRIENT_LABELS = { kcal: 'Kcal', carboidratos: 'Carboidratos (g)', proteinas: 'Proteínas (g)', gorduras: 'Gorduras (g)', fibras: 'Fibras (g)', sodio: 'Sódio (mg)', acucaresAdicionados: 'Açúcares adicionados (g)' };

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

  const precoConhecido = getPreco(item.nome);

  content.innerHTML = `
    <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Cadastrar "${escapeHtml(item.nome)}"</h2>
    <p id="taco-status" class="text-sm text-[var(--color-text-muted)] mb-2">Buscando na tabela nutricional...</p>
    ${precoConhecido ? `<p class="text-xs text-[var(--color-accent-text)] mb-2">Preço preenchido a partir do que você já pagou por "${escapeHtml(precoConhecido.nome)}" antes (ajustável).</p>` : ''}
    <label class="block text-sm font-semibold mb-1">Unidade de compra</label>
    <select id="modal-unidade-embalagem" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1 mb-2">
      <option value="g" ${(!precoConhecido || precoConhecido.unidadeEmbalagem === 'g') ? 'selected' : ''}>Gramas (g)</option>
      <option value="ml" ${precoConhecido?.unidadeEmbalagem === 'ml' ? 'selected' : ''}>Mililitros (ml)</option>
      <option value="unidade" ${precoConhecido?.unidadeEmbalagem === 'unidade' ? 'selected' : ''}>Unidade(s) — ex: dúzia, 30 ovos</option>
    </select>
    <label class="block text-sm font-semibold mb-1">Preço pago (R$)</label>
    <input id="modal-preco" type="number" step="0.01" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1 mb-2" value="${precoConhecido ? precoConhecido.precoEmbalagem : ''}">
    <label class="block text-sm font-semibold mb-1">Tamanho da embalagem</label>
    <input id="modal-tamanho" type="number" step="1" class="w-full border border-[var(--color-border)] rounded-lg px-2 py-1 mb-4" value="${precoConhecido ? precoConhecido.tamanhoEmbalagem : ''}">
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

    // gordurasSaturadas isn't one of the user-editable fields (it's
    // TACO-only, see NUTRIENT_LABELS' comment) — but if the TACO auto-fill
    // found a value for it, carry it through here, or it would silently be
    // dropped the moment this becomes a saved custom ingredient.
    if (nutricaoEncontrada && typeof nutricaoEncontrada.gordurasSaturadas === 'number') {
      nutricao100g.gordurasSaturadas = nutricaoEncontrada.gordurasSaturadas;
      anyFilled = true;
    }

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
    if (preco > 0 && tamanho > 0) {
      savePreco({ nome: item.nome, precoEmbalagem: preco, tamanhoEmbalagem: tamanho, unidadeEmbalagem });
    }

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
  // Collapsed by default when viewing an existing (locked) recipe — these
  // fields only matter while actually editing the recipe's cost inputs, so
  // hiding them by default keeps the opened-recipe view focused on
  // Ingredientes/Resultados instead of every operational field at once.
  // Open by default while creating/editing, so nothing is hidden mid-edit.
  container.innerHTML = `
    <details class="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-sm p-4 mb-4" ${isLocked ? '' : 'open'}>
      <summary class="font-display text-lg font-semibold text-[var(--color-text)] cursor-pointer select-none">Custos Extras e Operacionais</summary>

      <label class="block text-sm font-semibold mb-1 mt-3">Custo da embalagem unitária (R$)</label>
      <input id="input-embalagem" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${formatCurrency(currentRecipe.embalagemUnitaria)}" ${isLocked ? 'disabled' : ''}>

      <label class="block text-sm font-semibold mb-1">Quantidade de embalagens utilizadas</label>
      <p class="text-xs text-[var(--color-text-muted)] mb-1">Ex.: 20 brigadeiros, 4 por embalagem = 5 embalagens</p>
      <input id="input-qtd-embalagens" type="number" min="0" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.quantidadeEmbalagens}" ${isLocked ? 'disabled' : ''}>

      <label class="block text-sm font-semibold mb-1">Tempo de forno/fogo (minutos)</label>
      <input id="input-tempo-preparo" type="text" inputmode="decimal" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.tempoPreparoMinutos}" ${isLocked ? 'disabled' : ''}>

      <label class="block text-sm font-semibold mb-1">Valor pago no botijão de gás de 13kg (R$)</label>
      <input id="input-valor-botijao" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2"
             value="${formatCurrency(currentRecipe.valorBotijao)}" ${isLocked ? 'disabled' : ''}>
    </details>
  `;

  container.querySelector('#input-embalagem').addEventListener('input', (e) => {
    currentRecipe.embalagemUnitaria = applyCurrencyMask(e.target);
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
  container.querySelector('#input-qtd-embalagens').addEventListener('input', (e) => {
    currentRecipe.quantidadeEmbalagens = Number(e.target.value) || 0;
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

import { calculateCostPerPortion, calculateSuggestedPrices, calculateRealMargin, calculateMarkup } from './calculations.js';

function renderDashboardSection() {
  const container = document.getElementById('secao-dashboard');

  // Finding 1: single shared implementation with the list-screen preview
  // (previewRecipeCost), instead of duplicating the ingredient/gas/embalagem
  // summation here. computeLineCost is the real cost function (uses
  // parseQuantity, so fractions like "1/2" are handled correctly) and also
  // now accounts for ml-based package sizes (finding 5).
  const { custoTotal, custoPorPorcao, embalagensCost, ingredientesSemCusto } = calculateRecipeTotals(currentRecipe, computeLineCost);
  const embalagensCustoPorPorcao = calculateCostPerPortion({ custoTotal: embalagensCost, rendimento: currentRecipe.rendimento });
  const sugeridos = calculateSuggestedPrices({ custoPorPorcao });
  // Finding 10: != null (not truthy) so an explicit sale price of R$0,00 is
  // still passed through to calculateRealMargin, which already knows how to
  // render that as a (correctly, sharply negative) margin instead of hiding
  // the block entirely.
  const margem = currentRecipe.precoVendaDesejado != null
    ? calculateRealMargin({ precoVenda: currentRecipe.precoVendaDesejado, custoPorPorcao })
    : null;
  // Markup ("lucro sobre o custo") is a separate indicator from margem real
  // ("margem sobre a venda") — margem maxes out at 100% (can't profit more
  // than the sale price itself) while markup is unbounded, matching how
  // confectioners usually talk about profit ("lucro de mais de 100%").
  const lucroMarkup = currentRecipe.precoVendaDesejado != null
    ? calculateMarkup({ precoVenda: currentRecipe.precoVendaDesejado, custoPorPorcao })
    : null;
  const lucroPorPorcaoReais = currentRecipe.precoVendaDesejado != null && custoPorPorcao != null
    ? currentRecipe.precoVendaDesejado - custoPorPorcao
    : null;

  // "Quantas vezes o custo" reads better to a confectioner than a raw
  // percentage ("triplicou o custo" vs "200% de markup") — computed straight
  // from sale price / cost, independent of calculateMarkup's percentage form.
  const vezesOCusto = currentRecipe.precoVendaDesejado != null && custoPorPorcao > 0
    ? currentRecipe.precoVendaDesejado / custoPorPorcao
    : null;

  container.innerHTML = `
    <div class="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-display text-lg font-semibold text-[var(--color-text)] mb-3">Resultados</h2>

      <p class="font-display text-3xl font-semibold text-[var(--color-danger-text)]">${custoPorPorcao != null ? `R$ ${custoPorPorcao.toFixed(2)}` : '—'}</p>
      <p class="text-sm text-[var(--color-text-muted)] mb-2">Custo por porção</p>
      <p class="text-xs text-[var(--color-text-muted)]">Custo total da receita: R$ ${custoTotal.toFixed(2)}${embalagensCost > 0 ? ` · inclui R$ ${embalagensCost.toFixed(2)} de embalagem` : ''}</p>

      <p class="text-[var(--color-accent-text)] font-semibold mt-3">Preço sugerido: ${sugeridos ? `R$ ${sugeridos.preco2x.toFixed(2)} a R$ ${sugeridos.preco3x.toFixed(2)}` : '—'}</p>
      <p class="text-xs text-[var(--color-text-muted)] mb-2">De 2x a 3x o custo</p>

      <label class="block text-sm font-semibold mt-3 mb-1">Quanto você vai cobrar? (por porção, R$)</label>
      <input id="input-preco-venda" type="text" inputmode="numeric" class="w-full border border-[var(--color-border)] rounded-xl px-3 py-2"
             value="${currentRecipe.precoVendaDesejado != null ? formatCurrency(currentRecipe.precoVendaDesejado) : ''}">
      <p class="text-xs text-[var(--color-text-muted)] mt-1">Você pode calcular seu lucro a qualquer momento, mesmo sem editar a receita.</p>

      ${lucroPorPorcaoReais != null ? `
        <div class="mt-3 p-3 rounded-xl ${lucroPorPorcaoReais >= 0 ? 'bg-[var(--color-accent)]/10' : 'bg-[var(--color-danger)]/10'}">
          <p class="font-display text-xl font-bold ${lucroPorPorcaoReais >= 0 ? 'text-[var(--color-accent-text)]' : 'text-[var(--color-danger-text)]'}">
            ${lucroPorPorcaoReais >= 0 ? `Você lucra R$ ${lucroPorPorcaoReais.toFixed(2)} por unidade` : `Você perde R$ ${Math.abs(lucroPorPorcaoReais).toFixed(2)} por unidade`}
          </p>
          ${vezesOCusto != null ? `<p class="text-sm text-[var(--color-text-muted)]">${vezesOCusto >= 1 ? `Isso é ${vezesOCusto.toFixed(1)}x o custo` : `Isso é menos do que o custo (${vezesOCusto.toFixed(1)}x)`}</p>` : ''}
        </div>
      ` : ''}

      ${ingredientesSemCusto > 0
        ? `<p class="text-sm text-[var(--color-danger-text)] mt-2">Atenção: ${ingredientesSemCusto} ingrediente(s) sem custo calculável (dados incompletos).</p>`
        : ''}

      ${(embalagensCost > 0 || margem != null) ? `
        <details class="mt-3">
          <summary class="text-sm font-semibold text-[var(--color-primary-text)] cursor-pointer select-none">Ver detalhes do cálculo</summary>
          <div class="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]">
            ${embalagensCost > 0 ? `<p>Embalagens: R$ ${embalagensCost.toFixed(2)} no total (R$ ${embalagensCustoPorPorcao != null ? embalagensCustoPorPorcao.toFixed(2) : '0.00'} por porção)</p>` : ''}
            ${margem != null ? `<p>Margem sobre a venda: <strong class="${margem >= 0 ? 'text-[var(--color-accent-text)]' : 'text-[var(--color-danger-text)]'}">${margem.toFixed(1)}%</strong> — de cada real que você cobra, ${margem.toFixed(1)}% é lucro</p>` : ''}
            ${lucroMarkup != null ? `<p>Markup sobre o custo: <strong class="${lucroMarkup >= 0 ? 'text-[var(--color-accent-text)]' : 'text-[var(--color-danger-text)]'}">${lucroMarkup.toFixed(1)}%</strong> — quanto o preço de venda passou do custo</p>` : ''}
          </div>
        </details>
      ` : ''}
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

// Builds a plain-text summary meant to be read by a person (a customer, a
// supplier), not re-imported by this app — that's what the JSON export is
// for. Ingredient quantities are shown as typed ("2 xícara de Farinha de
// trigo"), not converted to grams, since that's how a confectioner actually
// talks about a recipe.
function buildRecipeShareText(recipe) {
  const { custoTotal, custoPorPorcao } = calculateRecipeTotals(recipe, computeLineCost);
  const sugeridos = calculateSuggestedPrices({ custoPorPorcao });

  const linhasIngredientes = recipe.ingredientes
    .filter((item) => item.nome.trim() !== '')
    .map((item) => `- ${item.quantidadeBruta || '?'} ${item.unidade} de ${item.nome}`)
    .join('\n');

  return [
    // *bold* is WhatsApp's own text-formatting syntax (renders as bold once
    // sent) — plain ASCII, so it can't be mangled by anything downstream the
    // way a 4-byte emoji like 🍰 could (a real redirect through WhatsApp's
    // own api.whatsapp.com was observed corrupting that specific character
    // during testing; this sidesteps the whole class of risk).
    `*${recipe.nome || '(sem nome)'}*`,
    '',
    'Ingredientes:',
    linhasIngredientes || '(nenhum ingrediente cadastrado)',
    '',
    `Rendimento: ${recipe.rendimento} porções`,
    `Custo total: R$ ${custoTotal.toFixed(2)}`,
    custoPorPorcao != null ? `Custo por porção: R$ ${custoPorPorcao.toFixed(2)}` : null,
    sugeridos ? `Preço sugerido: R$ ${sugeridos.preco2x.toFixed(2)} a R$ ${sugeridos.preco3x.toFixed(2)}` : null,
    '',
    'Gerado com Calculadora de Cozinha'
  ].filter((linha) => linha !== null).join('\n');
}

// wa.me works everywhere without asking for any permission: on a phone it
// opens the WhatsApp app straight to the contact picker with the text
// pre-filled; on desktop it opens WhatsApp Web (or the desktop app, if it's
// registered as the protocol handler). No navigator.share/clipboard
// fallback needed — this single mechanism already covers both platforms.
function compartilharReceitaNoWhatsApp(recipe) {
  const texto = buildRecipeShareText(recipe);
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}

document.getElementById('btn-compartilhar').addEventListener('click', () => {
  if (!currentRecipe) return;
  compartilharReceitaNoWhatsApp(currentRecipe);
});

import { calculateNutritionPerPortion, calculateVD, VALORES_DIARIOS_REFERENCIA } from './calculations.js';

function renderNutricaoSection() {
  const container = document.getElementById('secao-nutricao');
  container.innerHTML = `
    <button id="btn-gerar-nutricao" class="w-full bg-[var(--color-accent)] text-white font-bold py-3 rounded-2xl mb-4">
      Gerar Tabela Nutricional Média
    </button>
    <div id="resultado-nutricao" class="mb-4"></div>
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

    resultDiv.innerHTML = renderTabelaAnvisa(resultado, currentRecipe.rendimento);
  });
}

// Per-100g-of-recipe values aren't stored anywhere — they're derived from
// the already-computed per-portion amount and the portion's own weight:
// (quantidade na porção / peso da porção) * 100.
function calcularPor100g(valorPorPorcao, pesoPorcaoG) {
  if (!pesoPorcaoG) return 0;
  return (valorPorPorcao / pesoPorcaoG) * 100;
}

// Renders an ANVISA-style (IN 75/2020) nutrition facts table: per-100g,
// per-portion, and %VD columns. This is a calculation aid built from the
// recipe's own ingredient data — not a certified/lab-verified label, and
// its %VD rounding is a simple round-to-nearest-integer (the regulation's
// full per-nutrient rounding-interval table isn't implemented), which is
// disclosed in the footnote rather than presented as compliance-ready.
function renderTabelaAnvisa(resultado, rendimento) {
  const peso = resultado.pesoPorcao;

  const linhas = [
    { label: 'Valor energético', unidade: 'kcal', key: 'kcal', casas: 0, ref: VALORES_DIARIOS_REFERENCIA.kcal },
    { label: 'Carboidratos', unidade: 'g', key: 'carboidratos', casas: 1, ref: VALORES_DIARIOS_REFERENCIA.carboidratos },
    { label: 'Açúcares adicionados', unidade: 'g', key: 'acucaresAdicionados', casas: 1, ref: VALORES_DIARIOS_REFERENCIA.acucaresAdicionados },
    { label: 'Proteínas', unidade: 'g', key: 'proteinas', casas: 1, ref: VALORES_DIARIOS_REFERENCIA.proteinas },
    { label: 'Gorduras totais', unidade: 'g', key: 'gorduras', casas: 1, ref: VALORES_DIARIOS_REFERENCIA.gorduras },
    { label: 'Gorduras saturadas', unidade: 'g', key: 'gordurasSaturadas', casas: 1, ref: VALORES_DIARIOS_REFERENCIA.gordurasSaturadas },
    { label: 'Fibra alimentar', unidade: 'g', key: 'fibras', casas: 1, ref: VALORES_DIARIOS_REFERENCIA.fibras },
    { label: 'Sódio', unidade: 'mg', key: 'sodio', casas: 0, ref: VALORES_DIARIOS_REFERENCIA.sodio }
  ];

  const linhasHtml = linhas.map(({ label, unidade, key, casas, ref }) => {
    const porPorcao = resultado[key];
    const por100g = calcularPor100g(porPorcao, peso);
    const vd = calculateVD(porPorcao, ref);
    return `
      <tr class="border-b border-[var(--color-border)]">
        <td class="py-1 pr-2">${label} (${unidade})</td>
        <td class="py-1 px-2 text-right">${por100g.toFixed(casas)}</td>
        <td class="py-1 px-2 text-right">${porPorcao.toFixed(casas)}</td>
        <td class="py-1 pl-2 text-right">${vd != null ? `${vd}%` : '—'}</td>
      </tr>
    `;
  }).join('');

  const avisos = [];
  if (resultado.ingredientesSemDados > 0) {
    avisos.push(`Cálculo incompleto — ${resultado.ingredientesSemDados} ingrediente(s) sem dados nutricionais (não entraram na conta).`);
  }
  avisos.push('Gorduras saturadas: somadas apenas quando o ingrediente veio da base TACO, que é quem traz esse dado.');
  avisos.push('Açúcares adicionados: somados apenas a partir de ingredientes com esse dado cadastrado (ex: açúcar, mel, leite condensado) — não inclui açúcar natural de frutas, leite etc.');

  return `
    <div class="border-2 border-[var(--color-text)] rounded-xl p-4">
      <h3 class="font-display font-bold text-xl text-[var(--color-text)] border-b-4 border-[var(--color-text)] pb-1 mb-2">Informação Nutricional</h3>
      <p class="text-sm">Porções por embalagem: cerca de ${rendimento}</p>
      <p class="text-sm mb-2">Porção: ${peso.toFixed(0)} g</p>
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b-2 border-[var(--color-text)] font-semibold text-[var(--color-text-muted)]">
            <th class="text-left py-1 pr-2 font-semibold"></th>
            <th class="text-right py-1 px-2 font-semibold">100 g</th>
            <th class="text-right py-1 px-2 font-semibold">${peso.toFixed(0)} g</th>
            <th class="text-right py-1 pl-2 font-semibold">%VD*</th>
          </tr>
        </thead>
        <tbody>${linhasHtml}</tbody>
      </table>
      <p class="text-xs text-[var(--color-text-muted)] mt-3">
        *% de Valores Diários fornecidos pela porção, com base em uma dieta de 2.000 kcal.
        Seus valores diários podem ser maiores ou menores dependendo das suas necessidades energéticas.
      </p>
      <p class="text-xs text-[var(--color-text-muted)] mt-2">
        Valores calculados a partir dos ingredientes cadastrados nesta receita — não substitui laudo laboratorial
        nem segue automaticamente todas as regras de arredondamento da ANVISA (IN 75/2020).
      </p>
      ${avisos.map((a) => `<p class="text-xs text-[var(--color-danger-text)] mt-1">${a}</p>`).join('')}
    </div>
  `;
}

window.__onNutricaoRender = renderNutricaoSection;
