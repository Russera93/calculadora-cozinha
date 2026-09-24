// Minimal version so the Ingredientes tab can be tested; Task 15 replaces it.
import { html, toElement } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';

export function openIngredientSheet({ store, index, onRequestClose, onClose }) {
  const item = index === 'novo' ? null : store.recipe.ingredientes[index];
  const content = toElement(html`
    <div>
      <h2 class="sheet-title">${item ? item.nome : 'Novo ingrediente'}</h2>
      <div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-ok>Pronto</button></div>
    </div>`);
  const sheet = openSheet({ title: item ? item.nome : 'Novo ingrediente', content, onRequestClose, onClose: () => onClose?.(index === 'novo' ? null : index) });
  content.querySelector('[data-ok]').addEventListener('click', onRequestClose);
  return sheet;
}
