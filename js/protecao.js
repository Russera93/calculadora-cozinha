// js/protecao.js — which card, if any, goes on top of the recipe list.
// Everything lives only in this browser: iOS deletes a website's data after
// 7 days without a visit unless it is installed on the home screen, and any
// browser loses it when site data is cleared. So: first offer to install
// the app (one tap where the browser allows it, steps on iPhone), then
// remind about the backup. One card at a time. The rule is pure (tested);
// lista.js supplies the environment.

const DIA = 86400000;
const BACKUP_VELHO_DIAS = 30;
const MIN_RECEITAS_BACKUP = 3;
export const DISPENSA_INSTALAR_DIAS = 30;
export const DISPENSA_BACKUP_DIAS = 14;

const dispensado = (ate, agora) => ate != null && Date.parse(ate) > agora;

export function listNotice({
  isIOS, standalone, podeInstalar, totalReceitas, ultimoBackup,
  instalarDispensadoAte, backupDispensadoAte, agora
}) {
  if (!standalone && !dispensado(instalarDispensadoAte, agora)) {
    if (podeInstalar) return 'instalar';
    if (isIOS) return 'ios';
  }
  if (totalReceitas >= MIN_RECEITAS_BACKUP && !dispensado(backupDispensadoAte, agora)) {
    const ultimo = ultimoBackup ? Date.parse(ultimoBackup) : NaN;
    if (Number.isNaN(ultimo) || agora - ultimo > BACKUP_VELHO_DIAS * DIA) return 'backup';
  }
  return null;
}

export function dispensaAte(agora, dias) {
  return new Date(agora + dias * DIA).toISOString();
}
