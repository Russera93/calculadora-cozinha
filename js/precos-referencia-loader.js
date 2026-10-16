// js/precos-referencia-loader.js
//
// Loads data/precos-referencia.json once per page. A failed load is
// forgotten (offline now, online later).

let promessa = null;

export function getPrecosReferencia() {
  if (!promessa) {
    promessa = fetch('data/precos-referencia.json')
      .then((response) => {
        if (!response.ok) throw new Error('precos-referencia fetch failed: ' + response.status);
        return response.json();
      })
      .catch((err) => {
        promessa = null;
        throw err;
      });
  }
  return promessa;
}
