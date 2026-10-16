// js/ingredientes-sugeridos.js
//
// The ingredients most used in Brazilian confeitaria and salgaderia, by
// category, for the name suggestions in the ingredient sheet. Names only:
// nutrition still comes from the fixed DB (ingredients-db.js) or TACO once a
// name is chosen. Names that match a fixed ingredient keep matching it
// (normalize() ignores case/accents). An item may sit in more than one
// category (browsing "Massas" should show Farinha de trigo); search lists it
// once, under its first category.
// Ready-made recipes (planned) should use these same names.

import { normalize } from './text-utils.js';

export const CATEGORIAS = [
  {
    id: 'base', area: 'Confeitaria', nome: 'Base',
    itens: ['Açúcar', 'Açúcar cristal', 'Açúcar de confeiteiro', 'Açúcar mascavo', 'Farinha de trigo', 'Ovos',
      'Manteiga', 'Manteiga sem sal', 'Margarina', 'Leite', 'Fermento em pó', 'Sal', 'Fubá']
  },
  {
    id: 'laticinios', area: 'Confeitaria', nome: 'Lácteos',
    itens: ['Leite condensado', 'Creme de leite', 'Creme de leite fresco', 'Leite em pó', 'Cream cheese', 'Requeijão', 'Queijo ralado']
  },
  {
    id: 'chocolates', area: 'Confeitaria', nome: 'Chocolates',
    itens: ['Chocolate ao leite', 'Chocolate meio amargo', 'Chocolate branco', 'Chocolate em pó', 'Cacau em pó',
      'Achocolatado', 'Granulado', 'Granulado belga']
  },
  {
    id: 'recheios-doces', area: 'Confeitaria', nome: 'Recheios e coberturas',
    itens: ['Doce de leite', 'Coco ralado', 'Leite de coco', 'Leite Ninho', 'Creme de avelã', 'Geleia', 'Morango',
      'Maracujá', 'Limão', 'Abacaxi', 'Banana', 'Gelatina sem sabor', 'Amido de milho', 'Glucose de milho', 'Cenoura', 'Mel']
  },
  {
    id: 'aromas', area: 'Confeitaria', nome: 'Aromas e outros',
    itens: ['Essência de baunilha', 'Extrato de baunilha', 'Canela', 'Cravo', 'Noz-moscada', 'Castanha de caju',
      'Castanha-do-pará', 'Nozes', 'Amendoim', 'Paçoca', 'Aveia', 'Corante alimentício', 'Confeitos', 'Açúcar colorido',
      'Biscoito maisena']
  },
  {
    id: 'massas', area: 'Salgados', nome: 'Massas',
    itens: ['Farinha de trigo', 'Ovos', 'Leite', 'Manteiga', 'Margarina', 'Óleo', 'Sal', 'Açúcar',
      'Fermento biológico seco', 'Fermento biológico fresco', 'Fermento em pó', 'Polvilho doce', 'Polvilho azedo',
      'Batata', 'Mandioca', 'Caldo de galinha', 'Água', 'Gordura vegetal']
  },
  {
    id: 'recheios-salgados', area: 'Salgados', nome: 'Recheios',
    itens: ['Peito de frango', 'Carne moída', 'Presunto', 'Mortadela', 'Queijo muçarela', 'Queijo parmesão',
      'Queijo coalho', 'Requeijão', 'Catupiry', 'Calabresa', 'Salsicha', 'Palmito', 'Milho verde', 'Ervilha', 'Queijo ralado']
  },
  {
    id: 'temperos', area: 'Salgados', nome: 'Temperos',
    itens: ['Cebola', 'Alho', 'Tomate', 'Extrato de tomate', 'Salsinha', 'Cebolinha', 'Cheiro-verde', 'Orégano',
      'Pimenta-do-reino', 'Colorau', 'Páprica', 'Azeitona', 'Pimentão', 'Azeite', 'Gergelim',
      'Pimenta dedo-de-moça', 'Tempero pronto']
  },
  {
    id: 'empanar', area: 'Salgados', nome: 'Empanar e fritar',
    itens: ['Farinha de rosca', 'Farinha panko', 'Ovos', 'Leite', 'Óleo']
  }
];

export const CATEGORIA_MEUS = 'Meus';

const byName = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });

// normalized name -> { nome, categoria } at its first category
function catalogo() {
  const map = new Map();
  for (const c of CATEGORIAS) {
    for (const nome of c.itens) {
      const key = normalize(nome);
      if (!map.has(key)) map.set(key, { nome, categoria: c.nome });
    }
  }
  return map;
}

// 0: name starts with the text, 1: a word starts with it, 2: anywhere.
function rank(key, alvo) {
  if (key.startsWith(alvo)) return 0;
  if (key.split(/[\s-]+/).some((w) => w.startsWith(alvo))) return 1;
  if (key.includes(alvo)) return 2;
  return -1;
}

export function buscarSugestoes(texto, customIngredients, limite = 8) {
  const alvo = normalize(texto);
  if (!alvo) return [];
  const entries = catalogo();
  for (const { nome } of customIngredients) {
    const key = normalize(nome);
    if (key && !entries.has(key)) entries.set(key, { nome, categoria: CATEGORIA_MEUS });
  }
  const found = [];
  for (const [key, entry] of entries) {
    const r = rank(key, alvo);
    if (r >= 0) found.push({ r, meu: entry.categoria === CATEGORIA_MEUS ? 0 : 1, entry });
  }
  found.sort((a, b) => a.r - b.r || a.meu - b.meu || byName(a.entry.nome, b.entry.nome));
  return found.slice(0, limite).map(({ entry }) => ({ ...entry }));
}

export function itensDaCategoria(id, customIngredients) {
  if (id === 'meus') return customIngredients.map((i) => i.nome).sort(byName);
  return CATEGORIAS.find((c) => c.id === id)?.itens.slice() ?? [];
}
