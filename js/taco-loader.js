// js/taco-loader.js
//
// Loads data/taco.json once per page (needs HTTP, not file://).

import { loadTacoDatabase } from './taco-database.js';

let cache = null;

export async function getTacoIngredients() {
  if (cache) return cache;
  const response = await fetch('data/taco.json');
  if (!response.ok) throw new Error('TACO fetch failed: ' + response.status);
  cache = loadTacoDatabase(await response.json());
  return cache;
}
