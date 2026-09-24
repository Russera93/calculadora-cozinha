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

// Wires a currency <input> like a bank app: a typed digit is always appended
// on the right and Backspace always drops the last digit, wherever the caret
// happens to be (a caret left at the start of "0,00" by keyboard focus used
// to turn "590" into R$ 5.000,90). Paste and IME input fall through to the
// 'input' handler, which re-masks whatever digits are there. onValue gets
// the parsed number after every change.
export function bindCurrencyInput(inputEl, onValue, { allowEmpty = false, signal } = {}) {
  const commit = (digits) => {
    inputEl.value = digits;
    onValue(applyCurrencyMask(inputEl, { allowEmpty }));
  };
  const currentDigits = () => inputEl.value.replace(/\D/g, '');

  inputEl.addEventListener('beforeinput', (e) => {
    // With a selection (e.g. select-all), let the browser replace/delete it;
    // the 'input' handler below re-masks what is left.
    if (inputEl.selectionStart !== inputEl.selectionEnd) return;
    if (e.inputType === 'insertText' && e.data) {
      e.preventDefault();
      const typed = e.data.replace(/\D/g, '');
      if (typed) commit(currentDigits() + typed);
    } else if (e.inputType === 'deleteContentBackward') {
      e.preventDefault();
      commit(currentDigits().slice(0, -1));
    }
  }, { signal });
  inputEl.addEventListener('input', () => onValue(applyCurrencyMask(inputEl, { allowEmpty })), { signal });
}
