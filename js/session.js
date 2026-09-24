// js/session.js
//
// Recipes created in this page view via "+ Nova receita". Leaving such a
// recipe with no name and no ingredients discards it (no empty "(sem nome)"
// cards piling up).

const newRecipeIds = new Set();

export function markNewRecipe(id) { newRecipeIds.add(id); }
export function isNewRecipe(id) { return newRecipeIds.has(id); }
export function forgetNewRecipe(id) { newRecipeIds.delete(id); }
