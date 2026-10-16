// js/taxas.js — sale fees: what the card machine / iFood keeps from the
// price. Typed once (in the Preço tab, when that channel is picked) and
// used by every recipe sold through that channel.

export const CANAIS = [
  ['direto', 'Pix / dinheiro'],
  ['maquininha', 'Maquininha'],
  ['ifood', 'iFood']
];

export const TAXAS_PADRAO = { taxaMaquininha: 0, taxaIfood: 0 };

const TAXA_MAX = 90; // 100% would make every price impossible

const percent = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, TAXA_MAX) : 0);

export function normalizeTaxas(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { taxaMaquininha: percent(r.taxaMaquininha), taxaIfood: percent(r.taxaIfood) };
}

// The stored field for a channel's fee, or null for Pix/cash.
export function campoDoCanal(canal) {
  if (canal === 'maquininha') return 'taxaMaquininha';
  if (canal === 'ifood') return 'taxaIfood';
  return null;
}

// Fraction (0..0.9) of the sale price the channel keeps.
export function taxaDoCanal(taxas, canal) {
  const campo = campoDoCanal(canal);
  return campo ? taxas[campo] / 100 : 0;
}
