// js/receitas-prontas-loader.js
//
// Loads data/receitas-prontas.json once per page, only when the catalog is
// opened. A failed load is forgotten, so "Tentar de novo" really retries.

let promessa = null;

export function getReceitasProntas() {
  if (!promessa) {
    promessa = fetch('data/receitas-prontas.json')
      .then((response) => {
        if (!response.ok) throw new Error('receitas-prontas fetch failed: ' + response.status);
        return response.json();
      })
      .catch((err) => {
        promessa = null;
        throw err;
      });
  }
  return promessa;
}
