// js/app.js — bootstrap: theme, router, and which screen is on.

import { startRouter, navigate } from './router.js';
import { renderLista } from './screens/lista.js';
import { renderEditor } from './screens/editor.js';
import { initTheme } from './theme.js';
import { store } from './store.js';
import { showToast } from './ui/toast.js';
import { closeMenu } from './ui/menu.js';

const view = document.getElementById('view');
let current = null; // { screen, recipeId, update, destroy }

function sameScreen(route) {
  return current && current.screen === route.screen &&
    (route.screen !== 'editor' || current.recipeId === route.recipeId);
}

function onRoute(route) {
  closeMenu();
  if (sameScreen(route)) {
    current.update(route);
    return;
  }
  current?.destroy();
  current = null;
  window.scrollTo(0, 0);

  if (route.screen === 'editor') {
    const screen = renderEditor(view, route.recipeId);
    if (!screen) {
      showToast('Receita não encontrada');
      navigate({ screen: 'lista' }, { replace: true });
      return;
    }
    current = { ...screen, screen: 'editor', recipeId: route.recipeId };
  } else {
    current = { ...renderLista(view), screen: 'lista' };
  }
  current.update(route);
}

// pagehide/visibilitychange are the reliable "leaving" signals on phones
// (beforeunload often never fires there).
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
});

initTheme();
startRouter(onRoute);
