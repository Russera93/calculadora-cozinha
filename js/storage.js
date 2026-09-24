// js/storage.js

import { normalize } from './text-utils.js';

const RECIPES_KEY = 'calculadora-cozinha:recipes';
const CUSTOM_INGREDIENTS_KEY = 'calculadora-cozinha:custom-ingredients';
const PRECOS_KEY = 'calculadora-cozinha:precos';

function uuid() {
  return crypto.randomUUID();
}

function readList(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return []; // storage blocked (some private modes)
  }
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Returns false instead of throwing when the browser refuses the write
// (quota full, private mode), so the UI can show "Não salvo".
function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// Every recipe read from storage goes through here, so old data keeps
// working with no action from the user. Pure and idempotent.
export function migrateRecipe(recipe) {
  const migrated = {
    ...recipe,
    // The old editor always saved a trailing blank row; the new one adds
    // ingredients through a sheet, so blank rows are just noise.
    ingredientes: (recipe.ingredientes || []).filter((i) => i && typeof i.nome === 'string' && i.nome.trim() !== '')
  };
  // Recipes saved before "quantidade de embalagens" existed implicitly
  // used 1 package per portion.
  if (migrated.quantidadeEmbalagens == null) {
    migrated.quantidadeEmbalagens = migrated.rendimento;
  }
  return migrated;
}

export function getRecipes() {
  return readList(RECIPES_KEY).map(migrateRecipe);
}

export function getRecipe(id) {
  return getRecipes().find((r) => r.id === id) || null;
}

export function saveRecipe(recipe) {
  const recipes = getRecipes();
  const now = new Date().toISOString();
  const index = recipes.findIndex((r) => r.id === recipe.id);
  const updated = { ...recipe, atualizadoEm: now };

  if (index === -1) {
    recipes.push(updated);
  } else {
    recipes[index] = updated;
  }
  return writeList(RECIPES_KEY, recipes);
}

export function duplicateRecipe(id) {
  const recipes = getRecipes();
  const originalIndex = recipes.findIndex((r) => r.id === id);
  if (originalIndex === -1) return null;

  const now = new Date().toISOString();
  const copy = {
    ...recipes[originalIndex],
    id: `recipe:${uuid()}`,
    nome: `${recipes[originalIndex].nome} (cópia)`,
    criadoEm: now,
    atualizadoEm: now
  };
  // Inserted right after the original (not appended via saveRecipe) so the
  // copy shows up next to what it was duplicated from in the list, instead
  // of jumping to the end.
  recipes.splice(originalIndex + 1, 0, copy);
  writeList(RECIPES_KEY, recipes);
  return copy;
}

// Returns what was removed (and where), so the list can offer "Desfazer".
export function deleteRecipe(id) {
  const recipes = getRecipes();
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const [recipe] = recipes.splice(index, 1);
  writeList(RECIPES_KEY, recipes);
  return { recipe, index };
}

export function restoreRecipe(recipe, index) {
  const recipes = getRecipes().filter((r) => r.id !== recipe.id);
  recipes.splice(Math.min(index, recipes.length), 0, recipe);
  return writeList(RECIPES_KEY, recipes);
}

export function createEmptyRecipe() {
  const now = new Date().toISOString();
  return {
    id: `recipe:${uuid()}`,
    nome: '',
    rendimento: 1,
    ingredientes: [],
    embalagemUnitaria: 0,
    quantidadeEmbalagens: 1,
    tempoPreparoMinutos: 0,
    valorBotijao: 0,
    precoVendaDesejado: null,
    criadoEm: now,
    atualizadoEm: now
  };
}

export function getCustomIngredients() {
  return readList(CUSTOM_INGREDIENTS_KEY);
}

export function saveCustomIngredient(ingredient) {
  const ingredients = getCustomIngredients();
  const index = ingredients.findIndex((i) => i.id === ingredient.id);

  if (index === -1) {
    ingredients.push(ingredient);
  } else {
    ingredients[index] = ingredient;
  }
  writeList(CUSTOM_INGREDIENTS_KEY, ingredients);
}

// Everything this browser has stored, in one downloadable snapshot.
export function exportAllData() {
  return {
    version: 1,
    exportadoEm: new Date().toISOString(),
    recipes: getRecipes(),
    customIngredients: getCustomIngredients(),
    precos: readList(PRECOS_KEY)
  };
}

// Central price bank, keyed by normalized ingredient name — not id, since
// the same ingredient (e.g. "Farinha de trigo") can be matched via the
// fixed DB, TACO, or a custom entry across different recipes, and what a
// confectioner actually wants updated is "the price I pay for flour", not
// one specific source record. Learned silently as the user fills in prices
// (see app.js), then reused two ways: prefilling a newly-added ingredient
// row, and explicitly pushing a changed price into every recipe that
// already uses it (applyPricingToAllRecipes) — an on-demand action the
// user triggers, never automatic.
export function getPreco(nome) {
  const precos = readList(PRECOS_KEY);
  const target = normalize(nome);
  return precos.find((p) => normalize(p.nome) === target) || null;
}

export function savePreco({ nome, precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem }) {
  const precos = readList(PRECOS_KEY);
  const target = normalize(nome);
  const index = precos.findIndex((p) => normalize(p.nome) === target);
  const entry = { nome, precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem, atualizadoEm: new Date().toISOString() };

  if (index === -1) {
    precos.push(entry);
  } else {
    precos[index] = entry;
  }
  writeList(PRECOS_KEY, precos);
}

// Pushes a price into every ingredient line, across every recipe, whose
// name matches (excluding the recipe the user made the change in, which
// already has it). Returns how many recipes were touched, so the caller
// can confirm what happened.
export function applyPricingToAllRecipes(nome, { precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem }, excludeRecipeId) {
  const target = normalize(nome);
  const recipes = getRecipes();
  let recipesAtualizadas = 0;

  for (const recipe of recipes) {
    if (recipe.id === excludeRecipeId) continue;
    let mudou = false;
    for (const item of recipe.ingredientes) {
      if (normalize(item.nome) === target) {
        item.precoEmbalagem = precoEmbalagem;
        item.tamanhoEmbalagem = tamanhoEmbalagem;
        item.unidadeEmbalagem = unidadeEmbalagem;
        mudou = true;
      }
    }
    if (mudou) {
      saveRecipe(recipe);
      recipesAtualizadas += 1;
    }
  }

  return recipesAtualizadas;
}

// Adds recipes/ingredients from a previously exported backup. Anything
// whose id already exists here is left untouched — importing the same
// backup twice, or a backup that overlaps with data already on this
// device, never overwrites what's already here.
export function importBackup(data) {
  const incomingRecipes = Array.isArray(data?.recipes) ? data.recipes : [];
  const existingRecipes = getRecipes();
  const existingRecipeIds = new Set(existingRecipes.map((r) => r.id));
  const newRecipes = incomingRecipes.filter((r) => r && r.id && !existingRecipeIds.has(r.id));
  if (newRecipes.length > 0) {
    writeList(RECIPES_KEY, [...existingRecipes, ...newRecipes]);
  }

  const incomingIngredients = Array.isArray(data?.customIngredients) ? data.customIngredients : [];
  const existingIngredients = getCustomIngredients();
  const existingIngredientIds = new Set(existingIngredients.map((i) => i.id));
  const newIngredients = incomingIngredients.filter((i) => i && i.id && !existingIngredientIds.has(i.id));
  if (newIngredients.length > 0) {
    writeList(CUSTOM_INGREDIENTS_KEY, [...existingIngredients, ...newIngredients]);
  }

  // precos is keyed by name, not id — dedupe the same way getPreco/savePreco do.
  const incomingPrecos = Array.isArray(data?.precos) ? data.precos : [];
  const existingPrecos = readList(PRECOS_KEY);
  const existingPrecoNames = new Set(existingPrecos.map((p) => normalize(p.nome)));
  const newPrecos = incomingPrecos.filter((p) => p && p.nome && !existingPrecoNames.has(normalize(p.nome)));
  if (newPrecos.length > 0) {
    writeList(PRECOS_KEY, [...existingPrecos, ...newPrecos]);
  }

  return {
    receitasImportadas: newRecipes.length,
    receitasIgnoradas: incomingRecipes.length - newRecipes.length,
    ingredientesImportados: newIngredients.length,
    ingredientesIgnorados: incomingIngredients.length - newIngredients.length
  };
}
