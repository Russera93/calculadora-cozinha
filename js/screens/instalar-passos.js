// js/screens/instalar-passos.js — the install texts shared by the card on
// top of the list and the Ajustes sheet.

import { html, raw } from '../ui/dom.js';
import { SHARE_IOS_ICON } from '../ui/icons.js';

// levarReceitas: on iPhone the installed app starts empty, so when Safari
// already has recipes the steps start by copying them and end by pasting.
export function iosPassosHtml({ levarReceitas = false } = {}) {
  return html`
    ${levarReceitas ? html`
      <p class="muted" style="margin-top:8px">No iPhone o app instalado começa vazio. Primeiro leve suas receitas junto:</p>
      <button type="button" class="btn btn-secondary btn-block" data-action="copiar-receitas" style="margin-top:8px">📋 Copiar minhas receitas</button>` : ''}
    <ol class="passos">
      <li>Toque em <strong>Compartilhar</strong> ${raw(SHARE_IOS_ICON)} na barra do Safari</li>
      <li>Escolha <strong>"Adicionar à Tela de Início"</strong></li>
      <li>Toque em <strong>Adicionar</strong></li>
      ${levarReceitas ? html`<li>Abra o Doce Lucro pela Tela de Início e toque em <strong>"Colar minhas receitas"</strong></li>` : ''}
    </ol>`;
}

// Installed app on iPhone, still empty: bring the recipes copied in Safari.
export function trazerHtml() {
  return html`
    <button type="button" class="btn btn-primary btn-block" data-action="colar-receitas" style="margin-top:8px">📋 Colar minhas receitas</button>
    <div data-colar-manual hidden>
      <label class="field" style="margin-top:8px"><span class="field-label">Toque e segure no campo e escolha "Colar"</span>
        <textarea class="input nota-texto" data-texto-transferencia rows="3"></textarea></label>
      <button type="button" class="btn btn-secondary btn-block" data-action="trazer-texto">Trazer receitas</button>
    </div>
    <p class="ing-row-issue" data-erro-transferencia role="alert"></p>`;
}

export const POR_QUE_INSTALAR = 'Abre como um app, com ícone na tela inicial, funciona sem internet — e o celular não apaga suas receitas.';
