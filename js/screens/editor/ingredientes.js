// Initial version; replaced by the real tab in a later task.
import { html, setHtml } from '../../ui/dom.js';

export function render(panel) {
  setHtml(panel, html`<div class="card"><p class="muted">Ingredientes</p></div>`);
  return { destroy() {} };
}
