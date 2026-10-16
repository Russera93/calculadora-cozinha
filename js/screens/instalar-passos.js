// js/screens/instalar-passos.js — the install texts shared by the card on
// top of the list and the Ajustes sheet.

import { html, raw } from '../ui/dom.js';
import { SHARE_IOS_ICON } from '../ui/icons.js';

export function iosPassosHtml() {
  return html`
    <ol class="passos">
      <li>Toque em <strong>Compartilhar</strong> ${raw(SHARE_IOS_ICON)} na barra do Safari</li>
      <li>Escolha <strong>"Adicionar à Tela de Início"</strong></li>
      <li>Toque em <strong>Adicionar</strong></li>
    </ol>`;
}

export const POR_QUE_INSTALAR = 'Abre como um app, com ícone na tela inicial, funciona sem internet — e o celular não apaga suas receitas.';
