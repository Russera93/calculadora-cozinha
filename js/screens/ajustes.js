// js/screens/ajustes.js — settings sheet: install the app, theme and backup.

import { exportAllData, importBackup, getRecipes } from '../storage.js';
import { getThemePref, setThemePref } from '../theme.js';
import { html, setHtml, toElement } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { podeInstalar, instalar, onInstallChange, isIOSDevice, isStandalone } from '../instalar.js';
import { iosPassosHtml, trazerHtml, POR_QUE_INSTALAR } from './instalar-passos.js';
import { copiarReceitas, lerAreaDeTransferencia, trazerReceitas, MSG_COPIADO, MSG_NAO_COPIOU, MSG_NADA_COPIADO, msgTrouxe } from './transferir.js';
import { navigate } from '../router.js';

const THEME_OPTIONS = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `calculadora-cozinha-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openAjustesSheet({ onRequestClose, onClose, onDataChanged }) {
  const pref = getThemePref();
  const content = toElement(html`
    <div>
      <h2 class="sheet-title">Ajustes</h2>
      <p class="sheet-section">App no celular</p>
      <div data-instalar></div>
      <p class="sheet-section">Preços</p>
      <button type="button" class="btn btn-secondary btn-block" data-action="meus-ingredientes">🧂 Meus ingredientes</button>
      <p class="sheet-section">Vender</p>
      <button type="button" class="btn btn-secondary btn-block" data-action="cardapio">🛍️ Cardápio para o cliente</button>
      <p class="sheet-section">Tema</p>
      <div class="chips" role="group" aria-label="Tema">
        ${THEME_OPTIONS.map(([value, label]) => html`<button type="button" class="chip" data-theme-pref="${value}" aria-pressed="${pref === value}">${label}</button>`)}
      </div>
      <p class="sheet-section">Backup</p>
      <p class="muted">Suas receitas ficam guardadas só neste aparelho. Exporte um backup para não perder nada ou para passar para outro celular.</p>
      <div class="stack" style="margin-top:12px">
        <button type="button" class="btn btn-secondary btn-block" data-action="exportar">Exportar backup</button>
        <button type="button" class="btn btn-secondary btn-block" data-action="importar">Importar backup</button>
        <input type="file" accept="application/json,.json" hidden data-file>
        <p class="muted" data-import-result role="status"></p>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-block" data-action="fechar">Fechar</button>
      </div>
    </div>`);

  const instalarSlot = content.querySelector('[data-instalar]');
  function renderInstalar() {
    if (isStandalone()) {
      setHtml(instalarSlot, html`<p class="muted">✓ O app já está instalado neste aparelho.</p>
        ${isIOSDevice() ? html`<p class="muted" style="margin-top:8px">Receitas que ficaram no Safari: copie lá e cole aqui.</p>${trazerHtml()}` : ''}`);
    } else if (podeInstalar()) {
      setHtml(instalarSlot, html`<p class="muted">${POR_QUE_INSTALAR}</p>
        <button type="button" class="btn btn-primary btn-block" data-action="instalar" style="margin-top:8px">📲 Instalar o app</button>`);
    } else if (isIOSDevice()) {
      setHtml(instalarSlot, html`<p class="muted">${POR_QUE_INSTALAR}</p>${iosPassosHtml({ levarReceitas: getRecipes().length > 0 })}`);
    } else {
      setHtml(instalarSlot, html`<p class="muted">${POR_QUE_INSTALAR} No menu do navegador (⋮), toque em "Instalar app" ou "Adicionar à tela inicial".</p>`);
    }
  }
  renderInstalar();

  function aplicarTransferencia(texto) {
    const r = trazerReceitas(texto);
    if (!r) {
      content.querySelector('[data-erro-transferencia]').textContent = MSG_NADA_COPIADO;
      return;
    }
    showToast(msgTrouxe(r));
    onDataChanged?.();
  }
  const offInstall = onInstallChange(renderInstalar);

  const sheet = openSheet({ title: 'Ajustes', content, onRequestClose, onClose: () => { offInstall(); onClose?.(); } });
  const fileInput = content.querySelector('[data-file]');
  const result = content.querySelector('[data-import-result]');

  content.addEventListener('click', (e) => {
    const themeButton = e.target.closest('[data-theme-pref]');
    if (themeButton) {
      setThemePref(themeButton.dataset.themePref);
      for (const b of content.querySelectorAll('[data-theme-pref]')) b.setAttribute('aria-pressed', String(b === themeButton));
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'exportar') downloadBackup();
    if (action === 'copiar-receitas') copiarReceitas().then((ok) => showToast(ok ? MSG_COPIADO : MSG_NAO_COPIOU));
    if (action === 'colar-receitas') {
      lerAreaDeTransferencia().then((texto) => {
        if (texto == null) content.querySelector('[data-colar-manual]').hidden = false;
        else aplicarTransferencia(texto);
      });
    }
    if (action === 'trazer-texto') aplicarTransferencia(content.querySelector('[data-texto-transferencia]').value);
    if (action === 'instalar') {
      instalar().then((aceitou) => { if (aceitou) showToast('Pronto! O app está na tela inicial do seu celular.'); renderInstalar(); });
    }
    if (action === 'importar') fileInput.click();
    if (action === 'meus-ingredientes') navigate({ screen: 'meus-ingredientes' });
    if (action === 'cardapio') navigate({ screen: 'cardapio' });
    if (action === 'fechar') sheet.requestClose();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // allow picking the same file again
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      result.textContent = 'Arquivo inválido — não foi possível ler o backup.';
      return;
    }
    const r = importBackup(data);
    result.textContent = `Importação concluída: ${r.receitasImportadas} receita(s) adicionada(s), ${r.receitasIgnoradas} já existiam; ` +
      `${r.ingredientesImportados} ingrediente(s) adicionado(s), ${r.ingredientesIgnorados} já existiam.`;
    onDataChanged?.();
  });

  return sheet;
}
