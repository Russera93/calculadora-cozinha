// js/format.js
//
// Pure formatting/parsing helpers shared by every screen. No DOM here, so
// all of it is unit-tested; the one DOM-touching wrapper
// (applyCurrencyMask) lives in ui/dom.js and delegates to maskCurrencyDigits.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Intl puts a non-breaking space after "R$"; normalized to a plain space so
// the same string works in the UI, in tests and in WhatsApp text.
export function formatBRL(value) {
  const numeric = Number(value);
  return BRL.format(Number.isFinite(numeric) ? numeric : 0).replace(/ /g, ' ');
}

export function formatNumber(value, maxDecimals = 1) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxDecimals }).format(Number(value) || 0);
}

// Text for a currency <input>: always two decimals, no "R$", no thousands
// separator (so re-parsing it is unambiguous).
export function formatCurrencyInput(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

// Text for a plain decimal <input> (package size, minutes, nutrients).
export function formatDecimalInput(value) {
  return String(Number(Number(value || 0).toFixed(3))).replace('.', ',');
}

// "Money mask" used by Brazilian banking apps: every digit typed shifts in
// from the right, always filling the cents. Only digits are kept, so pasted
// text like "R$ 1.234,56" still reads as 1234.56.
export function maskCurrencyDigits(raw, { allowEmpty = false } = {}) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (allowEmpty && digits === '') return { value: null, text: '' };
  const value = parseInt(digits || '0', 10) / 100;
  return { value, text: formatCurrencyInput(value) };
}

export function parseDecimal(raw) {
  const text = String(raw ?? '').trim();
  const numeric = Number(text.replace(',', '.'));
  return text !== '' && Number.isFinite(numeric) ? numeric : 0;
}

export function parseInteger(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

const UNIT_LABELS = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  xicara: ['xícara', 'xícaras'],
  colherSopa: ['colher de sopa', 'colheres de sopa'],
  colherCha: ['colher de chá', 'colheres de chá'],
  unidade: ['unidade', 'unidades']
};

// Stored unit values (xicara, colherSopa…) stay as they are in
// localStorage; this is only how they are shown.
export function unitLabel(unidade, quantidade) {
  const labels = UNIT_LABELS[unidade];
  if (!labels) return String(unidade);
  return typeof quantidade === 'number' && quantidade > 1 ? labels[1] : labels[0];
}

export function packageUnitShort(unidadeEmbalagem) {
  return unidadeEmbalagem === 'unidade' ? 'un.' : String(unidadeEmbalagem);
}

export const UNIT_CHIPS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'xicara', label: 'xícara' },
  { value: 'colherSopa', label: 'c. sopa' },
  { value: 'colherCha', label: 'c. chá' },
  { value: 'unidade', label: 'unidade' }
];

export const PACKAGE_UNIT_CHIPS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'unidade', label: 'unidade' }
];
