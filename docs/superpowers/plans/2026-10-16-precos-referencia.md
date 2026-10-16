# Preço de referência de mercado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um robô semanal pesquisa preços no Savegnago e grava `data/precos-referencia.json`; o app usa esses preços para preencher os ingredientes sem preço ao copiar uma receita pronta e oferece "Atualizar N preços" quando chega semana nova.

**Architecture:** Cálculo puro do robô em `scripts/precos-referencia/calculo.js` (filtros, tamanho, mediana, proteção), script de rede `scripts/precos-referencia.mjs` e workflow agendado no GitHub. No app, módulo puro `js/precos-referencia.js` (aplicar/limpar/atualizar origem) + loader; a origem `origemPreco: 'referencia'` é limpa em todos os caminhos que dão um preço "dela".

**Tech Stack:** Vanilla JS (ES modules), Node 24 (`fetch` nativo, `node --test`), GitHub Actions, Playwright (smoke).

**Spec:** `docs/superpowers/specs/2026-10-16-precos-referencia-design.md`

## Global Constraints

- Vanilla JS, sem build, **zero dependências de runtime**; o robô também não adiciona dependência (usa `fetch` do Node).
- Todo arquivo novo do app (em `js/`) e `data/precos-referencia.json` entram no `PRECACHE` do `sw.js`; `CACHE` → `calculadora-app-v8`. Código só do robô fica em `scripts/` (fora do PRECACHE).
- Testes **nunca acessam a internet**.
- A referência **nunca** substitui preço digitado/lido da nota e **nunca** entra no banco de preços (`savePreco`).
- Textos da interface em pt-BR; comentários de código em inglês.
- Robô: 1 busca a cada 500 ms; `User-Agent: DoceLucroBot/1.0 (+https://github.com/Russera93/calculadora-cozinha)`.
- Proteção: menos de 70% dos ingredientes da semana anterior → não grava, sai com código 1.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `precos-referencia`.
- **Não publicar** (merge/push no `master`) antes de o usuário conferir a primeira carga (Task 7).

## Review Focus

1. **Abrir o campo de preço de uma linha de referência e sair sem mudar nada** → continua "referência" e não entra no banco de preços. Teste: Task 6 (smoke) + Task 4 (unit de `learnPrice` via helper).
2. **Linha com o mesmo nome em duas seções (Óleo refogar/fritar) quando uma vira "dela"** → a outra recebe o preço e também deixa de ser referência. Teste: Task 4.
3. **Arquivo de referência ausente/offline na cópia** → cópia funciona como antes, sem etiqueta. Teste: Task 5.
4. **Produto com unidade grudada ou em kg/L ("Farinha 5kg", "395gLata", "Óleo 1,5L")** → tamanho lido certo, janela aplicada. Teste: Task 1.
5. **Semana nova com o mesmo preço** → nenhum cartão "Atualizar" (só aparece se preço/embalagem mudou). Teste: Task 3.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `scripts/precos-referencia/calculo.js` (novo) | `lerTamanho`, `paraBase`, `precoReferencia`, `montarSaida`, `passaProtecao` (puro) |
| `scripts/precos-referencia/calculo.test.js` (novo) | testes do cálculo, com produtos sintéticos |
| `scripts/precos-referencia.config.json` (novo) | curadoria por ingrediente |
| `scripts/precos-referencia.mjs` (novo) | rede + escrita do arquivo (`npm run precos`) |
| `.github/workflows/precos-referencia.yml` (novo) | agendamento semanal |
| `package.json` (mod.) | `test` inclui `scripts/precos-referencia/*.test.js`; script `precos` |
| `js/precos-referencia.js` (novo) | origem do preço: aplicar, limpar, atualizar, antiga |
| `js/precos-referencia-loader.js` (novo) | carrega `data/precos-referencia.json` sob demanda |
| `data/precos-referencia.json` (novo) | saída do robô (primeira carga na Task 7) |
| `js/ingredient-match.js`, `js/purchase.js`, `js/storage.js`, `js/costing.js` (mod.) | limpam/levam a origem |
| `js/receitas-prontas.js`, `js/screens/pronta.js` (mod.) | cópia usa a referência |
| `js/costing.js` `ingredientSummary` / `js/screens/editor/ingredientes.js` / `ingrediente-sheet.js` (mod.) | etiqueta, aviso, cartão "Atualizar" |
| `css/styles.css`, `sw.js` (mod.) | estilo do aviso; PRECACHE + v8 |
| `scripts/smoke/15-referencia.mjs` (novo) | smoke |
| `CLAUDE.md` (mod.) | documentação |

---

### Task 1: Cálculo do robô (puro)

**Files:**
- Create: `scripts/precos-referencia/calculo.js`, `scripts/precos-referencia/calculo.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `extractPackageSize(descricao) → { tamanho, unidade } | null` (`js/receipt-parser.js`), `normalize` (`js/text-utils.js`).
- Produces:
  - `lerTamanho(nome) → { tamanho, unidade } | null`
  - `paraBase(tamanho, unidade) → { valor, base: 'g'|'ml'|'unidade' } | null`
  - `precoReferencia(config, produtos) → { nome, precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem, produtos } | null`
  - `montarSaida(entradas, { hoje, fonte }) → { atualizadoEm, fonte, precos }`
  - `passaProtecao(novo, anterior) → boolean`
- Config entry: `{ nome, busca, incluir: string[], excluir: string[], embalagem: { tamanho, unidade }, janela: [min, max] }`. **`janela` is in the base unit** (g, ml or unidade) of the package. `incluir`/`excluir` match **whole words** of the normalized product name (so "mel" does not match "caramelo").
- VTEX product shape used: `{ productName, items: [{ sellers: [{ commertialOffer: { Price } }] }] }`.

- [ ] **Step 1: Write the failing tests** `scripts/precos-referencia/calculo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerTamanho, paraBase, precoReferencia, montarSaida, passaProtecao } from './calculo.js';

const p = (productName, Price) => ({ productName, items: [{ sellers: [{ commertialOffer: { Price } }] }] });
const LEITE_CONDENSADO = {
  nome: 'Leite condensado', busca: 'leite condensado', incluir: ['leite condensado'],
  excluir: ['pudim', 'bolo', 'suspiro', 'doce', 'zero', 'semidesnatado'],
  embalagem: { tamanho: 395, unidade: 'g' }, janela: [350, 400]
};

test('lerTamanho: sizes in the name, also glued to the next word or with a comma', () => {
  assert.deepEqual(lerTamanho('Leite Condensado Itambé 395gLata'), { tamanho: 395, unidade: 'g' });
  assert.deepEqual(lerTamanho('Farinha de Trigo Dona Benta 1kg'), { tamanho: 1, unidade: 'kg' });
  assert.deepEqual(lerTamanho('Óleo de Soja Liza 900ml'), { tamanho: 900, unidade: 'ml' });
  assert.deepEqual(lerTamanho('Ovos Brancos 12 Unidades'), { tamanho: 12, unidade: 'unidade' });
  assert.equal(lerTamanho('Cebola Kg'), null);
});

test('paraBase: kg/L/mg to g/ml, pieces stay', () => {
  assert.deepEqual(paraBase(1, 'kg'), { valor: 1000, base: 'g' });
  assert.deepEqual(paraBase(1.5, 'l'), { valor: 1500, base: 'ml' });
  assert.deepEqual(paraBase(500, 'mg'), { valor: 0.5, base: 'g' });
  assert.deepEqual(paraBase(12, 'unidade'), { valor: 12, base: 'unidade' });
  assert.equal(paraBase(1, 'xicara'), null);
});

test('precoReferencia: filters words (whole words), reads size, keeps the window, median of the typical package', () => {
  const produtos = [
    p('Pudim de Leite Condensado Moça 500g', 49.9),        // excluded word
    p('Leite Condensado Itambé 395gLata', 8.79),
    p('Leite Condensado Piracanjuba 395g', 7.49),
    p('Leite Condensado Moça 395g', 9.99),
    p('Leite Condensado Moça Caixa 1kg', 24.9),             // outside the window
    p('Suspiro Leite Condensado 200g', 13.95),               // excluded
    p('Leite Condensado Italac 395g', 0)                     // no price
  ];
  assert.deepEqual(precoReferencia(LEITE_CONDENSADO, produtos), {
    nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3
  });
});

test('precoReferencia: other sizes inside the window are scaled to the typical package', () => {
  const farinha = { nome: 'Farinha de trigo', busca: 'farinha de trigo', incluir: ['farinha', 'trigo'], excluir: ['integral'],
    embalagem: { tamanho: 1, unidade: 'kg' }, janela: [1000, 5000] };
  const r = precoReferencia(farinha, [p('Farinha de Trigo Dona Benta 1kg', 6), p('Farinha de Trigo Renata 5kg', 25), p('Farinha de Trigo Integral 1kg', 9)]);
  assert.equal(r.precoEmbalagem, 5.5); // median of 6.00 and 5.00
  assert.equal(r.tamanhoEmbalagem, 1);
  assert.equal(r.unidadeEmbalagem, 'kg');
  assert.equal(r.produtos, 2);
});

test('precoReferencia: whole words — "mel" is not inside "caramelo"', () => {
  const mel = { nome: 'Mel', busca: 'mel', incluir: ['mel'], excluir: [], embalagem: { tamanho: 500, unidade: 'g' }, janela: [200, 1000] };
  assert.equal(precoReferencia(mel, [p('Calda de Caramelo 500g', 10), p('Bala de Caramelo 300g', 5)]), null);
  assert.equal(precoReferencia(mel, [p('Mel de Abelha Puro 500g', 30), p('Mel Silvestre 280g', 16.8)]).precoEmbalagem, 30);
});

test('precoReferencia: fewer than 2 products, no reference', () => {
  assert.equal(precoReferencia(LEITE_CONDENSADO, [p('Leite Condensado Moça 395g', 9.99)]), null);
  assert.equal(precoReferencia(LEITE_CONDENSADO, []), null);
});

test('montarSaida: keyed by normalized name, only found ingredients', () => {
  const r = { nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3 };
  const fonte = { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' };
  assert.deepEqual(montarSaida([r, null], { hoje: '2026-10-19', fonte }), { atualizadoEm: '2026-10-19', fonte, precos: { 'leite condensado': r } });
});

test('passaProtecao: needs at least 70% of last week; first run always passes', () => {
  const com = (n) => ({ precos: Object.fromEntries(Array.from({ length: n }, (_, i) => [`i${i}`, {}])) });
  assert.equal(passaProtecao(com(7), com(10)), true);
  assert.equal(passaProtecao(com(6), com(10)), false);
  assert.equal(passaProtecao(com(3), null), true);
  assert.equal(passaProtecao(com(0), null), false);
});
```

- [ ] **Step 2: Update** `package.json` scripts:

```json
    "test": "node --test js/*.test.js scripts/precos-referencia/*.test.js",
    "precos": "node scripts/precos-referencia.mjs",
```

(keep `test:mobile`).

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (`calculo.js` missing).

- [ ] **Step 4: Implement** `scripts/precos-referencia/calculo.js`:

```js
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
  return extractPackageSize(nome) || extractPackageSize(String(nome).replace(/(\d)(kg|mg|g|ml|l)(?=[a-zà-ú])/gi, '$1$2 '));
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
```

- [ ] **Step 5: Run** `npm test` — Expected: all PASS. If `lerTamanho('Cebola Kg')` does not return null (parser reads a bare unit), adjust only `lerTamanho` to require a number, and ledger it.

- [ ] **Step 6: Commit** — `git add scripts/precos-referencia/calculo.js scripts/precos-referencia/calculo.test.js package.json` — message "Price robot: pure calculation (filters, size, median, protection)".

---

### Task 2: Script de rede, configuração e agendamento

**Files:**
- Create: `scripts/precos-referencia.mjs`, `scripts/precos-referencia.config.json`, `.github/workflows/precos-referencia.yml`

**Interfaces:**
- Consumes: Task 1 functions.
- Produces: `data/precos-referencia.json` in the spec format; `npm run precos` prints a summary; `--dry-run` prints without writing.

- [ ] **Step 1: Create** `scripts/precos-referencia.mjs`:

```js
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
```

- [ ] **Step 2: Create** `scripts/precos-referencia.config.json` (starting curation; tuned with real results in Task 7):

```json
[
  { "nome": "Açúcar", "busca": "açúcar refinado", "incluir": ["acucar", "refinado"], "excluir": ["organico", "light", "sache", "cubos", "confeiteiro", "demerara", "mascavo"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [1000, 5000] },
  { "nome": "Açúcar cristal", "busca": "açúcar cristal", "incluir": ["acucar", "cristal"], "excluir": ["organico", "sache"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [1000, 5000] },
  { "nome": "Açúcar de confeiteiro", "busca": "açúcar confeiteiro", "incluir": ["confeiteiro"], "excluir": [], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [200, 1000] },
  { "nome": "Farinha de trigo", "busca": "farinha de trigo", "incluir": ["farinha", "trigo"], "excluir": ["integral", "fermento", "pastel", "pizza", "bolo", "mistura", "rosca", "kibe"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [1000, 5000] },
  { "nome": "Fermento em pó", "busca": "fermento em pó", "incluir": ["fermento"], "excluir": ["biologico", "seco", "fresco"], "embalagem": { "tamanho": 100, "unidade": "g" }, "janela": [90, 250] },
  { "nome": "Manteiga", "busca": "manteiga", "incluir": ["manteiga"], "excluir": ["ghee", "cacau", "amendoim", "garrafa", "biscoito", "pao", "sem sal"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [180, 500] },
  { "nome": "Manteiga sem sal", "busca": "manteiga sem sal", "incluir": ["manteiga", "sem sal"], "excluir": ["ghee"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [180, 500] },
  { "nome": "Margarina", "busca": "margarina", "incluir": ["margarina"], "excluir": ["light"], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [250, 1000] },
  { "nome": "Óleo", "busca": "óleo de soja", "incluir": ["oleo", "soja"], "excluir": ["composto"], "embalagem": { "tamanho": 900, "unidade": "ml" }, "janela": [900, 900] },
  { "nome": "Azeite", "busca": "azeite de oliva", "incluir": ["azeite", "oliva"], "excluir": ["dende", "tempero", "composto", "spray"], "embalagem": { "tamanho": 500, "unidade": "ml" }, "janela": [250, 1000] },
  { "nome": "Gordura vegetal", "busca": "gordura vegetal", "incluir": ["gordura", "vegetal"], "excluir": [], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [250, 1000] },
  { "nome": "Ovos", "busca": "ovos brancos", "incluir": ["ovos"], "excluir": ["codorna", "pascoa", "chocolate", "caipira", "organicos"], "embalagem": { "tamanho": 12, "unidade": "unidade" }, "janela": [12, 30] },
  { "nome": "Leite", "busca": "leite integral", "incluir": ["leite", "integral"], "excluir": ["po", "condensado", "coco", "fermentado", "lactose", "chocolate"], "embalagem": { "tamanho": 1, "unidade": "l" }, "janela": [1000, 1000] },
  { "nome": "Leite condensado", "busca": "leite condensado", "incluir": ["leite condensado"], "excluir": ["pudim", "bolo", "suspiro", "doce", "zero", "semidesnatado", "biscoito"], "embalagem": { "tamanho": 395, "unidade": "g" }, "janela": [350, 400] },
  { "nome": "Creme de leite", "busca": "creme de leite", "incluir": ["creme de leite"], "excluir": ["fresco", "lata", "sem lactose", "zero"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [180, 220] },
  { "nome": "Leite de coco", "busca": "leite de coco", "incluir": ["leite de coco"], "excluir": ["po", "light"], "embalagem": { "tamanho": 200, "unidade": "ml" }, "janela": [180, 500] },
  { "nome": "Coco ralado", "busca": "coco ralado", "incluir": ["coco", "ralado"], "excluir": ["flocos", "bolo", "cocada"], "embalagem": { "tamanho": 100, "unidade": "g" }, "janela": [50, 250] },
  { "nome": "Queijo ralado", "busca": "queijo ralado", "incluir": ["queijo", "ralado"], "excluir": ["pao"], "embalagem": { "tamanho": 100, "unidade": "g" }, "janela": [40, 200] },
  { "nome": "Chocolate em pó", "busca": "chocolate em pó", "incluir": ["chocolate", "po"], "excluir": ["achocolatado", "bebida"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [180, 400] },
  { "nome": "Chocolate meio amargo", "busca": "chocolate meio amargo", "incluir": ["meio amargo"], "excluir": ["bombom", "biscoito", "gotas"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [80, 2100] },
  { "nome": "Chocolate ao leite", "busca": "chocolate ao leite barra", "incluir": ["chocolate", "ao leite"], "excluir": ["bombom", "biscoito", "gotas", "wafer", "recheado"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [80, 2100] },
  { "nome": "Granulado", "busca": "chocolate granulado", "incluir": ["granulado"], "excluir": ["cafe"], "embalagem": { "tamanho": 150, "unidade": "g" }, "janela": [100, 1000] },
  { "nome": "Mel", "busca": "mel de abelha", "incluir": ["mel"], "excluir": ["biscoito", "bala", "pao"], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [200, 1000] },
  { "nome": "Biscoito maisena", "busca": "biscoito maisena", "incluir": ["biscoito", "maisena"], "excluir": ["chocolate", "recheado"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [150, 400] },
  { "nome": "Fubá", "busca": "fubá", "incluir": ["fuba"], "excluir": ["bolo", "pre cozido", "biscoito"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [500, 1000] },
  { "nome": "Amendoim", "busca": "amendoim cru", "incluir": ["amendoim"], "excluir": ["pacoca", "pe de moleque", "pasta", "japones", "doce", "cobertura", "creme", "salgado", "chocolate"], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [300, 1000] },
  { "nome": "Cravo", "busca": "cravo da índia", "incluir": ["cravo"], "excluir": [], "embalagem": { "tamanho": 10, "unidade": "g" }, "janela": [5, 50] },
  { "nome": "Noz-moscada", "busca": "noz moscada", "incluir": ["noz", "moscada"], "excluir": [], "embalagem": { "tamanho": 10, "unidade": "g" }, "janela": [5, 50] },
  { "nome": "Gergelim", "busca": "gergelim", "incluir": ["gergelim"], "excluir": ["oleo", "biscoito", "barra", "pasta"], "embalagem": { "tamanho": 100, "unidade": "g" }, "janela": [50, 500] },
  { "nome": "Fermento biológico seco", "busca": "fermento biológico seco", "incluir": ["fermento", "biologico"], "excluir": ["fresco"], "embalagem": { "tamanho": 10, "unidade": "g" }, "janela": [10, 500] },
  { "nome": "Polvilho azedo", "busca": "polvilho azedo", "incluir": ["polvilho", "azedo"], "excluir": ["biscoito"], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [500, 1000] },
  { "nome": "Farinha de rosca", "busca": "farinha de rosca", "incluir": ["farinha", "rosca"], "excluir": ["temperada"], "embalagem": { "tamanho": 500, "unidade": "g" }, "janela": [250, 1000] },
  { "nome": "Sal", "busca": "sal refinado", "incluir": ["sal", "refinado"], "excluir": ["grosso", "light", "rosa", "marinho", "temperado", "sache"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [1000, 1000] },
  { "nome": "Caldo de galinha", "busca": "caldo de galinha tablete", "incluir": ["caldo", "galinha"], "excluir": ["po", "liquido"], "embalagem": { "tamanho": 57, "unidade": "g" }, "janela": [50, 120] },
  { "nome": "Tempero pronto", "busca": "tempero sazon", "incluir": ["sazon"], "excluir": [], "embalagem": { "tamanho": 60, "unidade": "g" }, "janela": [50, 120] },
  { "nome": "Colorau", "busca": "colorau", "incluir": ["colorau"], "excluir": [], "embalagem": { "tamanho": 100, "unidade": "g" }, "janela": [50, 500] },
  { "nome": "Pimenta-do-reino", "busca": "pimenta do reino", "incluir": ["pimenta", "reino"], "excluir": [], "embalagem": { "tamanho": 50, "unidade": "g" }, "janela": [20, 200] },
  { "nome": "Azeitona", "busca": "azeitona verde", "incluir": ["azeitona", "verde"], "excluir": ["recheada", "pasta"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [100, 500] },
  { "nome": "Ervilha", "busca": "ervilha em conserva", "incluir": ["ervilha"], "excluir": ["seca", "partida", "congelada", "milho"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [150, 300] },
  { "nome": "Peito de frango", "busca": "peito de frango", "incluir": ["peito", "frango"], "excluir": ["empanado", "defumado", "peru", "cozido", "desfiado"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [500, 3000] },
  { "nome": "Carne moída", "busca": "carne moída", "incluir": ["carne", "moida"], "excluir": ["soja", "frango", "peru"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [400, 2000] },
  { "nome": "Salsicha", "busca": "salsicha", "incluir": ["salsicha"], "excluir": ["vegana", "lata", "conserva", "peru"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [400, 3000] },
  { "nome": "Cenoura", "busca": "cenoura", "incluir": ["cenoura"], "excluir": ["baby", "ralada", "bolo", "suco", "papinha"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [500, 2000] },
  { "nome": "Cebola", "busca": "cebola", "incluir": ["cebola"], "excluir": ["frita", "desidratada", "conserva", "po", "creme", "sopa", "roxa"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [500, 2000] },
  { "nome": "Alho", "busca": "alho", "incluir": ["alho"], "excluir": ["frito", "pasta", "sal", "tempero", "po", "desidratado", "granulado", "poro"], "embalagem": { "tamanho": 200, "unidade": "g" }, "janela": [100, 1000] },
  { "nome": "Tomate", "busca": "tomate", "incluir": ["tomate"], "excluir": ["extrato", "molho", "pelado", "seco", "sardinha", "catchup", "ketchup", "polpa", "cereja", "pure"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [500, 2000] },
  { "nome": "Limão", "busca": "limão taiti", "incluir": ["limao"], "excluir": ["suco", "tempero", "refrigerante", "bala", "cha", "siciliano"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [500, 2000] },
  { "nome": "Pimentão", "busca": "pimentão verde", "incluir": ["pimentao"], "excluir": ["conserva"], "embalagem": { "tamanho": 1, "unidade": "kg" }, "janela": [200, 2000] }
]
```

- [ ] **Step 3: Create** `.github/workflows/precos-referencia.yml`:

```yaml
name: Preços de referência

on:
  schedule:
    - cron: '0 9 * * 1'   # every Monday 06:00 in Brasília
  workflow_dispatch:

permissions:
  contents: write

jobs:
  precos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm ci
        env:
          PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1'
      - run: npm test
      - run: npm run precos
      - name: Commit if changed
        run: |
          if git diff --quiet -- data/precos-referencia.json; then echo "Sem mudança"; exit 0; fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add data/precos-referencia.json
          git commit -m "Preços de referência: semana de $(date -u +%Y-%m-%d)"
          git push
```

- [ ] **Step 4: Verify** — `npm test` (Expected: PASS) and `node --check scripts/precos-referencia.mjs` (Expected: no output). Do **not** run the network script here (Task 7 does).

- [ ] **Step 5: Commit** — the three files — message "Price robot: network script, ingredient curation, weekly GitHub job".

---

### Task 3: Origem do preço no app (puro) + loader

**Files:**
- Create: `js/precos-referencia.js`, `js/precos-referencia.test.js`, `js/precos-referencia-loader.js`, `js/precos-referencia-loader.test.js`
- Modify: `sw.js`

**Interfaces:**
- Produces:
  - `referenciaDe(nome, ref) → entry | null`
  - `aplicarReferencia(item, ref) → boolean` (only `precoEmbalagem === 0 && tamanhoEmbalagem === 0 && !semCusto`)
  - `limparOrigem(item) → void`
  - `referenciasParaAtualizar(recipe, ref) → item[]`
  - `atualizarReferencias(recipe, ref) → number`
  - `referenciaAntiga(item, hojeISO) → boolean` (> 30 days)
  - `getPrecosReferencia() → Promise<ref>` (loader)
- `ref` = `{ atualizadoEm, fonte, precos: { [normalizedName]: { nome, precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem, produtos } } }`.
- Item fields: `origemPreco: 'referencia'`, `referenciaEm: 'AAAA-MM-DD'`.

- [ ] **Step 1: Write the failing tests** `js/precos-referencia.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { referenciaDe, aplicarReferencia, limparOrigem, referenciasParaAtualizar, atualizarReferencias, referenciaAntiga } from './precos-referencia.js';

const REF = {
  atualizadoEm: '2026-10-19',
  fonte: { nome: 'Savegnago', regiao: 'interior de SP', url: 'x' },
  precos: { 'leite condensado': { nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3 } }
};
const linha = (o) => ({ nome: 'Leite condensado', quantidadeBruta: '1', unidade: 'unidade', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', ...o });

test('referenciaDe: by name, accents/case aside', () => {
  assert.equal(referenciaDe('LEITE CONDENSADO', REF).precoEmbalagem, 8.79);
  assert.equal(referenciaDe('Farinha', REF), null);
  assert.equal(referenciaDe('Leite condensado', null), null);
});

test('aplicarReferencia: fills an unpriced row and marks it', () => {
  const item = linha();
  assert.equal(aplicarReferencia(item, REF), true);
  assert.deepEqual([item.precoEmbalagem, item.tamanhoEmbalagem, item.unidadeEmbalagem, item.origemPreco, item.referenciaEm], [8.79, 395, 'g', 'referencia', '2026-10-19']);
});

test('aplicarReferencia: never over a price, never on a free line, nothing without a reference', () => {
  const dela = linha({ precoEmbalagem: 7, tamanhoEmbalagem: 395 });
  assert.equal(aplicarReferencia(dela, REF), false);
  assert.equal(dela.precoEmbalagem, 7);
  assert.equal(aplicarReferencia(linha({ semCusto: true }), REF), false);
  assert.equal(aplicarReferencia(linha({ nome: 'Farinha' }), REF), false);
});

test('limparOrigem: the price becomes hers', () => {
  const item = linha({ origemPreco: 'referencia', referenciaEm: '2026-10-12' });
  limparOrigem(item);
  assert.ok(!('origemPreco' in item) && !('referenciaEm' in item));
});

test('referenciasParaAtualizar / atualizarReferencias: only reference rows from an older week whose price changed', () => {
  const recipe = { ingredientes: [
    linha({ precoEmbalagem: 8.5, tamanhoEmbalagem: 395, origemPreco: 'referencia', referenciaEm: '2026-10-12' }),  // changed
    linha({ precoEmbalagem: 8.79, tamanhoEmbalagem: 395, origemPreco: 'referencia', referenciaEm: '2026-10-12' }), // same price
    linha({ precoEmbalagem: 6, tamanhoEmbalagem: 395 }),                                                          // hers
    linha({ precoEmbalagem: 8.5, tamanhoEmbalagem: 395, origemPreco: 'referencia', referenciaEm: '2026-10-19' })   // already this week
  ] };
  assert.equal(referenciasParaAtualizar(recipe, REF).length, 1);
  assert.equal(atualizarReferencias(recipe, REF), 1);
  assert.equal(recipe.ingredientes[0].precoEmbalagem, 8.79);
  assert.equal(recipe.ingredientes[0].referenciaEm, '2026-10-19');
  assert.equal(recipe.ingredientes[2].precoEmbalagem, 6);
  assert.equal(referenciasParaAtualizar(recipe, REF).length, 0);
  assert.deepEqual(referenciasParaAtualizar(recipe, null), []);
});

test('referenciaAntiga: more than 30 days', () => {
  assert.equal(referenciaAntiga({ origemPreco: 'referencia', referenciaEm: '2026-09-01' }, '2026-10-19'), true);
  assert.equal(referenciaAntiga({ origemPreco: 'referencia', referenciaEm: '2026-10-01' }, '2026-10-19'), false);
  assert.equal(referenciaAntiga({ referenciaEm: '2026-01-01' }, '2026-10-19'), false);
});
```

`js/precos-referencia-loader.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPrecosReferencia } from './precos-referencia-loader.js';

test('getPrecosReferencia: a failed load is not cached, a good one is', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 404 };
    return { ok: true, json: async () => ({ atualizadoEm: '2026-10-19', precos: {} }) };
  };
  await assert.rejects(getPrecosReferencia());
  assert.equal((await getPrecosReferencia()).atualizadoEm, '2026-10-19');
  await getPrecosReferencia();
  assert.equal(calls, 2);
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** `js/precos-referencia.js`:

```js
// js/precos-referencia.js
//
// Market reference prices (data/precos-referencia.json, weekly robot).
// A row filled from the reference is marked (origemPreco/referenciaEm) so
// it can be updated next week and shown as an estimate. Any price that
// comes from her (typed, receipt, price bank) clears the mark.

import { normalize } from './text-utils.js';

const DIA = 24 * 60 * 60 * 1000;

export function referenciaDe(nome, ref) {
  return ref?.precos?.[normalize(nome || '')] ?? null;
}

function preencher(item, entrada, ref) {
  item.precoEmbalagem = entrada.precoEmbalagem;
  item.tamanhoEmbalagem = entrada.tamanhoEmbalagem;
  item.unidadeEmbalagem = entrada.unidadeEmbalagem;
  item.origemPreco = 'referencia';
  item.referenciaEm = ref.atualizadoEm;
}

export function aplicarReferencia(item, ref) {
  if (item.semCusto || item.precoEmbalagem !== 0 || item.tamanhoEmbalagem !== 0) return false;
  const entrada = referenciaDe(item.nome, ref);
  if (!entrada) return false;
  preencher(item, entrada, ref);
  return true;
}

export function limparOrigem(item) {
  delete item.origemPreco;
  delete item.referenciaEm;
}

export function referenciasParaAtualizar(recipe, ref) {
  if (!ref) return [];
  return recipe.ingredientes.filter((item) => {
    if (item.origemPreco !== 'referencia' || !(item.referenciaEm < ref.atualizadoEm)) return false;
    const e = referenciaDe(item.nome, ref);
    return !!e && (e.precoEmbalagem !== item.precoEmbalagem || e.tamanhoEmbalagem !== item.tamanhoEmbalagem || e.unidadeEmbalagem !== item.unidadeEmbalagem);
  });
}

export function atualizarReferencias(recipe, ref) {
  const linhas = referenciasParaAtualizar(recipe, ref);
  for (const item of linhas) preencher(item, referenciaDe(item.nome, ref), ref);
  return linhas.length;
}

export function referenciaAntiga(item, hojeISO) {
  if (item.origemPreco !== 'referencia' || !item.referenciaEm) return false;
  return Date.parse(hojeISO) - Date.parse(item.referenciaEm) > 30 * DIA;
}
```

`js/precos-referencia-loader.js`:

```js
// js/precos-referencia-loader.js
//
// Loads data/precos-referencia.json once per page. A failed load is
// forgotten (offline now, online later).

let promessa = null;

export function getPrecosReferencia() {
  if (!promessa) {
    promessa = fetch('data/precos-referencia.json')
      .then((response) => {
        if (!response.ok) throw new Error('precos-referencia fetch failed: ' + response.status);
        return response.json();
      })
      .catch((err) => {
        promessa = null;
        throw err;
      });
  }
  return promessa;
}
```

`sw.js`: add `'js/precos-referencia-loader.js',` and `'js/precos-referencia.js',` to `PRECACHE` (alphabetical, after `'js/preparo.js',`).

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit** — message "Reference price origin: apply, clear, update, stale; loader".

---

### Task 4: A marca some quando o preço é dela (caminhos existentes)

**Files:**
- Modify: `js/ingredient-match.js` (`applyIngredientMatch`), `js/purchase.js` (`applyPurchase`), `js/storage.js` (`applyPricingToAllRecipes`), `js/costing.js` (`sincronizarPrecoMesmoNome`)
- Test: `js/ingredient-match.test.js`, `js/purchase.test.js`, `js/storage.test.js`

**Interfaces:**
- Consumes: `limparOrigem` (Task 3).
- Produces: `sincronizarPrecoMesmoNome` copies `origemPreco`/`referenciaEm` from the source row (or clears them on the target when the source has none).

- [ ] **Step 1: Write the failing tests**

Append to `js/ingredient-match.test.js`:

```js
test('applyIngredientMatch: a known price from her bank clears a reference mark', () => {
  const item = { ...emptyIngredientItem(), nome: 'Leite condensado', origemPreco: 'referencia', referenciaEm: '2026-10-12' };
  applyIngredientMatch(item, { known: null, precoConhecido: { precoEmbalagem: 7, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g' } });
  assert.equal(item.precoEmbalagem, 7);
  assert.ok(!('origemPreco' in item));
});
```

Append to `js/purchase.test.js`:

```js
test('applyPurchase: a receipt price is hers (reference mark cleared, also on namesakes)', () => {
  const recipe = { rendimento: 1, ingredientes: [
    line({ nome: 'Óleo', origemPreco: 'referencia', referenciaEm: '2026-10-12', precoEmbalagem: 8, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml' }),
    line({ nome: 'Óleo', origemPreco: 'referencia', referenciaEm: '2026-10-12', precoEmbalagem: 8, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml' })
  ] };
  applyPurchase(recipe, [{ item: { descricao: 'OLEO', quantidade: 1, tamanho: 900, unidade: 'ml', valorTotal: 7.5 }, ingredienteIndex: 0 }], 'x');
  for (const l of recipe.ingredientes) assert.ok(!('origemPreco' in l) && l.precoEmbalagem === 7.5);
});

test('sincronizarPrecoMesmoNome: carries the reference mark of the source row', () => {
  const a = line({ nome: 'Óleo', precoEmbalagem: 8, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml', origemPreco: 'referencia', referenciaEm: '2026-10-19' });
  const b = line({ nome: 'Óleo' });
  sincronizarPrecoMesmoNome([a, b], a);
  assert.equal(b.origemPreco, 'referencia');
  assert.equal(b.referenciaEm, '2026-10-19');
  delete a.origemPreco; delete a.referenciaEm; a.precoEmbalagem = 7;
  sincronizarPrecoMesmoNome([a, b], a);
  assert.ok(!('origemPreco' in b));
});
```

Append to `js/storage.test.js` (add `applyPricingToAllRecipes` to its import from `./storage.js`):

```js
test('applyPricingToAllRecipes: a price propagated by her clears the reference mark', () => {
  saveRecipe({ id: 'r1', nome: 'A', rendimento: 1, ingredientes: [{ nome: 'Óleo', quantidadeBruta: '1', unidade: 'g', precoEmbalagem: 8, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml', origemPreco: 'referencia', referenciaEm: '2026-10-12' }] });
  applyPricingToAllRecipes('óleo', { precoEmbalagem: 7, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml' }, 'outra');
  const item = getRecipes()[0].ingredientes[0];
  assert.equal(item.precoEmbalagem, 7);
  assert.ok(!('origemPreco' in item));
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (the 5 new tests).

- [ ] **Step 3: Implement**
  - `js/ingredient-match.js`: import `{ limparOrigem } from './precos-referencia.js'`; inside the `if (precoConhecido && …)` block, after setting the three fields, add `limparOrigem(item);`.
  - `js/purchase.js`: import `{ limparOrigem } from './precos-referencia.js'`; in `applyPurchase`, after `linha.unidadeEmbalagem = item.unidade;` and **before** `sincronizarPrecoMesmoNome(...)`, add `limparOrigem(linha);`.
  - `js/storage.js`: import `{ limparOrigem } from './precos-referencia.js'`; in `applyPricingToAllRecipes`, after setting `unidadeEmbalagem`, add `limparOrigem(item);`.
  - `js/costing.js` `sincronizarPrecoMesmoNome`, after copying `unidadeEmbalagem`:
    ```js
        if (item.origemPreco) {
          outra.origemPreco = item.origemPreco;
          outra.referenciaEm = item.referenciaEm;
        } else {
          delete outra.origemPreco;
          delete outra.referenciaEm;
        }
    ```

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit** — message "A price from her (bank, receipt, propagation) clears the reference mark".

---

### Task 5: Cópia de receita pronta usa a referência

**Files:**
- Modify: `js/receitas-prontas.js` (`criarReceitaDePronta`), `js/screens/pronta.js`
- Test: `js/receitas-prontas.test.js`

**Interfaces:**
- Consumes: `aplicarReferencia` (Task 3), `getPrecosReferencia` (Task 3).
- Produces: `criarReceitaDePronta(pronta, { existentes, custom, precoDe, taco, base, referencia = null })`.

- [ ] **Step 1: Write the failing tests** — append to `js/receitas-prontas.test.js`:

```js
const REF = { atualizadoEm: '2026-10-19', fonte: {}, precos: {
  'leite condensado': { nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 3 },
  'manteiga': { nome: 'Manteiga', precoEmbalagem: 12, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g', produtos: 5 }
} };

test('criarReceitaDePronta: her known price first, then the reference (marked), else unpriced', () => {
  const precoDe = (nome) => (nome === 'Manteiga' ? { precoEmbalagem: 10, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g' } : null);
  const [leite, manteiga, chocolate] = criarReceitaDePronta(brigadeiro(), opts({ precoDe, referencia: REF })).ingredientes;
  assert.deepEqual([leite.precoEmbalagem, leite.origemPreco, leite.referenciaEm], [8.79, 'referencia', '2026-10-19']);
  assert.deepEqual([manteiga.precoEmbalagem, manteiga.origemPreco], [10, undefined]);
  assert.deepEqual([chocolate.precoEmbalagem, chocolate.origemPreco], [0, undefined]);
});

test('criarReceitaDePronta: without a reference file the copy is as before', () => {
  const leite = criarReceitaDePronta(brigadeiro(), opts({ referencia: null })).ingredientes[0];
  assert.equal(leite.precoEmbalagem, 0);
  assert.ok(!('origemPreco' in leite));
});
```

- [ ] **Step 2: Run** `node --test js/receitas-prontas.test.js` — Expected: FAIL (first new test).

- [ ] **Step 3: Implement**
  - `js/receitas-prontas.js`: import `{ aplicarReferencia } from './precos-referencia.js'`; signature gets `referencia = null`; in the non-`semCusto` branch, right after `applyIngredientMatch(...)` and `item.unidade = ing.unidade;`, add `if (referencia) aplicarReferencia(item, referencia);` (it only fills when still unpriced, so her price wins).
  - `js/screens/pronta.js` `usar()`: load both before copying:
    ```js
        const [taco, referencia] = await Promise.all([
          getTacoIngredients().catch(() => []),
          getPrecosReferencia().catch(() => null)
        ]);
    ```
    (replacing the `let taco = []; try …` lines), import `getPrecosReferencia` from `../precos-referencia-loader.js`, and pass `referencia` to `criarReceitaDePronta`.

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit** — message "Copying a ready-made recipe fills unpriced rows with the market reference".

---

### Task 6: Na tela — etiqueta, aviso, "Atualizar N preços" (+ smoke)

**Files:**
- Create: `scripts/smoke/15-referencia.mjs`, `data/precos-referencia.json` (placeholder, real data in Task 7)
- Modify: `js/costing.js` (`ingredientSummary` untouched — tag goes in `rowHtml`), `js/screens/editor/ingredientes.js`, `js/screens/editor/ingrediente-sheet.js`, `css/styles.css`, `sw.js`

**Interfaces:**
- Consumes: Task 3 (`referenciaAntiga`, `referenciasParaAtualizar`, `atualizarReferencias`, `limparOrigem`, `getPrecosReferencia`).
- Produces: row tag `.tag` "referência"/"referência antiga"; sheet note `[data-referencia]`; card `[data-slot="referencia"]` with button "Atualizar N preços".

**UX decisions:** the tag sits on the row summary line (same `.tag` as "definir preço"); the sheet note uses `.aviso-card`-like muted box above "Quanto pagou" and disappears the moment she edits price/size/unit; the update card goes **above** the ingredient list (it changes what the list shows), with one primary action.

- [ ] **Step 1: Create** a placeholder `data/precos-referencia.json` (so the app and PRECACHE have the file; Task 7 replaces it):

```json
{ "atualizadoEm": "2026-10-12", "fonte": { "nome": "Savegnago", "regiao": "interior de SP", "url": "https://www.savegnago.com.br" }, "precos": {} }
```

and in `sw.js` add `'data/precos-referencia.json',` to `PRECACHE` and set `const CACHE = 'calculadora-app-v8';`.

- [ ] **Step 2: Write the failing smoke** `scripts/smoke/15-referencia.mjs`:

```js
// Market reference prices: copying a ready-made recipe fills unpriced rows
// (tag "referência", cost computed), the sheet explains it, editing the
// price makes it hers, a newer week offers "Atualizar N preços".

const semana = (atualizadoEm, leite) => JSON.stringify({
  atualizadoEm,
  fonte: { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' },
  precos: {
    'leite condensado': { nome: 'Leite condensado', precoEmbalagem: leite, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 5 },
    'chocolate em po': { nome: 'Chocolate em pó', precoEmbalagem: 9.5, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g', produtos: 4 },
    'granulado': { nome: 'Granulado', precoEmbalagem: 6, tamanhoEmbalagem: 150, unidadeEmbalagem: 'g', produtos: 3 }
  }
});

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal }) {
  let arquivo = semana('2026-10-12', 8.79);
  await page.route('**/data/precos-referencia.json*', (route) => route.fulfill({ contentType: 'application/json', body: arquivo }));
  await page.goto(baseUrl + '#/prontas/brigadeiro');
  await page.getByRole('button', { name: 'Usar esta receita' }).click();
  await page.locator('#nome-receita').waitFor();

  // Unpriced rows came with the reference, tagged; cost computed.
  const leite = page.locator('.ing-row', { hasText: 'Leite condensado' });
  await leite.getByText('referência', { exact: true }).waitFor();
  await leite.getByText('R$ 8,79').first().waitFor(); // cost and summary both show it
  assert.equal(await page.locator('.ing-row', { hasText: 'Manteiga sem sal' }).getByText('referência', { exact: true }).count(), 0);
  await semRolagemHorizontal();
  await shot('copia');

  // Sheet explains; leaving the price field unchanged keeps it a reference
  // and never teaches the price bank.
  await leite.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText(/Preço de referência · Savegnago \(interior de SP\)/).waitFor();
  await shot('painel');
  await dialog.getByLabel('Preço pago (R$)').click();
  await dialog.getByLabel('Tamanho da embalagem').click();
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await leite.getByText('referência', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => (localStorage.getItem('calculadora-cozinha:precos') || '').includes('8.79')), false);

  // A newer week with a different price: update card.
  arquivo = semana('2026-10-19', 9.29);
  await page.reload();
  await page.getByRole('button', { name: 'Atualizar 1 preço' }).click();
  await page.getByText('1 preço atualizado').waitFor();
  await leite.getByText('R$ 9,29').first().waitFor();
  assert.equal(await page.getByRole('button', { name: /Atualizar \d+ preço/ }).count(), 0);

  // Editing the price makes it hers: tag and note go away.
  await page.locator('.ing-row', { hasText: 'Chocolate em pó' }).click();
  await dialog.getByLabel('Preço pago (R$)').click();
  await dialog.getByLabel('Preço pago (R$)').pressSequentially('1050');
  assert.equal(await dialog.getByText(/Preço de referência/).isVisible(), false);
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.ing-row', { hasText: 'Chocolate em pó' }).getByText('referência', { exact: true }).count(), 0);
}
```

Run `npm run test:mobile -- 15` — Expected: FAIL (no tag yet).

- [ ] **Step 3: Implement the row tag** in `js/screens/editor/ingredientes.js`:
  - Import `{ referenciaAntiga, referenciasParaAtualizar, atualizarReferencias } from '../../precos-referencia.js'`, `{ getPrecosReferencia } from '../../precos-referencia-loader.js'`, `{ showToast } from '../../ui/toast.js'`.
  - In `rowHtml`, replace the summary span with:
    ```js
        ${resumo ? html`<span class="muted ing-row-detail">${resumo}${item.origemPreco === 'referencia' ? html` <span class="tag">${referenciaAntiga(item, new Date().toISOString().slice(0, 10)) ? 'referência antiga' : 'referência'}</span>` : ''}</span>` : ''}
    ```

- [ ] **Step 4: Implement the update card** in the same file:
  - Panel HTML: insert `<div data-slot="referencia"></div>` right **before** `<h2 class="section-title"><span>Ingredientes</span>`.
  - After the slots are queried: `const referenciaSlot = panel.querySelector('[data-slot="referencia"]'); let referencia = null;`
  - Add:
    ```js
      function renderReferencia() {
        const n = referenciasParaAtualizar(store.recipe, referencia).length;
        if (!n) { referenciaSlot.innerHTML = ''; return; }
        const data = referencia.atualizadoEm.split('-').reverse().slice(0, 2).join('/');
        setHtml(referenciaSlot, html`
          <div class="card aviso-card" role="note">
            <p><strong>Preços de referência novos</strong> <span class="muted">(semana de ${data})</span></p>
            <button type="button" class="btn btn-secondary btn-block" data-action="atualizar-referencia" style="margin-top:8px">Atualizar ${n} ${n === 1 ? 'preço' : 'preços'}</button>
          </div>`);
      }
    ```
    call `renderReferencia();` at the end of `renderRows()`, and after `renderRows();` (initial) add:
    ```js
      getPrecosReferencia().then((ref) => { if (!events.signal.aborted) { referencia = ref; renderReferencia(); } }).catch(() => {});
    ```
  - Click handler: `else if (e.target.closest('[data-action="atualizar-referencia"]')) { let n = 0; store.update((r) => { n = atualizarReferencias(r, referencia); }); showToast(n === 1 ? '1 preço atualizado' : `${n} preços atualizados`); }`

- [ ] **Step 5: Implement the sheet note** in `js/screens/editor/ingrediente-sheet.js`:
  - Imports: `{ limparOrigem } from '../../precos-referencia.js'`, `{ getPrecosReferencia } from '../../precos-referencia-loader.js'`.
  - Markup: right after `<div data-pago>` insert `<p class="referencia-nota" data-referencia hidden></p>`.
  - Add:
    ```js
      function syncReferencia() {
        const nota = q('[data-referencia]');
        nota.hidden = item.origemPreco !== 'referencia';
        if (nota.hidden) return;
        const data = (item.referenciaEm || '').split('-').reverse().slice(0, 2).join('/');
        getPrecosReferencia().catch(() => null).then((ref) => {
          const f = ref?.fonte ?? { nome: 'Savegnago', regiao: 'interior de SP' };
          nota.textContent = `💡 Preço de referência · ${f.nome} (${f.regiao}) · semana de ${data}. Confira o preço que você paga.`;
        });
      }
      function virouDela() {
        if (item.origemPreco !== 'referencia') return;
        limparOrigem(item);
        syncReferencia();
      }
    ```
  - Call `virouDela()` at the start of the `bindCurrencyInput(f.precoEmbalagem, …)` callback, of the `f.tamanhoEmbalagem` `input` listener, and of the chip branch when `field === 'unidadeEmbalagem'` (before `persist()`).
  - `learnPrice()`: first line `if (item.origemPreco === 'referencia') return;` (the reference never enters the price bank).
  - Call `syncReferencia();` next to `syncSemCusto();` at the bottom, and inside the name `change` handler after `applyIngredientMatch` (a bank price clears it there).

- [ ] **Step 6: CSS** — after `.sem-custo-nota`:

```css
.referencia-nota { font-size: 0.875rem; color: var(--color-text-muted); background: var(--color-surface-input); border-radius: 12px; padding: 8px 12px; margin: 12px 0 0; }
```

- [ ] **Step 7: Run** `npm run test:mobile -- 15` until PASS, then `npm test` and `npm run test:mobile` (full) — Expected: all pass; look at `scripts/.screenshots/15-referencia-{copia,painel}-{light,dark}.png`.

- [ ] **Step 8: Commit** — message "Reference prices on screen: row tag, sheet note, 'Atualizar N preços'".

---

### Task 7: Primeira carga real, conferência com o usuário, CLAUDE.md

**Files:**
- Modify: `scripts/precos-referencia.config.json` (tuning), `data/precos-referencia.json` (real), `CLAUDE.md`

- [ ] **Step 1: Run** `npm run precos -- --dry-run` (network). Read every line. For each ingredient without reference or with a suspicious price, open the raw search (`https://www.savegnago.com.br/api/catalog_system/pub/products/search?ft=<busca>&_from=0&_to=49`) and adjust `busca`/`incluir`/`excluir`/`janela`. Repeat until no result is obviously wrong (prefer *no reference* over a doubtful one). Ledger each tuning as a ruling.

- [ ] **Step 2: Run** `npm run precos` (writes the file). `npm test` — Expected: PASS.

- [ ] **Step 3: Update CLAUDE.md** — structure (`js/precos-referencia*.js`, `scripts/precos-referencia*`, `.github/workflows/`, `data/precos-referencia.json`), test count, a "Preço de referência de mercado" bullet (robot weekly, Savegnago with region note, filled on copy, update card, never overrides hers, never enters the bank, 70% protection, `npm run precos` as fallback), and remove "Meus ingredientes" duplication if any.

- [ ] **Step 4: Commit** — config, data, CLAUDE.md — message "First reference price load (Savegnago), curated config, docs".

- [ ] **Step 5: STOP** — show the user the table of prices (and which ingredients have no reference) before any merge/push. Publishing is the user's call.
