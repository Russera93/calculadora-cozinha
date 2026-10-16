// js/screens/editor/preparo-sheet.js — edit the recipe's steps as plain
// text, one per line. Saved while typing (store autosave).

import { textoParaPassos, passosParaTexto } from '../../preparo.js';
import { html, toElement } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';

export function openPreparoSheet({ store, onRequestClose, onClose }) {
  const content = toElement(html`
    <form novalidate>
      <h2 class="sheet-title">Modo de preparo</h2>
      <label class="field"><span class="field-label">Um passo por linha</span>
        <textarea class="input preparo-texto" name="preparo" rows="10" autocomplete="off"
          placeholder="Ex: Misture tudo numa panela.&#10;Mexa em fogo baixo até desgrudar.">${passosParaTexto(store.recipe.modoPreparo)}</textarea></label>
      <p class="field-hint">A numeração é feita sozinha.</p>
      <div class="sheet-actions">
        <button type="submit" class="btn btn-primary" style="flex:1">Pronto</button>
      </div>
    </form>`);
  const textarea = content.elements.preparo;

  textarea.addEventListener('input', () => {
    store.update((r) => { r.modoPreparo = textoParaPassos(textarea.value); });
  });
  content.addEventListener('submit', (e) => {
    e.preventDefault();
    sheet.requestClose();
  });

  const sheet = openSheet({
    title: 'Modo de preparo',
    content,
    onRequestClose,
    onClose: () => { store.flush(); onClose?.(); },
    initialFocus: 'textarea'
  });
  return sheet;
}
