import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validarCatalogo, nomesForaDaLista, medidaTexto, rendeTexto, contarIngredientes,
  agruparPorSecao, criarReceitaDePronta
} from './receitas-prontas.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/receitas-prontas.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(fixture);
const brigadeiro = () => clone().receitas[0];
const coxinha = () => clone().receitas[1];
const base = () => ({
  id: 'recipe:novo', nome: '', rendimento: 1, ingredientes: [], modoPreparo: [], embalagemUnitaria: 0,
  quantidadeEmbalagens: 1, tempoPreparoMinutos: 0, valorBotijao: 120, precoVendaDesejado: null,
  canalVenda: 'direto', criadoEm: 'x', atualizadoEm: 'x'
});
const TACO = [{ id: 'taco:coco-ralado-seco', nome: 'Coco ralado seco', densidadeGml: 0.55, nutricao100g: { kcal: 600 } }];
const opts = (extra = {}) => ({ existentes: [], custom: [], precoDe: () => null, taco: TACO, base: base(), ...extra });

test('validarCatalogo: the fixture is valid', () => {
  assert.deepEqual(validarCatalogo(fixture), []);
});

test('validarCatalogo: reports each kind of problem', () => {
  const data = clone();
  const r = data.receitas[0];
  r.id = 'Brigadeiro Bom';
  r.categoria = 'nao-existe';
  r.rendimento = 0;
  r.ingredientes[0].unidade = 'lata';
  r.ingredientes[1].quantidade = 'um pouco';
  r.preparo = [];
  data.receitas[1].id = 'Brigadeiro Bom';
  const p = validarCatalogo(data).join('\n');
  for (const trecho of ['id inválido', 'id repetido', 'categoria "nao-existe"', 'rendimento', 'unidade "lata"', 'quantidade "um pouco"', 'modo de preparo vazio']) {
    assert.ok(p.includes(trecho), `faltou: ${trecho}\n${p}`);
  }
  assert.deepEqual(validarCatalogo({}), ['formato: faltam "categorias" e "receitas"']);
  assert.ok(validarCatalogo({ categorias: [], receitas: [{ id: 'x', nome: 'X', categoria: 'y', rendimento: 1, ingredientes: [], preparo: ['a'] }] }).some((s) => s.includes('sem ingredientes')));
});

test('nomesForaDaLista: names missing from the suggestions list, once each (accents/case aside)', () => {
  const data = { categorias: [], receitas: [{ ingredientes: [
    { nome: 'Manteiga' }, { nome: 'Ingrediente Raro' }, { nome: 'ingrediente raro' }, { nome: 'Açúcar' }
  ] }] };
  assert.deepEqual(nomesForaDaLista(data), ['Ingrediente Raro']);
});

test('medidaTexto / rendeTexto / contarIngredientes', () => {
  assert.equal(medidaTexto({ quantidade: '1', unidade: 'colherSopa' }), '1 colher de sopa');
  assert.equal(medidaTexto({ quantidade: '2 1/2', unidade: 'xicara' }), '2 1/2 xícaras');
  assert.equal(medidaTexto({ quantidade: '500', unidade: 'g' }), '500 g');
  assert.equal(rendeTexto(brigadeiro()), 'Rende 30 docinhos');
  assert.equal(rendeTexto(coxinha()), 'Rende 25 unidades');
  assert.equal(rendeTexto({ rendimento: 1 }), 'Rende 1 unidade');
  const repetido = coxinha();
  repetido.ingredientes.push({ nome: 'farinha de trigo', quantidade: '1', unidade: 'xicara' });
  assert.equal(contarIngredientes(repetido), 4);
});

test('agruparPorSecao: groups in order of first appearance; no sections = one group', () => {
  const grupos = agruparPorSecao(coxinha().ingredientes);
  assert.deepEqual(grupos.map((g) => g.secao), ['Massa', 'Recheio']);
  assert.deepEqual(grupos[0].itens.map((i) => i.nome), ['Água', 'Farinha de trigo', 'Sal']);
  assert.deepEqual(agruparPorSecao(brigadeiro().ingredientes).map((g) => g.secao), [null]);
});

test('criarReceitaDePronta: name, yield, packages, steps, origin, base fields kept', () => {
  const r = criarReceitaDePronta(brigadeiro(), opts());
  assert.equal(r.id, 'recipe:novo');
  assert.equal(r.nome, 'Brigadeiro tradicional');
  assert.equal(r.rendimento, 30);
  assert.equal(r.quantidadeEmbalagens, 30);
  assert.deepEqual(r.modoPreparo, ['Junte tudo na panela.', 'Mexa até desgrudar.', 'Enrole.']);
  assert.equal(r.origem, 'brigadeiro');
  assert.equal(r.valorBotijao, 120);
  assert.deepEqual(r.ingredientes.map((i) => [i.nome, i.quantidadeBruta, i.unidade]), [
    ['Leite condensado', '1', 'unidade'], ['Manteiga', '1', 'colherSopa'], ['Chocolate em pó', '4', 'colherSopa'], ['Coco ralado', '1/2', 'xicara']
  ]);
});

test('criarReceitaDePronta: an existing name (accents/case aside) gets "(cópia)"', () => {
  const r = criarReceitaDePronta(brigadeiro(), opts({ existentes: [{ nome: 'BRIGADEIRO TRADICIONAL' }] }));
  assert.equal(r.nome, 'Brigadeiro tradicional (cópia)');
});

test('criarReceitaDePronta: known price, fixed ingredient, TACO for unknown ones', () => {
  const precos = { 'leite condensado': { precoEmbalagem: 6.5, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g' } };
  const r = criarReceitaDePronta(brigadeiro(), opts({ precoDe: (nome) => precos[nome.toLowerCase()] ?? null }));
  const [leite, manteiga, , coco] = r.ingredientes;
  assert.equal(leite.precoEmbalagem, 6.5);
  assert.equal(leite.tamanhoEmbalagem, 395);
  assert.equal(manteiga.ingredientId, 'fixed:manteiga');
  assert.equal(manteiga.densidadeGml, 0.96);
  assert.equal(coco.ingredientId, null);
  assert.equal(coco.densidadeGml, 0.55);
  assert.deepEqual(coco.nutricao100g, { kcal: 600 });
});

test('criarReceitaDePronta: without TACO the copy still works (no nutrition)', () => {
  const coco = criarReceitaDePronta(brigadeiro(), opts({ taco: [] })).ingredientes[3];
  assert.equal(coco.nutricao100g, null);
  assert.equal(coco.densidadeGml, null);
});

test('criarReceitaDePronta: semCusto lines stay free; eggs keep the recipe unit; sections are not copied', () => {
  const r = criarReceitaDePronta(coxinha(), opts());
  const agua = r.ingredientes[0];
  assert.equal(agua.semCusto, true);
  assert.equal(agua.precoEmbalagem, 0);
  const ovos = r.ingredientes.find((i) => i.nome === 'Ovos');
  assert.equal(ovos.unidade, 'unidade');
  assert.equal(ovos.unidadeEmbalagem, 'unidade');
  assert.ok(r.ingredientes.every((i) => !('secao' in i) && !('observacao' in i)));
  assert.ok(!('semCusto' in r.ingredientes[1]));
});

const real = JSON.parse(fs.readFileSync(new URL('../data/receitas-prontas.json', import.meta.url), 'utf8'));

test('data/receitas-prontas.json: valid, every name in the suggestions list, 16 recipes of 20-30 units', () => {
  assert.deepEqual(validarCatalogo(real), []);
  assert.deepEqual(nomesForaDaLista(real), []);
  assert.equal(real.receitas.length, 16);
  for (const r of real.receitas) assert.ok(r.rendimento >= 20 && r.rendimento <= 30, `${r.id}: rende ${r.rendimento}`);
});

test('data/receitas-prontas.json: fried snacks include frying oil; water is always free', () => {
  for (const id of ['coxinha-de-frango', 'massa-de-risoles', 'enroladinho-de-salsicha']) {
    const r = real.receitas.find((x) => x.id === id);
    assert.ok(r.ingredientes.some((i) => i.secao === 'Para fritar' && i.nome === 'Óleo'), id);
  }
  for (const r of real.receitas) {
    for (const i of r.ingredientes) if (i.nome === 'Água') assert.equal(i.semCusto, true, r.id);
  }
});
