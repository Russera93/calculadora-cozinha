// js/preparo.js
//
// Modo de preparo: the sheet edits plain text (one step per line); the
// recipe stores an array of steps. The app numbers the steps, so numbering
// or bullets pasted from elsewhere are stripped ("1. 1. Misture" otherwise).

// "1." "2)" "3 -" "4:" or a bullet, at the start of the line. A dash or
// colon only counts when a space follows, so "30-40 min" and "10:30" stay.
const MARCADOR = /^\s*(?:\d+\s*(?:[.)](?!\d)|[:\-–](?=\s|$))|[•*]|[-–](?=\s|$))\s*/;

export function textoParaPassos(texto) {
  return String(texto ?? '')
    .split(/\r?\n/)
    .map((linha) => linha.replace(MARCADOR, '').trim())
    .filter(Boolean);
}

export function passosParaTexto(passos) {
  return (passos || []).join('\n');
}
