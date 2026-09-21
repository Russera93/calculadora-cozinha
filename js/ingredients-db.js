
function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalize(text).replace(/\s+/g, '-');
}

function makeIngredient({ nome, categoria, densidadeGml = null, pesoUnidadeG = null, nutricao100g }) {
  return {
    id: `fixed:${slugify(nome)}`,
    nome,
    categoria,
    densidadeGml,
    pesoUnidadeG,
    nutricao100g
  };
}

export const FIXED_INGREDIENTS = [
  makeIngredient({
    nome: 'Farinha de trigo',
    categoria: 'po',
    densidadeGml: 0.5, // 1 xicara (240ml) = 120g
    nutricao100g: { kcal: 364, carboidratos: 76.3, proteinas: 10, gorduras: 1, fibras: 2.3, sodio: 2 }
  }),
  makeIngredient({
    nome: 'Açúcar',
    categoria: 'po',
    densidadeGml: 0.83, // 1 xicara (240ml) = ~200g
    nutricao100g: { kcal: 387, carboidratos: 99.8, proteinas: 0, gorduras: 0, fibras: 0, sodio: 1 }
  }),
  makeIngredient({
    nome: 'Óleo',
    categoria: 'liquido',
    densidadeGml: 0.92,
    nutricao100g: { kcal: 884, carboidratos: 0, proteinas: 0, gorduras: 100, fibras: 0, sodio: 0 }
  }),
  makeIngredient({
    nome: 'Ovos',
    categoria: 'outro',
    pesoUnidadeG: 50,
    nutricao100g: { kcal: 155, carboidratos: 1.1, proteinas: 13, gorduras: 11, fibras: 0, sodio: 124 }
  }),
  makeIngredient({
    nome: 'Banana',
    categoria: 'fruta_vegetal',
    pesoUnidadeG: 100,
    nutricao100g: { kcal: 89, carboidratos: 22.8, proteinas: 1.1, gorduras: 0.3, fibras: 2.6, sodio: 1 }
  }),
  makeIngredient({
    nome: 'Aveia',
    categoria: 'graos',
    densidadeGml: 0.33, // 1 xicara (240ml) = ~80g
    nutricao100g: { kcal: 389, carboidratos: 66.3, proteinas: 16.9, gorduras: 6.9, fibras: 10.6, sodio: 2 }
  }),
  makeIngredient({
    nome: 'Fermento em pó',
    categoria: 'po',
    densidadeGml: 0.9,
    nutricao100g: { kcal: 53, carboidratos: 27.7, proteinas: 0.1, gorduras: 0, fibras: 0.2, sodio: 10600 }
  }),
  makeIngredient({
    nome: 'Leite Condensado',
    categoria: 'liquido',
    densidadeGml: 1.3,
    nutricao100g: { kcal: 321, carboidratos: 54.4, proteinas: 7.9, gorduras: 8.7, fibras: 0, sodio: 127 }
  }),
  makeIngredient({
    nome: 'Creme de Leite',
    categoria: 'liquido',
    densidadeGml: 1.0,
    nutricao100g: { kcal: 239, carboidratos: 3.5, proteinas: 2.4, gorduras: 25, fibras: 0, sodio: 44 }
  }),
  makeIngredient({
    nome: 'Chocolate em pó',
    categoria: 'po',
    densidadeGml: 0.5,
    nutricao100g: { kcal: 365, carboidratos: 80, proteinas: 5, gorduras: 3, fibras: 5, sodio: 100 }
  }),
  makeIngredient({
    nome: 'Manteiga',
    categoria: 'gordura',
    densidadeGml: 0.96,
    nutricao100g: { kcal: 717, carboidratos: 0.1, proteinas: 0.9, gorduras: 81, fibras: 0, sodio: 11 }
  })
];

export function findFixedIngredient(nome) {
  const target = normalize(nome);
  return FIXED_INGREDIENTS.find((ing) => normalize(ing.nome) === target) || null;
}
