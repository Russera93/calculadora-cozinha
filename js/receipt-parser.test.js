import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceiptText, extractPackageSize } from './receipt-parser.js';

const one = (texto) => {
  const itens = parseReceiptText(texto);
  assert.equal(itens.length, 1, `esperava 1 item, veio ${JSON.stringify(itens)}`);
  return itens[0];
};

test('cupom numa linha: item, código de barras, quantidade × unitário e total', () => {
  assert.deepEqual(one('001 7891000100103 LEITE COND MOCA 395G 2 UN X 7,49 14,98'), {
    descricao: 'LEITE COND MOCA 395G', quantidade: 2, tamanho: 395, unidade: 'g', valorTotal: 14.98
  });
});

test('cupom em duas linhas, com código de tributo antes do total', () => {
  assert.deepEqual(one('002 7896005800027 CHOC PO 50% NESTLE 200G\n1,000 UN x 12,90 F1 12,90'), {
    descricao: 'CHOC PO 50% NESTLE 200G', quantidade: 1, tamanho: 200, unidade: 'g', valorTotal: 12.9
  });
});

test('item pesado: a quantidade em KG vira o tamanho da embalagem', () => {
  assert.deepEqual(one('003 2000123000000 BANANA PRATA\n0,875 KG X 6,99 6,12'), {
    descricao: 'BANANA PRATA', quantidade: 1, tamanho: 0.875, unidade: 'kg', valorTotal: 6.12
  });
});

test('dúzia de ovos: C/12 e DZ viram 12 unidades', () => {
  const ovos = one('OVOS BRANCOS GRANDES C/12 1 UN X 11,90 11,90');
  assert.equal(ovos.tamanho, 12);
  assert.equal(ovos.unidade, 'unidade');
  assert.deepEqual(extractPackageSize('OVOS VERMELHOS DZ'), { tamanho: 12, unidade: 'unidade' });
});

test('litro: 6 caixas de 1 L', () => {
  const leite = one('LEITE INTEGRAL ITALAC 1L 6 UN X 4,79 28,74');
  assert.deepEqual([leite.quantidade, leite.tamanho, leite.unidade, leite.valorTotal], [6, 1, 'l', 28.74]);
});

test('texto copiado da página da SEFAZ', () => {
  assert.deepEqual(one('MANTEIGA C/SAL AVIACAO 200G (Código: 7896051111111) Qtde.:1 UN: UN Vl. Unit.: 15,99 Vl. Total 15,99'), {
    descricao: 'MANTEIGA C/SAL AVIACAO 200G', quantidade: 1, tamanho: 200, unidade: 'g', valorTotal: 15.99
  });
});

test('OCR sujo: ponto como decimal, "un" minúsculo, tributo T18% no fim', () => {
  const farinha = one('004 FARINHA TRIGO DONA BENTA 1KG 2 un x 5.49 10.98 T18%');
  assert.deepEqual([farinha.descricao, farinha.quantidade, farinha.tamanho, farinha.unidade, farinha.valorTotal],
    ['FARINHA TRIGO DONA BENTA 1KG', 2, 1, 'kg', 10.98]);
  assert.equal(one('005 7891 ACUCAR REF 1KG 1 UN * 4,99 I1 4,99').valorTotal, 4.99);
});

test('linha simples sem quantidade: 1 unidade pelo valor', () => {
  assert.deepEqual(one('ACUCAR UNIAO REFINADO 1KG 4,99'), {
    descricao: 'ACUCAR UNIAO REFINADO 1KG', quantidade: 1, tamanho: 1, unidade: 'kg', valorTotal: 4.99
  });
});

test('sem total na linha: quantidade × unitário', () => {
  assert.equal(one('CREME LEITE 200G 3 UN X 3,50').valorTotal, 10.5);
});

test('rodapé, pagamento e cabeçalho não viram itens', () => {
  const texto = [
    'SUPERMERCADO BOM PRECO LTDA',
    'CNPJ: 12.345.678/0001-90 IE: 123456789',
    'CUPOM FISCAL ELETRONICO - SAT',
    '# COD DESC QTD UN VL UN R$ VL ITEM R$',
    '001 7891000100103 LEITE COND MOCA 395G 2 UN X 7,49 14,98',
    'TOTAL R$ 64,60',
    'SUBTOTAL 64,60',
    'DESCONTO 0,00',
    'CARTAO DEBITO 64,60',
    'TROCO 0,00',
    'Valor aproximado dos tributos R$ 12,30 (19,04%)',
    'QTD. TOTAL DE ITENS 6',
    'CPF DO CONSUMIDOR: 123.456.789-00',
    '15/10/2026 10:32:11'
  ].join('\n');
  const itens = parseReceiptText(texto);
  assert.deepEqual(itens.map((i) => i.descricao), ['LEITE COND MOCA 395G']);
});

test('vários itens em sequência, linhas em branco no meio', () => {
  const texto = '001 789 LEITE COND MOCA 395G 2 UN X 7,49 14,98\n\n002 789 CR LEITE NESTLE 200G\n1 UN X 3,99 3,99\n003 789 DETERGENTE YPE 500ML 1 UN X 2,49 2,49';
  assert.deepEqual(parseReceiptText(texto).map((i) => [i.descricao, i.valorTotal]), [
    ['LEITE COND MOCA 395G', 14.98], ['CR LEITE NESTLE 200G', 3.99], ['DETERGENTE YPE 500ML', 2.49]
  ]);
});

test('texto vazio ou sem itens', () => {
  assert.deepEqual(parseReceiptText(''), []);
  assert.deepEqual(parseReceiptText('   \n  OBRIGADO PELA PREFERENCIA\n'), []);
});

test('extractPackageSize: formatos de tamanho', () => {
  assert.deepEqual(extractPackageSize('LEITE COND 395G'), { tamanho: 395, unidade: 'g' });
  assert.deepEqual(extractPackageSize('REFRIGERANTE 1,5L'), { tamanho: 1.5, unidade: 'l' });
  assert.deepEqual(extractPackageSize('CREME DE LEITE 200 ML'), { tamanho: 200, unidade: 'ml' });
  assert.deepEqual(extractPackageSize('COCO RALADO 500GR'), { tamanho: 500, unidade: 'g' });
  assert.deepEqual(extractPackageSize('CORANTE 10MG'), { tamanho: 10, unidade: 'mg' });
  assert.deepEqual(extractPackageSize('LEITE 1 LT'), { tamanho: 1, unidade: 'l' });
  assert.deepEqual(extractPackageSize('OVOS C/30'), { tamanho: 30, unidade: 'unidade' });
  assert.deepEqual(extractPackageSize('OVOS CART 30'), { tamanho: 30, unidade: 'unidade' });
  assert.deepEqual(extractPackageSize('FERMENTO 3 UN 10G'), { tamanho: 10, unidade: 'g' });
  assert.equal(extractPackageSize('BANANA PRATA'), null);
  assert.equal(extractPackageSize('CHOC PO 50%'), null);
});

test('página da SEFAZ copiada com cabeçalho e itens quebrados em linhas', () => {
  const texto = [
    'SUPERMERCADO BOM PRECO LTDA',
    'CNPJ: 12.345.678/0001-90',
    'LEITE COND MOCA 395G',
    '(Código: 7891000100103)',
    'Qtde.:2  UN: UN  Vl. Unit.:  7,49',
    'Vl. Total',
    '14,98',
    'BANANA PRATA',
    '(Código: 2000123)',
    'Qtde.:0,875  UN: KG  Vl. Unit.:  6,99',
    'Vl. Total',
    '6,12',
    'Qtd. total de itens: 2',
    'Valor a pagar R$: 21,10'
  ].join('\n');
  const itens = parseReceiptText(texto);
  assert.equal(itens.length, 2);
  assert.equal(itens[0].descricao, 'LEITE COND MOCA 395G');
  assert.deepEqual([itens[0].quantidade, itens[0].tamanho, itens[0].valorTotal], [2, 395, 14.98]);
  assert.deepEqual(itens[1], { descricao: 'BANANA PRATA', quantidade: 1, tamanho: 0.875, unidade: 'kg', valorTotal: 6.12 });
});
