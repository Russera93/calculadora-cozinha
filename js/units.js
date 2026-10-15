// js/units.js
//
// Package units. A package is stored exactly as typed (1 kg stays
// tamanhoEmbalagem 1 + unidadeEmbalagem 'kg'); every calculation goes
// through packageInBase, so the math only ever sees grams, ml or pieces
// and recipes saved before kg/L/mg existed (g/ml/unidade) cost the same.

export const PACKAGE_UNITS = {
  g: { base: 'g', fator: 1 },
  kg: { base: 'g', fator: 1000 },
  mg: { base: 'g', fator: 0.001 },
  ml: { base: 'ml', fator: 1 },
  l: { base: 'ml', fator: 1000 },
  unidade: { base: 'unidade', fator: 1 }
};

export function packageInBase(tamanho, unidade) {
  const unit = Object.hasOwn(PACKAGE_UNITS, unidade) ? PACKAGE_UNITS[unidade] : null;
  if (!unit) return null;
  return { valor: tamanho * unit.fator, base: unit.base };
}
