// Renders the PNG app icons from icons/icon.svg and icons/icon-maskable.svg
// (the PNGs are committed; rerun only when an SVG changes):
//   node scripts/build-icons.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchOptions } from './find-browser.mjs';

const icons = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const OUTPUTS = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  // iOS paints transparent corners black and rounds the icon itself.
  ['icon-maskable.svg', 'apple-touch-icon.png', 180]
];

const browser = await chromium.launch(launchOptions());
const page = await browser.newPage();
for (const [svg, png, size] of OUTPUTS) {
  const markup = fs.readFileSync(path.join(icons, svg), 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  await page.locator('svg').screenshot({ path: path.join(icons, png), omitBackground: true });
  console.log(`icons/${png} (${size}px)`);
}
await browser.close();
