// js/router.js
//
// Hash routes, so the phone's back button/gesture moves through the app
// (closes a sheet, then leaves the recipe) instead of leaving the site.
// parseRoute/buildHash are pure and tested; the rest touches `history`
// only when called.

export const TABS = ['ingredientes', 'custos', 'preco', 'nutricao'];

const LISTA = { screen: 'lista' };

export function parseRoute(hash) {
  let parts;
  try {
    const path = String(hash || '').replace(/^#/, '').replace(/^\/+|\/+$/g, '');
    parts = path === '' ? [] : path.split('/').map(decodeURIComponent);
  } catch {
    return LISTA; // malformed %-encoding
  }

  if (parts.length === 0) return LISTA;
  if (parts.length === 1 && parts[0] === 'ajustes') return { screen: 'lista', sheet: 'ajustes' };
  if (parts.length === 1 && parts[0] === 'meus-ingredientes') return { screen: 'meus-ingredientes' };
  if (parts.length === 1 && parts[0] === 'cardapio') return { screen: 'cardapio' };
  if (parts[0] === 'prontas') {
    if (parts.length === 1) return { screen: 'prontas' };
    if (parts.length === 2 && parts[1]) return { screen: 'pronta', prontaId: parts[1] };
    if (parts.length === 3 && parts[1] && parts[2] === 'cozinhar') return { screen: 'pronta', prontaId: parts[1], cozinhar: true };
    return LISTA;
  }
  if (parts[0] !== 'receita' || !parts[1] || parts.length > 4) return LISTA;

  const recipeId = parts[1];
  const aba = parts[2] ?? 'ingredientes';
  if (!TABS.includes(aba)) return LISTA;
  if (parts.length <= 3) return { screen: 'editor', recipeId, aba };

  if (aba !== 'ingredientes') return LISTA;
  if (parts[3] === 'novo' || parts[3] === 'nota' || parts[3] === 'preparo' || parts[3] === 'cozinhar') {
    return { screen: 'editor', recipeId, aba, item: parts[3] };
  }
  if (/^\d+$/.test(parts[3])) return { screen: 'editor', recipeId, aba, item: Number(parts[3]) };
  return LISTA;
}

export function buildHash(route) {
  if (route.screen === 'editor') {
    let hash = `#/receita/${encodeURIComponent(route.recipeId)}/${route.aba ?? 'ingredientes'}`;
    if (route.item != null) hash += `/${route.item}`;
    return hash;
  }
  if (route.screen === 'meus-ingredientes') return '#/meus-ingredientes';
  if (route.screen === 'cardapio') return '#/cardapio';
  if (route.screen === 'prontas') return '#/prontas';
  if (route.screen === 'pronta') {
    let hash = `#/prontas/${encodeURIComponent(route.prontaId)}`;
    if (route.cozinhar) hash += '/cozinhar';
    return hash;
  }
  return route.sheet === 'ajustes' ? '#/ajustes' : '#/';
}

let handler = () => {};

// The address bar always shows the canonical hash for the current route
// ("" -> "#/", "#/receita/x" -> "#/receita/x/ingredientes", junk -> "#/").
function dispatch() {
  const route = parseRoute(location.hash);
  const canonical = buildHash(route);
  if (location.hash !== canonical) history.replaceState(history.state, '', canonical);
  handler(route);
}

export function startRouter(onRoute) {
  handler = onRoute;
  window.addEventListener('popstate', dispatch);
  dispatch();
}

// Entries pushed by the app are marked, so goBack() knows whether
// history.back() stays inside the app.
export function navigate(route, { replace = false } = {}) {
  const hash = buildHash(route);
  if (replace) {
    history.replaceState(history.state, '', hash);
  } else {
    history.pushState({ inApp: true }, '', hash);
  }
  handler(parseRoute(hash));
}

export function goBack(fallbackRoute) {
  if (history.state?.inApp) {
    history.back();
  } else {
    navigate(fallbackRoute, { replace: true });
  }
}
