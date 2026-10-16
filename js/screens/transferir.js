// js/screens/transferir.js — "Copiar minhas receitas" (Safari) and
// "Colar minhas receitas" (installed app on iPhone, which starts with its
// own empty storage). Through the clipboard: no server, works offline.

import { exportAllData, importBackup } from '../storage.js';
import { encodeTransfer, decodeTransfer } from '../transferencia.js';

export async function copiarReceitas() {
  try {
    await navigator.clipboard.writeText(encodeTransfer(exportAllData({ marcarBackup: false })));
    return true;
  } catch {
    return false;
  }
}

// The clipboard text, or null when the browser refused to read it (then
// the screen offers a field to paste into by hand).
export async function lerAreaDeTransferencia() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

// importBackup's summary, or null when the text has no copied recipes.
export function trazerReceitas(texto) {
  const data = decodeTransfer(texto);
  return data ? importBackup(data) : null;
}

export const MSG_COPIADO = 'Receitas copiadas! Agora adicione à Tela de Início e, no app, toque em "Colar minhas receitas".';
export const MSG_NAO_COPIOU = 'Não deu para copiar. Use Ajustes → Exportar backup e importe o arquivo no app.';
export const MSG_NADA_COPIADO = 'Não encontrei receitas copiadas. No Safari, toque em "Copiar minhas receitas" e tente de novo.';
export const msgTrouxe = (r) => (r.receitasImportadas > 0
  ? `${r.receitasImportadas} receita(s) trazida(s) do Safari.`
  : 'Essas receitas já estavam aqui.');
