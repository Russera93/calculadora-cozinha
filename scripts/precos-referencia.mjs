// scripts/precos-referencia.mjs — weekly reference prices (npm run precos).
// Searches the Savegnago public catalog (VTEX) for each ingredient in
// scripts/precos-referencia.config.json and writes data/precos-referencia.json.
// --dry-run: print only. --detalhe: also list the products behind each
// median. Never writes when far fewer ingredients were found than last week
// (the site may have changed); exits 1 so the job fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { precoReferencia, produtosValidos, montarSaida, passaProtecao, manterFalhas } from './precos-referencia/calculo.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = path.join(root, 'data', 'precos-referencia.json');
const FONTE = { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' };
const UA = 'DoceLucroBot/1.0 (+https://github.com/Russera93/calculadora-cozinha)';
const dryRun = process.argv.includes('--dry-run');
const detalhe = process.argv.includes('--detalhe');

const config = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'precos-referencia.config.json'), 'utf8'));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// The catalog answers HTTP 500 now and then, and a socket can hang: 20 s
// timeout, retry twice (also on network errors), waiting longer each time.
async function buscar(termo) {
  const url = `${FONTE.url}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(termo)}&_from=0&_to=49`;
  for (let tentativa = 1; ; tentativa++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return await res.json();
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (tentativa === 3) throw new Error(`${termo}: ${err.message}`);
      await espera(2000 * tentativa);
    }
  }
}

const entradas = [];
const comErro = [];
for (const item of config) {
  let r = null;
  try {
    const produtos = await buscar(item.busca);
    r = precoReferencia(item, produtos);
    if (detalhe) for (const v of produtosValidos(item, produtos)) console.log(`        R$ ${v.preco.toFixed(2).padStart(7)}  ${v.nome}`);
  } catch (err) {
    comErro.push(item.nome);
    console.log(`erro  ${item.nome}: ${err.message}`);
  }
  console.log(r ? `ok    ${item.nome.padEnd(26)} R$ ${r.precoEmbalagem.toFixed(2)} / ${r.tamanhoEmbalagem} ${r.unidadeEmbalagem} (${r.produtos} produtos)` : `--    ${item.nome}`);
  entradas.push(r);
  await espera(500);
}

const hoje = new Date().toISOString().slice(0, 10);
const saida = montarSaida(entradas, { hoje, fonte: FONTE });
const anterior = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : null;
manterFalhas(saida, anterior, comErro);
const n = Object.keys(saida.precos).length;
console.log(`\n${n}/${config.length} ingredientes com referência`);

if (!passaProtecao(saida, anterior)) {
  console.error(`Proteção: só ${n} (semana anterior: ${Object.keys(anterior?.precos || {}).length}). Arquivo mantido.`);
  process.exit(1);
}
if (!dryRun) fs.writeFileSync(SAIDA, JSON.stringify(saida, null, 2) + '\n');
