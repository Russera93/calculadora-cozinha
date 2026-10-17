// js/cardapio.js
//
// Cardápio compartilhável: what the client sees for each recipe she
// picks — name, quantity (her own words: "1 unidade", "a dúzia", "o
// quilo"…) and the price she wants to show, never cost or margin. Pure
// defaults only; the screen (js/screens/cardapio.js) handles the photo,
// selection and PDF/image export.

export function itemPadrao(recipe) {
  return {
    recipeId: recipe.id,
    nome: recipe.nome?.trim() || '(sem nome)',
    quantidade: '1 unidade',
    precoCliente: recipe.precoVendaDesejado ?? 0
  };
}

// Only items she kept checked, with a name and a price above zero — a
// row she forgot to price would just confuse the client.
export function itensProntos(itens) {
  return itens.filter((i) => i.incluido && i.nome.trim() && i.precoCliente > 0);
}
