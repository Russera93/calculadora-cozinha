// js/storage.js

const RECIPES_KEY = 'calculadora-cozinha:recipes';
const CUSTOM_INGREDIENTS_KEY = 'calculadora-cozinha:custom-ingredients';

function uuid() {
  return crypto.randomUUID();
}

function readList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

export function getRecipes() {
  return readList(RECIPES_KEY);
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
  writeList(RECIPES_KEY, recipes);
}

export function duplicateRecipe(id) {
  const original = getRecipe(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const copy = {
    ...original,
    id: `recipe:${uuid()}`,
    nome: `${original.nome} (cópia)`,
    criadoEm: now,
    atualizadoEm: now
  };
  saveRecipe(copy);
  return copy;
}

export function deleteRecipe(id) {
  const recipes = getRecipes().filter((r) => r.id !== id);
  writeList(RECIPES_KEY, recipes);
}

export function createEmptyRecipe() {
  const now = new Date().toISOString();
  return {
    id: `recipe:${uuid()}`,
    nome: '',
    rendimento: 1,
    ingredientes: [],
    embalagemUnitaria: 0,
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
    customIngredients: getCustomIngredients()
  };
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

  return {
    receitasImportadas: newRecipes.length,
    receitasIgnoradas: incomingRecipes.length - newRecipes.length,
    ingredientesImportados: newIngredients.length,
    ingredientesIgnorados: incomingIngredients.length - newIngredients.length
  };
}
