// js/ui/confirm.js — replaces window.confirm() with a bottom sheet.

import { openSheet } from './sheet.js';
import { html, toElement } from './dom.js';

export function confirmSheet({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) {
  return new Promise((resolve) => {
    let result = false;
    const content = toElement(html`
      <div>
        <h2 class="sheet-title">${title}</h2>
        <p>${message}</p>
        <div class="sheet-actions">
          <button type="button" class="btn btn-secondary" data-cancel>${cancelLabel}</button>
          <button type="button" class="btn btn-primary" style="flex:1" data-ok>${confirmLabel}</button>
        </div>
      </div>`);
    const sheet = openSheet({ title, content, onClose: () => resolve(result), initialFocus: '[data-ok]' });
    content.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
    content.querySelector('[data-ok]').addEventListener('click', () => { result = true; sheet.close(); });
  });
}
