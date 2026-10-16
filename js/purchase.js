// js/purchase.js
//
// A receipt applied to a recipe: the purchased packages fill each
// ingredient's price/size, and the purchase is kept on the recipe
// (recipe.compra) to answer "how much of it does one batch use" and "how
// many batches does it make". The share of a package one batch uses is
// computeLineCost with a price of 1, so every unit rule (whole cans,
// dozens, ml through density, kg/L) applies here too.

import { computeLineCost, sincronizarPrecoMesmoNome } from './costing.js';
import { normalize } from './text-utils.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function unitPrice(item) {
  return round2(item.valorTotal / item.quantidade);
}

// escolhas: [{ item: parsed receipt item, ingredienteIndex }], items
// already checked (quantidade, tamanho, unidade and valorTotal filled).
export function applyPurchase(recipe, escolhas, agora) {
  const aplicados = [];
  const itens = [];
  for (const { item, ingredienteIndex } of escolhas) {
    const linha = recipe.ingredientes[ingredienteIndex];
    if (!linha) continue;
    linha.precoEmbalagem = unitPrice(item);
    linha.tamanhoEmbalagem = item.tamanho;
    linha.unidadeEmbalagem = item.unidade;
    sincronizarPrecoMesmoNome(recipe.ingredientes, linha);
    aplicados.push({ nome: linha.nome, precoEmbalagem: linha.precoEmbalagem, tamanhoEmbalagem: linha.tamanhoEmbalagem, unidadeEmbalagem: linha.unidadeEmbalagem });
    itens.push({
      nome: linha.nome,
      descricao: item.descricao,
      quantidade: item.quantidade,
      tamanho: item.tamanho,
      unidade: item.unidade,
      valorTotal: item.valorTotal
    });
  }
  recipe.compra = { lidaEm: agora, itens };
  return aplicados;
}

export function purchaseYield(recipe) {
  const compra = recipe.compra;
  if (!compra || !Array.isArray(compra.itens) || compra.itens.length === 0) return null;

  // Every row of an ingredient (a ready-made recipe has Farinha in the
  // dough and to bread): one batch uses all of them.
  const linhasPorNome = new Map();
  for (const linha of recipe.ingredientes) {
    if (!linha.nome || !linha.nome.trim() || linha.semCusto) continue;
    const key = normalize(linha.nome);
    if (!linhasPorNome.has(key)) linhasPorNome.set(key, []);
    linhasPorNome.get(key).push(linha);
  }

  const itens = [];
  for (const c of compra.itens) {
    // Ingredient removed or renamed since the receipt was applied.
    const linhas = linhasPorNome.get(normalize(c.nome));
    if (!linhas || !(c.quantidade > 0)) continue;
    let fracao = 0;
    for (const linha of linhas) {
      const parte = computeLineCost({ ...linha, precoEmbalagem: 1, tamanhoEmbalagem: c.tamanho, unidadeEmbalagem: c.unidade });
      fracao = parte == null || fracao == null ? null : fracao + parte;
    }
    const ok = fracao != null && fracao > 0;
    itens.push({
      nome: linhas[0].nome,
      receitas: ok ? c.quantidade / fracao : null,
      gasto: ok ? (c.valorTotal / c.quantidade) * fracao : null,
      valorTotal: c.valorTotal
    });
  }
  if (itens.length === 0) return null;

  let limite = null;
  for (const item of itens) {
    if (item.receitas != null && (limite == null || item.receitas < limite.receitas)) limite = item;
  }
  // 1e-9: 2 cans / 1 can per batch must be 2, not 1.9999999.
  const receitasPossiveis = limite ? Math.floor(limite.receitas + 1e-9) : null;
  const nomesCompra = new Set(itens.map((i) => normalize(i.nome)));

  return {
    itens,
    receitasPossiveis,
    unidadesPossiveis: receitasPossiveis != null && recipe.rendimento > 0 ? receitasPossiveis * recipe.rendimento : null,
    limitante: limite ? limite.nome : null,
    gastoPorReceita: itens.reduce((sum, i) => sum + (i.gasto ?? 0), 0),
    totalNota: round2(itens.reduce((sum, i) => sum + i.valorTotal, 0)),
    faltando: [...linhasPorNome.values()].filter((ls) => !nomesCompra.has(normalize(ls[0].nome))).map((ls) => ls[0].nome)
  };
}
