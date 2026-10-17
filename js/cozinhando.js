// js/cozinhando.js
//
// Modo cozinhando: pure helpers only (step navigation and the optional
// countdown a step's own text implies, e.g. "asse por 40 minutos"). The
// overlay itself (DOM, Wake Lock, the running timer) lives in
// js/ui/cozinhando.js, which is not unit-tested here.

// "40 min", "40min.", "5 minutos", "30-40 min" (the higher bound, so the
// timer never undercooks); "1h", "1h30", "1 hora e 30 minutos".
const HORAS_RE = /(\d+)\s*h(?:oras?)?\s*(?:e\s*)?(\d{1,2})?\s*(?:min\w*)?/i;
const MINUTOS_RE = /(\d+)\s*min\w*/i;

export function detectarDuracaoMs(passo) {
  const texto = String(passo ?? '');
  const h = texto.match(HORAS_RE);
  if (h) {
    const horas = Number(h[1]);
    const minutos = h[2] ? Number(h[2]) : 0;
    if (horas > 0 && horas <= 12) return (horas * 60 + minutos) * 60000;
  }
  const m = texto.match(MINUTOS_RE);
  if (m) {
    const minutos = Number(m[1]);
    if (minutos > 0 && minutos <= 300) return minutos * 60000;
  }
  return null;
}

export function formatarDuracao(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}
