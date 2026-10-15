// js/negocio.js — "Meu negócio": set once, used by every recipe.
// The monthly pay goal and the hours worked give the value of an hour;
// fixed monthly bills are spread over those same hours, so a recipe that
// takes 2 h carries 2 h of both. Sale fees come off the price per channel.

export const CONTAS_FIXAS = [
  ['luz', 'Luz'],
  ['agua', 'Água'],
  ['internet', 'Internet / telefone'],
  ['aluguel', 'Aluguel'],
  ['mei', 'MEI (DAS)'],
  ['outros', 'Outros']
];

export const CANAIS = [
  ['direto', 'Pix / dinheiro'],
  ['maquininha', 'Maquininha'],
  ['ifood', 'iFood']
];

export const NEGOCIO_PADRAO = {
  ganhoMensal: 0,
  horasSemana: 0,
  contasFixas: Object.fromEntries(CONTAS_FIXAS.map(([key]) => [key, 0])),
  taxaMaquininha: 0,
  taxaIfood: 0,
  lucroExtra: 20
};

const SEMANAS_POR_MES = 52 / 12;
const TAXA_MAX = 90;

const nonNegative = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

export function normalizeNegocio(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const contas = r.contasFixas && typeof r.contasFixas === 'object' ? r.contasFixas : {};
  return {
    ganhoMensal: nonNegative(r.ganhoMensal),
    horasSemana: nonNegative(r.horasSemana),
    contasFixas: Object.fromEntries(CONTAS_FIXAS.map(([key]) => [key, nonNegative(contas[key])])),
    taxaMaquininha: Math.min(nonNegative(r.taxaMaquininha), TAXA_MAX),
    taxaIfood: Math.min(nonNegative(r.taxaIfood), TAXA_MAX),
    lucroExtra: nonNegative(r.lucroExtra, NEGOCIO_PADRAO.lucroExtra)
  };
}

export function horasPorMes(n) {
  return n.horasSemana * SEMANAS_POR_MES;
}

export function isConfigurado(n) {
  return n.ganhoMensal > 0 && n.horasSemana > 0;
}

export function valorHora(n) {
  const horas = horasPorMes(n);
  return horas > 0 ? n.ganhoMensal / horas : 0;
}

export function totalFixos(n) {
  return Object.values(n.contasFixas).reduce((sum, v) => sum + v, 0);
}

export function fixosPorHora(n) {
  const horas = horasPorMes(n);
  return horas > 0 ? totalFixos(n) / horas : 0;
}

// Fraction (0..0.9) of the sale price the channel keeps.
export function taxaDoCanal(n, canal) {
  if (canal === 'maquininha') return n.taxaMaquininha / 100;
  if (canal === 'ifood') return n.taxaIfood / 100;
  return 0;
}
