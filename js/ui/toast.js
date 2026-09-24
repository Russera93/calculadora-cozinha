// js/ui/toast.js — one short message at a time, optionally with an action.

let current = null;

export function showToast(message, { actionLabel, onAction, duration = 5000 } = {}) {
  current?.dismiss();
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);

  let timer = null;
  const handle = {
    dismiss() {
      clearTimeout(timer);
      el.remove();
      if (current === handle) current = null;
    }
  };

  if (actionLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', () => { handle.dismiss(); onAction?.(); });
    el.append(button);
  }

  root.append(el);
  timer = setTimeout(() => handle.dismiss(), duration);
  current = handle;
  return handle;
}
