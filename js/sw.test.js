// The service worker must pre-cache every file the app needs offline;
// forgetting a new module would make the installed app break offline.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function precacheList() {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const block = sw.slice(sw.indexOf('// PRECACHE-START'), sw.indexOf('// PRECACHE-END'));
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function appModules(dir = 'js') {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return appModules(rel);
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [rel] : [];
  });
}

test('sw.js pre-caches every app module, the page, styles, data, manifest and icons', () => {
  const list = new Set(precacheList());
  const icons = fs.readdirSync(path.join(root, 'icons')).map((f) => `icons/${f}`);
  const needed = ['./', 'index.html', 'css/styles.css', 'data/taco.json', 'manifest.webmanifest', ...icons, ...appModules()];
  for (const file of needed) assert.ok(list.has(file), `falta no PRECACHE do sw.js: ${file}`);
});

test('every pre-cached file exists (a missing one makes the install fail)', () => {
  for (const file of precacheList()) {
    if (file === './') continue;
    assert.ok(fs.existsSync(path.join(root, file)), `não existe: ${file}`);
  }
});
