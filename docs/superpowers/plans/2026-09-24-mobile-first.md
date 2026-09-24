# Reforma Mobile-First (A + B) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os erros de cálculo/dados e refazer a interface da Calculadora de Cozinha para uso no celular (lista em cartões, editor em abas, painel de ingrediente, barra de resultado fixa), sem build e sem dependências de runtime.

**Architecture:** A lógica sai do `js/app.js` (1.266 linhas) para módulos puros testáveis (`format`, `costing`, `share`, `results`, `ingredient-match`, `nutrition-table`, `router`, `store`). A UI é reescrita em módulos por tela (`js/screens/…`) e componentes (`js/ui/…`), ligados por um router de hash com History API e um store com autosave. O Tailwind CDN é substituído por CSS próprio de componentes.

**Tech Stack:** HTML + CSS + JavaScript (ES modules nativos), `localStorage`, `node --test` para testes unitários, Playwright (só `devDependencies`) para o smoke test mobile.

**Spec:** [docs/superpowers/specs/2026-09-24-mobile-first-design.md](../specs/2026-09-24-mobile-first-design.md)

## Global Constraints

- Vanilla JS, ES modules nativos (`type="module"`), **sem build step**, **zero dependências de runtime**. Playwright só em `devDependencies`.
- Tudo no branch `mobile-first`; nada vai para `master` antes da Task 18.
- Chaves do `localStorage` (`calculadora-cozinha:recipes`, `:custom-ingredients`, `:precos`, `:tema`) e formato das receitas/backup (`version: 1`) **não mudam**.
- Tokens de cor existentes em `css/styles.css` mantidos com os mesmos valores; bordas de card acinzentadas no claro e `transparent` no escuro.
- Cor do WhatsApp fixa nos dois temas: fundo `#25D366`, texto `#06301D`.
- `calculateMarkup` e `calculateRealMargin` continuam indicadores separados.
- Moeda sempre via `formatBRL` → `"R$ 33,51"` (espaço comum, vírgula decimal).
- Alvos de toque ≥ 44×44px; inputs com `font-size: 16px`; coluna única `max-width: 480px`.
- Texto do WhatsApp **nunca** contém custo, preço ou margem.
- Testes unitários ficam em `js/*.test.js` (o script `npm test` é `node --test js/*.test.js`).
- Comentários de código em inglês (padrão do repositório); textos da interface em português do Brasil.
- Cada commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Link direto para um ingrediente que não existe** (`#/receita/<id>/ingredientes/99`, ex.: após excluir ingredientes e recarregar): deve abrir a aba Ingredientes sem painel e corrigir o endereço, sem erro. → teste no smoke da Task 14.
2. **Painel aberto por link direto (sem histórico no app) + "Pronto"/voltar**: deve fechar o painel e continuar no app, na aba Ingredientes, e não sair do site. → teste no smoke da Task 15.
3. **Digitar vários dígitos seguidos num campo de preço do painel**: o foco não pode sair do campo (o teclado do celular não pode fechar) e o valor final tem que ser o digitado. → teste no smoke da Task 15.
4. **Nomes longos e valores grandes em 390px** ("Bolo de pote de ninho com Nutella e morango…", R$ 1.234,50): nada pode gerar rolagem horizontal. → asserção `semRolagemHorizontal` nos smokes das Tasks 12 e 14.
5. **Colar "R$ 1.234,56" num campo de moeda** tem que resultar em 1234,56, e não em 1,23 nem em NaN. → teste em `format.test.js` na Task 2.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `js/calculations.js` | (existente) `calculateSuggestedPrices` passa a ser por unidade | 1 |
| `js/format.js` | Moeda, números, máscara de moeda, parse, rótulos de unidade | 2 |
| `js/costing.js` | Custo por linha, gramas usados, problemas da linha, resumo da linha | 3 |
| `js/share.js` | Texto e URL do WhatsApp | 4 |
| `js/storage.js` | (existente) + `migrateRecipe`, escrita segura, excluir/restaurar | 5 |
| `js/router.js` | Rotas (puro) + navegação com History API | 6 |
| `js/store.js` | Receita aberta, autosave, status de salvamento | 7 |
| `js/results.js` | Todos os números derivados de uma receita (custo, lucro, sugestões, estado) | 8 |
| `js/ingredient-match.js`, `js/taco-loader.js` | Reconhecer ingrediente, ingrediente customizado, carregar TACO | 9 |
| `js/nutrition-table.js` | Nutrição por porção e HTML da tabela ANVISA | 10 |
| `css/styles.css`, `js/ui/*`, `js/theme.js`, `scripts/check-contrast.mjs` | Base visual e componentes | 11 |
| `index.html`, `js/app.js`, `js/session.js`, `js/screens/lista.js`, `js/screens/ajustes.js`, `scripts/smoke-mobile.mjs`, `scripts/smoke/*` | Troca para a nova app + tela de lista | 12 |
| `js/screens/editor.js`, `js/screens/result-bar.js`, `js/screens/editor/*.js` (versões iniciais) | Estrutura do editor, abas e barra | 13 |
| `js/screens/editor/ingredientes.js` | Aba Ingredientes | 14 |
| `js/screens/editor/ingrediente-sheet.js` | Painel de ingrediente | 15 |
| `js/screens/editor/custos.js`, `js/screens/editor/preco.js` | Abas Custos e Preço | 16 |
| `js/screens/editor/nutricao.js` | Aba Nutrição | 17 |
| `CLAUDE.md`, `.gitignore`, verificação final | Entrega | 18 |

---

### Task 1: Preço sugerido por unidade

**Files:**
- Modify: `js/calculations.js:91-96`
- Modify: `js/calculations.test.js:133-135`
- Modify: `js/app.js` (dois pontos de chamada, linhas ~1024 e ~1109; o arquivo inteiro é substituído na Task 12, mas até lá o app antigo precisa continuar funcionando)

**Interfaces:**
- Produces: `calculateSuggestedPrices({ custoPorPorcao: number|null }) → { preco2x, preco3x, preco4x } | null`

- [ ] **Step 1: Substituir o teste antigo pelo novo contrato**

Em `js/calculations.test.js`, troque o teste `'calculateSuggestedPrices: returns 2x and 3x total cost'` por:

```js
test('calculateSuggestedPrices: returns 2x, 3x and 4x the cost PER PORTION', () => {
  assert.deepEqual(calculateSuggestedPrices({ custoPorPorcao: 1.5 }), { preco2x: 3, preco3x: 4.5, preco4x: 6 });
});

test('calculateSuggestedPrices: unknown cost per portion returns null', () => {
  assert.equal(calculateSuggestedPrices({ custoPorPorcao: null }), null);
  assert.equal(calculateSuggestedPrices({ custoPorPorcao: NaN }), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL nos dois testes novos (retorna `{ preco2x: NaN, ... }` em vez do esperado).

- [ ] **Step 3: Implementar**

Em `js/calculations.js`, substitua `calculateSuggestedPrices` por:

```js
// Suggested prices are per portion — the same unit as "custo por porção"
// and "Quanto você vai cobrar? (por porção)". (It used to multiply the
// whole recipe's cost, which showed e.g. R$ 67,03 next to a R$ 1,12
// portion cost.)
export function calculateSuggestedPrices({ custoPorPorcao }) {
  if (typeof custoPorPorcao !== 'number' || !Number.isFinite(custoPorPorcao)) return null;
  return {
    preco2x: custoPorPorcao * 2,
    preco3x: custoPorPorcao * 3,
    preco4x: custoPorPorcao * 4
  };
}
```

- [ ] **Step 4: Ajustar as duas chamadas do app antigo**

Em `js/app.js`, `renderDashboardSection`: troque
`const sugeridos = calculateSuggestedPrices({ custoTotal });` por
`const sugeridos = calculateSuggestedPrices({ custoPorPorcao });`
e a linha do preço sugerido por:

```js
      <p class="text-[var(--color-accent-text)] font-semibold mt-3">Preço sugerido: ${sugeridos ? `R$ ${sugeridos.preco2x.toFixed(2)} a R$ ${sugeridos.preco3x.toFixed(2)}` : '—'}</p>
```

Em `buildRecipeShareText`: troque `const sugeridos = calculateSuggestedPrices({ custoTotal });` por `const sugeridos = calculateSuggestedPrices({ custoPorPorcao });` e a linha do array por:

```js
    sugeridos ? `Preço sugerido: R$ ${sugeridos.preco2x.toFixed(2)} a R$ ${sugeridos.preco3x.toFixed(2)}` : null,
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: PASS (61 testes).

- [ ] **Step 6: Commit**

```bash
git add js/calculations.js js/calculations.test.js js/app.js
git commit -m "Fix suggested price: multiply cost per portion, not whole-recipe cost

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `format.js` — moeda, números e unidades

**Files:**
- Create: `js/format.js`
- Test: `js/format.test.js`

**Interfaces:**
- Produces:
  - `formatBRL(value: number) → string` (`"R$ 33,51"`, `"-R$ 2,00"`)
  - `formatNumber(value: number, maxDecimals = 1) → string` (`"1.234,5"`)
  - `formatCurrencyInput(value: number|null) → string` (`"10,00"`, sem "R$", sem separador de milhar)
  - `formatDecimalInput(value: number) → string` (`"1,5"`, `"395"`, sem separador de milhar)
  - `maskCurrencyDigits(raw: string, { allowEmpty = false } = {}) → { value: number|null, text: string }`
  - `parseDecimal(raw: string) → number` (0 se inválido)
  - `parseInteger(raw: string) → number` (só dígitos; 0 se vazio)
  - `unitLabel(unidade: string, quantidade: number|null) → string`
  - `packageUnitShort(unidadeEmbalagem: string) → string`
  - `UNIT_CHIPS: Array<{ value, label }>`, `PACKAGE_UNIT_CHIPS: Array<{ value, label }>`

- [ ] **Step 1: Escrever os testes**

`js/format.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBRL, formatNumber, formatCurrencyInput, formatDecimalInput,
  maskCurrencyDigits, parseDecimal, parseInteger, unitLabel, packageUnitShort,
  UNIT_CHIPS, PACKAGE_UNIT_CHIPS
} from './format.js';

test('formatBRL: pt-BR currency with a plain space and comma decimals', () => {
  assert.equal(formatBRL(33.51), 'R$ 33,51');
  assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
  assert.equal(formatBRL(0), 'R$ 0,00');
  assert.equal(formatBRL(-2), '-R$ 2,00');
});

test('formatBRL: non-numbers render as R$ 0,00 instead of NaN', () => {
  assert.equal(formatBRL(null), 'R$ 0,00');
  assert.equal(formatBRL(undefined), 'R$ 0,00');
});

test('formatNumber: pt-BR grouping and rounding', () => {
  assert.equal(formatNumber(903.65, 0), '904');
  assert.equal(formatNumber(13.65, 1), '13,7');
  assert.equal(formatNumber(1234.5, 1), '1.234,5');
  assert.equal(formatNumber(60), '60');
});

test('formatCurrencyInput: two decimals, comma, no grouping', () => {
  assert.equal(formatCurrencyInput(10), '10,00');
  assert.equal(formatCurrencyInput(1234.5), '1234,50');
  assert.equal(formatCurrencyInput(null), '0,00');
});

test('formatDecimalInput: comma decimal, trims float noise, no grouping', () => {
  assert.equal(formatDecimalInput(1.5), '1,5');
  assert.equal(formatDecimalInput(395), '395');
  assert.equal(formatDecimalInput(1000), '1000');
  assert.equal(formatDecimalInput(0.1 + 0.2), '0,3');
});

test('maskCurrencyDigits: digits shift in from the right (bank-app style)', () => {
  assert.deepEqual(maskCurrencyDigits('050'), { value: 0.5, text: '0,50' });
  assert.deepEqual(maskCurrencyDigits('1000'), { value: 10, text: '10,00' });
  assert.deepEqual(maskCurrencyDigits('7,499'), { value: 74.99, text: '74,99' });
});

test('maskCurrencyDigits: pasted "R$ 1.234,56" becomes 1234.56', () => {
  assert.deepEqual(maskCurrencyDigits('R$ 1.234,56'), { value: 1234.56, text: '1234,56' });
});

test('maskCurrencyDigits: empty input is 0 by default, null with allowEmpty', () => {
  assert.deepEqual(maskCurrencyDigits(''), { value: 0, text: '0,00' });
  assert.deepEqual(maskCurrencyDigits('', { allowEmpty: true }), { value: null, text: '' });
  assert.deepEqual(maskCurrencyDigits('R$ ', { allowEmpty: true }), { value: null, text: '' });
});

test('parseDecimal: comma or dot, invalid is 0', () => {
  assert.equal(parseDecimal('1,5'), 1.5);
  assert.equal(parseDecimal('2.25'), 2.25);
  assert.equal(parseDecimal('abc'), 0);
  assert.equal(parseDecimal(''), 0);
});

test('parseInteger: keeps digits only, empty is 0', () => {
  assert.equal(parseInteger('30'), 30);
  assert.equal(parseInteger(' 3a0 '), 30);
  assert.equal(parseInteger(''), 0);
});

test('unitLabel: readable pt-BR names, plural above 1', () => {
  assert.equal(unitLabel('colherSopa', 1), 'colher de sopa');
  assert.equal(unitLabel('colherSopa', 2), 'colheres de sopa');
  assert.equal(unitLabel('colherCha', 0.5), 'colher de chá');
  assert.equal(unitLabel('xicara', 1.5), 'xícaras');
  assert.equal(unitLabel('unidade', 2), 'unidades');
  assert.equal(unitLabel('unidade', null), 'unidade');
  assert.equal(unitLabel('g', 100), 'g');
  assert.equal(unitLabel('ml', 200), 'ml');
  assert.equal(unitLabel('litro', 2), 'litro');
});

test('packageUnitShort: g, ml, un.', () => {
  assert.equal(packageUnitShort('g'), 'g');
  assert.equal(packageUnitShort('ml'), 'ml');
  assert.equal(packageUnitShort('unidade'), 'un.');
});

test('chip lists cover every stored unit value', () => {
  assert.deepEqual(UNIT_CHIPS.map((c) => c.value), ['g', 'ml', 'xicara', 'colherSopa', 'colherCha', 'unidade']);
  assert.deepEqual(PACKAGE_UNIT_CHIPS.map((c) => c.value), ['g', 'ml', 'unidade']);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './format.js'`.

- [ ] **Step 3: Implementar `js/format.js`**

```js
// js/format.js
//
// Pure formatting/parsing helpers shared by every screen. No DOM here, so
// all of it is unit-tested; the one DOM-touching wrapper
// (applyCurrencyMask) lives in ui/dom.js and delegates to maskCurrencyDigits.

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Intl puts a non-breaking space after "R$"; normalized to a plain space so
// the same string works in the UI, in tests and in WhatsApp text.
export function formatBRL(value) {
  const numeric = Number(value);
  return BRL.format(Number.isFinite(numeric) ? numeric : 0).replace(/ /g, ' ');
}

export function formatNumber(value, maxDecimals = 1) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: maxDecimals }).format(Number(value) || 0);
}

// Text for a currency <input>: always two decimals, no "R$", no thousands
// separator (so re-parsing it is unambiguous).
export function formatCurrencyInput(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

// Text for a plain decimal <input> (package size, minutes, nutrients).
export function formatDecimalInput(value) {
  return String(Number(Number(value || 0).toFixed(3))).replace('.', ',');
}

// "Money mask" used by Brazilian banking apps: every digit typed shifts in
// from the right, always filling the cents. Only digits are kept, so pasted
// text like "R$ 1.234,56" still reads as 1234.56.
export function maskCurrencyDigits(raw, { allowEmpty = false } = {}) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (allowEmpty && digits === '') return { value: null, text: '' };
  const value = parseInt(digits || '0', 10) / 100;
  return { value, text: formatCurrencyInput(value) };
}

export function parseDecimal(raw) {
  const numeric = Number(String(raw ?? '').trim().replace(',', '.'));
  return String(raw ?? '').trim() !== '' && Number.isFinite(numeric) ? numeric : 0;
}

export function parseInteger(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

const UNIT_LABELS = {
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  xicara: ['xícara', 'xícaras'],
  colherSopa: ['colher de sopa', 'colheres de sopa'],
  colherCha: ['colher de chá', 'colheres de chá'],
  unidade: ['unidade', 'unidades']
};

// Stored unit values (xicara, colherSopa…) stay as they are in
// localStorage; this is only how they are shown.
export function unitLabel(unidade, quantidade) {
  const labels = UNIT_LABELS[unidade];
  if (!labels) return String(unidade);
  return typeof quantidade === 'number' && quantidade > 1 ? labels[1] : labels[0];
}

export function packageUnitShort(unidadeEmbalagem) {
  return unidadeEmbalagem === 'unidade' ? 'un.' : String(unidadeEmbalagem);
}

export const UNIT_CHIPS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'xicara', label: 'xícara' },
  { value: 'colherSopa', label: 'c. sopa' },
  { value: 'colherCha', label: 'c. chá' },
  { value: 'unidade', label: 'unidade' }
];

export const PACKAGE_UNIT_CHIPS = [
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'unidade', label: 'unidade' }
];
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/format.js js/format.test.js
git commit -m "Add format.js: pt-BR currency/number formatting, currency mask, unit labels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `costing.js` — custo por ingrediente

**Files:**
- Create: `js/costing.js`
- Test: `js/costing.test.js`

**Interfaces:**
- Consumes: `parseQuantity`, `toGrams`, `calculateIngredientCost` (calculations.js); `formatBRL`, `formatDecimalInput`, `unitLabel`, `packageUnitShort` (format.js)
- Produces:
  - `computeLineCost(item) → number|null` (lógica idêntica à de `app.js:430-510`)
  - `quantidadeConvertidaEmGramas(item, quantidade) → number|null` (idêntica a `app.js:537-547`)
  - `gramsUsed(item) → number|null`
  - `lineIssue(item) → null | 'quantidade' | 'quantidadeInvalida' | 'preco' | 'tamanho' | 'conversao'`
  - `ISSUE_TEXT: Record<issue, string>`
  - `ingredientSummary(item) → string` (ex.: `"2 unidades · R$ 7,49 / 395 g"`)

Formato de `item` (inalterado): `{ ingredientId, nome, quantidadeBruta: string, unidade: 'g'|'ml'|'xicara'|'colherSopa'|'colherCha'|'unidade', precoEmbalagem: number, tamanhoEmbalagem: number, unidadeEmbalagem: 'g'|'ml'|'unidade', nutricao100g, densidadeGml: number|null, pesoUnidadeG: number|null }`.

- [ ] **Step 1: Escrever os testes**

`js/costing.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLineCost, quantidadeConvertidaEmGramas, gramsUsed, lineIssue, ISSUE_TEXT, ingredientSummary } from './costing.js';

function item(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null,
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

test('computeLineCost: grams used from a gram package', () => {
  assert.equal(round2(computeLineCost(item({ quantidadeBruta: '240', precoEmbalagem: 5, tamanhoEmbalagem: 1000 }))), 1.2);
});

test('computeLineCost: ml package is converted through density', () => {
  // 900 ml of oil (0.92 g/ml) = 828 g for R$ 9; using 92 g -> R$ 1,00
  const oil = item({ quantidadeBruta: '92', precoEmbalagem: 9, tamanhoEmbalagem: 900, unidadeEmbalagem: 'ml', densidadeGml: 0.92 });
  assert.equal(round2(computeLineCost(oil)), 1);
});

test('computeLineCost: "2 unidades" of a can bought by weight = 2 whole cans', () => {
  const lata = item({ quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 });
  assert.equal(round2(computeLineCost(lata)), 14.98);
});

test('computeLineCost: eggs by the unit from a dozen', () => {
  const ovos = item({ quantidadeBruta: '3', unidade: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade', pesoUnidadeG: 50 });
  assert.equal(computeLineCost(ovos), 3);
});

test('computeLineCost: eggs by weight from a dozen uses the average egg weight', () => {
  const ovos = item({ quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade', pesoUnidadeG: 50 });
  assert.equal(computeLineCost(ovos), 2);
});

test('computeLineCost: fraction "1/2" of a xícara via density', () => {
  // 1/2 xícara (120 ml) of flour at 0.5 g/ml = 60 g; 1 kg costs R$ 5 -> R$ 0,30
  const farinha = item({ quantidadeBruta: '1/2', unidade: 'xicara', densidadeGml: 0.5, precoEmbalagem: 5, tamanhoEmbalagem: 1000 });
  assert.equal(round2(computeLineCost(farinha)), 0.3);
});

test('computeLineCost: impossible conversions return null', () => {
  assert.equal(computeLineCost(item({ quantidadeBruta: '1', unidade: 'xicara', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), null);
  assert.equal(computeLineCost(item({ quantidadeBruta: '100', unidade: 'g', unidadeEmbalagem: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12 })), null);
  assert.equal(computeLineCost(item({ quantidadeBruta: 'meia', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), null);
});

test('quantidadeConvertidaEmGramas: only when a real conversion happens', () => {
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'xicara', densidadeGml: 0.5 }), 0.5), 60);
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'unidade', pesoUnidadeG: 50, unidadeEmbalagem: 'g' }), 2), 100);
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'unidade', pesoUnidadeG: 50, unidadeEmbalagem: 'unidade' }), 2), null);
  assert.equal(quantidadeConvertidaEmGramas(item({ unidade: 'g' }), 100), null);
});

test('gramsUsed: direct, converted, and whole-package cases', () => {
  assert.equal(gramsUsed(item({ quantidadeBruta: '100', unidade: 'g' })), 100);
  assert.equal(gramsUsed(item({ quantidadeBruta: '1', unidade: 'colherSopa', densidadeGml: 1 })), 15);
  assert.equal(gramsUsed(item({ quantidadeBruta: '2', unidade: 'unidade', tamanhoEmbalagem: 395, unidadeEmbalagem: 'g' })), 790);
  assert.equal(Math.round(gramsUsed(item({ quantidadeBruta: '1', unidade: 'unidade', tamanhoEmbalagem: 200, unidadeEmbalagem: 'ml', densidadeGml: 1.03 }))), 206);
  assert.equal(gramsUsed(item({ quantidadeBruta: '2', unidade: 'unidade', pesoUnidadeG: 50 })), 100);
});

test('gramsUsed: unknown when it cannot be computed', () => {
  assert.equal(gramsUsed(item({ quantidadeBruta: '', unidade: 'g' })), null);
  assert.equal(gramsUsed(item({ quantidadeBruta: '1', unidade: 'xicara' })), null);
  assert.equal(gramsUsed(item({ quantidadeBruta: '1', unidade: 'unidade', tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade' })), null);
});

test('lineIssue: first missing piece, in the order a person fills the form', () => {
  assert.equal(lineIssue(item({})), 'quantidade');
  assert.equal(lineIssue(item({ quantidadeBruta: 'meia' })), 'quantidadeInvalida');
  assert.equal(lineIssue(item({ quantidadeBruta: '100' })), 'preco');
  assert.equal(lineIssue(item({ quantidadeBruta: '100', precoEmbalagem: 5 })), 'tamanho');
  assert.equal(lineIssue(item({ quantidadeBruta: '1', unidade: 'xicara', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), 'conversao');
  assert.equal(lineIssue(item({ quantidadeBruta: '100', precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), null);
});

test('ISSUE_TEXT has a message for every issue', () => {
  for (const key of ['quantidade', 'quantidadeInvalida', 'preco', 'tamanho', 'conversao']) {
    assert.equal(typeof ISSUE_TEXT[key], 'string');
  }
});

test('ingredientSummary: quantity with readable unit and what was paid', () => {
  const lata = item({ quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 });
  assert.equal(ingredientSummary(lata), '2 unidades · R$ 7,49 / 395 g');
  const manteiga = item({ quantidadeBruta: '1', unidade: 'colherSopa', precoEmbalagem: 11.5, tamanhoEmbalagem: 200 });
  assert.equal(ingredientSummary(manteiga), '1 colher de sopa · R$ 11,50 / 200 g');
  const ovos = item({ quantidadeBruta: '3', unidade: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade' });
  assert.equal(ingredientSummary(ovos), '3 unidades · R$ 12,00 / 12 un.');
});

test('ingredientSummary: partial data shows only what exists', () => {
  assert.equal(ingredientSummary(item({ quantidadeBruta: '100' })), '100 g');
  assert.equal(ingredientSummary(item({ precoEmbalagem: 5, tamanhoEmbalagem: 1000 })), 'R$ 5,00 / 1000 g');
  assert.equal(ingredientSummary(item({})), '');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './costing.js'`.

- [ ] **Step 3: Implementar `js/costing.js`**

```js
// js/costing.js
//
// Per-ingredient cost math, moved out of app.js so it can be unit-tested.
// computeLineCost and quantidadeConvertidaEmGramas keep exactly the
// behavior they had in app.js (including the "whole package" rule for
// "1 lata" and the count-based rule for eggs bought by the dozen).

import { parseQuantity, toGrams, calculateIngredientCost } from './calculations.js';
import { formatBRL, formatDecimalInput, unitLabel, packageUnitShort } from './format.js';

export function computeLineCost(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  // Bought by the piece (a dozen eggs): compare both sides in units.
  if (item.unidadeEmbalagem === 'unidade') {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;

    let usadoEmUnidades;
    if (item.unidade === 'unidade') {
      usadoEmUnidades = quantidade;
    } else {
      // Recipe measures by weight/volume but it's bought by the piece:
      // convert back to a unit count via the average weight per unit.
      if (!item.pesoUnidadeG) return null;
      const gramas = toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
      if (gramas == null) return null;
      usadoEmUnidades = gramas / item.pesoUnidadeG;
    }

    return calculateIngredientCost({
      gramasUsadas: usadoEmUnidades,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
  }

  // "1 unidade" of something sold by weight/volume with no known weight
  // per unit (e.g. "1 lata de leite condensado"): one whole package.
  if (item.unidade === 'unidade' && item.pesoUnidadeG == null) {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;
    return calculateIngredientCost({
      gramasUsadas: quantidade * item.tamanhoEmbalagem,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
  }

  const gramas = toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
  if (gramas == null) return null;

  // An 'ml' package must be converted to grams via density first, or
  // 900 ml of oil would be costed as 900 g.
  const gramasEmbalagem = item.unidadeEmbalagem === 'ml'
    ? toGrams({ quantidade: item.tamanhoEmbalagem, unidade: 'ml', densidadeGml: item.densidadeGml, pesoUnidadeG: null })
    : item.tamanhoEmbalagem;

  return calculateIngredientCost({ gramasUsadas: gramas, gramasEmbalagem, precoEmbalagem: item.precoEmbalagem });
}

// The "≈ 60 g" hint: only for units where a hidden conversion happens.
export function quantidadeConvertidaEmGramas(item, quantidade) {
  if (quantidade == null) return null;
  if (item.unidade === 'xicara' || item.unidade === 'colherSopa' || item.unidade === 'colherCha') {
    if (item.densidadeGml == null) return null;
    return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml });
  }
  if (item.unidade === 'unidade' && item.unidadeEmbalagem !== 'unidade' && item.pesoUnidadeG != null) {
    return quantidade * item.pesoUnidadeG;
  }
  return null;
}

// Grams of this ingredient that go into the recipe, or null when unknown.
// Mirrors computeLineCost's "whole package" rule for "1 lata".
export function gramsUsed(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;

  if (item.unidade === 'unidade' && item.pesoUnidadeG == null) {
    if (!item.tamanhoEmbalagem || item.tamanhoEmbalagem <= 0) return null;
    if (item.unidadeEmbalagem === 'g') return quantidade * item.tamanhoEmbalagem;
    if (item.unidadeEmbalagem === 'ml') {
      return item.densidadeGml == null ? null : quantidade * item.tamanhoEmbalagem * item.densidadeGml;
    }
    return null;
  }

  return toGrams({ quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG });
}

export const ISSUE_TEXT = {
  quantidade: 'falta a quantidade',
  quantidadeInvalida: 'quantidade não reconhecida (use 2, 1/2 ou 0,5)',
  preco: 'falta o preço',
  tamanho: 'falta o tamanho da embalagem',
  conversao: 'não dá para converter essa unidade — use g ou ml'
};

export function lineIssue(item) {
  if (String(item.quantidadeBruta ?? '').trim() === '') return 'quantidade';
  if (parseQuantity(item.quantidadeBruta) == null) return 'quantidadeInvalida';
  if (!(item.precoEmbalagem > 0)) return 'preco';
  if (!(item.tamanhoEmbalagem > 0)) return 'tamanho';
  if (computeLineCost(item) == null) return 'conversao';
  return null;
}

export function ingredientSummary(item) {
  const partes = [];
  const bruta = String(item.quantidadeBruta ?? '').trim();
  if (bruta) partes.push(`${bruta} ${unitLabel(item.unidade, parseQuantity(bruta))}`);
  if (item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) {
    partes.push(`${formatBRL(item.precoEmbalagem)} / ${formatDecimalInput(item.tamanhoEmbalagem)} ${packageUnitShort(item.unidadeEmbalagem)}`);
  }
  return partes.join(' · ');
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/costing.js js/costing.test.js
git commit -m "Add costing.js: tested per-ingredient cost, grams used, line issues and summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `share.js` — texto do WhatsApp sem custos

**Files:**
- Create: `js/share.js`
- Test: `js/share.test.js`

**Interfaces:**
- Consumes: `parseQuantity` (calculations.js), `gramsUsed` (costing.js), `unitLabel`, `formatNumber` (format.js)
- Produces: `buildRecipeShareText(recipe) → string`, `whatsappUrl(text) → string`

- [ ] **Step 1: Escrever os testes**

`js/share.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecipeShareText, whatsappUrl } from './share.js';

function item(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null, ...overrides
  };
}

const brigadeiro = {
  nome: 'Brigadeiro Gourmet',
  rendimento: 30,
  precoVendaDesejado: 3.5,
  ingredientes: [
    item({ nome: 'Leite condensado', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 }),
    item({ nome: 'Chocolate 50%', quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 12.9, tamanhoEmbalagem: 200 }),
    item({ nome: 'Manteiga', quantidadeBruta: '1', unidade: 'colherSopa', precoEmbalagem: 11.5, tamanhoEmbalagem: 200, densidadeGml: 0.91 })
  ]
};

test('buildRecipeShareText: recipe only — ingredients, yield and total weight', () => {
  assert.equal(buildRecipeShareText(brigadeiro), [
    '*Brigadeiro Gourmet*',
    '',
    'Ingredientes:',
    '- 2 unidades de Leite condensado',
    '- 100 g de Chocolate 50%',
    '- 1 colher de sopa de Manteiga',
    '',
    'Rende: 30 porções (≈ 904 g no total)',
    '',
    'Enviado pela Calculadora de Cozinha'
  ].join('\n'));
});

test('buildRecipeShareText: never includes costs or prices', () => {
  const text = buildRecipeShareText(brigadeiro);
  assert.ok(!text.includes('R$'));
  assert.ok(!/custo|preço|margem|lucro/i.test(text));
});

test('buildRecipeShareText: total weight omitted when any ingredient weight is unknown', () => {
  const recipe = { ...brigadeiro, ingredientes: [...brigadeiro.ingredientes, item({ nome: 'Farinha misteriosa', quantidadeBruta: '1', unidade: 'xicara' })] };
  assert.ok(buildRecipeShareText(recipe).includes('\nRende: 30 porções\n'));
});

test('buildRecipeShareText: ingredient without quantity, singular portion, blank rows, no name', () => {
  const recipe = { nome: '  ', rendimento: 1, ingredientes: [item({ nome: 'Sal' }), item({ nome: '' })] };
  const text = buildRecipeShareText(recipe);
  assert.ok(text.startsWith('*(sem nome)*'));
  assert.ok(text.includes('\n- Sal\n'));
  assert.ok(text.includes('Rende: 1 porção\n'));
});

test('buildRecipeShareText: no ingredients', () => {
  const text = buildRecipeShareText({ nome: 'Bolo', rendimento: 8, ingredientes: [] });
  assert.ok(text.includes('(nenhum ingrediente cadastrado)'));
  assert.ok(text.includes('Rende: 8 porções\n'));
});

test('whatsappUrl: wa.me link with encoded text', () => {
  assert.equal(whatsappUrl('*Bolo*\nRende: 8'), 'https://wa.me/?text=*Bolo*%0ARende%3A%208');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './share.js'`.

- [ ] **Step 3: Implementar `js/share.js`**

```js
// js/share.js
//
// Text sent through WhatsApp. It is the RECIPE only (ingredients and
// yield) — never costs, prices or margins, so it can be sent to a customer
// or a partner without revealing how the price was built.

import { parseQuantity } from './calculations.js';
import { gramsUsed } from './costing.js';
import { unitLabel, formatNumber } from './format.js';

function ingredientLine(item) {
  const nome = item.nome.trim();
  const bruta = String(item.quantidadeBruta ?? '').trim();
  if (!bruta) return `- ${nome}`;
  return `- ${bruta} ${unitLabel(item.unidade, parseQuantity(bruta))} de ${nome}`;
}

function totalGrams(itens) {
  if (itens.length === 0) return null;
  let total = 0;
  for (const item of itens) {
    const g = gramsUsed(item);
    if (g == null) return null;
    total += g;
  }
  return total;
}

export function buildRecipeShareText(recipe) {
  const itens = (recipe.ingredientes || []).filter((i) => typeof i.nome === 'string' && i.nome.trim() !== '');
  const porcoes = recipe.rendimento === 1 ? 'porção' : 'porções';
  const gramas = totalGrams(itens);
  const rende = `Rende: ${recipe.rendimento} ${porcoes}` + (gramas != null ? ` (≈ ${formatNumber(gramas, 0)} g no total)` : '');

  return [
    // *bold* is WhatsApp's own formatting syntax; plain ASCII on purpose
    // (a 4-byte emoji was seen getting corrupted by wa.me redirects).
    `*${recipe.nome?.trim() || '(sem nome)'}*`,
    '',
    'Ingredientes:',
    itens.map(ingredientLine).join('\n') || '(nenhum ingrediente cadastrado)',
    '',
    rende,
    '',
    'Enviado pela Calculadora de Cozinha'
  ].join('\n');
}

// wa.me opens the WhatsApp app (phone) or WhatsApp Web (desktop) with the
// text pre-filled, without any browser permission.
export function whatsappUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/share.js js/share.test.js
git commit -m "Add share.js: WhatsApp text with the recipe only, no costs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `storage.js` — migração, escrita segura, excluir/restaurar

**Files:**
- Modify: `js/storage.js`
- Test: `js/storage.test.js` (novo)

**Interfaces:**
- Produces:
  - `migrateRecipe(recipe) → recipe` (puro, novo objeto)
  - `getRecipes()` passa a devolver receitas já migradas
  - `saveRecipe(recipe) → boolean` (false se o `localStorage` recusar)
  - `deleteRecipe(id) → { recipe, index } | null`
  - `restoreRecipe(recipe, index) → boolean`
  - Demais exports inalterados (`getRecipe`, `duplicateRecipe`, `createEmptyRecipe`, `getCustomIngredients`, `saveCustomIngredient`, `exportAllData`, `getPreco`, `savePreco`, `applyPricingToAllRecipes`, `importBackup`).

- [ ] **Step 1: Escrever os testes**

`js/storage.test.js` (o Node 24 não tem `localStorage`; o teste instala uma versão em memória):

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

function installMemoryStorage({ failWrites = false } = {}) {
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('QuotaExceededError'); data.set(k, String(v)); },
    removeItem: (k) => data.delete(k)
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  return data;
}

const {
  migrateRecipe, getRecipes, saveRecipe, deleteRecipe, restoreRecipe, createEmptyRecipe
} = await import('./storage.js');

beforeEach(() => installMemoryStorage());

test('migrateRecipe: backfills quantidadeEmbalagens from rendimento', () => {
  const migrated = migrateRecipe({ id: 'r', rendimento: 20, ingredientes: [] });
  assert.equal(migrated.quantidadeEmbalagens, 20);
});

test('migrateRecipe: keeps an existing quantidadeEmbalagens, including 0', () => {
  assert.equal(migrateRecipe({ id: 'r', rendimento: 20, quantidadeEmbalagens: 5, ingredientes: [] }).quantidadeEmbalagens, 5);
  assert.equal(migrateRecipe({ id: 'r', rendimento: 20, quantidadeEmbalagens: 0, ingredientes: [] }).quantidadeEmbalagens, 0);
});

test('migrateRecipe: drops blank ingredient rows saved by the old editor', () => {
  const migrated = migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [{ nome: 'Farinha' }, { nome: '' }, { nome: '   ' }] });
  assert.deepEqual(migrated.ingredientes.map((i) => i.nome), ['Farinha']);
});

test('migrateRecipe: is idempotent and does not mutate its input', () => {
  const original = { id: 'r', rendimento: 3, ingredientes: [{ nome: 'A' }, { nome: '' }] };
  const once = migrateRecipe(original);
  assert.deepEqual(migrateRecipe(once), once);
  assert.equal(original.ingredientes.length, 2);
  assert.equal('quantidadeEmbalagens' in original, false);
});

test('getRecipes: returns migrated recipes', () => {
  localStorage.setItem('calculadora-cozinha:recipes', JSON.stringify([{ id: 'r', nome: 'Velha', rendimento: 4, ingredientes: [{ nome: '' }] }]));
  const [recipe] = getRecipes();
  assert.equal(recipe.quantidadeEmbalagens, 4);
  assert.equal(recipe.ingredientes.length, 0);
});

test('saveRecipe: returns true on success and false when storage refuses', () => {
  assert.equal(saveRecipe(createEmptyRecipe()), true);
  installMemoryStorage({ failWrites: true });
  assert.equal(saveRecipe(createEmptyRecipe()), false);
});

test('deleteRecipe + restoreRecipe: undo puts the recipe back at the same position', () => {
  const a = { ...createEmptyRecipe(), nome: 'A' };
  const b = { ...createEmptyRecipe(), nome: 'B' };
  const c = { ...createEmptyRecipe(), nome: 'C' };
  [a, b, c].forEach(saveRecipe);

  const removed = deleteRecipe(b.id);
  assert.equal(removed.index, 1);
  assert.equal(removed.recipe.nome, 'B');
  assert.deepEqual(getRecipes().map((r) => r.nome), ['A', 'C']);

  restoreRecipe(removed.recipe, removed.index);
  assert.deepEqual(getRecipes().map((r) => r.nome), ['A', 'B', 'C']);
});

test('deleteRecipe: unknown id returns null', () => {
  assert.equal(deleteRecipe('recipe:nope'), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `migrateRecipe` e `restoreRecipe` não exportados.

- [ ] **Step 3: Implementar em `js/storage.js`**

Substitua `readList` e `writeList`:

```js
function readList(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return []; // storage blocked (some private modes)
  }
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Returns false instead of throwing when the browser refuses the write
// (quota full, private mode), so the UI can show "Não salvo".
function writeList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
```

Adicione `migrateRecipe` logo acima de `getRecipes` e faça `getRecipes` usá-lo:

```js
// Every recipe read from storage goes through here, so old data keeps
// working with no action from the user. Pure and idempotent.
export function migrateRecipe(recipe) {
  const migrated = {
    ...recipe,
    // The old editor always saved a trailing blank row; the new one adds
    // ingredients through a sheet, so blank rows are just noise.
    ingredientes: (recipe.ingredientes || []).filter((i) => i && typeof i.nome === 'string' && i.nome.trim() !== '')
  };
  // Recipes saved before "quantidade de embalagens" existed implicitly
  // used 1 package per portion.
  if (migrated.quantidadeEmbalagens == null) {
    migrated.quantidadeEmbalagens = migrated.rendimento;
  }
  return migrated;
}

export function getRecipes() {
  return readList(RECIPES_KEY).map(migrateRecipe);
}
```

Faça `saveRecipe` devolver o resultado da escrita (troque a última linha `writeList(RECIPES_KEY, recipes);` por `return writeList(RECIPES_KEY, recipes);`).

Substitua `deleteRecipe` e adicione `restoreRecipe`:

```js
// Returns what was removed (and where), so the list can offer "Desfazer".
export function deleteRecipe(id) {
  const recipes = getRecipes();
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return null;
  const [recipe] = recipes.splice(index, 1);
  writeList(RECIPES_KEY, recipes);
  return { recipe, index };
}

export function restoreRecipe(recipe, index) {
  const recipes = getRecipes().filter((r) => r.id !== recipe.id);
  recipes.splice(Math.min(index, recipes.length), 0, recipe);
  return writeList(RECIPES_KEY, recipes);
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js js/storage.test.js
git commit -m "storage: migrateRecipe on read, safe writes, delete returns position for undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `router.js` — rotas e voltar do celular

**Files:**
- Create: `js/router.js`
- Test: `js/router.test.js`

**Interfaces:**
- Produces:
  - `TABS = ['ingredientes', 'custos', 'preco', 'nutricao']`
  - `parseRoute(hash: string) → Route`, onde `Route = { screen: 'lista', sheet?: 'ajustes' } | { screen: 'editor', recipeId: string, aba: Tab, item?: number | 'novo' }`
  - `buildHash(route) → string`
  - `startRouter(handler: (route) => void)` — chama `handler` já com a rota atual e a cada `popstate`; antes, troca o endereço pelo hash canônico da rota (`replaceState`), então a lista é sempre `#/` e o editor sempre `#/receita/<id>/<aba>`
  - `navigate(route, { replace = false } = {})` — push (entrada marcada `{ inApp: true }`) ou replace, e chama o handler
  - `goBack(fallbackRoute)` — `history.back()` se a entrada atual foi criada pelo app; senão `navigate(fallback, { replace: true })`

- [ ] **Step 1: Escrever os testes**

`js/router.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, buildHash, TABS } from './router.js';

test('parseRoute: list and settings', () => {
  assert.deepEqual(parseRoute(''), { screen: 'lista' });
  assert.deepEqual(parseRoute('#/'), { screen: 'lista' });
  assert.deepEqual(parseRoute('#/ajustes'), { screen: 'lista', sheet: 'ajustes' });
});

test('parseRoute: editor defaults to the Ingredientes tab', () => {
  assert.deepEqual(parseRoute('#/receita/abc'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes' });
});

test('parseRoute: every tab', () => {
  for (const aba of TABS) {
    assert.deepEqual(parseRoute(`#/receita/abc/${aba}`), { screen: 'editor', recipeId: 'abc', aba });
  }
});

test('parseRoute: ingredient sheet by index or new', () => {
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/2'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 2 });
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/novo'), { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 'novo' });
});

test('parseRoute: anything unknown falls back to the list', () => {
  for (const hash of ['#/xyz', '#/receita', '#/receita/abc/lucro', '#/receita/abc/custos/2', '#/receita/abc/ingredientes/-1', '#/receita/abc/ingredientes/x', '#/receita/%E0%A4%A']) {
    assert.deepEqual(parseRoute(hash), { screen: 'lista' }, hash);
  }
});

test('buildHash: round-trips, including recipe ids with ":"', () => {
  const routes = [
    { screen: 'lista' },
    { screen: 'lista', sheet: 'ajustes' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'preco' },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes', item: 0 },
    { screen: 'editor', recipeId: 'recipe:1f2e-3d', aba: 'ingredientes', item: 'novo' }
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(buildHash(route)), route);
  }
  assert.equal(buildHash({ screen: 'lista' }), '#/');
  assert.equal(buildHash({ screen: 'editor', recipeId: 'recipe:1', aba: 'custos' }), '#/receita/recipe%3A1/custos');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './router.js'`.

- [ ] **Step 3: Implementar `js/router.js`**

```js
// js/router.js
//
// Hash routes, so the phone's back button/gesture moves through the app
// (closes a sheet, then leaves the recipe) instead of leaving the site.
// parseRoute/buildHash are pure and tested; the rest touches `history`
// only when called.

export const TABS = ['ingredientes', 'custos', 'preco', 'nutricao'];

const LISTA = { screen: 'lista' };

export function parseRoute(hash) {
  let parts;
  try {
    const path = String(hash || '').replace(/^#/, '').replace(/^\/+|\/+$/g, '');
    parts = path === '' ? [] : path.split('/').map(decodeURIComponent);
  } catch {
    return LISTA; // malformed %-encoding
  }

  if (parts.length === 0) return LISTA;
  if (parts.length === 1 && parts[0] === 'ajustes') return { screen: 'lista', sheet: 'ajustes' };
  if (parts[0] !== 'receita' || !parts[1] || parts.length > 4) return LISTA;

  const recipeId = parts[1];
  const aba = parts[2] ?? 'ingredientes';
  if (!TABS.includes(aba)) return LISTA;
  if (parts.length <= 3) return { screen: 'editor', recipeId, aba };

  if (aba !== 'ingredientes') return LISTA;
  if (parts[3] === 'novo') return { screen: 'editor', recipeId, aba, item: 'novo' };
  if (/^\d+$/.test(parts[3])) return { screen: 'editor', recipeId, aba, item: Number(parts[3]) };
  return LISTA;
}

export function buildHash(route) {
  if (route.screen === 'editor') {
    let hash = `#/receita/${encodeURIComponent(route.recipeId)}/${route.aba ?? 'ingredientes'}`;
    if (route.item != null) hash += `/${route.item}`;
    return hash;
  }
  return route.sheet === 'ajustes' ? '#/ajustes' : '#/';
}

let handler = () => {};

// The address bar always shows the canonical hash for the current route
// ("" -> "#/", "#/receita/x" -> "#/receita/x/ingredientes", junk -> "#/").
function dispatch() {
  const route = parseRoute(location.hash);
  const canonical = buildHash(route);
  if (location.hash !== canonical) history.replaceState(history.state, '', canonical);
  handler(route);
}

export function startRouter(onRoute) {
  handler = onRoute;
  window.addEventListener('popstate', dispatch);
  dispatch();
}

// Entries pushed by the app are marked, so goBack() knows whether
// history.back() stays inside the app.
export function navigate(route, { replace = false } = {}) {
  const hash = buildHash(route);
  if (replace) {
    history.replaceState(history.state, '', hash);
  } else {
    history.pushState({ inApp: true }, '', hash);
  }
  handler(parseRoute(hash));
}

export function goBack(fallbackRoute) {
  if (history.state?.inApp) {
    history.back();
  } else {
    navigate(fallbackRoute, { replace: true });
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/router.js js/router.test.js
git commit -m "Add router.js: hash routes with History API so the phone back button works

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `store.js` — receita aberta e autosave

**Files:**
- Create: `js/store.js`
- Test: `js/store.test.js`

**Interfaces:**
- Consumes: `saveRecipe` (storage.js) → `boolean`
- Produces:
  - `createStore({ save, delay = 400, setTimeoutFn, clearTimeoutFn })` → objeto com:
    - `recipe` (getter) — receita aberta ou `null`
    - `status` (getter) — `'salvo' | 'salvando' | 'erro'`
    - `load(recipe)` — salva pendências da anterior e abre esta
    - `update(mutator: (recipe) => void)` — aplica, agenda salvamento, notifica
    - `flush()` — salva pendência agora
    - `clear()` — `flush()` e fecha a receita
    - `subscribe(fn: (recipe) => void) → unsubscribe`
  - `store` — instância única com `save: saveRecipe`

- [ ] **Step 1: Escrever os testes**

`js/store.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './store.js';

function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    setTimeoutFn: (fn) => { const id = next++; pending.set(id, fn); return id; },
    clearTimeoutFn: (id) => pending.delete(id),
    runAll: () => { const fns = [...pending.values()]; pending.clear(); fns.forEach((fn) => fn()); },
    get count() { return pending.size; }
  };
}

function setup(saveResult = true) {
  const saved = [];
  const timers = fakeTimers();
  const store = createStore({ save: (r) => { saved.push(structuredClone(r)); return saveResult; }, ...timers });
  return { store, saved, timers };
}

test('update applies the change immediately and saves once after the debounce', () => {
  const { store, saved, timers } = setup();
  store.load({ id: 'r', nome: '' });
  store.update((r) => { r.nome = 'B'; });
  store.update((r) => { r.nome = 'Bo'; });
  assert.equal(store.recipe.nome, 'Bo');
  assert.equal(store.status, 'salvando');
  assert.equal(saved.length, 0);
  assert.equal(timers.count, 1);
  timers.runAll();
  assert.deepEqual(saved.map((r) => r.nome), ['Bo']);
  assert.equal(store.status, 'salvo');
});

test('flush saves pending changes right away; without pending changes it does nothing', () => {
  const { store, saved } = setup();
  store.load({ id: 'r', nome: '' });
  store.flush();
  assert.equal(saved.length, 0);
  store.update((r) => { r.nome = 'X'; });
  store.flush();
  assert.equal(saved.length, 1);
});

test('a refused save sets status to erro', () => {
  const { store, timers } = setup(false);
  store.load({ id: 'r', nome: '' });
  store.update((r) => { r.nome = 'X'; });
  timers.runAll();
  assert.equal(store.status, 'erro');
});

test('load flushes the previous recipe before switching', () => {
  const { store, saved } = setup();
  store.load({ id: 'a', nome: '' });
  store.update((r) => { r.nome = 'A'; });
  store.load({ id: 'b', nome: '' });
  assert.deepEqual(saved.map((r) => r.id), ['a']);
  assert.equal(store.recipe.id, 'b');
  assert.equal(store.status, 'salvo');
});

test('subscribers are notified on update and status change; unsubscribe stops it', () => {
  const { store, timers } = setup();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.load({ id: 'r', nome: '' });
  store.update((r) => { r.nome = 'X'; });
  timers.runAll();
  assert.equal(calls, 3); // load, update, saved
  unsubscribe();
  store.update((r) => { r.nome = 'Y'; });
  assert.equal(calls, 3);
});

test('update and clear with no recipe open are safe no-ops', () => {
  const { store, saved } = setup();
  store.update((r) => { r.nome = 'X'; });
  store.clear();
  assert.equal(store.recipe, null);
  assert.equal(saved.length, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './store.js'`.

- [ ] **Step 3: Implementar `js/store.js`**

```js
// js/store.js
//
// Holds the recipe open in the editor. Screens change it through update(),
// which saves after a short debounce and notifies subscribers so they can
// refresh derived numbers without re-creating inputs (re-creating inputs
// on every keystroke is what made the phone keyboard close).

import { saveRecipe } from './storage.js';

export function createStore({ save, delay = 400, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
  let recipe = null;
  let timer = null;
  let status = 'salvo';
  const listeners = new Set();

  function notify() {
    for (const fn of listeners) fn(recipe);
  }

  function runSave() {
    timer = null;
    if (!recipe) return;
    status = save(recipe) === false ? 'erro' : 'salvo';
    notify();
  }

  const api = {
    get recipe() { return recipe; },
    get status() { return status; },

    load(next) {
      api.flush();
      recipe = next;
      status = 'salvo';
      notify();
    },

    update(mutator) {
      if (!recipe) return;
      mutator(recipe);
      status = 'salvando';
      if (timer != null) clearTimeoutFn(timer);
      timer = setTimeoutFn(runSave, delay);
      notify();
    },

    flush() {
      if (timer == null) return;
      clearTimeoutFn(timer);
      runSave();
    },

    clear() {
      api.flush();
      recipe = null;
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
  return api;
}

export const store = createStore({ save: saveRecipe });
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/store.js js/store.test.js
git commit -m "Add store.js: open recipe, debounced autosave and save status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `results.js` — números derivados da receita

**Files:**
- Create: `js/results.js`
- Test: `js/results.test.js`

**Interfaces:**
- Consumes: `calculateRecipeTotals`, `calculateSuggestedPrices`, `calculateRealMargin`, `calculateMarkup`, `calculateCostPerPortion` (calculations.js); `computeLineCost` (costing.js)
- Produces: `recipeResult(recipe) →`
  ```
  { kind: 'semRendimento'|'semIngredientes'|'semPreco'|'lucro'|'prejuizo',
    ingredientesCost, gasCost, embalagensCost, custoTotal, custoPorPorcao, ingredientesSemCusto,
    lucroPorPorcao, lucroTotal, vezesOCusto, margem, markup,
    sugeridos: {preco2x, preco3x, preco4x} | null, embalagensPorPorcao, gasPorPorcao }
  ```

- [ ] **Step 1: Escrever os testes**

`js/results.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeResult } from './results.js';

function item(overrides) {
  return {
    ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null, ...overrides
  };
}
function recipe(overrides) {
  return {
    rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 0, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null,
    // 500 g of a R$ 10/kg ingredient = R$ 5,00 -> R$ 0,50 per portion
    ingredientes: [item({ nome: 'Farinha', quantidadeBruta: '500', precoEmbalagem: 10, tamanhoEmbalagem: 1000 })],
    ...overrides
  };
}
const round2 = (n) => Math.round(n * 100) / 100;

test('recipeResult: cost per portion and per-portion suggestions', () => {
  const r = recipeResult(recipe());
  assert.equal(r.kind, 'semPreco');
  assert.equal(r.custoTotal, 5);
  assert.equal(r.custoPorPorcao, 0.5);
  assert.deepEqual(r.sugeridos, { preco2x: 1, preco3x: 1.5, preco4x: 2 });
  assert.equal(r.lucroPorPorcao, null);
});

test('recipeResult: profit per portion and for the whole recipe', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 2 }));
  assert.equal(r.kind, 'lucro');
  assert.equal(r.lucroPorPorcao, 1.5);
  assert.equal(r.lucroTotal, 15);
  assert.equal(r.vezesOCusto, 4);
  assert.equal(r.margem, 75);
  assert.equal(r.markup, 300);
});

test('recipeResult: selling below cost is prejuizo', () => {
  const r = recipeResult(recipe({ precoVendaDesejado: 0.3 }));
  assert.equal(r.kind, 'prejuizo');
  assert.equal(round2(r.lucroPorPorcao), -0.2);
});

test('recipeResult: an explicit price of 0 is still a price (prejuizo), not "semPreco"', () => {
  assert.equal(recipeResult(recipe({ precoVendaDesejado: 0 })).kind, 'prejuizo');
});

test('recipeResult: zero yield wins over everything else', () => {
  const r = recipeResult(recipe({ rendimento: 0, precoVendaDesejado: 2 }));
  assert.equal(r.kind, 'semRendimento');
  assert.equal(r.custoPorPorcao, null);
  assert.equal(r.sugeridos, null);
});

test('recipeResult: no ingredient with a computable cost is semIngredientes', () => {
  assert.equal(recipeResult(recipe({ ingredientes: [] })).kind, 'semIngredientes');
  assert.equal(recipeResult(recipe({ ingredientes: [item({ nome: 'Sal' })] })).kind, 'semIngredientes');
});

test('recipeResult: counts ingredients without cost and per-portion extras', () => {
  const r = recipeResult(recipe({
    ingredientes: [...recipe().ingredientes, item({ nome: 'Sal' })],
    embalagemUnitaria: 0.5, quantidadeEmbalagens: 10,
    valorBotijao: 120, tempoPreparoMinutos: 25
  }));
  assert.equal(r.ingredientesSemCusto, 1);
  assert.equal(r.embalagensPorPorcao, 0.5);
  assert.equal(round2(r.gasPorPorcao), 0.1);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './results.js'`.

- [ ] **Step 3: Implementar `js/results.js`**

```js
// js/results.js
//
// Every number the screens show about a recipe, computed in one place:
// the list cards, the result bar and the Preço tab all read from here.

import {
  calculateRecipeTotals, calculateSuggestedPrices, calculateRealMargin,
  calculateMarkup, calculateCostPerPortion
} from './calculations.js';
import { computeLineCost } from './costing.js';

export function recipeResult(recipe) {
  const totals = calculateRecipeTotals(recipe, computeLineCost);
  const nomeados = recipe.ingredientes.filter((i) => i.nome && i.nome.trim() !== '').length;
  const comCusto = nomeados - totals.ingredientesSemCusto;
  const preco = recipe.precoVendaDesejado;
  const { custoPorPorcao } = totals;
  const temPreco = preco != null;

  const lucroPorPorcao = temPreco && custoPorPorcao != null ? preco - custoPorPorcao : null;

  let kind;
  if (!(recipe.rendimento > 0)) kind = 'semRendimento';
  else if (comCusto === 0) kind = 'semIngredientes';
  else if (!temPreco) kind = 'semPreco';
  else kind = lucroPorPorcao >= 0 ? 'lucro' : 'prejuizo';

  return {
    kind,
    ...totals,
    lucroPorPorcao,
    lucroTotal: lucroPorPorcao != null ? lucroPorPorcao * recipe.rendimento : null,
    vezesOCusto: temPreco && custoPorPorcao > 0 ? preco / custoPorPorcao : null,
    // margem (over the sale price) and markup (over the cost) are
    // deliberately separate indicators — see CLAUDE.md.
    margem: temPreco ? calculateRealMargin({ precoVenda: preco, custoPorPorcao }) : null,
    markup: temPreco ? calculateMarkup({ precoVenda: preco, custoPorPorcao }) : null,
    sugeridos: calculateSuggestedPrices({ custoPorPorcao }),
    embalagensPorPorcao: calculateCostPerPortion({ custoTotal: totals.embalagensCost, rendimento: recipe.rendimento }),
    gasPorPorcao: calculateCostPerPortion({ custoTotal: totals.gasCost, rendimento: recipe.rendimento })
  };
}
```

- [ ] **Step 4: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/results.js js/results.test.js
git commit -m "Add results.js: single source for cost, profit, suggestions and result state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `ingredient-match.js` e `taco-loader.js`

**Files:**
- Create: `js/ingredient-match.js`, `js/taco-loader.js`
- Test: `js/ingredient-match.test.js`

**Interfaces:**
- Consumes: `normalize` (text-utils.js), `FIXED_INGREDIENTS`, `findFixedIngredient` (ingredients-db.js), `loadTacoDatabase` (taco-database.js)
- Produces:
  - `emptyIngredientItem() → item`
  - `findKnownIngredient(nome, customIngredients) → ingredient | null`
  - `applyIngredientMatch(item, { known, precoConhecido }) → boolean` (muta `item`; `true` se reconheceu)
  - `NUTRIENT_LABELS: Record<key, label>` (sem `gordurasSaturadas`)
  - `buildCustomIngredient({ id, nome, unidadeEmbalagem, nutricaoDigitada, nutricaoTaco }) → ingredient`
  - `ingredientNameSuggestions(customIngredients) → string[]` (ordenado pt-BR, sem duplicatas)
  - `getTacoIngredients() → Promise<ingredient[]>` (taco-loader.js, com cache)

- [ ] **Step 1: Escrever os testes**

`js/ingredient-match.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyIngredientItem, findKnownIngredient, applyIngredientMatch,
  buildCustomIngredient, NUTRIENT_LABELS, ingredientNameSuggestions
} from './ingredient-match.js';

test('emptyIngredientItem: blank row with grams defaults', () => {
  assert.deepEqual(emptyIngredientItem(), {
    ingredientId: null, nome: '', quantidadeBruta: '', unidade: 'g',
    precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g',
    nutricao100g: null, densidadeGml: null, pesoUnidadeG: null
  });
});

test('findKnownIngredient: fixed DB first, then custom, accent/case-insensitive', () => {
  assert.equal(findKnownIngredient('acucar', []).nome, 'Açúcar');
  const custom = [{ id: 'custom:1', nome: 'Nutella', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null }];
  assert.equal(findKnownIngredient('NUTELLA', custom).id, 'custom:1');
  assert.equal(findKnownIngredient('Granulado', custom), null);
});

test('applyIngredientMatch: eggs default both units to "unidade"', () => {
  const item = emptyIngredientItem();
  item.nome = 'Ovos';
  const matched = applyIngredientMatch(item, { known: findKnownIngredient('Ovos', []), precoConhecido: null });
  assert.equal(matched, true);
  assert.equal(item.ingredientId, 'fixed:ovos');
  assert.equal(item.pesoUnidadeG, 50);
  assert.equal(item.unidade, 'unidade');
  assert.equal(item.unidadeEmbalagem, 'unidade');
});

test('applyIngredientMatch: unmatched name clears stale data from a previous match', () => {
  const item = { ...emptyIngredientItem(), ingredientId: 'fixed:ovos', nutricao100g: { kcal: 1 }, densidadeGml: 1, pesoUnidadeG: 50 };
  const matched = applyIngredientMatch(item, { known: null, precoConhecido: null });
  assert.equal(matched, false);
  assert.equal(item.ingredientId, null);
  assert.equal(item.nutricao100g, null);
  assert.equal(item.densidadeGml, null);
  assert.equal(item.pesoUnidadeG, null);
});

test('applyIngredientMatch: known price fills untouched price fields, matched or not', () => {
  const preco = { nome: 'Granulado', precoEmbalagem: 8, tamanhoEmbalagem: 500, unidadeEmbalagem: 'g' };
  const item = emptyIngredientItem();
  applyIngredientMatch(item, { known: null, precoConhecido: preco });
  assert.equal(item.precoEmbalagem, 8);
  assert.equal(item.tamanhoEmbalagem, 500);
});

test('applyIngredientMatch: never overwrites a price the person already typed', () => {
  const preco = { nome: 'Granulado', precoEmbalagem: 8, tamanhoEmbalagem: 500, unidadeEmbalagem: 'g' };
  const item = { ...emptyIngredientItem(), precoEmbalagem: 9.9 };
  applyIngredientMatch(item, { known: null, precoConhecido: preco });
  assert.equal(item.precoEmbalagem, 9.9);
  assert.equal(item.tamanhoEmbalagem, 0);
});

test('buildCustomIngredient: typed nutrition, ml packages get density 1', () => {
  const ing = buildCustomIngredient({
    id: 'custom:x', nome: 'Leite de coco', unidadeEmbalagem: 'ml',
    nutricaoDigitada: { kcal: 166, carboidratos: null }, nutricaoTaco: null
  });
  assert.equal(ing.densidadeGml, 1);
  assert.equal(ing.categoria, 'outro');
  assert.equal(ing.pesoUnidadeG, null);
  assert.equal(ing.nutricao100g.kcal, 166);
  assert.equal(ing.nutricao100g.carboidratos, null);
});

test('buildCustomIngredient: nothing typed and no TACO data -> nutricao100g null', () => {
  const ing = buildCustomIngredient({ id: 'custom:x', nome: 'X', unidadeEmbalagem: 'g', nutricaoDigitada: {}, nutricaoTaco: null });
  assert.equal(ing.nutricao100g, null);
  assert.equal(ing.densidadeGml, null);
});

test('buildCustomIngredient: keeps gordurasSaturadas from TACO (not user-editable)', () => {
  const ing = buildCustomIngredient({ id: 'custom:x', nome: 'X', unidadeEmbalagem: 'g', nutricaoDigitada: {}, nutricaoTaco: { gordurasSaturadas: 3.2 } });
  assert.equal(ing.nutricao100g.gordurasSaturadas, 3.2);
});

test('NUTRIENT_LABELS: user-editable nutrients only', () => {
  assert.deepEqual(Object.keys(NUTRIENT_LABELS), ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio', 'acucaresAdicionados']);
});

test('ingredientNameSuggestions: fixed + custom, sorted pt-BR, no duplicates', () => {
  const names = ingredientNameSuggestions([{ nome: 'Nutella' }, { nome: 'açúcar' }]);
  assert.ok(names.includes('Nutella'));
  assert.equal(names.filter((n) => n.toLowerCase().startsWith('a') && n.toLowerCase().includes('car')).length, 1);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module './ingredient-match.js'`.

- [ ] **Step 3: Implementar `js/ingredient-match.js`**

```js
// js/ingredient-match.js
//
// Recognizing an ingredient by name and turning an unknown one into a
// saved custom ingredient. Same rules the old app.js had
// (applyIngredientMatch + the custom-ingredient modal), made pure: storage
// lookups are passed in, so all of it is unit-tested.

import { normalize } from './text-utils.js';
import { FIXED_INGREDIENTS, findFixedIngredient } from './ingredients-db.js';

export function emptyIngredientItem() {
  return {
    ingredientId: null,
    nome: '',
    quantidadeBruta: '',
    unidade: 'g',
    precoEmbalagem: 0,
    tamanhoEmbalagem: 0,
    unidadeEmbalagem: 'g',
    nutricao100g: null,
    densidadeGml: null,
    pesoUnidadeG: null
  };
}

export function findKnownIngredient(nome, customIngredients) {
  const target = normalize(nome);
  return findFixedIngredient(nome) || customIngredients.find((i) => normalize(i.nome) === target) || null;
}

export function applyIngredientMatch(item, { known, precoConhecido }) {
  // Always clear stale data first: renaming "Ovos" to something unknown
  // must not keep egg nutrition/weight under the new name.
  item.ingredientId = null;
  item.nutricao100g = null;
  item.densidadeGml = null;
  item.pesoUnidadeG = null;

  // Price learned from earlier recipes fills the row only while it is
  // still untouched — never over a value typed for this recipe.
  if (precoConhecido && item.precoEmbalagem === 0 && item.tamanhoEmbalagem === 0) {
    item.precoEmbalagem = precoConhecido.precoEmbalagem;
    item.tamanhoEmbalagem = precoConhecido.tamanhoEmbalagem;
    item.unidadeEmbalagem = precoConhecido.unidadeEmbalagem;
  }

  if (!known) return false;

  item.ingredientId = known.id;
  item.nutricao100g = known.nutricao100g;
  item.densidadeGml = known.densidadeGml;
  item.pesoUnidadeG = known.pesoUnidadeG;

  // Counted by the piece (eggs, bananas) -> used and bought by the piece.
  if (known.pesoUnidadeG != null && known.densidadeGml == null) {
    item.unidade = 'unidade';
    item.unidadeEmbalagem = 'unidade';
  }
  return true;
}

// gordurasSaturadas is deliberately absent: it only comes from TACO lab
// data, never typed by hand.
export const NUTRIENT_LABELS = {
  kcal: 'Kcal',
  carboidratos: 'Carboidratos (g)',
  proteinas: 'Proteínas (g)',
  gorduras: 'Gorduras (g)',
  fibras: 'Fibras (g)',
  sodio: 'Sódio (mg)',
  acucaresAdicionados: 'Açúcares adicionados (g)'
};

export function buildCustomIngredient({ id, nome, unidadeEmbalagem, nutricaoDigitada, nutricaoTaco }) {
  const nutricao100g = {};
  let anyFilled = false;
  for (const key of Object.keys(NUTRIENT_LABELS)) {
    const value = nutricaoDigitada[key] ?? null;
    nutricao100g[key] = value;
    if (value != null) anyFilled = true;
  }
  if (nutricaoTaco && typeof nutricaoTaco.gordurasSaturadas === 'number') {
    nutricao100g.gordurasSaturadas = nutricaoTaco.gordurasSaturadas;
    anyFilled = true;
  }
  return {
    id,
    nome,
    categoria: 'outro',
    densidadeGml: unidadeEmbalagem === 'ml' ? 1.0 : null,
    pesoUnidadeG: null,
    nutricao100g: anyFilled ? nutricao100g : null
  };
}

export function ingredientNameSuggestions(customIngredients) {
  const seen = new Set();
  const names = [];
  for (const { nome } of [...FIXED_INGREDIENTS, ...customIngredients]) {
    const key = normalize(nome);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    names.push(nome);
  }
  return names.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
}
```

- [ ] **Step 4: Implementar `js/taco-loader.js`**

```js
// js/taco-loader.js
//
// Loads data/taco.json once per page (needs HTTP, not file://).

import { loadTacoDatabase } from './taco-database.js';

let cache = null;

export async function getTacoIngredients() {
  if (cache) return cache;
  const response = await fetch('data/taco.json');
  if (!response.ok) throw new Error('TACO fetch failed: ' + response.status);
  cache = loadTacoDatabase(await response.json());
  return cache;
}
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/ingredient-match.js js/ingredient-match.test.js js/taco-loader.js
git commit -m "Add ingredient-match.js (pure, tested) and taco-loader.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `nutrition-table.js` — tabela ANVISA

**Files:**
- Create: `js/nutrition-table.js`
- Test: `js/nutrition-table.test.js`
- **Depende de** `js/ui/dom.js` (`html`, `unwrap`), que é criado nesta task (a Task 11 acrescenta o resto do arquivo).

**Interfaces:**
- Consumes: `parseQuantity`, `toGrams`, `calculateNutritionPerPortion`, `calculateVD`, `VALORES_DIARIOS_REFERENCIA` (calculations.js)
- Produces:
  - `js/ui/dom.js`: `escapeHtml(str)`, `raw(str) → Fragment`, `html\`...\` → Fragment`, `unwrap(fragment) → string`
  - `nutritionPerPortion(recipe) → result | null` (mesmo resultado de `calculateNutritionPerPortion`)
  - `nutritionRows(result) → Array<{ label, unidade, por100g, porPorcao, vd, casas }>`
  - `nutritionTableHtml(result, rendimento) → Fragment`

- [ ] **Step 1: Escrever os testes**

`js/dom.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, html, raw, unwrap } from './ui/dom.js';

test('escapeHtml: escapes markup and quotes', () => {
  assert.equal(escapeHtml(`<b a="1">'&'</b>`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;&#39;&lt;/b&gt;');
});

test('html: escapes interpolated values', () => {
  assert.equal(unwrap(html`<p>${'<img onerror=x>'}</p>`), '<p>&lt;img onerror=x&gt;</p>');
});

test('html: nested fragments, arrays, raw, and empty values', () => {
  const items = ['a', '<b>'].map((t) => html`<li>${t}</li>`);
  assert.equal(unwrap(html`<ul>${items}</ul>`), '<ul><li>a</li><li>&lt;b&gt;</li></ul>');
  assert.equal(unwrap(html`${raw('<svg></svg>')}`), '<svg></svg>');
  assert.equal(unwrap(html`<p>${null}${undefined}${false}${0}</p>`), '<p>0</p>');
});
```

`js/nutrition-table.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 3: Criar `js/ui/dom.js` (parte pura)**

```js
// js/ui/dom.js
//
// Tiny templating helpers. html`` escapes every interpolated value unless it
// is itself a fragment (from html`` or raw()), which closes the self-XSS gap
// of typing markup into a recipe or ingredient name.

const RAW = Symbol('raw');

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(value) {
  return { [RAW]: String(value) };
}

function render(value) {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (typeof value === 'object' && RAW in value) return value[RAW];
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((value, i) => { out += render(value) + strings[i + 1]; });
  return raw(out);
}

export function unwrap(fragment) {
  return render(fragment);
}
```

- [ ] **Step 4: Criar `js/nutrition-table.js`**

```js
// js/nutrition-table.js
//
// ANVISA-style (IN 75/2020) nutrition table. A calculation aid built from
// the recipe's own ingredient data — not a certified label, and %VD uses
// simple rounding; both are disclosed in the footnotes.

import {
  parseQuantity, toGrams, calculateNutritionPerPortion, calculateVD, VALORES_DIARIOS_REFERENCIA
} from './calculations.js';
import { html } from './ui/dom.js';
import { formatNumber } from './format.js';

export function nutritionPerPortion(recipe) {
  const itens = recipe.ingredientes
    .filter((item) => item.nome && item.nome.trim() !== '')
    .map((item) => {
      const quantidade = parseQuantity(item.quantidadeBruta);
      const gramas = quantidade == null ? null : toGrams({
        quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG
      });
      return { gramas: gramas ?? 0, nutricao100g: gramas != null ? item.nutricao100g : null };
    });
  return calculateNutritionPerPortion({ itens, rendimento: recipe.rendimento });
}

const LINHAS = [
  { label: 'Valor energético', unidade: 'kcal', key: 'kcal', casas: 0 },
  { label: 'Carboidratos', unidade: 'g', key: 'carboidratos', casas: 1 },
  { label: 'Açúcares adicionados', unidade: 'g', key: 'acucaresAdicionados', casas: 1 },
  { label: 'Proteínas', unidade: 'g', key: 'proteinas', casas: 1 },
  { label: 'Gorduras totais', unidade: 'g', key: 'gorduras', casas: 1 },
  { label: 'Gorduras saturadas', unidade: 'g', key: 'gordurasSaturadas', casas: 1 },
  { label: 'Fibra alimentar', unidade: 'g', key: 'fibras', casas: 1 },
  { label: 'Sódio', unidade: 'mg', key: 'sodio', casas: 0 }
];

export function nutritionRows(resultado) {
  const peso = resultado.pesoPorcao;
  return LINHAS.map(({ label, unidade, key, casas }) => {
    const porPorcao = resultado[key];
    return {
      label, unidade, casas,
      porPorcao,
      por100g: peso ? (porPorcao / peso) * 100 : 0,
      vd: calculateVD(porPorcao, VALORES_DIARIOS_REFERENCIA[key])
    };
  });
}

export function nutritionTableHtml(resultado, rendimento) {
  const peso = formatNumber(resultado.pesoPorcao, 0);
  const avisos = [];
  if (resultado.ingredientesSemDados > 0) {
    avisos.push(`Cálculo incompleto — ${resultado.ingredientesSemDados} ingrediente(s) sem dados nutricionais (não entraram na conta).`);
  }
  avisos.push('Gorduras saturadas: somadas apenas quando o ingrediente veio da base TACO, que é quem traz esse dado.');
  avisos.push('Açúcares adicionados: somados apenas a partir de ingredientes com esse dado cadastrado (ex: açúcar, mel, leite condensado) — não inclui açúcar natural de frutas, leite etc.');

  return html`
    <div class="nutri">
      <h3>Informação Nutricional</h3>
      <p>Porções por embalagem: cerca de ${rendimento}</p>
      <p>Porção: ${peso} g</p>
      <div class="nutri-scroll">
        <table>
          <thead><tr><th></th><th>100 g</th><th>${peso} g</th><th>%VD*</th></tr></thead>
          <tbody>
            ${nutritionRows(resultado).map((r) => html`
              <tr>
                <td>${r.label} (${r.unidade})</td>
                <td>${formatNumber(r.por100g, r.casas)}</td>
                <td>${formatNumber(r.porPorcao, r.casas)}</td>
                <td>${r.vd != null ? `${r.vd}%` : '—'}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      <p class="nutri-note">*% de Valores Diários fornecidos pela porção, com base em uma dieta de 2.000 kcal. Seus valores diários podem ser maiores ou menores dependendo das suas necessidades energéticas.</p>
      <p class="nutri-note">Valores calculados a partir dos ingredientes cadastrados nesta receita — não substitui laudo laboratorial nem segue automaticamente todas as regras de arredondamento da ANVISA (IN 75/2020).</p>
      ${avisos.map((a) => html`<p class="nutri-warn">${a}</p>`)}
    </div>`;
}
```

- [ ] **Step 5: Rodar testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add js/ui/dom.js js/dom.test.js js/nutrition-table.js js/nutrition-table.test.js
git commit -m "Add escaping html templates and tested nutrition-table.js

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Base visual e componentes (CSS, painel, aviso, menu, confirmação, tema)

**Files:**
- Rewrite: `css/styles.css`
- Modify: `js/ui/dom.js` (acrescentar `setHtml`, `toElement`, `applyCurrencyMask`)
- Create: `js/ui/icons.js`, `js/ui/sheet.js`, `js/ui/toast.js`, `js/ui/menu.js`, `js/ui/confirm.js`, `js/theme.js`, `scripts/check-contrast.mjs`

**Interfaces:**
- Produces:
  - `setHtml(el, fragment)`, `toElement(fragment) → Element`, `applyCurrencyMask(inputEl, opts) → number|null`, `bindCurrencyInput(inputEl, onValue(number|null), { allowEmpty?, signal? })`
  - `WHATSAPP_ICON: string` (SVG)
  - `openSheet({ title, content: Element, onRequestClose?, onClose?, initialFocus?: string }) → { close(), requestClose(), element }`
  - `showToast(message, { actionLabel?, onAction?, duration = 5000 }) → { dismiss() }`
  - `openMenu(anchor: Element, items: Array<{ label, onSelect, danger? }>)`, `closeMenu()`
  - `confirmSheet({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) → Promise<boolean>`
  - `theme.js`: `getThemePref() → 'auto'|'light'|'dark'`, `setThemePref(pref)`, `toggleTheme()`, `effectiveTheme()`, `syncThemeUi()`, `initTheme()`
  - CSS: classes listadas em "Classes disponíveis" abaixo, usadas pelas Tasks 12–17.

Esta task não muda o `index.html`, e o app antigo continua carregando (o `styles.css` novo mantém os tokens e não reaproveita nomes de classe do Tailwind).

- [ ] **Step 1: Escrever o verificador de contraste (é o "teste" desta task)**

`scripts/check-contrast.mjs`:

```js
// Checks WCAG contrast of the text/background token pairs introduced by the
// mobile redesign. Run: node scripts/check-contrast.mjs  (exit 1 on failure)

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const PAIRS = [
  ['barra (claro): texto', '#F6ECE1', '#3A2A22'],
  ['barra (claro): secundário', '#C9B6A8', '#3A2A22'],
  ['barra (claro): lucro', '#8FCB96', '#3A2A22'],
  ['barra (claro): prejuízo', '#E8967C', '#3A2A22'],
  ['barra (escuro): texto', '#F6ECE1', '#4A362C'],
  ['barra (escuro): secundário', '#C9B6A8', '#4A362C'],
  ['barra (escuro): lucro', '#8FCB96', '#4A362C'],
  ['barra (escuro): prejuízo', '#E8967C', '#4A362C'],
  ['abas (claro): texto', '#3A2A22', '#EFE3D8'],
  ['abas (claro): selecionada', '#3A2A22', '#FFFFFF'],
  ['abas (escuro): texto', '#F6ECE1', '#33241D'],
  ['abas (escuro): selecionada', '#F6ECE1', '#4A362C'],
  ['chip selecionado', '#FFFFFF', '#9C4E36'],
  ['etiqueta (claro)', '#8F4A32', '#EEDDD3']
];

let failed = false;
for (const [name, fg, bg] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2)}:1  ${name}`);
}
process.exit(failed ? 1 : 0);
```

Run: `node scripts/check-contrast.mjs`
Expected: todas as linhas `ok` (o menor valor é 4.90, prejuízo na barra escura), exit 0.

- [ ] **Step 2: Reescrever `css/styles.css`**

Os três blocos de tokens (`:root`, `:root[data-theme="dark"]`, `@media (prefers-color-scheme: dark)`) mantêm **exatamente** os valores e comentários atuais e ganham os tokens novos abaixo. Arquivo completo:

```css
/* ============================================================
   Design tokens
   ------------------------------------------------------------
   "-text"/"-accenttext" pairs exist because a color that reads
   well as body text on the page background is not automatically
   readable as a button's background under white text, and in
   dark mode those two jobs pull in opposite directions (button
   backgrounds must stay dark/saturated; on-page text must go
   bright). Every text pairing below was checked against WCAG AA
   (4.5:1) for normal text — new pairs are verified by
   scripts/check-contrast.mjs.
   ============================================================ */
:root {
  --color-bg: #FBF3EC;            /* creme/bege — fundo da página */
  --color-surface: #FFFFFF;       /* cards */
  --color-surface-input: #FBF3EC; /* campos de formulário, levemente recuados do card branco */
  --color-border: #B0A093;        /* cinza-acastanhado, visível sobre o card branco (2.5:1) */
  --color-card-border: #D9CCBF;   /* contorno sutil dos cards no modo claro — evita o efeito "folha branca" */
  --color-text: #3A2A22;          /* marrom-cacau — 12.5:1 no fundo */
  --color-text-muted: #7D6A5D;    /* 4.7:1 no fundo */

  --color-primary: #9C4E36;       /* terracota — fundo de botão, 5.9:1 com texto branco */
  --color-primary-text: #8F4A32;  /* terracota como texto direto na página, 6.0:1 */
  --color-accent: #4C7A52;        /* verde salva — fundo de botão, 5.0:1 com texto branco */
  --color-accent-text: #4C7A52;   /* mesmo tom já passa como texto, 4.5:1 */
  --color-danger: #A8442E;        /* terracota escuro — custos/avisos, 5.4:1 */
  --color-danger-text: #A8442E;

  /* Marca do WhatsApp — fixo nos dois temas (é um botão de marca, não um
     token semântico do app). #25D366 é o verde reconhecível; o texto/ícone
     usa um verde bem escuro em vez de branco porque branco sobre esse verde
     claro só dá 1.98:1 de contraste (reprova até o limite de texto grande) —
     #06301D sobre o mesmo fundo dá 7.31:1. */
  --color-whatsapp-bg: #25D366;
  --color-whatsapp-text: #06301D;

  /* Barra de resultado e avisos: fundo cacau nos dois temas (mais claro no
     escuro para se destacar do fundo espresso). */
  --color-bar-bg: #3A2A22;
  --color-bar-text: #F6ECE1;      /* 11.7:1 */
  --color-bar-muted: #C9B6A8;     /* 7.0:1 */
  --color-bar-profit: #8FCB96;    /* 7.3:1 */
  --color-bar-loss: #E8967C;      /* 5.9:1 */
  --color-tabs-bg: #EFE3D8;       /* texto --color-text sobre ele: 11.2:1 */
  --color-tab-selected: #FFFFFF;
  --color-tag-bg: #EEDDD3;        /* etiqueta: --color-primary-text sobre ele 5.0:1 */
  --color-overlay: rgb(0 0 0 / 0.45);

  color-scheme: light;
}

:root[data-theme="dark"] {
  --color-bg: #221812;            /* espresso — "cozinha depois do expediente" */
  --color-surface: #33241D;
  --color-surface-input: #221812;
  --color-border: #4A362C;
  --color-card-border: transparent; /* pedido do usuário: modo escuro mantém como está, sem contorno extra nos cards */
  --color-text: #F6ECE1;          /* creme quente — 14.9:1 no fundo */
  --color-text-muted: #C9B6A8;    /* 8.9:1 no fundo */

  --color-primary-text: #E8916B;  /* terracota clareado para contraste no fundo escuro, 7.2:1 */
  --color-accent-text: #8FCB96;   /* verde clareado, 9.2:1 */
  --color-danger-text: #E8967C;   /* 7.5:1 */
  /* --color-primary / --color-accent (fundo de botão) permanecem iguais nos dois temas:
     o requisito é o contraste do texto branco em cima, que não depende do tema da página. */

  --color-bar-bg: #4A362C;        /* texto 9.7:1, secundário 5.8:1, lucro 6.0:1, prejuízo 4.9:1 */
  --color-tabs-bg: #33241D;       /* texto 12.2:1 */
  --color-tab-selected: #4A362C;  /* texto 9.7:1 */
  --color-tag-bg: #4A2E24;
  --color-overlay: rgb(0 0 0 / 0.6);

  color-scheme: dark;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #221812;
    --color-surface: #33241D;
    --color-surface-input: #221812;
    --color-border: #4A362C;
    --color-card-border: transparent;
    --color-text: #F6ECE1;
    --color-text-muted: #C9B6A8;
    --color-primary-text: #E8916B;
    --color-accent-text: #8FCB96;
    --color-danger-text: #E8967C;
    --color-bar-bg: #4A362C;
    --color-tabs-bg: #33241D;
    --color-tab-selected: #4A362C;
    --color-tag-bg: #4A2E24;
    --color-overlay: rgb(0 0 0 / 0.6);
    color-scheme: dark;
  }
}

/* ---------- Base ---------- */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  font-family: 'Nunito', system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.4;
  background-color: var(--color-bg);
  color: var(--color-text);
  transition: background-color 0.2s ease, color 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}
body.no-scroll { overflow: hidden; }
h1, h2, h3, p { margin: 0; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: inherit; }
.font-display, h1, h2, h3, .title-input { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }

.app {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
  padding: 0 16px calc(112px + env(safe-area-inset-bottom));
}
.visually-hidden {
  position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.stack > * + * { margin-top: 8px; }
.muted { color: var(--color-text-muted); font-size: 0.875rem; }
.text-cost { color: var(--color-danger-text); font-weight: 700; }
.text-profit { color: var(--color-accent-text); font-weight: 800; }
.text-loss { color: var(--color-danger-text); font-weight: 800; }

/* Visible keyboard focus, in both themes */
input:focus-visible, select:focus-visible, textarea:focus-visible,
button:focus-visible, a:focus-visible, summary:focus-visible, [tabindex]:focus-visible {
  outline: 2px solid var(--color-primary-text);
  outline-offset: 2px;
}

/* ---------- Header ---------- */
.sticky-head {
  position: sticky; top: 0; z-index: 10;
  background: var(--color-bg);
  margin: 0 -16px; padding: env(safe-area-inset-top) 16px 0;
}
.topbar { display: flex; align-items: center; gap: 8px; min-height: 60px; }
.topbar h1 { flex: 1; min-width: 0; font-size: 1.5rem; font-weight: 600; }
.icon-btn {
  min-width: 44px; min-height: 44px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 999px; font-size: 1.125rem; color: var(--color-text);
}
.icon-btn.outlined { border: 1px solid var(--color-border); }
.whatsapp-btn { background: var(--color-whatsapp-bg); color: var(--color-whatsapp-text); }
.title-input {
  flex: 1; min-width: 0; font-size: 1.25rem; font-weight: 600;
  border: 0; background: transparent; color: var(--color-text);
  padding: 8px 6px; border-radius: 10px; text-overflow: ellipsis;
}
.title-input:focus { background: var(--color-surface-input); }
.title-input::placeholder { color: var(--color-text-muted); }
.save-badge { font-size: 0.75rem; font-weight: 700; color: var(--color-accent-text); white-space: nowrap; }
.save-badge[data-status="salvando"] { color: var(--color-text-muted); }
.save-badge[data-status="erro"] { color: var(--color-danger-text); }

/* ---------- Tabs ---------- */
.tabs {
  display: flex; gap: 4px; padding: 4px; margin-bottom: 12px;
  background: var(--color-tabs-bg); border-radius: 14px;
}
.tab {
  flex: 1; min-height: 44px; border-radius: 10px;
  font-size: 0.875rem; font-weight: 700; text-align: center; color: var(--color-text);
}
.tab[aria-selected="true"] { background: var(--color-tab-selected); box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); font-weight: 800; }

/* ---------- Cards & fields ---------- */
.card {
  display: block; width: 100%;
  background: var(--color-surface); color: var(--color-text);
  border: 1px solid var(--color-card-border); border-radius: 16px;
  padding: 12px 14px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.05);
}
.card + .card { margin-top: 12px; }
.card-title { font-size: 1.0625rem; font-weight: 600; margin-bottom: 10px; }
.field { display: block; margin-bottom: 12px; }
.field-label { display: block; font-size: 0.875rem; font-weight: 700; margin-bottom: 4px; }
.field-hint { display: block; font-size: 0.8125rem; color: var(--color-text-muted); margin-top: 4px; min-height: 1em; }
.input {
  width: 100%; min-height: 44px;
  font: inherit; font-size: 16px; /* 16px: iOS does not zoom on focus */
  padding: 10px 12px; color: var(--color-text);
  background: var(--color-surface-input);
  border: 1px solid var(--color-border); border-radius: 12px;
}
.input::placeholder { color: var(--color-text-muted); opacity: 0.8; }
.row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.line-total { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 4px; }
.search { margin-bottom: 12px; }

/* ---------- Chips ---------- */
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  min-height: 44px; padding: 8px 14px; border-radius: 999px;
  border: 1px solid var(--color-border); background: var(--color-surface);
  font-weight: 700; font-size: 0.9375rem;
}
.chip[aria-pressed="true"] { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
.chip:disabled { opacity: 0.5; cursor: not-allowed; }

/* ---------- Buttons ---------- */
.btn {
  min-height: 48px; padding: 12px 16px; border-radius: 14px;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-weight: 800; text-align: center;
}
.btn-block { width: 100%; }
.btn-primary { background: var(--color-primary); color: #fff; }
.btn-secondary { border: 1px solid var(--color-border); color: var(--color-text); }
.btn-link { min-height: 44px; color: var(--color-primary-text); font-weight: 700; }
.btn-danger-link { color: var(--color-danger-text); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fab {
  position: fixed; z-index: 20;
  right: max(16px, calc(50vw - 240px + 16px));
  bottom: calc(16px + env(safe-area-inset-bottom));
  min-height: 56px; padding: 0 20px; border-radius: 18px;
  background: var(--color-primary); color: #fff; font-weight: 800;
  box-shadow: 0 6px 16px rgb(156 78 54 / 0.4);
}

/* ---------- Recipe list ---------- */
.recipe-card { display: flex; align-items: stretch; padding: 0; }
.recipe-card-main { flex: 1; min-width: 0; display: block; padding: 12px 4px 12px 14px; }
.recipe-card-name { display: block; font-family: 'Fraunces', Georgia, serif; font-size: 1.0625rem; font-weight: 600; overflow-wrap: anywhere; }
.recipe-card-meta { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-top: 4px; }
.recipe-card .icon-btn { align-self: center; margin-right: 4px; font-size: 1.375rem; color: var(--color-text-muted); }
.tag { font-size: 0.75rem; font-weight: 800; border-radius: 999px; padding: 2px 8px; background: var(--color-tag-bg); color: var(--color-primary-text); }
.tag-loss { color: var(--color-danger-text); }
.empty { text-align: center; padding: 24px 16px; }
.empty .btn { margin-top: 16px; }

/* ---------- Editor: Ingredientes ---------- */
.rende-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.stepper { display: flex; align-items: center; gap: 8px; }
.stepper button { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--color-border); font-size: 1.25rem; font-weight: 800; text-align: center; }
.stepper .input { width: 64px; text-align: center; font-weight: 800; padding: 8px 4px; }
.section-title { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin: 16px 2px 8px; font-size: 1.125rem; font-weight: 600; }
.ing-list { list-style: none; margin: 0; padding: 0; }
.ing-row { text-align: left; }
.ing-row-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.ing-row-name { font-weight: 800; overflow-wrap: anywhere; }
.ing-row-detail { display: block; margin-top: 2px; overflow-wrap: anywhere; }
.ing-row-issue { display: block; color: var(--color-danger-text); font-size: 0.8125rem; font-weight: 700; margin-top: 2px; }
.ing-row-issue:empty { display: none; }
.add-row {
  display: block; width: 100%; min-height: 52px; margin-top: 8px;
  border: 2px dashed var(--color-border); border-radius: 16px;
  color: var(--color-primary-text); font-weight: 800; text-align: center;
}
.ing-cost { display: flex; justify-content: space-between; align-items: baseline; margin-top: 12px; }

/* ---------- Editor: Preço ---------- */
.big-number { font-family: 'Fraunces', Georgia, serif; font-size: 2rem; font-weight: 600; }
.result-box { border-radius: 14px; padding: 12px; margin-top: 12px; }
.result-box.profit { background: rgb(76 122 82 / 0.14); }
.result-box.loss { background: rgb(168 68 46 / 0.14); }
.result-box .big { font-family: 'Fraunces', Georgia, serif; font-size: 1.25rem; font-weight: 700; }
.details { margin-top: 12px; }
.details summary { min-height: 44px; display: flex; align-items: center; color: var(--color-primary-text); font-weight: 700; cursor: pointer; }

/* ---------- Result bar ---------- */
.result-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 15;
  display: block; width: 100%; max-width: 480px; margin: 0 auto;
  background: var(--color-bar-bg); color: var(--color-bar-text);
  border-radius: 18px 18px 0 0;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  text-align: left; box-shadow: 0 -4px 16px rgb(0 0 0 / 0.15);
}
.result-bar[hidden] { display: none; }
.result-bar-main { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px 12px; }
.result-bar-value { font-size: 1.125rem; font-weight: 800; }
.result-bar .profit { color: var(--color-bar-profit); }
.result-bar .loss { color: var(--color-bar-loss); }
.result-bar-sub { display: block; font-size: 0.8125rem; color: var(--color-bar-muted); margin-top: 2px; }

/* ---------- Bottom sheet ---------- */
.sheet-backdrop {
  position: fixed; inset: 0; z-index: 40;
  display: flex; align-items: flex-end; justify-content: center;
  background: var(--color-overlay);
}
.sheet {
  width: 100%; max-width: 480px; max-height: 92dvh;
  overflow-y: auto; overscroll-behavior: contain;
  background: var(--color-surface); color: var(--color-text);
  border-radius: 22px 22px 0 0;
  padding: 0 16px calc(16px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 30px rgb(0 0 0 / 0.25);
  animation: sheet-in 0.2s ease-out;
}
.sheet:focus { outline: none; }
.sheet-grab { display: flex; justify-content: center; padding: 10px 0 12px; touch-action: none; cursor: grab; }
.sheet-grab::before { content: ''; width: 40px; height: 5px; border-radius: 5px; background: var(--color-border); }
.sheet-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 12px; overflow-wrap: anywhere; }
.sheet-section { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--color-primary-text); margin: 16px 0 8px; }
.sheet-actions {
  position: sticky; bottom: calc(-16px - env(safe-area-inset-bottom));
  display: flex; gap: 8px; margin-top: 16px;
  padding: 8px 0 calc(16px + env(safe-area-inset-bottom));
  background: var(--color-surface);
}
@keyframes sheet-in { from { transform: translateY(100%); } to { transform: none; } }

/* ---------- Toast ---------- */
.toast-root {
  position: fixed; left: 0; right: 0; z-index: 50;
  bottom: calc(96px + env(safe-area-inset-bottom));
  display: flex; justify-content: center; padding: 0 16px; pointer-events: none;
}
.toast {
  pointer-events: auto; width: 100%; max-width: 448px; min-height: 48px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 4px 4px 4px 16px; border-radius: 14px;
  background: var(--color-bar-bg); color: var(--color-bar-text);
  box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.toast button { min-height: 44px; padding: 0 12px; color: var(--color-bar-profit); font-weight: 800; }

/* ---------- Menu ---------- */
.menu {
  position: fixed; z-index: 45; min-width: 220px; padding: 4px 0;
  background: var(--color-surface); color: var(--color-text);
  border: 1px solid var(--color-card-border); border-radius: 14px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.2);
}
.menu-item { display: flex; align-items: center; width: 100%; min-height: 48px; padding: 0 16px; font-weight: 700; text-align: left; }
.menu-item.danger { color: var(--color-danger-text); border-top: 1px solid var(--color-border); }

/* ---------- Nutrition table ---------- */
.nutri { border: 2px solid var(--color-text); border-radius: 12px; padding: 14px; background: var(--color-surface); }
.nutri h3 { font-size: 1.25rem; font-weight: 700; border-bottom: 4px solid var(--color-text); padding-bottom: 4px; margin-bottom: 8px; }
.nutri p { font-size: 0.875rem; }
.nutri-scroll { overflow-x: auto; margin-top: 8px; }
.nutri table { width: 100%; min-width: 300px; border-collapse: collapse; font-size: 0.875rem; }
.nutri th, .nutri td { padding: 4px 6px; text-align: right; border-bottom: 1px solid var(--color-border); }
.nutri th:first-child, .nutri td:first-child { text-align: left; padding-left: 0; }
.nutri thead th { border-bottom: 2px solid var(--color-text); color: var(--color-text-muted); }
.nutri .nutri-note { font-size: 0.75rem; color: var(--color-text-muted); margin-top: 8px; }
.nutri .nutri-warn { font-size: 0.75rem; color: var(--color-danger-text); margin-top: 4px; }

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 3: Completar `js/ui/dom.js` com os helpers de DOM**

Acrescente ao final do arquivo (e o import no topo):

```js
import { maskCurrencyDigits } from '../format.js';
```

```js
// --- DOM helpers (only touch `document` when called) ---

export function setHtml(el, fragment) {
  el.innerHTML = unwrap(fragment);
}

export function toElement(fragment) {
  const template = document.createElement('template');
  template.innerHTML = unwrap(fragment).trim();
  return template.content.firstElementChild;
}

// Applies the bank-app money mask to a currency <input> in place and
// returns the numeric value (null when allowEmpty and cleared).
export function applyCurrencyMask(inputEl, opts) {
  const { value, text } = maskCurrencyDigits(inputEl.value, opts);
  inputEl.value = text;
  inputEl.setSelectionRange(text.length, text.length);
  return value;
}

// Wires a currency <input>: the caret always sits at the end (digits enter
// from the right, so tapping into the middle of "0,00" must not scramble
// them), and onValue receives the parsed number on every keystroke.
export function bindCurrencyInput(inputEl, onValue, { allowEmpty = false, signal } = {}) {
  const caretToEnd = () => inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  inputEl.addEventListener('focus', caretToEnd, { signal });
  inputEl.addEventListener('click', caretToEnd, { signal });
  inputEl.addEventListener('input', () => onValue(applyCurrencyMask(inputEl, { allowEmpty })), { signal });
}
```

Run: `npm test` → Expected: PASS (o `dom.test.js` continua passando; `format.js` é puro).

- [ ] **Step 4: Criar `js/ui/icons.js`**

```js
// WhatsApp glyph (brand icon). Colored by currentColor.
export const WHATSAPP_ICON = `<svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16.001 3C9.11 3 3.5 8.611 3.5 15.502c0 2.376.657 4.66 1.902 6.652L3 29l7.02-2.352a12.46 12.46 0 0 0 5.981 1.524h.006C22.898 28.172 28.5 22.561 28.5 15.67 28.5 8.779 22.898 3 16.001 3zm0 22.727a10.2 10.2 0 0 1-5.2-1.43l-.373-.222-3.868 1.296 1.276-3.77-.243-.387a10.147 10.147 0 0 1-1.567-5.412c0-5.646 4.596-10.24 10.245-10.24 2.737 0 5.31 1.066 7.243 3.002a10.166 10.166 0 0 1 2.995 7.238c0 5.646-4.596 10.925-10.508 10.925z"/><path d="M21.437 18.184c-.297-.148-1.758-.868-2.03-.967-.272-.099-.47-.148-.669.149-.198.297-.767.968-.94 1.166-.173.198-.347.223-.644.075-.297-.149-1.254-.462-2.389-1.475-.883-.788-1.48-1.76-1.653-2.058-.173-.298-.019-.459.13-.607.133-.133.297-.347.446-.52.149-.174.198-.298.297-.496.1-.199.05-.372-.025-.52-.074-.149-.669-1.612-.916-2.208-.242-.578-.487-.5-.669-.51-.173-.008-.372-.01-.57-.01a1.094 1.094 0 0 0-.793.372c-.272.298-1.04 1.017-1.04 2.48 0 1.462 1.066 2.875 1.214 3.073.148.199 2.096 3.201 5.077 4.489.71.306 1.262.489 1.694.625.712.226 1.36.195 1.871.118.571-.085 1.759-.719 2.006-1.413.248-.694.248-1.29.174-1.413-.075-.124-.273-.199-.57-.348z"/></svg>`;
```

- [ ] **Step 5: Criar `js/ui/sheet.js`**

```js
// js/ui/sheet.js
//
// Bottom sheet dialog: backdrop tap, Esc and drag-down on the handle all
// call onRequestClose (routed sheets pass goBack so the phone's back
// button and these gestures behave the same). close() actually removes it.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
let openCount = 0;

export function openSheet({ title, content, onRequestClose, onClose, initialFocus }) {
  const root = document.getElementById('overlay-root');
  const previousFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', title);
  sheet.tabIndex = -1;
  const grab = document.createElement('div');
  grab.className = 'sheet-grab';
  grab.setAttribute('aria-hidden', 'true');
  sheet.append(grab, content);
  backdrop.append(sheet);
  root.append(backdrop);

  openCount += 1;
  document.body.classList.add('no-scroll');

  let closed = false;
  const requestClose = () => (onRequestClose ?? close)();

  function close() {
    if (closed) return;
    closed = true;
    backdrop.remove();
    openCount -= 1;
    if (openCount === 0) document.body.classList.remove('no-scroll');
    onClose?.();
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus({ preventScroll: true });
  }

  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) requestClose(); });

  sheet.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
    } else if (e.key === 'Tab') {
      const items = [...sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Drag the handle down more than 80px to close.
  let startY = null;
  let dy = 0;
  grab.addEventListener('pointerdown', (e) => {
    startY = e.clientY;
    dy = 0;
    grab.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  grab.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const endDrag = () => {
    if (startY == null) return;
    startY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 80) requestClose();
  };
  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);

  // Focusing a text field pops the phone keyboard, so only do it when asked.
  requestAnimationFrame(() => {
    const target = initialFocus ? sheet.querySelector(initialFocus) : sheet;
    (target || sheet).focus({ preventScroll: true });
  });

  return { close, requestClose, element: sheet };
}
```

- [ ] **Step 6: Criar `js/ui/toast.js`**

```js
// js/ui/toast.js — one short message at a time, optionally with an action.

let current = null;

export function showToast(message, { actionLabel, onAction, duration = 5000 } = {}) {
  current?.dismiss();
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);

  let timer = null;
  const handle = {
    dismiss() {
      clearTimeout(timer);
      el.remove();
      if (current === handle) current = null;
    }
  };

  if (actionLabel) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = actionLabel;
    button.addEventListener('click', () => { handle.dismiss(); onAction?.(); });
    el.append(button);
  }

  root.append(el);
  timer = setTimeout(() => handle.dismiss(), duration);
  current = handle;
  return handle;
}
```

- [ ] **Step 7: Criar `js/ui/menu.js`**

```js
// js/ui/menu.js — the "⋯" action menu, anchored to its button.

let active = null;

export function closeMenu() {
  if (!active) return;
  const { menu, cleanup } = active;
  active = null;
  cleanup();
  menu.remove();
}

export function openMenu(anchor, items) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-item' + (item.danger ? ' danger' : '');
    button.setAttribute('role', 'menuitem');
    button.textContent = item.label;
    button.addEventListener('click', () => { closeMenu(); item.onSelect(); });
    menu.append(button);
  }
  document.getElementById('overlay-root').append(menu);

  // Below the anchor, or above it when there is no room; kept on screen.
  const rect = anchor.getBoundingClientRect();
  const { offsetHeight: h, offsetWidth: w } = menu;
  const below = rect.bottom + 4;
  const top = below + h > window.innerHeight - 8 ? Math.max(8, rect.top - 4 - h) : below;
  const left = Math.max(8, Math.min(rect.right - w, window.innerWidth - w - 8));
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  const onPointerDown = (e) => { if (!menu.contains(e.target) && !anchor.contains(e.target)) closeMenu(); };
  const onKeyDown = (e) => { if (e.key === 'Escape') { closeMenu(); anchor.focus(); } };
  const onScroll = () => closeMenu();
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('scroll', onScroll, { passive: true });
  anchor.setAttribute('aria-expanded', 'true');

  active = {
    menu,
    cleanup() {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
      anchor.setAttribute('aria-expanded', 'false');
    }
  };
  menu.querySelector('button')?.focus({ preventScroll: true });
}
```

- [ ] **Step 8: Criar `js/ui/confirm.js`**

```js
// js/ui/confirm.js — replaces window.confirm() with a bottom sheet.

import { openSheet } from './sheet.js';
import { html, toElement } from './dom.js';

export function confirmSheet({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) {
  return new Promise((resolve) => {
    let result = false;
    const content = toElement(html`
      <div>
        <h2 class="sheet-title">${title}</h2>
        <p>${message}</p>
        <div class="sheet-actions">
          <button type="button" class="btn btn-secondary" data-cancel>${cancelLabel}</button>
          <button type="button" class="btn btn-primary" style="flex:1" data-ok>${confirmLabel}</button>
        </div>
      </div>`);
    const sheet = openSheet({ title, content, onClose: () => resolve(result), initialFocus: '[data-ok]' });
    content.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
    content.querySelector('[data-ok]').addEventListener('click', () => { result = true; sheet.close(); });
  });
}
```

- [ ] **Step 9: Criar `js/theme.js`**

```js
// js/theme.js
//
// 'auto' (follow the phone), 'light' or 'dark'. index.html's inline script
// applies a saved choice before first paint; this keeps the toggle icons
// and <meta name="theme-color"> in sync afterwards.

const THEME_KEY = 'calculadora-cozinha:tema';
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getThemePref() {
  try {
    return localStorage.getItem(THEME_KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function effectiveTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr;
  return darkQuery().matches ? 'dark' : 'light';
}

export function syncThemeUi() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  const icon = effectiveTheme() === 'dark' ? '☀️' : '🌙';
  for (const el of document.querySelectorAll('[data-theme-icon]')) el.textContent = icon;
}

export function setThemePref(pref) {
  try {
    if (pref === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // storage blocked: the choice still applies to this page view
  }
  if (pref === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', pref);
  syncThemeUi();
}

export function toggleTheme() {
  setThemePref(effectiveTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  syncThemeUi();
  darkQuery().addEventListener('change', syncThemeUi);
}
```

- [ ] **Step 10: Verificar**

Run: `npm test && node scripts/check-contrast.mjs`
Expected: testes PASS; contraste todo `ok`.

Run: `node --input-type=module -e "for (const f of ['ui/sheet','ui/toast','ui/menu','ui/confirm','ui/icons','theme']) await import('./js/' + f + '.js'); console.log('imports ok')"`
Expected: `imports ok` (nenhum módulo toca o DOM ao ser importado).

- [ ] **Step 11: Commit**

```bash
git add css/styles.css js/ui js/theme.js scripts/check-contrast.mjs
git commit -m "Add mobile CSS components (no Tailwind) and UI primitives: sheet, toast, menu, confirm, theme

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Troca para a nova app + tela "Minhas Receitas" + smoke mobile

**Files:**
- Rewrite: `index.html`, `js/app.js` (o app antigo é apagado; tudo que ele fazia já existe nos módulos das Tasks 1–11 ou é refeito nas Tasks 13–17)
- Create: `js/session.js`, `js/screens/lista.js`, `js/screens/ajustes.js`, `js/screens/editor.js` (versão mínima, substituída na Task 13)
- Create: `scripts/smoke-mobile.mjs`, `scripts/smoke/01-lista.mjs`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: Tasks 2–11.
- Produces:
  - `session.js`: `markNewRecipe(id)`, `isNewRecipe(id) → boolean`, `forgetNewRecipe(id)`
  - Contrato de tela: `renderX(view, …) → { update(route), destroy() }`; `app.js` chama `update(route)` logo após criar a tela e a cada mudança de rota da mesma tela.
  - `renderLista(view) → { update, destroy }`
  - `openAjustesSheet({ onRequestClose, onClose, onDataChanged }) → sheet`
  - `renderEditor(view, recipeId) → { update, destroy } | null` (`null` = receita não existe)
  - Smoke: cada arquivo `scripts/smoke/NN-nome.mjs` exporta `default async function (t)`, com `t = { page, baseUrl, assert, shot(name), semRolagemHorizontal(), seed(recipes) }`.

- [ ] **Step 1: Instalar Playwright como dependência de desenvolvimento**

```bash
npm i -D playwright@1.55.0
npx playwright install chromium
```

Se o download do Chromium falhar (rede bloqueada), use um Chromium já instalado com a variável `CHROMIUM_PATH` (o script abaixo respeita). Em `package.json`, acrescente o script:

```json
  "scripts": {
    "test": "node --test js/*.test.js",
    "test:mobile": "node scripts/smoke-mobile.mjs"
  },
```

Em `.gitignore`, acrescente `node_modules/`.

- [ ] **Step 2: Escrever o runner do smoke**

`scripts/smoke-mobile.mjs`:

```js
// Mobile smoke test: serves the app over HTTP, opens it in Chromium at
// 390x844 (touch, 2x), and runs every scenario in scripts/smoke/ in order,
// each in a fresh browser context (empty localStorage), in light and dark.
// Screenshots go to scripts/.screenshots/ (git-ignored).
//   npm run test:mobile            all scenarios
//   npm run test:mobile -- 03      only scenarios whose file name contains "03"

import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsDir = path.join(root, 'scripts', '.screenshots');
fs.mkdirSync(shotsDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((resolve) => server.listen(0, resolve));
const baseUrl = `http://localhost:${server.address().port}/`;

const filter = process.argv[2] || '';
const scenarioFiles = fs.readdirSync(path.join(root, 'scripts', 'smoke'))
  .filter((f) => f.endsWith('.mjs') && f.includes(filter)).sort();

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;

for (const theme of ['light', 'dark']) {
  for (const file of scenarioFiles) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      colorScheme: theme, locale: 'pt-BR'
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Google Fonts may be unreachable in CI/offline; that is not an app error.
    page.on('console', (m) => {
      if (m.type() === 'error' && !(m.location()?.url || '').startsWith('https://fonts.')) errors.push(m.text());
    });

    const t = {
      page, baseUrl, assert,
      async shot(name) {
        await page.screenshot({ path: path.join(shotsDir, `${file.replace('.mjs', '')}-${name}-${theme}.png`), fullPage: true });
      },
      async semRolagemHorizontal() {
        const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        assert.ok(scroll <= client, `rolagem horizontal: scrollWidth ${scroll} > ${client}`);
      },
      async seed(recipes) {
        await page.evaluate((r) => localStorage.setItem('calculadora-cozinha:recipes', JSON.stringify(r)), recipes);
      }
    };

    const label = `${file} [${theme}]`;
    try {
      const scenario = (await import(pathToFileURL(path.join(root, 'scripts', 'smoke', file)).href)).default;
      await scenario(t);
      assert.deepEqual(errors, [], 'erros no console');
      console.log(`ok    ${label}`);
    } catch (err) {
      failures += 1;
      console.log(`FAIL  ${label}\n      ${err.message.split('\n').join('\n      ')}`);
      await page.screenshot({ path: path.join(shotsDir, `FAIL-${file.replace('.mjs', '')}-${theme}.png`), fullPage: true }).catch(() => {});
    }
    await context.close();
  }
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} falha(s)` : '\ntudo ok');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 3: Escrever o cenário da lista (vai falhar)**

`scripts/smoke/01-lista.mjs`:

```js
// Minhas Receitas: empty state, cards with profit, long names, ⋯ menu,
// rename, duplicate, delete + undo, search, settings sheet and back button.

function receita(id, nome, precoVendaDesejado) {
  return {
    id, nome, rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 10, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado, criadoEm: '2026-09-01T00:00:00.000Z', atualizadoEm: '2026-09-01T00:00:00.000Z',
    ingredientes: [{ ingredientId: null, nome: 'Farinha', quantidadeBruta: '500', unidade: 'g', precoEmbalagem: 10, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null }]
  };
}

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.goto(baseUrl);
  await page.getByText('Nenhuma receita ainda').waitFor();
  await shot('vazia');

  await seed([
    receita('recipe:a', 'Brownie', 0.3),
    receita('recipe:b', 'Bolo de pote de ninho com Nutella e morango do sul de Minas Gerais', 1234.5),
    receita('recipe:c', 'Coxinha', null),
    receita('recipe:d', 'Açaí na tigela', 2)
  ]);
  await page.reload();

  // Sorted pt-BR, with profit/loss/price tags.
  const nomes = await page.locator('.recipe-card-name').allTextContents();
  assert.deepEqual(nomes, ['Açaí na tigela', 'Bolo de pote de ninho com Nutella e morango do sul de Minas Gerais', 'Brownie', 'Coxinha']);
  await page.getByText('Custo R$ 0,50/un.').first().waitFor();
  await page.getByText('lucro R$ 1.234,00').waitFor();
  await page.getByText('prejuízo R$ 0,20').waitFor();
  await page.getByText('definir preço').waitFor();
  await semRolagemHorizontal();
  await shot('lista');

  // Search (shown from 4 recipes on), accent-insensitive.
  await page.getByPlaceholder('🔍 Buscar receita').fill('acai');
  assert.deepEqual(await page.locator('.recipe-card-name').allTextContents(), ['Açaí na tigela']);
  await page.getByPlaceholder('🔍 Buscar receita').fill('');

  // Rename through the ⋯ menu.
  await page.getByRole('button', { name: 'Ações para Coxinha' }).click();
  await page.getByRole('menuitem', { name: /Renomear/ }).click();
  await page.getByRole('dialog').locator('input').fill('Coxinha de frango');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Coxinha de frango').waitFor();

  // Duplicate. (Cards are located by class: the toast repeats the name.)
  const copia = page.locator('.recipe-card-name', { hasText: 'Brownie (cópia)' });
  await page.getByRole('button', { name: 'Ações para Brownie', exact: true }).click();
  await page.getByRole('menuitem', { name: /Duplicar/ }).click();
  await copia.waitFor();

  // Delete + undo.
  await page.getByRole('button', { name: 'Ações para Brownie (cópia)' }).click();
  await page.getByRole('menuitem', { name: /Excluir/ }).click();
  await copia.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await copia.waitFor();

  // Settings sheet opens as a route; the browser back button closes it.
  await page.getByRole('button', { name: 'Ajustes e backup' }).click();
  await page.getByRole('dialog', { name: 'Ajustes' }).waitFor();
  assert.ok(page.url().endsWith('#/ajustes'));
  await shot('ajustes');
  await page.goBack();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('#/'));
}
```

Run: `npm run test:mobile -- 01`
Expected: FAIL (o `index.html` atual ainda é o do app antigo; "Nenhuma receita ainda" existe, mas o seletor `.recipe-card-name` não).

- [ ] **Step 4: Reescrever `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#FBF3EC">
  <meta name="description" content="Calcule o custo e o preço de venda dos seus doces e salgados pelo celular.">
  <link rel="icon" href="data:,">
  <title>Calculadora de Cozinha</title>
  <script>
    // Applied before first paint, so the page never flashes the wrong theme.
    (function () {
      try {
        var saved = localStorage.getItem('calculadora-cozinha:tema');
        if (saved) document.documentElement.setAttribute('data-theme', saved);
      } catch (e) {}
    })();
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="app">
    <main id="view"></main>
  </div>
  <div id="overlay-root"></div>
  <div id="toast-root" class="toast-root" aria-live="polite"></div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Criar `js/session.js`**

```js
// js/session.js
//
// Recipes created in this page view via "+ Nova receita". Leaving such a
// recipe with no name and no ingredients discards it (no empty "(sem nome)"
// cards piling up).

const newRecipeIds = new Set();

export function markNewRecipe(id) { newRecipeIds.add(id); }
export function isNewRecipe(id) { return newRecipeIds.has(id); }
export function forgetNewRecipe(id) { newRecipeIds.delete(id); }
```

- [ ] **Step 6: Criar `js/screens/ajustes.js`**

```js
// js/screens/ajustes.js — settings sheet: theme and backup.

import { exportAllData, importBackup } from '../storage.js';
import { getThemePref, setThemePref } from '../theme.js';
import { html, toElement } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';

const THEME_OPTIONS = [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']];

function downloadBackup() {
  const blob = new Blob([JSON.stringify(exportAllData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `calculadora-cozinha-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openAjustesSheet({ onRequestClose, onClose, onDataChanged }) {
  const pref = getThemePref();
  const content = toElement(html`
    <div>
      <h2 class="sheet-title">Ajustes</h2>
      <p class="sheet-section">Tema</p>
      <div class="chips" role="group" aria-label="Tema">
        ${THEME_OPTIONS.map(([value, label]) => html`<button type="button" class="chip" data-theme-pref="${value}" aria-pressed="${pref === value}">${label}</button>`)}
      </div>
      <p class="sheet-section">Backup</p>
      <p class="muted">Suas receitas ficam guardadas só neste aparelho. Exporte um backup para não perder nada ou para passar para outro celular.</p>
      <div class="stack" style="margin-top:12px">
        <button type="button" class="btn btn-secondary btn-block" data-action="exportar">Exportar backup</button>
        <button type="button" class="btn btn-secondary btn-block" data-action="importar">Importar backup</button>
        <input type="file" accept="application/json,.json" hidden data-file>
        <p class="muted" data-import-result role="status"></p>
      </div>
      <div class="sheet-actions">
        <button type="button" class="btn btn-primary btn-block" data-action="fechar">Fechar</button>
      </div>
    </div>`);

  const sheet = openSheet({ title: 'Ajustes', content, onRequestClose, onClose });
  const fileInput = content.querySelector('[data-file]');
  const result = content.querySelector('[data-import-result]');

  content.addEventListener('click', (e) => {
    const themeButton = e.target.closest('[data-theme-pref]');
    if (themeButton) {
      setThemePref(themeButton.dataset.themePref);
      for (const b of content.querySelectorAll('[data-theme-pref]')) b.setAttribute('aria-pressed', String(b === themeButton));
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'exportar') downloadBackup();
    if (action === 'importar') fileInput.click();
    if (action === 'fechar') sheet.requestClose();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = ''; // allow picking the same file again
    if (!file) return;
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      result.textContent = 'Arquivo inválido — não foi possível ler o backup.';
      return;
    }
    const r = importBackup(data);
    result.textContent = `Importação concluída: ${r.receitasImportadas} receita(s) adicionada(s), ${r.receitasIgnoradas} já existiam; ` +
      `${r.ingredientesImportados} ingrediente(s) adicionado(s), ${r.ingredientesIgnorados} já existiam.`;
    onDataChanged?.();
  });

  return sheet;
}
```

- [ ] **Step 7: Criar `js/screens/lista.js`**

```js
// js/screens/lista.js — "Minhas Receitas".

import { getRecipes, createEmptyRecipe, saveRecipe, duplicateRecipe, deleteRecipe, restoreRecipe } from '../storage.js';
import { recipeResult } from '../results.js';
import { formatBRL } from '../format.js';
import { normalize } from '../text-utils.js';
import { buildRecipeShareText, whatsappUrl } from '../share.js';
import { html, setHtml, toElement } from '../ui/dom.js';
import { openMenu, closeMenu } from '../ui/menu.js';
import { showToast } from '../ui/toast.js';
import { openSheet } from '../ui/sheet.js';
import { navigate, goBack } from '../router.js';
import { toggleTheme, syncThemeUi } from '../theme.js';
import { markNewRecipe } from '../session.js';
import { openAjustesSheet } from './ajustes.js';

const SEARCH_MIN_RECIPES = 4;
const byName = (a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' });

function cardHtml(recipe) {
  const r = recipeResult(recipe);
  const nome = recipe.nome?.trim() || '(sem nome)';
  const custo = r.custoPorPorcao != null && r.kind !== 'semIngredientes'
    ? `Custo ${formatBRL(r.custoPorPorcao)}/un.`
    : 'Custo ainda não calculado';
  let destaque = '';
  if (r.kind === 'lucro') destaque = html`<span class="text-profit">lucro ${formatBRL(r.lucroPorPorcao)}</span>`;
  else if (r.kind === 'prejuizo') destaque = html`<span class="tag tag-loss">prejuízo ${formatBRL(Math.abs(r.lucroPorPorcao))}</span>`;
  else if (recipe.precoVendaDesejado == null) destaque = html`<span class="tag">definir preço</span>`;

  return html`
    <article class="card recipe-card">
      <button type="button" class="recipe-card-main" data-open="${recipe.id}">
        <span class="recipe-card-name">${nome}</span>
        <span class="recipe-card-meta"><span class="muted">${custo}</span>${destaque}</span>
      </button>
      <button type="button" class="icon-btn" data-menu="${recipe.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Ações para ${nome}">⋯</button>
    </article>`;
}

export function renderLista(view) {
  const events = new AbortController();
  let query = '';
  let ajustes = null;

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <h1>Minhas Receitas</h1>
        <button type="button" class="icon-btn outlined" data-action="ajustes" aria-label="Ajustes e backup">⚙️</button>
        <button type="button" class="icon-btn outlined" data-action="tema" aria-label="Alternar tema claro/escuro"><span data-theme-icon aria-hidden="true">🌙</span></button>
      </header>
    </div>
    <div data-slot="search"></div>
    <div class="stack" data-slot="list"></div>
    <button type="button" class="fab" data-action="nova">+ Nova receita</button>`);
  syncThemeUi();

  const searchSlot = view.querySelector('[data-slot="search"]');
  const listSlot = view.querySelector('[data-slot="list"]');

  function renderSearch(total) {
    if (total < SEARCH_MIN_RECIPES) {
      searchSlot.innerHTML = '';
      query = '';
      return;
    }
    if (searchSlot.firstElementChild) return;
    setHtml(searchSlot, html`
      <label class="visually-hidden" for="busca">Buscar receita</label>
      <input id="busca" class="input search" type="search" placeholder="🔍 Buscar receita" enterkeyhint="search" autocomplete="off">`);
    searchSlot.querySelector('input').addEventListener('input', (e) => { query = e.target.value; renderList(); });
  }

  function renderList() {
    const all = getRecipes().sort(byName);
    renderSearch(all.length);
    if (all.length === 0) {
      setHtml(listSlot, html`
        <div class="card empty">
          <p class="font-display" style="font-size:1.25rem">Nenhuma receita ainda</p>
          <p class="muted" style="margin-top:8px">Cadastre os ingredientes e descubra quanto custa cada unidade e quanto você lucra.</p>
          <button type="button" class="btn btn-primary" data-action="nova">Criar minha primeira receita</button>
        </div>`);
      return;
    }
    const q = normalize(query);
    const visible = q ? all.filter((r) => normalize(r.nome || '').includes(q)) : all;
    setHtml(listSlot, visible.length
      ? html`${visible.map(cardHtml)}`
      : html`<p class="muted" style="text-align:center;padding:16px">Nenhuma receita com "${query}".</p>`);
  }

  function renameRecipe(recipe) {
    const content = toElement(html`
      <form>
        <h2 class="sheet-title">Renomear receita</h2>
        <label class="field"><span class="field-label">Nome</span>
          <input class="input" name="nome" value="${recipe.nome}" enterkeyhint="done" autocomplete="off"></label>
        <div class="sheet-actions">
          <button type="button" class="btn btn-secondary" data-cancel>Cancelar</button>
          <button type="submit" class="btn btn-primary" style="flex:1">Salvar</button>
        </div>
      </form>`);
    const sheet = openSheet({ title: 'Renomear receita', content, initialFocus: 'input' });
    content.querySelector('[data-cancel]').addEventListener('click', () => sheet.close());
    content.addEventListener('submit', (e) => {
      e.preventDefault();
      recipe.nome = content.elements.nome.value.trim();
      saveRecipe(recipe);
      sheet.close();
      renderList();
    });
  }

  function openRecipeMenu(anchor, id) {
    const recipe = getRecipes().find((r) => r.id === id);
    if (!recipe) return;
    const nome = recipe.nome?.trim() || '(sem nome)';
    openMenu(anchor, [
      { label: '✏️ Renomear', onSelect: () => renameRecipe(recipe) },
      { label: '📄 Duplicar', onSelect: () => { duplicateRecipe(id); renderList(); showToast('Cópia criada'); } },
      { label: '💬 Enviar no WhatsApp', onSelect: () => window.open(whatsappUrl(buildRecipeShareText(recipe)), '_blank', 'noopener') },
      {
        label: '🗑️ Excluir',
        danger: true,
        onSelect: () => {
          const removed = deleteRecipe(id);
          renderList();
          if (!removed) return;
          showToast(`"${nome}" excluída`, {
            actionLabel: 'Desfazer',
            onAction: () => { restoreRecipe(removed.recipe, removed.index); renderList(); }
          });
        }
      }
    ]);
  }

  function createRecipe() {
    const recipe = createEmptyRecipe();
    saveRecipe(recipe);
    markNewRecipe(recipe.id);
    navigate({ screen: 'editor', recipeId: recipe.id, aba: 'ingredientes' });
  }

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-open], [data-menu]');
    if (!target) return;
    if (target.dataset.open) navigate({ screen: 'editor', recipeId: target.dataset.open, aba: 'ingredientes' });
    else if (target.dataset.menu) openRecipeMenu(target, target.dataset.menu);
    else if (target.dataset.action === 'nova') createRecipe();
    else if (target.dataset.action === 'ajustes') navigate({ screen: 'lista', sheet: 'ajustes' });
    else if (target.dataset.action === 'tema') toggleTheme();
  }, { signal: events.signal });

  renderList();

  return {
    update(route) {
      if (route.sheet === 'ajustes' && !ajustes) {
        ajustes = openAjustesSheet({
          onRequestClose: () => goBack({ screen: 'lista' }),
          onClose: () => { ajustes = null; },
          onDataChanged: renderList
        });
      } else if (route.sheet !== 'ajustes' && ajustes) {
        ajustes.close();
      }
    },
    destroy() {
      events.abort();
      closeMenu();
      ajustes?.close();
    }
  };
}
```

- [ ] **Step 8: Criar `js/screens/editor.js` (versão mínima, substituída na Task 13)**

```js
// js/screens/editor.js — minimal version; Task 13 replaces it with tabs.

import { getRecipe } from '../storage.js';
import { goBack } from '../router.js';
import { html, setHtml } from '../ui/dom.js';

export function renderEditor(view, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;
  const events = new AbortController();
  setHtml(view, html`
    <div class="sticky-head"><header class="topbar">
      <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar para Minhas Receitas">←</button>
      <h1>${recipe.nome || 'Nova receita'}</h1>
    </header></div>`);
  view.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="voltar"]')) goBack({ screen: 'lista' });
  }, { signal: events.signal });
  return { update() {}, destroy() { events.abort(); } };
}
```

- [ ] **Step 9: Reescrever `js/app.js`**

```js
// js/app.js — bootstrap: theme, router, and which screen is on.

import { startRouter, navigate } from './router.js';
import { renderLista } from './screens/lista.js';
import { renderEditor } from './screens/editor.js';
import { initTheme } from './theme.js';
import { store } from './store.js';
import { showToast } from './ui/toast.js';
import { closeMenu } from './ui/menu.js';

const view = document.getElementById('view');
let current = null; // { screen, recipeId, update, destroy }

function sameScreen(route) {
  return current && current.screen === route.screen &&
    (route.screen !== 'editor' || current.recipeId === route.recipeId);
}

function onRoute(route) {
  closeMenu();
  if (sameScreen(route)) {
    current.update(route);
    return;
  }
  current?.destroy();
  current = null;
  window.scrollTo(0, 0);

  if (route.screen === 'editor') {
    const screen = renderEditor(view, route.recipeId);
    if (!screen) {
      showToast('Receita não encontrada');
      navigate({ screen: 'lista' }, { replace: true });
      return;
    }
    current = { ...screen, screen: 'editor', recipeId: route.recipeId };
  } else {
    current = { ...renderLista(view), screen: 'lista' };
  }
  current.update(route);
}

// pagehide/visibilitychange are the reliable "leaving" signals on phones
// (beforeunload often never fires there).
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') store.flush();
});

initTheme();
startRouter(onRoute);
```

- [ ] **Step 10: Rodar o smoke e os testes**

Run: `npm test && npm run test:mobile -- 01`
Expected: testes PASS; `ok    01-lista.mjs [light]` e `ok    01-lista.mjs [dark]`. Abra `scripts/.screenshots/01-lista-lista-light.png` e `…-dark.png` e confira: cartões legíveis, nome longo quebrando linha, sem nada cortado.

- [ ] **Step 11: Commit**

```bash
git add index.html js/app.js js/session.js js/screens package.json package-lock.json .gitignore scripts/smoke-mobile.mjs scripts/smoke/01-lista.mjs
git commit -m "Switch to the new mobile app shell: recipe list with cards, menu, undo, search, settings

Removes Tailwind CDN and the old monolithic app.js.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Estrutura do editor — cabeçalho, abas e barra de resultado

**Files:**
- Rewrite: `js/screens/editor.js`
- Create: `js/screens/result-bar.js`
- Create (versões iniciais, substituídas nas Tasks 14–17): `js/screens/editor/ingredientes.js`, `js/screens/editor/custos.js`, `js/screens/editor/preco.js`, `js/screens/editor/nutricao.js`
- Test: `js/result-bar.test.js`, `scripts/smoke/02-editor.mjs`

**Interfaces:**
- Consumes: `store`, `recipeResult`, `navigate`, `goBack`, `isNewRecipe`, `forgetNewRecipe`, `deleteRecipe`, `buildRecipeShareText`, `whatsappUrl`, `showToast`, `WHATSAPP_ICON`
- Produces:
  - `resultBarContent(result) → Fragment` (puro)
  - `mountResultBar(slot, { onOpen }) → { update(recipe), setHidden(hidden), destroy() }`
  - Contrato de aba: `render(panel, { store }) → { update?(route), destroy() }`

- [ ] **Step 1: Escrever o teste da barra**

`js/result-bar.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultBarContent } from './screens/result-bar.js';
import { unwrap } from './ui/dom.js';

// Closing spans become a space (they are separate visual pieces); other tags vanish.
const text = (fragment) => unwrap(fragment).replace(/<\/span>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

test('resultBarContent: each state has its message', () => {
  assert.equal(text(resultBarContent({ kind: 'semRendimento', ingredientesSemCusto: 0 })), 'Defina quantas porções a receita rende');
  assert.equal(text(resultBarContent({ kind: 'semIngredientes', ingredientesSemCusto: 0 })), 'Adicione ingredientes para ver o custo');
  assert.equal(text(resultBarContent({ kind: 'semPreco', custoPorPorcao: 1.12, ingredientesSemCusto: 0 })), 'Custo R$ 1,12/un. Defina seu preço ›');
  assert.equal(text(resultBarContent({ kind: 'lucro', custoPorPorcao: 1.12, lucroPorPorcao: 2.38, ingredientesSemCusto: 0 })), 'Custo R$ 1,12/un. Lucro R$ 2,38/un.');
  assert.equal(text(resultBarContent({ kind: 'prejuizo', custoPorPorcao: 3.2, lucroPorPorcao: -0.2, ingredientesSemCusto: 0 })), 'Custo R$ 3,20/un. Prejuízo R$ 0,20/un.');
});

test('resultBarContent: profit and loss use their color classes', () => {
  assert.ok(unwrap(resultBarContent({ kind: 'lucro', custoPorPorcao: 1, lucroPorPorcao: 1, ingredientesSemCusto: 0 })).includes('profit'));
  assert.ok(unwrap(resultBarContent({ kind: 'prejuizo', custoPorPorcao: 1, lucroPorPorcao: -1, ingredientesSemCusto: 0 })).includes('loss'));
});

test('resultBarContent: warns about ingredients without cost', () => {
  assert.ok(text(resultBarContent({ kind: 'semPreco', custoPorPorcao: 1, ingredientesSemCusto: 2 })).endsWith('2 ingrediente(s) sem preço'));
});
```

Run: `npm test` → Expected: FAIL (módulo não existe).

- [ ] **Step 2: Criar `js/screens/result-bar.js`**

```js
// js/screens/result-bar.js — the always-visible cost/profit bar.

import { recipeResult } from '../results.js';
import { formatBRL } from '../format.js';
import { html, setHtml } from '../ui/dom.js';

export function resultBarContent(r) {
  let main;
  if (r.kind === 'semRendimento') {
    main = html`<span class="result-bar-value">Defina quantas porções a receita rende</span>`;
  } else if (r.kind === 'semIngredientes') {
    main = html`<span class="result-bar-value">Adicione ingredientes para ver o custo</span>`;
  } else {
    const custo = html`<span>Custo <strong>${formatBRL(r.custoPorPorcao)}</strong>/un.</span>`;
    let direita;
    if (r.kind === 'semPreco') direita = html`<span class="result-bar-value">Defina seu preço ›</span>`;
    else if (r.kind === 'lucro') direita = html`<span class="result-bar-value profit">Lucro ${formatBRL(r.lucroPorPorcao)}/un.</span>`;
    else direita = html`<span class="result-bar-value loss">Prejuízo ${formatBRL(Math.abs(r.lucroPorPorcao))}/un.</span>`;
    main = html`${custo}${direita}`;
  }
  return html`
    <span class="result-bar-main">${main}</span>
    ${r.ingredientesSemCusto > 0 ? html`<span class="result-bar-sub">${r.ingredientesSemCusto} ingrediente(s) sem preço</span>` : ''}`;
}

export function mountResultBar(slot, { onOpen }) {
  const bar = document.createElement('button');
  bar.type = 'button';
  bar.className = 'result-bar';
  bar.setAttribute('aria-label', 'Resultado — abrir a aba Preço');
  const live = document.createElement('span');
  live.setAttribute('aria-live', 'polite');
  bar.append(live);
  slot.append(bar);
  bar.addEventListener('click', onOpen);

  return {
    update(recipe) { setHtml(live, resultBarContent(recipeResult(recipe))); },
    setHidden(hidden) { bar.hidden = hidden; },
    destroy() { bar.remove(); }
  };
}
```

Run: `npm test` → Expected: PASS.

- [ ] **Step 3: Escrever o cenário do editor (vai falhar)**

`scripts/smoke/02-editor.mjs`:

```js
// Editor shell: new recipe focuses the name, tabs switch with replaceState,
// result bar opens Preço, save badge, empty new recipe is discarded on back,
// unknown recipe id goes back to the list.

export default async function ({ page, baseUrl, assert, shot }) {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: '+ Nova receita' }).click();
  await page.getByRole('tab', { name: 'Ingredientes' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'nome-receita');

  // Leaving an untouched new recipe discards it.
  await page.getByRole('button', { name: 'Voltar para Minhas Receitas' }).click();
  await page.getByText('Nenhuma receita ainda').waitFor();

  // A named one is kept, and autosaves.
  await page.getByRole('button', { name: '+ Nova receita' }).click();
  await page.locator('#nome-receita').fill('Brigadeiro');
  await page.getByText('✓ Salvo').waitFor();
  await page.getByText('Adicione ingredientes para ver o custo').waitFor();
  await shot('ingredientes');

  // Tabs replace the history entry: back from any tab returns to the list.
  await page.getByRole('tab', { name: 'Custos' }).click();
  assert.ok(page.url().endsWith('/custos'));
  assert.equal(await page.getByRole('tab', { name: 'Custos' }).getAttribute('aria-selected'), 'true');
  await page.locator('.result-bar').click();
  assert.ok(page.url().endsWith('/preco'));
  assert.equal(await page.locator('.result-bar').isVisible(), false);
  await page.goBack();
  await page.getByText('Brigadeiro').waitFor();
  assert.ok(page.url().endsWith('#/'));

  // Unknown recipe in the URL -> list + message.
  await page.goto(baseUrl + '#/receita/recipe%3Anao-existe/custos');
  await page.getByText('Receita não encontrada').waitFor();
  assert.ok(page.url().endsWith('#/'));
}
```

Run: `npm run test:mobile -- 02` → Expected: FAIL (o editor mínimo não tem abas).

- [ ] **Step 4: Criar as versões iniciais das quatro abas**

Mesmo conteúdo nos quatro arquivos, trocando o título (`Ingredientes`, `Custos`, `Preço`, `Nutrição`). Exemplo `js/screens/editor/custos.js`:

```js
// Initial version; replaced by the real tab in a later task.
import { html, setHtml } from '../../ui/dom.js';

export function render(panel) {
  setHtml(panel, html`<div class="card"><p class="muted">Custos</p></div>`);
  return { destroy() {} };
}
```

- [ ] **Step 5: Reescrever `js/screens/editor.js`**

```js
// js/screens/editor.js — recipe editor: header, tabs, result bar.

import { getRecipe, deleteRecipe } from '../storage.js';
import { store } from '../store.js';
import { navigate, goBack } from '../router.js';
import { isNewRecipe, forgetNewRecipe } from '../session.js';
import { buildRecipeShareText, whatsappUrl } from '../share.js';
import { html, raw, setHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { WHATSAPP_ICON } from '../ui/icons.js';
import { mountResultBar } from './result-bar.js';
import * as ingredientesTab from './editor/ingredientes.js';
import * as custosTab from './editor/custos.js';
import * as precoTab from './editor/preco.js';
import * as nutricaoTab from './editor/nutricao.js';

const TABS = [
  ['ingredientes', 'Ingredientes', ingredientesTab],
  ['custos', 'Custos', custosTab],
  ['preco', 'Preço', precoTab],
  ['nutricao', 'Nutrição', nutricaoTab]
];
const SAVE_LABELS = { salvo: '✓ Salvo', salvando: 'Salvando…', erro: '⚠ Não salvo' };

export function renderEditor(view, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return null;

  const events = new AbortController();
  store.load(recipe);

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar para Minhas Receitas">←</button>
        <label class="visually-hidden" for="nome-receita">Nome da receita</label>
        <input id="nome-receita" class="title-input" value="${recipe.nome}" placeholder="Nome da receita" enterkeyhint="done" autocomplete="off">
        <span class="save-badge" data-save-badge role="status"></span>
        <button type="button" class="icon-btn whatsapp-btn" data-action="whatsapp" aria-label="Enviar receita no WhatsApp">${raw(WHATSAPP_ICON)}</button>
      </header>
      <nav class="tabs" role="tablist" aria-label="Partes da receita">
        ${TABS.map(([aba, label]) => html`<button type="button" role="tab" class="tab" id="tab-${aba}" data-tab="${aba}" aria-controls="tab-panel" aria-selected="false" tabindex="-1">${label}</button>`)}
      </nav>
    </div>
    <section id="tab-panel" role="tabpanel"></section>
    <div data-slot="result-bar"></div>`);

  const panel = view.querySelector('#tab-panel');
  const badge = view.querySelector('[data-save-badge]');
  const nameInput = view.querySelector('#nome-receita');
  const tabButtons = [...view.querySelectorAll('[role="tab"]')];
  const resultBar = mountResultBar(view.querySelector('[data-slot="result-bar"]'), { onOpen: () => showTab('preco') });

  let currentAba = null;
  let tab = null;
  let lastStatus = store.status;

  function showTab(aba) {
    navigate({ screen: 'editor', recipeId, aba }, { replace: true });
  }

  function refresh() {
    badge.textContent = SAVE_LABELS[store.status];
    badge.dataset.status = store.status;
    if (store.status === 'erro' && lastStatus !== 'erro') {
      showToast('Não foi possível salvar. Exporte um backup em Ajustes.');
    }
    lastStatus = store.status;
    resultBar.update(store.recipe);
  }
  const unsubscribe = store.subscribe(refresh);

  nameInput.addEventListener('input', () => store.update((r) => { r.nome = nameInput.value; }), { signal: events.signal });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.blur(); }, { signal: events.signal });

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-tab]');
    if (!target || !view.contains(target)) return;
    if (target.dataset.tab) showTab(target.dataset.tab);
    else if (target.dataset.action === 'voltar') goBack({ screen: 'lista' });
    else if (target.dataset.action === 'whatsapp') {
      store.flush();
      window.open(whatsappUrl(buildRecipeShareText(store.recipe)), '_blank', 'noopener');
    }
  }, { signal: events.signal });

  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  view.addEventListener('keydown', (e) => {
    const i = tabButtons.indexOf(e.target);
    if (i === -1 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    e.preventDefault();
    const next = tabButtons[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabButtons.length) % tabButtons.length];
    next.focus();
    showTab(next.dataset.tab);
  }, { signal: events.signal });

  function mountTab(aba) {
    tab?.destroy();
    currentAba = aba;
    for (const b of tabButtons) {
      const selected = b.dataset.tab === aba;
      b.setAttribute('aria-selected', String(selected));
      b.tabIndex = selected ? 0 : -1;
    }
    panel.setAttribute('aria-labelledby', `tab-${aba}`);
    panel.innerHTML = '';
    const module = TABS.find(([key]) => key === aba)[2];
    tab = module.render(panel, { store });
    resultBar.setHidden(aba === 'preco');
    window.scrollTo(0, 0);
  }

  refresh();
  if (isNewRecipe(recipeId)) requestAnimationFrame(() => nameInput.focus());

  return {
    update(route) {
      if (route.aba !== currentAba) mountTab(route.aba);
      tab.update?.(route);
    },
    destroy() {
      tab?.destroy();
      tab = null;
      unsubscribe();
      events.abort();
      resultBar.destroy();
      store.flush();
      const r = store.recipe;
      if (r && isNewRecipe(r.id)) {
        forgetNewRecipe(r.id);
        if (!r.nome.trim() && r.ingredientes.length === 0) deleteRecipe(r.id);
      }
      store.clear();
    }
  };
}
```

- [ ] **Step 6: Rodar**

Run: `npm test && npm run test:mobile`
Expected: tudo PASS (cenários 01 e 02, nos dois temas).

- [ ] **Step 7: Commit**

```bash
git add js/screens js/result-bar.test.js scripts/smoke/02-editor.mjs
git commit -m "Editor shell: editable title, save badge, tabs in the URL, fixed result bar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Aba Ingredientes

**Files:**
- Rewrite: `js/screens/editor/ingredientes.js`
- Create: `js/screens/editor/ingrediente-sheet.js` (versão mínima só com "Pronto", substituída na Task 15)
- Test: `scripts/smoke/03-ingredientes.mjs`

**Interfaces:**
- Consumes: `store`, `calculateRecipeTotals`, `computeLineCost`, `lineIssue`, `ISSUE_TEXT`, `ingredientSummary`, `formatBRL`, `parseInteger`, `navigate`, `goBack`
- Produces: aba com `update(route)` que abre/fecha o painel conforme `route.item`; `openIngredientSheet({ store, index, onRequestClose, onClose }) → sheet` (a Task 15 mantém exatamente esta assinatura; `onClose(index|null)` recebe o índice final do ingrediente para devolver o foco à linha)

- [ ] **Step 1: Escrever o cenário (vai falhar)**

`scripts/smoke/03-ingredientes.mjs`:

```js
// Ingredientes tab: yield stepper, rows with cost/summary/issue, totals,
// long names, and deep links to missing ingredients.

const ing = (o) => ({ ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null, ...o });

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.goto(baseUrl);
  await seed([{
    id: 'recipe:b', nome: 'Brigadeiro Gourmet', rendimento: 30, embalagemUnitaria: 0.35, quantidadeEmbalagens: 30,
    tempoPreparoMinutos: 20, valorBotijao: 120, precoVendaDesejado: 3.5, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z',
    ingredientes: [
      ing({ nome: 'Leite condensado', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 }),
      ing({ nome: 'Chocolate meio amargo 50% cacau da marca preferida da confeiteira', quantidadeBruta: '100', precoEmbalagem: 12.9, tamanhoEmbalagem: 200 }),
      ing({ nome: 'Manteiga', quantidadeBruta: '1', unidade: 'colherSopa', precoEmbalagem: 11.5, tamanhoEmbalagem: 200, densidadeGml: 0.91 }),
      ing({ nome: 'Granulado', quantidadeBruta: '50' })
    ]
  }]);
  await page.goto(baseUrl + '#/receita/recipe%3Ab');

  await page.getByText('2 unidades · R$ 7,49 / 395 g').waitFor();
  await page.getByText('R$ 14,98').waitFor();
  await page.getByText('1 colher de sopa · R$ 11,50 / 200 g').waitFor();
  await page.getByText('falta o preço').waitFor();
  await page.getByText('R$ 22,21').waitFor(); // ingredients total
  await page.getByText('Lucro R$ 2,38/un.').waitFor();
  await page.getByText('1 ingrediente(s) sem preço').waitFor();
  await semRolagemHorizontal();
  await shot('lista');

  // Stepper: 30 -> 31 changes cost per unit; typing 0 shows the yield message.
  await page.getByRole('button', { name: 'Aumentar porções' }).click();
  assert.equal(await page.locator('#rendimento').inputValue(), '31');
  await page.locator('#rendimento').fill('0');
  await page.getByText('Defina quantas porções a receita rende').waitFor();
  await page.getByRole('button', { name: 'Diminuir porções' }).click();
  assert.equal(await page.locator('#rendimento').inputValue(), '1');
  await page.locator('#rendimento').fill('30');

  // Tapping a row opens its sheet (push), back closes it.
  await page.getByRole('button', { name: /Manteiga/ }).click();
  await page.getByRole('dialog').waitFor();
  assert.ok(page.url().endsWith('/ingredientes/2'));
  await page.goBack();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('/ingredientes'));

  // Review focus 1: deep link to a missing ingredient -> no sheet, URL fixed.
  await page.goto(baseUrl + '#/receita/recipe%3Ab/ingredientes/99');
  await page.getByText('Leite condensado').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.ok(page.url().endsWith('/ingredientes'));
}
```

Run: `npm run test:mobile -- 03` → Expected: FAIL.

- [ ] **Step 2: Criar `js/screens/editor/ingrediente-sheet.js` (versão mínima)**

```js
// Minimal version so the Ingredientes tab can be tested; Task 15 replaces it.
import { html, toElement } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';

export function openIngredientSheet({ store, index, onRequestClose, onClose }) {
  const item = index === 'novo' ? null : store.recipe.ingredientes[index];
  const content = toElement(html`
    <div>
      <h2 class="sheet-title">${item ? item.nome : 'Novo ingrediente'}</h2>
      <div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-ok>Pronto</button></div>
    </div>`);
  const sheet = openSheet({ title: item ? item.nome : 'Novo ingrediente', content, onRequestClose, onClose: () => onClose?.(index === 'novo' ? null : index) });
  content.querySelector('[data-ok]').addEventListener('click', onRequestClose);
  return sheet;
}
```

- [ ] **Step 3: Reescrever `js/screens/editor/ingredientes.js`**

```js
// js/screens/editor/ingredientes.js — yield + ingredient rows.

import { calculateRecipeTotals } from '../../calculations.js';
import { computeLineCost, lineIssue, ISSUE_TEXT, ingredientSummary } from '../../costing.js';
import { formatBRL, parseInteger } from '../../format.js';
import { navigate, goBack } from '../../router.js';
import { html, setHtml } from '../../ui/dom.js';
import { openIngredientSheet } from './ingrediente-sheet.js';

function rowHtml(item, index) {
  const custo = computeLineCost(item);
  const issue = lineIssue(item);
  const resumo = ingredientSummary(item);
  return html`
    <li>
      <button type="button" class="card ing-row" data-index="${index}">
        <span class="ing-row-top">
          <span class="ing-row-name">${item.nome}</span>
          <span class="text-cost">${custo != null ? formatBRL(custo) : '—'}</span>
        </span>
        ${resumo ? html`<span class="muted ing-row-detail">${resumo}</span>` : ''}
        ${issue ? html`<span class="ing-row-issue">${ISSUE_TEXT[issue]}</span>` : ''}
      </button>
    </li>`;
}

export function render(panel, { store }) {
  const events = new AbortController();
  const recipeId = store.recipe.id;
  const tabRoute = { screen: 'editor', recipeId, aba: 'ingredientes' };

  setHtml(panel, html`
    <div class="card rende-row">
      <label for="rendimento"><strong>Rende</strong> <span class="muted">porções</span></label>
      <div class="stepper">
        <button type="button" data-step="-1" aria-label="Diminuir porções">−</button>
        <input id="rendimento" class="input" inputmode="numeric" pattern="[0-9]*" value="${store.recipe.rendimento}" autocomplete="off">
        <button type="button" data-step="1" aria-label="Aumentar porções">+</button>
      </div>
    </div>
    <h2 class="section-title"><span>Ingredientes</span><span class="muted" data-total></span></h2>
    <ul class="ing-list stack" data-list></ul>
    <button type="button" class="add-row" data-action="add">+ Adicionar ingrediente</button>`);

  const rendInput = panel.querySelector('#rendimento');
  const list = panel.querySelector('[data-list]');
  const total = panel.querySelector('[data-total]');

  function renderRows() {
    const { ingredientes } = store.recipe;
    setHtml(list, ingredientes.length
      ? html`${ingredientes.map(rowHtml)}`
      : html`<li class="muted" style="padding:8px 2px">Comece adicionando o primeiro ingrediente.</li>`);
    const { ingredientesCost } = calculateRecipeTotals(store.recipe, computeLineCost);
    total.textContent = ingredientes.length ? formatBRL(ingredientesCost) : '';
  }
  const unsubscribe = store.subscribe(renderRows);

  rendInput.addEventListener('input', () => {
    store.update((r) => { r.rendimento = parseInteger(rendInput.value); });
  }, { signal: events.signal });

  panel.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      const next = Math.max(1, (store.recipe.rendimento || 0) + Number(step.dataset.step));
      rendInput.value = String(next);
      store.update((r) => { r.rendimento = next; });
      return;
    }
    const row = e.target.closest('[data-index]');
    if (row) navigate({ ...tabRoute, item: Number(row.dataset.index) });
    else if (e.target.closest('[data-action="add"]')) navigate({ ...tabRoute, item: 'novo' });
  }, { signal: events.signal });

  let sheet = null;
  let sheetKey = null;

  function focusRow(index) {
    if (index == null) return;
    panel.querySelector(`[data-index="${index}"]`)?.focus({ preventScroll: true });
  }

  renderRows();

  return {
    update(route) {
      const key = route.item ?? null;
      if (key === sheetKey) return;
      if (sheet) {
        const open = sheet;
        sheet = null;
        sheetKey = null;
        open.close();
      }
      if (key == null) return;
      if (key !== 'novo' && !store.recipe.ingredientes[key]) {
        navigate(tabRoute, { replace: true }); // e.g. a stale link to a removed ingredient
        return;
      }
      sheetKey = key;
      sheet = openIngredientSheet({
        store,
        index: key,
        onRequestClose: () => goBack(tabRoute),
        onClose: (finalIndex) => {
          if (sheetKey === key) { sheet = null; sheetKey = null; }
          focusRow(finalIndex);
        }
      });
    },
    destroy() {
      sheet?.close();
      unsubscribe();
      events.abort();
    }
  };
}
```

- [ ] **Step 4: Rodar**

Run: `npm run test:mobile`
Expected: 01, 02 e 03 PASS nos dois temas. Confira `scripts/.screenshots/03-ingredientes-lista-*.png`: o nome longo quebra linha, o custo fica à direita, a barra não cobre o botão "+ Adicionar ingrediente" quando a página é rolada até o fim.

- [ ] **Step 5: Commit**

```bash
git add js/screens/editor/ingredientes.js js/screens/editor/ingrediente-sheet.js scripts/smoke/03-ingredientes.mjs
git commit -m "Ingredientes tab: yield stepper and compact ingredient rows with cost and hints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Painel de ingrediente

**Files:**
- Rewrite: `js/screens/editor/ingrediente-sheet.js`
- Test: `scripts/smoke/04-painel-ingrediente.mjs`

**Interfaces:**
- Consumes: `openSheet`, `confirmSheet`, `showToast`, `html`, `toElement`, `setHtml`, `bindCurrencyInput`; `UNIT_CHIPS`, `PACKAGE_UNIT_CHIPS`, `formatBRL`, `formatCurrencyInput`, `formatDecimalInput`, `formatNumber`, `parseDecimal`, `packageUnitShort`; `parseQuantity`; `computeLineCost`, `quantidadeConvertidaEmGramas`, `lineIssue`, `ISSUE_TEXT`; `emptyIngredientItem`, `findKnownIngredient`, `applyIngredientMatch`, `buildCustomIngredient`, `NUTRIENT_LABELS`, `ingredientNameSuggestions`; `getCustomIngredients`, `saveCustomIngredient`, `getPreco`, `savePreco`, `applyPricingToAllRecipes`; `getTacoIngredients`; `findInTaco`
- Produces: `openIngredientSheet({ store, index: number|'novo', onRequestClose, onClose(finalIndex|null) }) → sheet` (mesma assinatura da Task 14)

- [ ] **Step 1: Escrever o cenário (vai falhar)**

`scripts/smoke/04-painel-ingrediente.mjs`:

```js
// Ingredient sheet: add known + unknown ingredients, chips, conversion hint,
// money mask with focus kept, TACO lookup, price propagation, remove + undo,
// deep-linked sheet closing inside the app, persistence after reload.

export default async function ({ page, baseUrl, assert, shot, seed }) {
  await page.goto(baseUrl);
  await seed([
    { id: 'recipe:outra', nome: 'Bolo', rendimento: 8, embalagemUnitaria: 0, quantidadeEmbalagens: 8, tempoPreparoMinutos: 0, valorBotijao: 0, precoVendaDesejado: null,
      criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z',
      ingredientes: [{ ingredientId: 'fixed:manteiga', nome: 'Manteiga', quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 9, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: 0.96, pesoUnidadeG: null }] },
    { id: 'recipe:b', nome: 'Brigadeiro', rendimento: 20, embalagemUnitaria: 0, quantidadeEmbalagens: 20, tempoPreparoMinutos: 0, valorBotijao: 0, precoVendaDesejado: null,
      criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [] }
  ]);
  await page.goto(baseUrl + '#/receita/recipe%3Ab');

  // 1) Known ingredient from the fixed DB, measured in colheres de sopa.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  const dialog = page.getByRole('dialog');
  await page.waitForFunction(() => document.activeElement?.name === 'nome');
  await dialog.getByLabel('Ingrediente').fill('Manteiga');
  await dialog.getByLabel('Ingrediente').press('Enter'); // change -> match; Enter moves to the next field
  await dialog.getByLabel('Quantidade usada').fill('2');
  await dialog.getByRole('button', { name: 'c. sopa' }).click();
  assert.equal(await dialog.getByRole('button', { name: 'c. sopa' }).getAttribute('aria-pressed'), 'true');
  await dialog.getByText('≈ 28,8 g').waitFor(); // 2 × 15 ml × 0.96 g/ml

  // Review focus 3: typing digit by digit keeps focus and the full value.
  const preco = dialog.getByLabel('Preço pago (R$)');
  await preco.click();
  await preco.pressSequentially('1150');
  assert.equal(await preco.inputValue(), '11,50');
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'precoEmbalagem');
  await dialog.getByLabel('Tamanho da embalagem').fill('200');
  await dialog.getByText('R$ 1,66').waitFor(); // 28.8 g of R$ 11,50 / 200 g
  await shot('painel');

  // Price propagation to the other recipe (confirmation sheet).
  await dialog.getByRole('button', { name: /Usar este preço em outras receitas/ }).click();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await page.getByText('Preço atualizado em 1 outra(s) receita(s).').waitFor();

  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByText('2 colheres de sopa · R$ 11,50 / 200 g').waitFor();

  // 2) Unknown ingredient -> nutrition section with TACO lookup.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await dialog.getByLabel('Ingrediente').fill('Leite de coco');
  await dialog.getByLabel('Ingrediente').press('Tab');
  await dialog.getByText('Nutrição (opcional)').waitFor();
  await dialog.getByText(/Encontrado na tabela TACO|Não encontrado na tabela nutricional/).waitFor();
  await dialog.getByLabel('Quantidade usada').fill('1');
  await dialog.getByRole('button', { name: 'unidade', exact: true }).first().click();
  await dialog.getByLabel('Preço pago (R$)').pressSequentially('590');
  await dialog.getByLabel('Tamanho da embalagem').fill('200');
  await dialog.getByRole('group', { name: 'Unidade da embalagem' }).getByRole('button', { name: 'ml' }).click();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByText('1 unidade · R$ 5,90 / 200 ml').waitFor();
  const custom = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:custom-ingredients') || '[]'));
  assert.ok(custom.some((c) => c.nome === 'Leite de coco' && c.densidadeGml === 1));

  // 3) Remove + undo. (Rows are located by class: the toast repeats the name.)
  const cocoRow = page.locator('.ing-row', { hasText: 'Leite de coco' });
  await cocoRow.click();
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await cocoRow.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await cocoRow.waitFor();

  // 4) Review focus 2: sheet opened by a deep link closes inside the app.
  await page.goto(baseUrl + '#/receita/recipe%3Ab/ingredientes/0');
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('#/receita/recipe%3Ab/ingredientes'));

  // 5) New sheet closed with no name adds nothing.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.ing-row').count(), 2);

  // Everything persisted.
  await page.reload();
  await page.getByText('2 colheres de sopa · R$ 11,50 / 200 g').waitFor();
  const outra = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:recipes')).find((r) => r.id === 'recipe:outra'));
  assert.equal(outra.ingredientes[0].precoEmbalagem, 11.5);
}
```

Run: `npm run test:mobile -- 04` → Expected: FAIL.

- [ ] **Step 2: Reescrever `js/screens/editor/ingrediente-sheet.js`**

```js
// js/screens/editor/ingrediente-sheet.js
//
// Bottom sheet with every field of one ingredient. Edits apply live
// (store + autosave). A new ingredient joins the recipe once it has a name.
// An unrecognized name shows the optional nutrition section (TACO lookup)
// that used to be a separate modal; the custom ingredient is saved when the
// sheet closes.

import { parseQuantity } from '../../calculations.js';
import { computeLineCost, quantidadeConvertidaEmGramas, lineIssue, ISSUE_TEXT } from '../../costing.js';
import {
  UNIT_CHIPS, PACKAGE_UNIT_CHIPS, formatBRL, formatCurrencyInput, formatDecimalInput,
  formatNumber, parseDecimal, packageUnitShort
} from '../../format.js';
import {
  emptyIngredientItem, findKnownIngredient, applyIngredientMatch, buildCustomIngredient,
  NUTRIENT_LABELS, ingredientNameSuggestions
} from '../../ingredient-match.js';
import { getCustomIngredients, saveCustomIngredient, getPreco, savePreco, applyPricingToAllRecipes } from '../../storage.js';
import { getTacoIngredients } from '../../taco-loader.js';
import { findInTaco } from '../../taco-database.js';
import { html, setHtml, toElement, bindCurrencyInput } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmSheet } from '../../ui/confirm.js';
import { showToast } from '../../ui/toast.js';

function chip({ value, label }, selected) {
  return html`<button type="button" class="chip" data-value="${value}" aria-pressed="${value === selected}">${label}</button>`;
}

export function openIngredientSheet({ store, index, onRequestClose, onClose }) {
  const isNew = index === 'novo';
  const item = isNew ? emptyIngredientItem() : store.recipe.ingredientes[index];
  const recipeId = store.recipe.id;
  let itemIndex = isNew ? null : index;
  let pendingCustom = false;
  let tacoNutricao = null;
  let lookupToken = 0;
  let removed = false;
  let closed = false;

  const content = toElement(html`
    <form novalidate>
      <h2 class="sheet-title">${isNew ? 'Novo ingrediente' : item.nome}</h2>

      <label class="field"><span class="field-label">Ingrediente</span>
        <input class="input" name="nome" list="ingredientes-sugestoes" value="${item.nome}" placeholder="Ex: Leite condensado" autocomplete="off" enterkeyhint="next"></label>
      <datalist id="ingredientes-sugestoes">
        ${ingredientNameSuggestions(getCustomIngredients()).map((nome) => html`<option value="${nome}">`)}
      </datalist>

      <p class="sheet-section">Quanto usa na receita</p>
      <label class="field"><span class="visually-hidden">Quantidade usada</span>
        <input class="input" name="quantidadeBruta" value="${item.quantidadeBruta}" placeholder="Ex: 2, 1/2 ou 0,5" autocomplete="off" enterkeyhint="next"></label>
      <div class="chips" role="group" aria-label="Unidade usada na receita" data-chips="unidade">
        ${UNIT_CHIPS.map((c) => chip(c, item.unidade))}
      </div>
      <p class="field-hint" data-conversao></p>

      <p class="sheet-section">Quanto pagou</p>
      <div class="row-2">
        <label class="field"><span class="field-label">Preço pago (R$)</span>
          <input class="input" name="precoEmbalagem" inputmode="numeric" value="${formatCurrencyInput(item.precoEmbalagem)}" autocomplete="off" enterkeyhint="next"></label>
        <label class="field"><span class="field-label">Tamanho da embalagem</span>
          <input class="input" name="tamanhoEmbalagem" inputmode="decimal" value="${item.tamanhoEmbalagem ? formatDecimalInput(item.tamanhoEmbalagem) : ''}" placeholder="Ex: 395" autocomplete="off" enterkeyhint="done"></label>
      </div>
      <div class="chips" role="group" aria-label="Unidade da embalagem" data-chips="unidadeEmbalagem">
        ${PACKAGE_UNIT_CHIPS.map((c) => chip(c, item.unidadeEmbalagem))}
      </div>

      <div class="card ing-cost"><span>Custo na receita</span><strong class="text-cost" data-custo></strong></div>
      <p class="ing-row-issue" data-issue></p>
      <button type="button" class="btn-link" data-action="propagar" hidden>🔄 Usar este preço em outras receitas</button>

      <div data-nutricao hidden>
        <p class="sheet-section">Nutrição (opcional)</p>
        <p class="muted" data-taco-status></p>
        <div class="row-2" data-nutri-fields style="margin-top:8px"></div>
      </div>

      <div class="sheet-actions">
        ${isNew ? '' : html`<button type="button" class="btn btn-danger-link" data-action="remover">Remover</button>`}
        <button type="submit" class="btn btn-primary" style="flex:1">Pronto</button>
      </div>
    </form>`);

  const f = content.elements;
  const q = (selector) => content.querySelector(selector);

  // Existing ingredient -> store update (autosave). New one joins the
  // recipe as soon as it has a name.
  function persist() {
    if (itemIndex == null) {
      if (item.nome.trim()) {
        store.update((r) => { r.ingredientes.push(item); });
        itemIndex = store.recipe.ingredientes.length - 1;
      }
    } else {
      store.update(() => {});
    }
    refreshDerived();
  }

  function refreshDerived() {
    const custo = computeLineCost(item);
    q('[data-custo]').textContent = custo != null ? formatBRL(custo) : '—';
    const issue = item.nome.trim() ? lineIssue(item) : null;
    q('[data-issue]').textContent = issue ? ISSUE_TEXT[issue] : '';
    const gramas = quantidadeConvertidaEmGramas(item, parseQuantity(item.quantidadeBruta));
    q('[data-conversao]').textContent = gramas != null ? `≈ ${formatNumber(gramas, 1)} g` : '';
    q('[data-action="propagar"]').hidden = !(item.nome.trim() && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0);
  }

  function syncChips() {
    for (const group of content.querySelectorAll('[data-chips]')) {
      for (const b of group.children) b.setAttribute('aria-pressed', String(b.dataset.value === item[group.dataset.chips]));
    }
  }

  function syncPriceFields() {
    f.precoEmbalagem.value = formatCurrencyInput(item.precoEmbalagem);
    f.tamanhoEmbalagem.value = item.tamanhoEmbalagem ? formatDecimalInput(item.tamanhoEmbalagem) : '';
  }

  function learnPrice() {
    if (item.nome.trim() && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) {
      savePreco({ nome: item.nome, precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem });
    }
  }

  function renderNutriFields(nutricao) {
    setHtml(q('[data-nutri-fields]'), html`${Object.entries(NUTRIENT_LABELS).map(([key, label]) => html`
      <label class="field"><span class="field-label">${label}</span>
        <input class="input" data-nutriente="${key}" inputmode="decimal" autocomplete="off"
               value="${nutricao && nutricao[key] != null ? formatDecimalInput(nutricao[key]) : ''}"></label>`)}`);
  }

  function readNutri() {
    const out = {};
    for (const input of content.querySelectorAll('[data-nutriente]')) {
      const v = input.value.trim();
      out[input.dataset.nutriente] = v === '' ? null : parseDecimal(v);
    }
    return out;
  }

  function showNutricao(nome) {
    q('[data-nutricao]').hidden = false;
    const status = q('[data-taco-status]');
    status.textContent = 'Buscando na tabela nutricional…';
    tacoNutricao = null;
    renderNutriFields(null);
    const token = ++lookupToken;
    getTacoIngredients()
      .then((taco) => {
        if (token !== lookupToken || closed) return;
        const match = findInTaco(nome, taco);
        tacoNutricao = match ? match.nutricao100g : null;
        status.textContent = match
          ? `Encontrado na tabela TACO: "${match.nome}" (ajustável).`
          : 'Não encontrado na tabela nutricional — preencha se quiser (opcional).';
        renderNutriFields(tacoNutricao);
      })
      .catch(() => {
        if (token !== lookupToken || closed) return;
        status.textContent = 'Base nutricional indisponível — verifique sua conexão. Você pode preencher à mão.';
      });
  }

  f.nome.addEventListener('change', () => {
    const nome = f.nome.value.trim();
    item.nome = nome;
    if (nome) {
      const matched = applyIngredientMatch(item, {
        known: findKnownIngredient(nome, getCustomIngredients()),
        precoConhecido: getPreco(nome)
      });
      pendingCustom = !matched;
      syncChips();
      syncPriceFields();
      if (pendingCustom) showNutricao(nome);
      else q('[data-nutricao]').hidden = true;
    } else {
      pendingCustom = false;
      q('[data-nutricao]').hidden = true;
    }
    persist();
  });

  f.quantidadeBruta.addEventListener('input', () => { item.quantidadeBruta = f.quantidadeBruta.value; persist(); });
  bindCurrencyInput(f.precoEmbalagem, (value) => { item.precoEmbalagem = value; persist(); });
  f.tamanhoEmbalagem.addEventListener('input', () => { item.tamanhoEmbalagem = parseDecimal(f.tamanhoEmbalagem.value); persist(); });
  f.precoEmbalagem.addEventListener('blur', learnPrice);
  f.tamanhoEmbalagem.addEventListener('blur', learnPrice);

  async function propagar() {
    const ok = await confirmSheet({
      title: 'Usar este preço em outras receitas?',
      message: `"${item.nome}" passa a custar ${formatBRL(item.precoEmbalagem)} por ${formatDecimalInput(item.tamanhoEmbalagem)} ${packageUnitShort(item.unidadeEmbalagem)} em todas as outras receitas que usam esse ingrediente.`,
      confirmLabel: 'Atualizar'
    });
    if (!ok) return;
    const n = applyPricingToAllRecipes(
      item.nome,
      { precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem },
      recipeId
    );
    showToast(n > 0 ? `Preço atualizado em ${n} outra(s) receita(s).` : 'Nenhuma outra receita usa esse ingrediente ainda.');
  }

  function remover() {
    const position = itemIndex;
    removed = true;
    store.update((r) => { r.ingredientes.splice(position, 1); });
    onRequestClose();
    showToast(`"${item.nome}" removido`, {
      actionLabel: 'Desfazer',
      onAction: () => {
        if (store.recipe?.id !== recipeId) return; // left the recipe meanwhile
        store.update((r) => { r.ingredientes.splice(Math.min(position, r.ingredientes.length), 0, item); });
      }
    });
  }

  content.addEventListener('click', (e) => {
    const chipButton = e.target.closest('[data-chips] .chip');
    if (chipButton) {
      const field = chipButton.parentElement.dataset.chips;
      item[field] = chipButton.dataset.value;
      syncChips();
      persist();
      if (field === 'unidadeEmbalagem') learnPrice();
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'propagar') propagar();
    if (action === 'remover') remover();
  });

  // Enter moves to the next field; "Pronto" (or Enter on the last field) closes.
  content.addEventListener('submit', (e) => {
    e.preventDefault();
    const order = [f.nome, f.quantidadeBruta, f.precoEmbalagem, f.tamanhoEmbalagem];
    const i = order.indexOf(document.activeElement);
    if (i >= 0 && i < order.length - 1) {
      order[i + 1].focus();
      return;
    }
    onRequestClose();
  });

  function finalize() {
    closed = true;
    if (store.recipe?.id === recipeId && itemIndex != null && !removed) {
      if (!item.nome.trim()) {
        const position = itemIndex;
        store.update((r) => { r.ingredientes.splice(position, 1); });
        itemIndex = null;
      } else if (pendingCustom) {
        const custom = buildCustomIngredient({
          id: `custom:${crypto.randomUUID()}`,
          nome: item.nome,
          unidadeEmbalagem: item.unidadeEmbalagem,
          nutricaoDigitada: readNutri(),
          nutricaoTaco: tacoNutricao
        });
        saveCustomIngredient(custom);
        store.update(() => {
          item.ingredientId = custom.id;
          item.nutricao100g = custom.nutricao100g;
          item.densidadeGml = custom.densidadeGml;
          item.pesoUnidadeG = null;
        });
        learnPrice();
      }
      store.flush();
    }
    onClose?.(removed ? null : itemIndex);
  }

  refreshDerived();
  return openSheet({
    title: isNew ? 'Novo ingrediente' : item.nome,
    content,
    onRequestClose,
    onClose: finalize,
    initialFocus: isNew ? 'input[name="nome"]' : null
  });
}
```

- [ ] **Step 3: Rodar**

Run: `npm run test:mobile`
Expected: 01–04 PASS nos dois temas. Confira `04-painel-ingrediente-painel-*.png`: chips com 44px de altura, botões "Pronto/Remover" visíveis no fim do painel, sem rolagem horizontal.

- [ ] **Step 4: Commit**

```bash
git add js/screens/editor/ingrediente-sheet.js scripts/smoke/04-painel-ingrediente.mjs
git commit -m "Ingredient bottom sheet: unit chips, live cost, TACO nutrition inline, price propagation, remove with undo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Abas Custos e Preço

**Files:**
- Rewrite: `js/screens/editor/custos.js`, `js/screens/editor/preco.js`
- Test: `scripts/smoke/05-custos-preco.mjs`

**Interfaces:**
- Consumes: `store`, `recipeResult`, `formatBRL`, `formatNumber`, `formatCurrencyInput`, `formatDecimalInput`, `parseDecimal`, `parseInteger`, `bindCurrencyInput`, `html`, `setHtml`
- Produces: `render(panel, { store }) → { destroy() }` nas duas abas

- [ ] **Step 1: Escrever o cenário (vai falhar)**

`scripts/smoke/05-custos-preco.mjs`:

```js
// Custos: package and gas inputs update totals and the bar.
// Preço: 2x/3x/4x chips per unit, typed price, profit, details.

const ing = { ingredientId: null, nome: 'Farinha', quantidadeBruta: '500', unidade: 'g', precoEmbalagem: 10, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null };

export default async function ({ page, baseUrl, assert, shot, seed }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:b', nome: 'Biscoito', rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 10, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [ing] }]);

  await page.goto(baseUrl + '#/receita/recipe%3Ab/custos');
  await page.getByLabel('Custo de cada embalagem (R$)').pressSequentially('50');
  await page.getByLabel('Quantas embalagens').fill('5');
  await page.getByText('R$ 2,50', { exact: true }).waitFor(); // 5 × R$ 0,50
  await page.getByLabel('Tempo de forno/fogo (minutos)').fill('25');
  await page.getByLabel('Preço do botijão 13 kg (R$)').pressSequentially('12000');
  await page.getByText('R$ 1,00', { exact: true }).waitFor(); // 120 / 3000 × 25
  await page.getByText('R$ 8,50').waitFor(); // 5 + 2,50 + 1
  await page.getByText('Custo R$ 0,85/un.').waitFor();
  await shot('custos');

  await page.locator('.result-bar').click();
  await page.getByText('Custo por unidade').waitFor();
  await page.getByRole('button', { name: '3× R$ 2,55' }).click();
  assert.equal(await page.getByLabel('Quanto você vai cobrar? (por unidade)').inputValue(), '2,55');
  await page.getByText('Você lucra R$ 1,70 por unidade').waitFor();
  await page.getByText('R$ 17,00 na receita toda').waitFor();

  const campo = page.getByLabel('Quanto você vai cobrar? (por unidade)');
  await campo.fill('');
  await campo.pressSequentially('50');
  await page.getByText('Você perde R$ 0,35 por unidade').waitFor();
  await campo.fill('');
  await page.getByText('Escolha uma sugestão ou digite seu preço.').waitFor();
  await campo.pressSequentially('300');

  await page.getByText('Ver detalhes do cálculo').click();
  await page.getByText(/Margem sobre a venda: 71,7%/).waitFor();
  await page.getByText(/Markup sobre o custo: 252,9%/).waitFor();
  await shot('preco');

  await page.reload();
  assert.equal(await page.getByLabel('Quanto você vai cobrar? (por unidade)').inputValue(), '3,00');
}
```

Run: `npm run test:mobile -- 05` → Expected: FAIL.

- [ ] **Step 2: Reescrever `js/screens/editor/custos.js`**

```js
// js/screens/editor/custos.js — packaging and gas.

import { recipeResult } from '../../results.js';
import { formatBRL, formatCurrencyInput, formatDecimalInput, parseDecimal, parseInteger } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';

export function render(panel, { store }) {
  const events = new AbortController();
  const r = store.recipe;

  setHtml(panel, html`
    <div class="card">
      <h2 class="card-title">Embalagem</h2>
      <label class="field"><span class="field-label">Custo de cada embalagem (R$)</span>
        <input class="input" name="embalagemUnitaria" inputmode="numeric" value="${formatCurrencyInput(r.embalagemUnitaria)}" autocomplete="off"></label>
      <label class="field"><span class="field-label">Quantas embalagens</span>
        <input class="input" name="quantidadeEmbalagens" inputmode="numeric" pattern="[0-9]*" value="${r.quantidadeEmbalagens}" autocomplete="off">
        <span class="field-hint">Ex.: 20 brigadeiros, 4 por embalagem = 5 embalagens</span></label>
      <p class="line-total"><span>Total de embalagens</span><strong class="text-cost" data-total="embalagens"></strong></p>
    </div>
    <div class="card">
      <h2 class="card-title">Gás</h2>
      <label class="field"><span class="field-label">Tempo de forno/fogo (minutos)</span>
        <input class="input" name="tempoPreparoMinutos" inputmode="decimal" value="${formatDecimalInput(r.tempoPreparoMinutos)}" autocomplete="off"></label>
      <label class="field"><span class="field-label">Preço do botijão 13 kg (R$)</span>
        <input class="input" name="valorBotijao" inputmode="numeric" value="${formatCurrencyInput(r.valorBotijao)}" autocomplete="off"></label>
      <p class="line-total"><span>Total de gás</span><strong class="text-cost" data-total="gas"></strong></p>
    </div>
    <div class="card line-total"><span>Custo total da receita</span><strong class="text-cost" data-total="receita"></strong></div>`);

  const field = (name) => panel.querySelector(`[name="${name}"]`);
  const set = (name) => (value) => store.update((recipe) => { recipe[name] = value; });
  const { signal } = events;

  bindCurrencyInput(field('embalagemUnitaria'), set('embalagemUnitaria'), { signal });
  bindCurrencyInput(field('valorBotijao'), set('valorBotijao'), { signal });
  field('quantidadeEmbalagens').addEventListener('input', (e) => set('quantidadeEmbalagens')(parseInteger(e.target.value)), { signal });
  field('tempoPreparoMinutos').addEventListener('input', (e) => set('tempoPreparoMinutos')(parseDecimal(e.target.value)), { signal });

  function refresh() {
    const res = recipeResult(store.recipe);
    panel.querySelector('[data-total="embalagens"]').textContent = formatBRL(res.embalagensCost);
    panel.querySelector('[data-total="gas"]').textContent = formatBRL(res.gasCost);
    panel.querySelector('[data-total="receita"]').textContent = formatBRL(res.custoTotal);
  }
  const unsubscribe = store.subscribe(refresh);
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
```

- [ ] **Step 3: Reescrever `js/screens/editor/preco.js`**

```js
// js/screens/editor/preco.js — what to charge and what you earn.

import { recipeResult } from '../../results.js';
import { formatBRL, formatNumber, formatCurrencyInput } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';

const MULTIPLICADORES = [['preco2x', 2], ['preco3x', 3], ['preco4x', 4]];
const round2 = (n) => Math.round(n * 100) / 100;

function resultadoHtml(r) {
  if (r.kind === 'semRendimento' || r.kind === 'semIngredientes') {
    return html`<p class="muted" style="margin-top:12px">Complete os ingredientes e o rendimento para calcular o lucro.</p>`;
  }
  if (r.kind === 'semPreco') {
    return html`<p class="muted" style="margin-top:12px">Escolha uma sugestão ou digite seu preço.</p>`;
  }
  const lucro = r.kind === 'lucro';
  return html`
    <div class="result-box ${lucro ? 'profit' : 'loss'}">
      <p class="big ${lucro ? 'text-profit' : 'text-loss'}">
        ${lucro ? `Você lucra ${formatBRL(r.lucroPorPorcao)} por unidade` : `Você perde ${formatBRL(Math.abs(r.lucroPorPorcao))} por unidade`}
      </p>
      <p class="muted">${lucro ? `${formatBRL(r.lucroTotal)} na receita toda` : `${formatBRL(Math.abs(r.lucroTotal))} de prejuízo na receita toda`}</p>
      ${r.vezesOCusto != null ? html`<p class="muted">${r.vezesOCusto >= 1 ? `Isso é ${formatNumber(r.vezesOCusto, 1)}× o custo` : `Isso é menos do que o custo (${formatNumber(r.vezesOCusto, 1)}×)`}</p>` : ''}
    </div>`;
}

function detalhesHtml(r) {
  const linhas = [];
  if (r.margem != null) linhas.push(html`<p class="muted">Margem sobre a venda: <strong class="${r.margem >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.margem, 1)}%</strong> — de cada real que você cobra, ${formatNumber(r.margem, 1)}% é lucro</p>`);
  if (r.markup != null) linhas.push(html`<p class="muted">Markup sobre o custo: <strong class="${r.markup >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.markup, 1)}%</strong> — quanto o preço de venda passou do custo</p>`);
  if (r.embalagensPorPorcao != null) linhas.push(html`<p class="muted">Embalagem: ${formatBRL(r.embalagensPorPorcao)} por unidade (${formatBRL(r.embalagensCost)} no total)</p>`);
  if (r.gasPorPorcao != null) linhas.push(html`<p class="muted">Gás: ${formatBRL(r.gasPorPorcao)} por unidade (${formatBRL(r.gasCost)} no total)</p>`);
  return linhas.length ? html`${linhas}` : html`<p class="muted">Defina o preço para ver margem e markup.</p>`;
}

export function render(panel, { store }) {
  const events = new AbortController();
  const preco = store.recipe.precoVendaDesejado;

  setHtml(panel, html`
    <div class="card">
      <p class="muted">Custo por unidade</p>
      <p class="big-number text-cost" data-custo-un></p>
      <p class="muted" data-custo-total></p>
    </div>
    <div class="card">
      <label class="field-label" for="preco-venda">Quanto você vai cobrar? (por unidade)</label>
      <div class="chips" role="group" aria-label="Sugestões de preço" style="margin:8px 0 12px">
        ${MULTIPLICADORES.map(([key]) => html`<button type="button" class="chip" data-sugestao="${key}"></button>`)}
      </div>
      <input id="preco-venda" class="input" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off"
             value="${preco != null ? formatCurrencyInput(preco) : ''}">
      <div data-resultado></div>
      <details class="details"><summary>Ver detalhes do cálculo</summary><div class="stack" data-detalhes></div></details>
    </div>`);

  const input = panel.querySelector('#preco-venda');
  const chips = [...panel.querySelectorAll('[data-sugestao]')];

  bindCurrencyInput(input, (value) => store.update((r) => { r.precoVendaDesejado = value; }), { allowEmpty: true, signal: events.signal });

  panel.addEventListener('click', (e) => {
    const chipButton = e.target.closest('[data-sugestao]');
    if (!chipButton || chipButton.disabled) return;
    const { sugeridos } = recipeResult(store.recipe);
    const value = round2(sugeridos[chipButton.dataset.sugestao]);
    input.value = formatCurrencyInput(value);
    store.update((r) => { r.precoVendaDesejado = value; });
  }, { signal: events.signal });

  function refresh() {
    const r = recipeResult(store.recipe);
    const temCusto = r.kind !== 'semRendimento' && r.kind !== 'semIngredientes';
    panel.querySelector('[data-custo-un]').textContent = temCusto ? formatBRL(r.custoPorPorcao) : '—';
    panel.querySelector('[data-custo-total]').textContent = `Custo total da receita: ${formatBRL(r.custoTotal)}`;
    for (const chipButton of chips) {
      const mult = MULTIPLICADORES.find(([key]) => key === chipButton.dataset.sugestao)[1];
      const valor = temCusto && r.sugeridos ? round2(r.sugeridos[chipButton.dataset.sugestao]) : null;
      chipButton.textContent = valor != null ? `${mult}× ${formatBRL(valor)}` : `${mult}×`;
      chipButton.disabled = valor == null;
      chipButton.setAttribute('aria-pressed', String(valor != null && store.recipe.precoVendaDesejado === valor));
    }
    setHtml(panel.querySelector('[data-resultado]'), resultadoHtml(r));
    setHtml(panel.querySelector('[data-detalhes]'), detalhesHtml(r));
  }
  const unsubscribe = store.subscribe(refresh);
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
```

- [ ] **Step 4: Rodar**

Run: `npm test && npm run test:mobile`
Expected: tudo PASS. Confira `05-custos-preco-preco-*.png`.

- [ ] **Step 5: Commit**

```bash
git add js/screens/editor/custos.js js/screens/editor/preco.js scripts/smoke/05-custos-preco.mjs
git commit -m "Custos and Preço tabs: live totals, per-unit 2x/3x/4x suggestions, profit and details

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Aba Nutrição

**Files:**
- Rewrite: `js/screens/editor/nutricao.js`
- Test: `scripts/smoke/06-nutricao.mjs`

**Interfaces:**
- Consumes: `nutritionPerPortion`, `nutritionTableHtml`, `html`, `setHtml`
- Produces: `render(panel, { store }) → { destroy() }`

- [ ] **Step 1: Escrever o cenário (vai falhar)**

`scripts/smoke/06-nutricao.mjs`:

```js
// Nutrição: table computed on open (no button), invalid yield message,
// table fits 390px (its own horizontal scroll only).

const ovos = { ingredientId: 'fixed:ovos', nome: 'Ovos', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade',
  nutricao100g: { kcal: 155, carboidratos: 1.1, proteinas: 13, gorduras: 11, fibras: 0, sodio: 124 }, densidadeGml: null, pesoUnidadeG: 50 };

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:o', nome: 'Omelete', rendimento: 2, embalagemUnitaria: 0, quantidadeEmbalagens: 2, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [ovos] }]);
  await page.goto(baseUrl + '#/receita/recipe%3Ao/nutricao');
  await page.getByText('Informação Nutricional').waitFor();
  await page.getByText('Porção: 50 g').waitFor();
  await page.getByText('não substitui laudo laboratorial', { exact: false }).waitFor();
  await semRolagemHorizontal();
  await shot('tabela');

  await page.getByRole('tab', { name: 'Ingredientes' }).click();
  await page.locator('#rendimento').fill('0');
  await page.getByRole('tab', { name: 'Nutrição' }).click();
  await page.getByText('Defina um rendimento válido para calcular a tabela nutricional.').waitFor();
  assert.equal(await page.getByText('Informação Nutricional').count(), 0);
}
```

Run: `npm run test:mobile -- 06` → Expected: FAIL.

- [ ] **Step 2: Reescrever `js/screens/editor/nutricao.js`**

```js
// js/screens/editor/nutricao.js — ANVISA-style table, computed on open.

import { nutritionPerPortion, nutritionTableHtml } from '../../nutrition-table.js';
import { html, setHtml } from '../../ui/dom.js';

export function render(panel, { store }) {
  const resultado = nutritionPerPortion(store.recipe);
  setHtml(panel, resultado
    ? nutritionTableHtml(resultado, store.recipe.rendimento)
    : html`<div class="card"><p class="text-loss">Defina um rendimento válido para calcular a tabela nutricional.</p></div>`);
  return { destroy() {} };
}
```

- [ ] **Step 3: Rodar**

Run: `npm test && npm run test:mobile`
Expected: tudo PASS.

- [ ] **Step 4: Commit**

```bash
git add js/screens/editor/nutricao.js scripts/smoke/06-nutricao.mjs
git commit -m "Nutrição tab: ANVISA-style table computed on open

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Verificação final, documentação e entrega

**Files:**
- Modify: `CLAUDE.md`
- Verify: árvore inteira

- [ ] **Step 1: Procurar sobras do app antigo**

Run: `git grep -n -i -e "window.__" -e "tailwind" -e "preserveFocus" -e "\[var(--color" -- js index.html css`
Expected: nenhuma ocorrência.

Run: `git grep -n -e "confirm(" -e "alert(" -- js`
Expected: nenhuma ocorrência (tudo passou para `confirmSheet`/`showToast`).

- [ ] **Step 2: Rodar tudo**

Run: `npm test && node scripts/check-contrast.mjs && npm run test:mobile`
Expected: todos os testes unitários PASS, contraste `ok`, 6 cenários × 2 temas `ok`.

- [ ] **Step 3: Conferir as capturas**

Abra cada arquivo em `scripts/.screenshots/` (claro e escuro) e confira:
- nada cortado nem sobreposto;
- a barra de resultado não cobre o último elemento da página;
- o foco visível aparece nos botões;
- no escuro, os cards não têm contorno;
- o botão do WhatsApp é verde com ícone escuro.

Anote e corrija qualquer problema antes de seguir.

- [ ] **Step 4: Conferir a migração de uma receita salva pela versão antiga**

Rode:

```bash
node --input-type=module -e "
import { migrateRecipe } from './js/storage.js';
const antiga = { id: 'recipe:x', nome: 'Antiga', rendimento: 12, ingredientes: [{ nome: 'Farinha', quantidadeBruta: '1', unidade: 'xicara', precoEmbalagem: 5, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g', densidadeGml: 0.5 }, { nome: '' }], embalagemUnitaria: 0.3, tempoPreparoMinutos: 10, valorBotijao: 110, precoVendaDesejado: 2 };
console.log(JSON.stringify(migrateRecipe(antiga)));"
```

Expected: `quantidadeEmbalagens: 12` e só o ingrediente "Farinha".

- [ ] **Step 5: Atualizar `CLAUDE.md`**

Substitua as seções "Stack e restrições arquiteturais" (item do Tailwind), "Estrutura de arquivos", "Testes e verificação" e "Próximo passo planejado" pelo texto abaixo, e acrescente o item "Reforma mobile-first (A+B)" ao fim de "Funcionalidades adicionadas depois":

Item de stack (substitui o do Tailwind):

```markdown
- **CSS próprio, sem Tailwind** (removido na reforma mobile-first: o Play
  CDN gerava CSS em runtime, lento em Android de entrada). Componentes em
  `css/styles.css` (card, chip, sheet, tabs, result-bar, toast, menu…),
  cores só via tokens `--color-*`. Contraste dos pares novos verificado
  por `node scripts/check-contrast.mjs`.
```

Estrutura de arquivos:

```markdown
index.html                 — shell mínimo (#view, #overlay-root, #toast-root)
css/styles.css             — tokens (claro/escuro) + componentes
js/app.js                  — bootstrap: tema, router, troca de tela
js/router.js               — rotas por hash + History API (voltar do celular)
js/store.js                — receita aberta, autosave (400ms), status de salvamento
js/session.js              — receitas novas desta sessão (descarte da receita vazia)
js/calculations.js         — motor de cálculo puro
js/costing.js              — custo por ingrediente, gramas usados, problemas da linha
js/results.js              — números derivados de uma receita (custo, lucro, sugestões, estado)
js/format.js               — moeda/números pt-BR, máscara de moeda, rótulos de unidade
js/share.js                — texto do WhatsApp (só a receita, sem custos)
js/ingredient-match.js     — reconhecer ingrediente, ingrediente customizado
js/nutrition-table.js      — nutrição por porção e tabela ANVISA
js/storage.js              — CRUD em localStorage + migrateRecipe
js/taco-loader.js, js/taco-database.js, js/ingredients-db.js, js/text-utils.js
js/theme.js                — tema automático/claro/escuro
js/ui/                     — dom (html`` com escape), sheet, toast, menu, confirm, icons
js/screens/                — lista, ajustes, editor, result-bar, editor/{ingredientes, ingrediente-sheet, custos, preco, nutricao}
js/*.test.js               — testes unitários (node --test)
scripts/smoke-mobile.mjs   — smoke test Playwright 390×844 (cenários em scripts/smoke/)
scripts/check-contrast.mjs — verificação WCAG dos pares de cor novos
```

Funcionalidade:

```markdown
- **Reforma mobile-first (A+B)** — spec em
  `docs/superpowers/specs/2026-09-24-mobile-first-design.md`. Lista em
  cartões com menu ⋯, busca e "Desfazer"; editor em abas (Ingredientes ·
  Custos · Preço · Nutrição) com barra de resultado fixa; ingrediente
  editado num painel que sobe de baixo (substitui a tabela de colunas e o
  modal de ingrediente customizado); **modo travado Salvar/Editar
  removido** (autosave + "✓ Salvo"); preço sugerido corrigido para **por
  unidade** (antes multiplicava o custo total); WhatsApp envia **só a
  receita**, sem custos; voltar do celular navega dentro do app.
```

Testes e verificação:

```markdown
- `npm test` — testes unitários de todos os módulos puros.
- `npm run test:mobile` — Playwright em 390×844, temas claro e escuro,
  capturas em `scripts/.screenshots/` (ignorado pelo git). Sem Chromium
  baixado: `CHROMIUM_PATH=/caminho/chrome npm run test:mobile`.
```

Próximo passo planejado:

```markdown
## Próximos passos planejados

- **C** — mão de obra, custos fixos e taxas (maquininha/iFood) no preço.
- **D** — cardápio compartilhável, orçamento para cliente, link que importa
  receita, receitas modelo, PWA instalável/offline.
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "Update CLAUDE.md for the mobile-first redesign

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Entregar**

Use o skill `superpowers:finishing-a-development-branch`. O merge em `master` publica no GitHub Pages; só faça após a aprovação do usuário.
