// Mobile smoke test: serves the app over HTTP, opens it in Chromium at
// 390x844 (touch, 2x), and runs every scenario in scripts/smoke/ in order,
// each in a fresh browser context (empty localStorage), in light and dark.
// Screenshots go to scripts/.screenshots/ (git-ignored).
//   npm run test:mobile            all scenarios
//   npm run test:mobile -- 03      only scenarios whose file name contains "03"
// No downloaded Playwright browser? Point CHROMIUM_PATH at a Chrome/Chromium.

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'scripts', '.screenshots');
fs.mkdirSync(shotsDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, resolve));
const baseUrl = `http://localhost:${server.address().port}/`;

const filter = process.argv[2] || '';
const scenarioFiles = fs.readdirSync(path.join(root, 'scripts', 'smoke'))
  .filter((f) => f.endsWith('.mjs') && f.includes(filter)).sort();

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;

for (const theme of ['light', 'dark']) {
  for (const file of scenarioFiles) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      colorScheme: theme, locale: 'pt-BR'
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Google Fonts may be unreachable in CI/offline; that is not an app error.
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').startsWith('https://fonts.')) errors.push(m.text());
    });

    const t = {
      page, baseUrl, assert,
      async shot(name) {
        await page.screenshot({ path: path.join(shotsDir, `${file.replace('.mjs', '')}-${name}-${theme}.png`), fullPage: true });
      },
      async semRolagemHorizontal() {
        const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        assert.ok(scroll <= client, `rolagem horizontal: scrollWidth ${scroll} > ${client}`);
      },
      async seed(recipes) {
        await page.evaluate((r) => localStorage.setItem('calculadora-cozinha:recipes', JSON.stringify(r)), recipes);
      }
    };

    const label = `${file} [${theme}]`;
    try {
      const scenario = (await import(pathToFileURL(path.join(root, 'scripts', 'smoke', file)).href)).default;
      await scenario(t);
      assert.deepEqual(errors, [], 'erros no console');
      console.log(`ok    ${label}`);
    } catch (err) {
      failures += 1;
      console.log(`FAIL  ${label}\n      ${err.message.split('\n').join('\n      ')}`);
      await page.screenshot({ path: path.join(shotsDir, `FAIL-${file.replace('.mjs', '')}-${theme}.png`), fullPage: true }).catch(() => {});
    }
    await context.close();
  }
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} falha(s)` : '\ntudo ok');
process.exit(failures ? 1 : 0);
