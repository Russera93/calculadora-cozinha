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

// Products that count for an ingredient, each priced as the typical
// package: words (whole words; `comeca` anchors the start of the name),
// readable size inside the window, a price. Printed by --detalhe.
export function produtosValidos(config, produtos) {
  const tipica = paraBase(config.embalagem.tamanho, config.embalagem.unidade);
  const [min, max] = config.janela;
  const validos = [];
  for (const produto of produtos) {
    const nome = palavras(produto.productName || '');
    if (config.comeca && !nome.startsWith(palavras(config.comeca))) continue;
    if (!config.incluir.every((f) => temFrase(nome, f))) continue;
    if (config.excluir.some((f) => temFrase(nome, f))) continue;
    const preco = produto.items?.[0]?.sellers?.[0]?.commertialOffer?.Price;
    if (!(preco > 0)) continue;
    const tamanho = lerTamanho(produto.productName);
    const base = tamanho && paraBase(tamanho.tamanho, tamanho.unidade);
    if (!base || base.base !== tipica.base || base.valor < min || base.valor > max) continue;
    validos.push({ nome: produto.productName, preco: Math.round(((preco * tipica.valor) / base.valor) * 100) / 100 });
  }
  return validos;
}

export function precoReferencia(config, produtos) {
  let precos = produtosValidos(config, produtos).map((v) => v.preco);
  if (precos.length < 2) return null;
  // Drop outliers (a junk R$ 9,50 "1 kg", an imported premium bar).
  const m = mediana(precos);
  precos = precos.filter((v) => v >= m / 2 && v <= m * 2);
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

// A search that errored this week keeps last week's entry, so one bad
// request never drops an ingredient (and protection can't ratchet down).
export function manterFalhas(saida, anterior, nomesComErro) {
  for (const nome of nomesComErro) {
    const key = normalize(nome);
    if (!saida.precos[key] && anterior?.precos?.[key]) saida.precos[key] = anterior.precos[key];
  }
  return saida;
}
