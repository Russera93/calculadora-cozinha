// js/ui/dom.js
//
// Tiny templating helpers. html`` escapes every interpolated value unless it
// is itself a fragment (from html`` or raw()), which closes the self-XSS gap
// of typing markup into a recipe or ingredient name.

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
