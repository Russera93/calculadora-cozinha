// js/screens/ajustes.js — settings sheet: theme and backup.

import { exportAllData, importBackup } from '../storage.js';
import { getThemePref, setThemePref } from '../theme.js';
import { html, toElement } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';

const THEME_OPTIONS = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];

function downloadBackup() {
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

  const sheet = openSheet({ title: 'Ajustes', content, onRequestClose, onClose });
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
    if (action === 'importar') fileInput.click();
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
