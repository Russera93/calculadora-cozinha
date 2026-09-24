// js/ui/dom.js
//
// Tiny templating helpers. html`` escapes every interpolated value unless it
// is itself a fragment (from html`` or raw()), which closes the self-XSS gap
// of typing markup into a recipe or ingredient name.

import { maskCurrencyDigits } from '../format.js';

const RAW = Symbol('raw');

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(value) {
  return { [RAW]: String(value) };
}

function render(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && RAW in value) return value[RAW];
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => { out += render(value) + strings[i + 1]; });
  return raw(out);
}

export function unwrap(fragment) {
  return render(fragment);
}

// --- DOM helpers (only touch `document` when called) ---

export function setHtml(el, fragment) {
  el.innerHTML = unwrap(fragment);
}

export function toElement(fragment) {
  const template = document.createElement('template');
  template.innerHTML = unwrap(fragment).trim();
  return template.content.firstElementChild;
}

// Applies the bank-app money mask to a currency <input> in place and
// returns the numeric value (null when allowEmpty and cleared).
export function applyCurrencyMask(inputEl, opts) {
  const { value, text } = maskCurrencyDigits(inputEl.value, opts);
  inputEl.value = text;
  inputEl.setSelectionRange(text.length, text.length);
  return value;
}

// Wires a currency <input>: the caret always sits at the end (digits enter
// from the right, so tapping into the middle of "0,00" must not scramble
// them), and onValue receives the parsed number on every keystroke.
export function bindCurrencyInput(inputEl, onValue, { allowEmpty = false, signal } = {}) {
  const caretToEnd = () => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  inputEl.addEventListener('focus', caretToEnd, { signal });
  inputEl.addEventListener('click', caretToEnd, { signal });
  inputEl.addEventListener('input', () => onValue(applyCurrencyMask(inputEl, { allowEmpty })), { signal });
}
