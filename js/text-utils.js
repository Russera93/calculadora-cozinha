// js/text-utils.js
//
// Case/accent-insensitive normalization, shared by every place that matches
// ingredient names against each other (fixed DB, TACO, custom ingredients,
// the price bank) — hoisted here so "Açaí" and "acai" are recognized as the
// same ingredient everywhere, not just in whichever file happened to define
// its own copy of this function first.

export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
