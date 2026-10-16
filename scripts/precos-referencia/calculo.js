// scripts/precos-referencia/calculo.js
//
// Pure part of the weekly price robot: which catalog products count for an
// ingredient, their size, and the reference price (median of the typical
// package). Tested without network.

import { extractPackageSize } from '../../js/receipt-parser.js';
import { normalize } from '../../js/text-utils.js';

const FATOR = { g: ['g', 1], kg: ['g', 1000], mg: ['g', 0.001], ml: ['ml', 1], l: ['ml', 1000], unidade: ['unidade', 1] };

export function paraBase(tamanho, unidade) {
  const f = FATOR[unidade];
  return f ? { valor: tamanho * f[1], base: f[0] } : null;
}

export function lerTamanho(nome) {
  // "395gLata": the unit glued to the next word hides it from the parser.
  const tamanho = extractPackageSize(nome) || extractPackageSize(String(nome).replace(/(\d)(kg|mg|g|ml|l)(?=[a-zà-ú])/gi, '$1$2 '));
  if (tamanho) return tamanho;
  // Egg trays: "Com 30", "C/12".
  const contagem = String(nome).match(/\b(?:com|c\/)\s*(\d+)\b/i);
  return contagem ? { tamanho: Number(contagem[1]), unidade: 'unidade' } : null;
}

const palavras = (texto) => ` ${normalize(texto).replace(/[^a-z0-9]+/g, ' ').trim()} `;
const temFrase = (nome, frase) => nome.includes(palavras(frase));

const mediana = (valores) => {
  const s = [...valores].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function precoReferencia(config, produtos) {
  const tipica = paraBase(config.embalagem.tamanho, config.embalagem.unidade);
  const [min, max] = config.janela;
  const precos = [];
  for (const produto of produtos) {
    const nome = palavras(produto.productName || '');
    if (!config.incluir.every((f) => temFrase(nome, f))) continue;
    if (config.excluir.some((f) => temFrase(nome, f))) continue;
    const preco = produto.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
    if (!(preco > 0)) continue;
    const tamanho = lerTamanho(produto.productName);
    const base = tamanho && paraBase(tamanho.tamanho, tamanho.unidade);
    if (!base || base.base !== tipica.base || base.valor < min || base.valor > max) continue;
    precos.push((preco * tipica.valor) / base.valor);
  }
  if (precos.length < 2) return null;
  return {
    nome: config.nome,
    precoEmbalagem: Math.round(mediana(precos) * 100) / 100,
    tamanhoEmbalagem: config.embalagem.tamanho,
    unidadeEmbalagem: config.embalagem.unidade,
    produtos: precos.length
  };
}

export function montarSaida(entradas, { hoje, fonte }) {
  const precos = {};
  for (const e of entradas) if (e) precos[normalize(e.nome)] = e;
  return { atualizadoEm: hoje, fonte, precos };
}

export function passaProtecao(novo, anterior) {
  const n = Object.keys(novo.precos).length;
  if (!anterior) return n > 0;
  return n >= 0.7 * Object.keys(anterior.precos || {}).length;
}
