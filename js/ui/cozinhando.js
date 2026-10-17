// js/ui/cozinhando.js
//
// Modo cozinhando: one step at a time, big text, screen kept on (Wake
// Lock, best-effort — silently does nothing where unsupported) and an
// optional countdown when the step's own text implies one ("asse por 40
// minutos", see js/cozinhando.js). Moving to another step always stops
// the countdown: it belongs to the step you were reading, not a
// background timer that keeps going once you've moved on.

import { detectarDuracaoMs, formatarDuracao } from '../cozinhando.js';
import { html, setHtml } from './dom.js';

export function abrirCozinhando({ nome, passos, onRequestClose, onClose }) {
  const root = document.getElementById('overlay-root');
  const previousFocus = document.activeElement;

  const el = document.createElement('div');
  el.className = 'cozinhar';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', `Modo cozinhando: ${nome}`);
  el.tabIndex = -1;
  root.append(el);
  document.body.classList.add('no-scroll');

  let indice = 0;
  let wakeLock = null;
  let timerId = null;
  let restanteMs = null; // null: cronômetro não iniciado para este passo
  let rodando = false;
  let closed = false;
  let closeRequested = false;

  async function pedirWakeLock() {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  }
  function soltarWakeLock() {
    wakeLock?.release?.().catch(() => {});
    wakeLock = null;
  }
  function aoMudarVisibilidade() {
    if (document.visibilityState === 'visible' && !closed) pedirWakeLock();
  }

  function pararCronometro() {
    if (timerId != null) { clearInterval(timerId); timerId = null; }
    rodando = false;
  }
  function correr(duracaoMs) {
    rodando = true;
    const fim = Date.now() + duracaoMs;
    timerId = setInterval(() => {
      restanteMs = fim - Date.now();
      if (restanteMs <= 0) {
        restanteMs = 0;
        pararCronometro();
        navigator.vibrate?.([200, 100, 200, 100, 200]);
      }
      render();
    }, 250);
  }
  function irParaPasso(novoIndice) {
    indice = novoIndice;
    pararCronometro();
    restanteMs = null;
    render();
  }

  function render() {
    const passo = passos[indice];
    const duracao = detectarDuracaoMs(passo);
    setHtml(el, html`
      <header class="cozinhar-head">
        <button type="button" class="icon-btn outlined" data-action="fechar" aria-label="Sair do modo cozinhando">×</button>
        <span class="cozinhar-titulo">${nome}</span>
        <span class="cozinhar-passo-num">${indice + 1} / ${passos.length}</span>
      </header>
      <div class="cozinhar-corpo">
        <p class="cozinhar-texto">${passo}</p>
        ${duracao != null ? html`
          <div class="cozinhar-timer${restanteMs === 0 ? ' cozinhar-timer-fim' : ''}">
            <span class="cozinhar-timer-valor">${formatarDuracao(restanteMs ?? duracao)}</span>
            ${restanteMs == null
              ? html`<button type="button" class="btn btn-secondary" data-action="iniciar" data-ms="${duracao}">⏱ Iniciar cronômetro</button>`
              : rodando
                ? html`<button type="button" class="btn btn-secondary" data-action="pausar">Pausar</button>`
                : html`<div class="cozinhar-timer-acoes">
                    <button type="button" class="btn btn-secondary" data-action="retomar" ${restanteMs === 0 ? 'disabled' : ''}>Retomar</button>
                    <button type="button" class="btn-link" data-action="zerar">Reiniciar</button>
                  </div>`}
          </div>` : ''}
      </div>
      <footer class="cozinhar-nav">
        ${indice > 0 ? html`<button type="button" class="btn btn-secondary" data-action="anterior">← Anterior</button>` : ''}
        ${indice < passos.length - 1
          ? html`<button type="button" class="btn btn-primary" style="flex:1" data-action="proximo">Próximo →</button>`
          : html`<button type="button" class="btn btn-primary" style="flex:1" data-action="fechar">Concluir</button>`}
      </footer>`);
  }

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    if (action === 'fechar') requestClose();
    else if (action === 'anterior' && indice > 0) irParaPasso(indice - 1);
    else if (action === 'proximo' && indice < passos.length - 1) irParaPasso(indice + 1);
    else if (action === 'iniciar') { restanteMs = Number(btn.dataset.ms); correr(restanteMs); render(); }
    else if (action === 'pausar') { pararCronometro(); render(); }
    else if (action === 'retomar') { correr(restanteMs); render(); }
    else if (action === 'zerar') { pararCronometro(); restanteMs = null; render(); }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); requestClose(); }
    else if (e.key === 'ArrowRight' && indice < passos.length - 1) irParaPasso(indice + 1);
    else if (e.key === 'ArrowLeft' && indice > 0) irParaPasso(indice - 1);
  });
  document.addEventListener('visibilitychange', aoMudarVisibilidade);

  function requestClose() {
    if (closeRequested || closed) return;
    closeRequested = true;
    (onRequestClose ?? close)();
  }
  function close() {
    if (closed) return;
    closed = true;
    pararCronometro();
    soltarWakeLock();
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    el.remove();
    document.body.classList.remove('no-scroll');
    onClose?.();
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
  }

  pedirWakeLock();
  render();
  requestAnimationFrame(() => el.focus({ preventScroll: true }));

  return { close, requestClose, element: el };
}
