// js/ui/menu.js — the "⋯" action menu, anchored to its button.

let active = null;

export function closeMenu() {
  if (!active) return;
  const { menu, cleanup } = active;
  active = null;
  cleanup();
  menu.remove();
}

export function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-item' + (item.danger ? ' danger' : '');
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.addEventListener('click', () => { closeMenu(); item.onSelect(); });
    menu.append(button);
  }
  document.getElementById('overlay-root').append(menu);

  // Below the anchor, or above it when there is no room; kept on screen.
  const rect = anchor.getBoundingClientRect();
  const { offsetHeight: h, offsetWidth: w } = menu;
  const below = rect.bottom + 4;
  const top = below + h > window.innerHeight - 8 ? Math.max(8, rect.top - 4 - h) : below;
  const left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8));
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  const onPointerDown = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
  const onKeyDown = (e) => { if (e.key === 'Escape') { closeMenu(); anchor.focus(); } };
  const onScroll = () => closeMenu();
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('scroll', onScroll, { passive: true });
  anchor.setAttribute('aria-expanded', 'true');

  active = {
    menu,
    cleanup() {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
      anchor.setAttribute('aria-expanded', 'false');
    }
  };
  menu.querySelector('button')?.focus({ preventScroll: true });
}
