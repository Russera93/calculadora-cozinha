// js/receipt-parser.js
//
// Turns the text of a store receipt (OCR of a photo, or text pasted from
// an e-mailed NFC-e / the SEFAZ page) into purchased items. Pure, so it is
// unit-tested against real-world line shapes; OCR noise (dot as decimal,
// lowercase "x", tax codes glued to the total) is tolerated on purpose,
// and whatever still comes out wrong is fixed on the review screen.

import { normalize } from './text-utils.js';

const MONEY = String.raw`\d+(?:\.\d{3})*[.,]\d{2}`;
const QTY = String.raw`\d+(?:[.,]\d{1,3})?`;
const LINE_UNIT = String.raw`UN|UND|UNID|UNIDADE|KG|GR|G|L|LT|PC|PCT|CX|DZ|FD|SC`;

// "2 UN X 7,49 …" — quantity, unit, multiplier, unit price.
const QTY_PRICE_RE = new RegExp(String.raw`(?:^|\s)(${QTY})\s*(${LINE_UNIT})?\.?\s*[X*]\s*(${MONEY})(?![\d%])`);
// A money value that is not a percentage ("T18,00%").
const MONEY_ANYWHERE_RE = new RegExp(String.raw`(?<![\d.,])(${MONEY})(?![\d%]|[.,]\d)`, 'g');
const TRAILING_MONEY_RE = new RegExp(String.raw`^(.*\S)\s+(?:R\$\s*)?(${MONEY})\s*$`);

// Header, footer and payment lines (checked on the accent-free, lowercase text).
const NOT_AN_ITEM_RE = new RegExp([
  String.raw`^(sub)?total\b`, String.raw`\btotal r\$`, String.raw`\btroco\b`, String.raw`\bdinheiro\b`,
  String.raw`\bcartao\b`, String.raw`\bcredito\b`, String.raw`\bdebito\b`, String.raw`\bpix\b`,
  String.raw`\bdesconto\b`, String.raw`\bacrescimo\b`, String.raw`\bcpf\b`, String.raw`\bcnpj\b`,
  String.raw`\bie:`, String.raw`\btributos?\b`, String.raw`\bvalor aproximado\b`, String.raw`\bitens\b`,
  String.raw`\bforma de pagamento\b`, String.raw`\bconsumidor\b`, String.raw`\bvl item\b`,
  String.raw`\bvalor (a )?pag`, String.raw`\bcupom\b`, String.raw`\bnfc-?e\b`, String.raw`\bsat\b`,
  String.raw`\bchave de acesso\b`, String.raw`\bprotocolo\b`, String.raw`\boperador\b`, String.raw`\bextrato\b`
].join('|'));

const round2 = (n) => Math.round(n * 100) / 100;

function parseMoney(text) {
  return text.includes(',') ? Number(text.replace(/\./g, '').replace(',', '.')) : Number(text);
}

function parseQty(text) {
  return Number(text.replace(',', '.'));
}

// Drops item number and barcode from the start, "R$"/dashes from the end.
function cleanDescription(text) {
  let out = text.trim();
  for (let i = 0; i < 3; i += 1) out = out.replace(/^(?:#|\d{1,14})\s+/, '');
  return out.replace(/\s*(?:R\$|[-–=:])\s*$/, '').replace(/\s+/g, ' ').trim();
}

const hasLetters = (text) => (text.match(/\p{L}/gu) || []).length >= 3;
const isNotAnItem = (line) => NOT_AN_ITEM_RE.test(normalize(line));

const WEIGHT_VOLUME = { KG: 'kg', KGS: 'kg', G: 'g', GR: 'g', GRS: 'g', GRAMAS: 'g', MG: 'mg', ML: 'ml', L: 'l', LT: 'l', LTS: 'l', LITRO: 'l', LITROS: 'l' };
const SIZE_RE = /(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s?(KGS?|GRAMAS|GRS?|G|MG|ML|LITROS?|LTS?|L)(?![\p{L}])/gu;

// Package size written in the product name: "395G", "1,5L", "C/12", "DZ".
export function extractPackageSize(descricao) {
  const text = String(descricao ?? '').toUpperCase();
  const sizes = [...text.matchAll(SIZE_RE)];
  if (sizes.length) {
    const [, valor, unidade] = sizes[sizes.length - 1];
    return { tamanho: parseQty(valor), unidade: WEIGHT_VOLUME[unidade] };
  }
  const pieces = text.match(/\bC\/\s?(\d+)\b/) || text.match(/\bCART(?:ELA)?\.?\s?(\d+)\b/) || text.match(/\b(\d+)\s?(?:UN|UND|UNID|UNIDADES)\b/);
  if (pieces) return { tamanho: Number(pieces[1]), unidade: 'unidade' };
  if (/\b(?:DZ|DUZIA)\b/.test(normalize(text).toUpperCase())) return { tamanho: 12, unidade: 'unidade' };
  return null;
}

function makeItem(descricao, quantidade, unidadeLinha, valorTotal) {
  // Sold by weight ("0,875 KG X 6,99"): what was weighed is the package.
  if (unidadeLinha === 'KG' || unidadeLinha === 'G' || unidadeLinha === 'GR') {
    return { descricao, quantidade: 1, tamanho: quantidade, unidade: unidadeLinha === 'KG' ? 'kg' : 'g', valorTotal: round2(valorTotal) };
  }
  const size = extractPackageSize(descricao);
  return {
    descricao,
    quantidade,
    tamanho: size ? size.tamanho : null,
    unidade: size ? size.unidade : null,
    valorTotal: round2(valorTotal)
  };
}

// Text copied from the SEFAZ NFC-e page:
// "NOME (Código: 789…) Qtde.:2 UN: UN Vl. Unit.: 7,49 Vl. Total 14,98",
// often broken across lines — so it is matched on the joined text, with
// "¶" marking where the lines were (the name is the last line before
// "(Código", never the page header above it).
const S = String.raw`[\s¶]*`;
const SEFAZ_RE = new RegExp(
  String.raw`([^]*?)\(${S}C[OÓ]DIGO${S}:?${S}\d*${S}\)${S}QTDE\.?${S}:?${S}(${QTY})${S}UN${S}:?${S}([A-Z]*)${S}VL\.?${S}UNIT\.?${S}:?${S}(${MONEY})${S}VL\.?${S}TOTAL${S}:?${S}(${MONEY})`,
  'g'
);

function parseSefaz(text) {
  const joined = text.toUpperCase().split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).join(' ¶ ');
  const itens = [];
  for (const m of joined.matchAll(SEFAZ_RE)) {
    const linhas = m[1].split('¶').map(cleanDescription).filter(hasLetters);
    const descricao = linhas.length ? linhas[linhas.length - 1] : '';
    if (!descricao || isNotAnItem(descricao)) continue;
    itens.push(makeItem(descricao, parseQty(m[2]), m[3], parseMoney(m[5])));
  }
  return itens;
}

export function parseReceiptText(texto) {
  const text = String(texto ?? '');
  if (/QTDE\.?\s*:/i.test(text)) {
    const sefaz = parseSefaz(text);
    if (sefaz.length) return sefaz;
  }

  const itens = [];
  // A line with only the product name, waiting for its "2 UN X 7,49" line.
  let pendente = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.toUpperCase().replace(/\s+/g, ' ').trim();
    if (!line) continue;
    if (isNotAnItem(line)) { pendente = null; continue; }

    const qp = line.match(QTY_PRICE_RE);
    if (qp) {
      const quantidade = parseQty(qp[1]);
      const unitario = parseMoney(qp[3]);
      const resto = line.slice(qp.index + qp[0].length);
      const totais = [...resto.matchAll(MONEY_ANYWHERE_RE)];
      const valorTotal = totais.length ? parseMoney(totais[totais.length - 1][1]) : quantidade * unitario;
      let descricao = cleanDescription(line.slice(0, qp.index));
      if (!hasLetters(descricao)) descricao = pendente ?? '';
      pendente = null;
      if (descricao && quantidade > 0) itens.push(makeItem(descricao, quantidade, qp[2] ?? null, valorTotal));
      continue;
    }

    const simple = line.match(TRAILING_MONEY_RE);
    if (simple) {
      const descricao = cleanDescription(simple[1]);
      pendente = null;
      if (hasLetters(descricao)) itens.push(makeItem(descricao, 1, null, parseMoney(simple[2])));
      continue;
    }

    pendente = hasLetters(line) ? cleanDescription(line) : null;
  }
  return itens;
}
