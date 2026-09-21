export function parseQuantity(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;

  // Mixed number: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Simple fraction: "1/2"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (den === 0) return null;
    return num / den;
  }

  // Plain number (integer or decimal)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}

export const VOLUME_ML = {
  xicara: 240,
  colherSopa: 15,
  colherCha: 5
};

export function toGrams({ quantidade, unidade, densidadeGml, pesoUnidadeG }) {
  if (typeof quantidade !== 'number' || Number.isNaN(quantidade)) return null;

  if (unidade === 'g') {
    return quantidade;
  }

  if (unidade === 'ml') {
    if (densidadeGml == null) return null;
    return quantidade * densidadeGml;
  }

  if (unidade === 'xicara' || unidade === 'colherSopa' || unidade === 'colherCha') {
    if (densidadeGml == null) return null;
    return quantidade * VOLUME_ML[unidade] * densidadeGml;
  }

  if (unidade === 'unidade') {
    if (pesoUnidadeG == null) return null;
    return quantidade * pesoUnidadeG;
  }

  return null;
}

export function calculateIngredientCost({ gramasUsadas, gramasEmbalagem, precoEmbalagem }) {
  if (typeof gramasUsadas !== 'number' || Number.isNaN(gramasUsadas)) return null;
  if (typeof gramasEmbalagem !== 'number' || gramasEmbalagem <= 0) return null;
  if (typeof precoEmbalagem !== 'number' || precoEmbalagem < 0) return null;

  return (gramasUsadas / gramasEmbalagem) * precoEmbalagem;
}
