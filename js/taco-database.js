// js/taco-database.js

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const DENSITY_BY_CATEGORY = {
  po: 0.55,
  liquido: 1.0,
  graos: 0.35,
  laticinio: 1.03,
  gordura: 0.95,
  fruta_vegetal: 0.6,
  outro: null
};

export function loadTacoDatabase(rawRows) {
  return rawRows.map((row) => ({
    id: `taco:${slugify(row.nome)}`,
    nome: row.nome,
    categoria: row.categoria,
    densidadeGml: DENSITY_BY_CATEGORY[row.categoria] ?? null,
    pesoUnidadeG: null,
    nutricao100g: row.nutricao100g
  }));
}

export function findInTaco(nomeBuscado, tacoIngredients) {
  const target = normalize(nomeBuscado);
  if (!target) return null;

  const exact = tacoIngredients.find((ing) => normalize(ing.nome) === target);
  if (exact) return exact;

  const partial = tacoIngredients.find((ing) => normalize(ing.nome).includes(target));
  if (partial) return partial;

  return null;
}
