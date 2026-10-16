// scripts/precos-referencia.mjs — weekly reference prices (npm run precos).
// Searches the Savegnago public catalog (VTEX) for each ingredient in
// scripts/precos-referencia.config.json and writes data/precos-referencia.json.
// --dry-run: print only. Never writes when far fewer ingredients were found
// than last week (the site may have changed); exits 1 so the job fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { precoReferencia, montarSaida, passaProtecao } from './precos-referencia/calculo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(root, 'data', 'precos-referencia.json');
const FONTE = { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' };
const UA = 'DoceLucroBot/1.0 (+https://github.com/Russera93/calculadora-cozinha)';
const dryRun = process.argv.includes('--dry-run');

const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'precos-referencia.config.json'), 'utf8'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(termo) {
  const url = `${FONTE.url}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(termo)}&_from=0&_to=49`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${termo}: HTTP ${res.status}`);
  return res.json();
}

const entradas = [];
for (const item of config) {
  let r = null;
  try {
    r = precoReferencia(item, await buscar(item.busca));
  } catch (err) {
    console.log(`erro  ${item.nome}: ${err.message}`);
  }
  console.log(r ? `ok    ${item.nome.padEnd(26)} R$ ${r.precoEmbalagem.toFixed(2)} / ${r.tamanhoEmbalagem} ${r.unidadeEmbalagem} (${r.produtos} produtos)` : `--    ${item.nome}`);
  entradas.push(r);
  await espera(500);
}

const hoje = new Date().toISOString().slice(0, 10);
const saida = montarSaida(entradas, { hoje, fonte: FONTE });
const anterior = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : null;
const n = Object.keys(saida.precos).length;
console.log(`\n${n}/${config.length} ingredientes com referência`);

if (!passaProtecao(saida, anterior)) {
  console.error(`Proteção: só ${n} (semana anterior: ${Object.keys(anterior?.precos || {}).length}). Arquivo mantido.`);
  process.exit(1);
}
if (!dryRun) fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + '\n');
