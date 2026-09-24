// js/theme.js
//
// 'auto' (follow the phone), 'light' or 'dark'. index.html's inline script
// applies a saved choice before first paint; this keeps the toggle icons
// and <meta name="theme-color"> in sync afterwards.

const THEME_KEY = 'calculadora-cozinha:tema';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref() {
  try {
    return localStorage.getItem(THEME_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function effectiveTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr;
  return darkQuery().matches ? 'dark' : 'light';
}

export function syncThemeUi() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  const icon = effectiveTheme() === 'dark' ? '☀️' : '🌙';
  for (const el of document.querySelectorAll('[data-theme-icon]')) el.textContent = icon;
}

export function setThemePref(pref) {
  try {
    if (pref === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // storage blocked: the choice still applies to this page view
  }
  if (pref === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', pref);
  syncThemeUi();
}

export function toggleTheme() {
  setThemePref(effectiveTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  syncThemeUi();
  darkQuery().addEventListener('change', syncThemeUi);
}
