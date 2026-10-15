// Playwright's own Chromium when it was downloaded; otherwise an installed
// Chrome/Edge/Chromium, so scripts run without `npx playwright install`.
// CHROMIUM_PATH always wins. Returns launch options for chromium.launch().

import fs from 'node:fs';
import { chromium } from 'playwright';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

export function launchOptions() {
  if (process.env.CHROMIUM_PATH) return { executablePath: process.env.CHROMIUM_PATH };
  try { if (fs.existsSync(chromium.executablePath())) return {}; } catch {}
  const found = CANDIDATES.find((p) => fs.existsSync(p));
  return found ? { executablePath: found } : {};
}
