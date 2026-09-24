import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nutritionPerPortion, nutritionRows, nutritionTableHtml } from './nutrition-table.js';
import { unwrap } from './ui/dom.js';

const ovos = { nome: 'Ovos', quantidadeBruta: '2', unidade: 'unidade', pesoUnidadeG: 50, densidadeGml: null,
  nutricao100g: { kcal: 155, carboidratos: 1.1, proteinas: 13, gorduras: 11, fibras: 0, sodio: 124 } };

test('nutritionPerPortion: grams from each ingredient, divided by yield', () => {
  const r = nutritionPerPortion({ rendimento: 2, ingredientes: [ovos] });
  assert.equal(r.kcal, 77.5); // 100 g of egg = 155 kcal, 2 portions
  assert.equal(r.pesoPorcao, 50);
  assert.equal(r.ingredientesSemDados, 0);
});

test('nutritionPerPortion: unconvertible ingredient counts as "sem dados"; blank rows ignored', () => {
  const r = nutritionPerPortion({ rendimento: 1, ingredientes: [ovos, { ...ovos, nome: 'X', unidade: 'xicara', densidadeGml: null }, { ...ovos, nome: '' }] });
  assert.equal(r.ingredientesSemDados, 1);
});

test('nutritionPerPortion: invalid yield returns null', () => {
  assert.equal(nutritionPerPortion({ rendimento: 0, ingredientes: [ovos] }), null);
});

test('nutritionRows: per 100 g derived from portion weight, %VD rounded', () => {
  const rows = nutritionRows(nutritionPerPortion({ rendimento: 2, ingredientes: [ovos] }));
  const kcal = rows.find((r) => r.label === 'Valor energético');
  assert.equal(kcal.por100g, 155);
  assert.equal(kcal.porPorcao, 77.5);
  assert.equal(kcal.vd, 4);
  assert.equal(rows.length, 8);
});

test('nutritionTableHtml: title, portion, disclaimer and warnings', () => {
  const out = unwrap(nutritionTableHtml(nutritionPerPortion({ rendimento: 2, ingredientes: [ovos] }), 2));
  assert.ok(out.includes('Informação Nutricional'));
  assert.ok(out.includes('Porção: 50 g'));
  assert.ok(out.includes('não substitui laudo laboratorial'));
  assert.ok(out.includes('Gorduras saturadas: somadas apenas'));
});
