// js/share.js
//
// Text sent through WhatsApp. It is the RECIPE only (ingredients and
// yield) — never costs, prices or margins, so it can be sent to a customer
// or a partner without revealing how the price was built.

import { parseQuantity } from './calculations.js';
import { gramsUsed } from './costing.js';
import { unitLabel, formatNumber } from './format.js';

function ingredientLine(item) {
  const nome = item.nome.trim();
  const bruta = String(item.quantidadeBruta ?? '').trim();
  if (!bruta) return `- ${nome}`;
  return `- ${bruta} ${unitLabel(item.unidade, parseQuantity(bruta))} de ${nome}`;
}

function totalGrams(itens) {
  if (itens.length === 0) return null;
  let total = 0;
  for (const item of itens) {
    const g = gramsUsed(item);
    if (g == null) return null;
    total += g;
  }
  return total;
}

export function buildRecipeShareText(recipe) {
  const itens = (recipe.ingredientes || []).filter((i) => typeof i.nome === 'string' && i.nome.trim() !== '');
  const porcoes = recipe.rendimento === 1 ? 'porção' : 'porções';
  const gramas = totalGrams(itens);
  const rende = `Rende: ${recipe.rendimento} ${porcoes}` + (gramas != null ? ` (≈ ${formatNumber(gramas, 0)} g no total)` : '');

  return [
    // *bold* is WhatsApp's own formatting syntax; plain ASCII on purpose
    // (a 4-byte emoji was seen getting corrupted by wa.me redirects).
    `*${recipe.nome?.trim() || '(sem nome)'}*`,
    '',
    'Ingredientes:',
    itens.map(ingredientLine).join('\n') || '(nenhum ingrediente cadastrado)',
    '',
    rende,
    '',
    'Enviado pela Calculadora de Cozinha'
  ].join('\n');
}

// wa.me opens the WhatsApp app (phone) or WhatsApp Web (desktop) with the
// text pre-filled, without any browser permission.
export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
