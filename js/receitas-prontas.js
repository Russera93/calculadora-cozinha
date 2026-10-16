// js/receitas-prontas.js
//
// Ready-made recipes (data/receitas-prontas.json): checking the file,
// texts for the catalog/detail, and turning one into the person's own
// recipe. Pure — storage, TACO and prices are passed in.

import { parseQuantity } from './calculations.js';
import { UNIT_CHIPS, unitLabel } from './format.js';
import { CATEGORIAS } from './ingredientes-sugeridos.js';
import { emptyIngredientItem, findKnownIngredient, applyIngredientMatch } from './ingredient-match.js';
import { findInTaco } from './taco-database.js';
import { normalize } from './text-utils.js';

const UNIDADES = UNIT_CHIPS.map((u) => u.value);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validarCatalogo(data) {
  if (!data || !Array.isArray(data.categorias) || !Array.isArray(data.receitas)) {
    return ['formato: faltam "categorias" e "receitas"'];
  }
  const problemas = [];
  const categorias = new Set(data.categorias.map((c) => c.id));
  const ids = new Set();
  for (const r of data.receitas) {
    const onde = r?.id || '(sem id)';
    if (!ID.test(r?.id || '')) problemas.push(`${onde}: id inválido`);
    if (ids.has(r?.id)) problemas.push(`${onde}: id repetido`);
    ids.add(r?.id);
    if (!r?.nome?.trim()) problemas.push(`${onde}: sem nome`);
    if (!categorias.has(r?.categoria)) problemas.push(`${onde}: categoria "${r?.categoria}" não existe`);
    if (!Number.isInteger(r?.rendimento) || r.rendimento < 1) problemas.push(`${onde}: rendimento inválido`);
    if (!Array.isArray(r?.ingredientes) || r.ingredientes.length === 0) problemas.push(`${onde}: sem ingredientes`);
    for (const i of r?.ingredientes || []) {
      if (!i?.nome?.trim()) problemas.push(`${onde}: ingrediente sem nome`);
      if (!UNIDADES.includes(i?.unidade)) problemas.push(`${onde}: ${i?.nome}: unidade "${i?.unidade}" inválida`);
      if (parseQuantity(i?.quantidade) == null) problemas.push(`${onde}: ${i?.nome}: quantidade "${i?.quantidade}" ilegível`);
    }
    if (!Array.isArray(r?.preparo) || r.preparo.length === 0 || r.preparo.some((p) => typeof p !== 'string' || !p.trim())) {
      problemas.push(`${onde}: modo de preparo vazio`);
    }
  }
  return problemas;
}

export function nomesForaDaLista(data) {
  const conhecidos = new Set(CATEGORIAS.flatMap((c) => c.itens).map(normalize));
  const fora = new Map(); // normalized -> first spelling seen
  for (const r of data.receitas) {
    for (const i of r.ingredientes) {
      const key = normalize(i.nome);
      if (!conhecidos.has(key) && !fora.has(key)) fora.set(key, i.nome);
    }
  }
  return [...fora.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function medidaTexto(ing) {
  return `${ing.quantidade} ${unitLabel(ing.unidade, parseQuantity(ing.quantidade))}`;
}

export function rendeTexto(pronta) {
  const unidade = pronta.unidadeRendimento || (pronta.rendimento === 1 ? 'unidade' : 'unidades');
  return `Rende ${pronta.rendimento} ${unidade}`;
}

export function contarIngredientes(pronta) {
  return new Set(pronta.ingredientes.map((i) => normalize(i.nome))).size;
}

export function agruparPorSecao(ingredientes) {
  const grupos = new Map();
  for (const ing of ingredientes) {
    const secao = ing.secao || null;
    if (!grupos.has(secao)) grupos.set(secao, { secao, itens: [] });
    grupos.get(secao).itens.push(ing);
  }
  return [...grupos.values()];
}

// The copy goes through the same recognition as a typed ingredient: fixed
// DB / custom, the price she already used, and TACO for the rest (density
// makes "1 xícara" cost something as soon as she adds a price).
export function criarReceitaDePronta(pronta, { existentes, custom, precoDe, taco, base }) {
  const usados = new Set(existentes.map((r) => normalize(r.nome || '')));
  const nome = usados.has(normalize(pronta.nome)) ? `${pronta.nome} (cópia)` : pronta.nome;

  const ingredientes = pronta.ingredientes.map((ing) => {
    const item = { ...emptyIngredientItem(), nome: ing.nome, quantidadeBruta: ing.quantidade, unidade: ing.unidade };
    if (ing.semCusto) {
      item.semCusto = true;
      return item;
    }
    const known = findKnownIngredient(ing.nome, custom);
    applyIngredientMatch(item, { known, precoConhecido: precoDe(ing.nome) });
    item.unidade = ing.unidade; // the recipe's measure wins over the eggs default
    if (!known) {
      const match = findInTaco(ing.nome, taco);
      if (match) {
        item.nutricao100g = match.nutricao100g;
        item.densidadeGml = match.densidadeGml;
      }
    }
    return item;
  });

  return {
    ...base,
    nome,
    rendimento: pronta.rendimento,
    quantidadeEmbalagens: pronta.rendimento,
    ingredientes,
    modoPreparo: [...pronta.preparo],
    origem: pronta.id
  };
}
