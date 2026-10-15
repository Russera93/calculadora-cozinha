// js/protecao.js — when to warn that recipes could be lost. Everything
// lives only in this browser: iOS deletes a website's data after 7 days
// without a visit unless it is installed on the home screen, and any
// browser loses it when site data is cleared. The rule is pure (tested);
// lista.js supplies the environment.

const DIA = 86400000;
const BACKUP_VELHO_DIAS = 30;
const MIN_RECEITAS_BACKUP = 3;
export const DISPENSA_DIAS = 14;

export function protectionNotice({ isIOS, standalone, totalReceitas, ultimoBackup, dispensadoAte, agora }) {
  if (dispensadoAte && Date.parse(dispensadoAte) > agora) return null;
  if (totalReceitas === 0) return null;
  if (isIOS && !standalone) return 'ios';
  if (totalReceitas >= MIN_RECEITAS_BACKUP) {
    const ultimo = ultimoBackup ? Date.parse(ultimoBackup) : NaN;
    if (Number.isNaN(ultimo) || agora - ultimo > BACKUP_VELHO_DIAS * DIA) return 'backup';
  }
  return null;
}

export function dispensaAte(agora) {
  return new Date(agora + DISPENSA_DIAS * DIA).toISOString();
}
