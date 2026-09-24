import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, html, raw, unwrap } from './ui/dom.js';

test('escapeHtml: escapes markup and quotes', () => {
  assert.equal(escapeHtml(`<b a="1">'&'</b>`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;');
});

test('html: escapes interpolated values', () => {
  assert.equal(unwrap(html`<p>${'<img onerror=x>'}</p>`), '<p>&lt;img onerror=x&gt;</p>');
});

test('html: nested fragments, arrays, raw, and empty values', () => {
  const items = ['a', '<b>'].map((t) => html`<li>${t}</li>`);
  assert.equal(unwrap(html`<ul>${items}</ul>`), '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  assert.equal(unwrap(html`${raw('<svg></svg>')}`), '<svg></svg>');
  assert.equal(unwrap(html`<p>${null}${undefined}${false}${0}</p>`), '<p>0</p>');
});
