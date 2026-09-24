// js/ui/sheet.js
//
// Bottom sheet dialog: backdrop tap, Esc and drag-down on the handle all
// call onRequestClose (routed sheets pass goBack so the phone's back
// button and these gestures behave the same). close() actually removes it.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
let openCount = 0;

export function openSheet({ title, content, onRequestClose, onClose, initialFocus }) {
  const root = document.getElementById('overlay-root');
  const previousFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);
  sheet.tabIndex = -1;
  const grab = document.createElement('div');
  grab.className = 'sheet-grab';
  grab.setAttribute('aria-hidden', 'true');
  sheet.append(grab, content);
  backdrop.append(sheet);
  root.append(backdrop);

  openCount += 1;
  document.body.classList.add('no-scroll');

  let closed = false;
  const requestClose = () => (onRequestClose ?? close)();

  function close() {
    if (closed) return;
    closed = true;
    backdrop.remove();
    openCount -= 1;
    if (openCount === 0) document.body.classList.remove('no-scroll');
    onClose?.();
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
  }

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) requestClose(); });

  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
    } else if (e.key === 'Tab') {
      const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Drag the handle down more than 80px to close.
  let startY = null;
  let dy = 0;
  grab.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    dy = 0;
    grab.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  grab.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = () => {
    if (startY == null) return;
    startY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 80) requestClose();
  };
  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);

  // Focusing a text field pops the phone keyboard, so only do it when asked.
  requestAnimationFrame(() => {
    const target = initialFocus ? sheet.querySelector(initialFocus) : sheet;
    (target || sheet).focus({ preventScroll: true });
  });

  return { close, requestClose, element: sheet };
}
