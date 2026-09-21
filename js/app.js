import {
  getRecipes,
  getRecipe,
  duplicateRecipe,
  deleteRecipe,
  createEmptyRecipe,
  saveRecipe
} from './storage.js';
import { toGrams, calculateIngredientCost, calculateGasCost, calculateRecipeCost } from './calculations.js';

function showScreen(screenId) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.toggle('active', el.id === screenId);
  }
}

function previewRecipeCost(recipe) {
  const ingredientesCost = recipe.ingredientes.reduce((sum, item) => {
    const gramas = toGrams({
      quantidade: parseQuantitySafe(item.quantidadeBruta),
      unidade: item.unidade,
      densidadeGml: item.densidadeGml,
      pesoUnidadeG: item.pesoUnidadeG
    });
    if (gramas == null) return sum;
    const cost = calculateIngredientCost({
      gramasUsadas: gramas,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
    return sum + (cost ?? 0);
  }, 0);

  const gasCost = calculateGasCost({
    valorBotijao: recipe.valorBotijao,
    tempoPreparoMinutos: recipe.tempoPreparoMinutos
  }) ?? 0;

  const embalagensCost = (recipe.embalagemUnitaria || 0) * (recipe.rendimento || 0);

  return calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost });
}

function parseQuantitySafe(raw) {
  // local re-import avoided by inlining: see calculations.js for the real parser
  return Number(String(raw).replace(',', '.')) || null;
}

function renderRecipeList() {
  const container = document.getElementById('lista-receitas');
  const recipes = getRecipes();
  container.innerHTML = '';

  if (recipes.length === 0) {
    container.innerHTML = '<p class="text-stone-500 text-center py-8">Nenhuma receita ainda. Crie a primeira!</p>';
    return;
  }

  for (const recipe of recipes) {
    const custoTotal = previewRecipeCost(recipe);
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between';
    card.innerHTML = `
      <div>
        <h2 class="font-bold text-lg">${recipe.nome || '(sem nome)'}</h2>
        <p class="text-sm text-stone-500">Atualizado em ${new Date(recipe.atualizadoEm).toLocaleDateString('pt-BR')}</p>
        <p class="text-sm text-[var(--color-danger)] font-semibold">Custo total: R$ ${custoTotal.toFixed(2)}</p>
      </div>
      <div class="flex gap-2">
        <button data-action="abrir" class="text-[var(--color-primary)] font-semibold">Abrir</button>
        <button data-action="duplicar" class="text-stone-500">Duplicar</button>
        <button data-action="excluir" class="text-[var(--color-danger)]">Excluir</button>
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
  showScreen('screen-lista');
  renderRecipeList();
});

renderRecipeList();
showScreen('screen-lista');

export { showScreen, renderRecipeList };

let currentRecipe = null;
let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveRecipe(currentRecipe);
  }, 400);
}

function renderRecipeEditor(recipeId) {
  currentRecipe = getRecipe(recipeId);
  if (!currentRecipe) return;

  const container = document.getElementById('editor-conteudo');
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <label class="block text-sm font-semibold mb-1">Nome do Produto Final</label>
      <input id="input-nome" type="text" class="w-full border rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.nome}" placeholder="Ex: Bolo de Chocolate">

      <label class="block text-sm font-semibold mb-1">Rendimento (porções)</label>
      <input id="input-rendimento" type="number" min="0" class="w-full border rounded-xl px-3 py-2"
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
