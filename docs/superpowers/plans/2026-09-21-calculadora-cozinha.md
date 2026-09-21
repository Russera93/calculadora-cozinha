# Calculadora de Precificação e Nutrição — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-file, offline-capable web app that lets a small-scale baker/cook cost out a recipe (ingredients + gas + packaging), get a suggested sale price, and generate a per-portion nutrition table, with recipes and custom ingredients persisted in the browser.

**Architecture:** Vanilla JS, no build step, no framework. A DOM-free calculation engine (`js/calculations.js`) is developed and tested first via Node's built-in test runner, then consumed by a thin UI layer (`js/app.js`) that renders two screens (recipe list, recipe editor) and a modal (custom ingredient) directly against `index.html`. Ingredient data comes from three merged sources: a small fixed database, an embedded TACO (Brazilian food composition table) dataset, and user-entered custom ingredients — all persisted via `js/storage.js` (localStorage).

**Tech Stack:** HTML5, Tailwind CSS (CDN), Google Fonts (Poppins/Nunito), Vanilla JS as native ES modules (`type="module"`), Node.js built-in test runner (`node --test`), no npm dependencies.

**Spec:** [docs/superpowers/specs/2026-09-21-calculadora-cozinha-design.md](../specs/2026-09-21-calculadora-cozinha-design.md) (technical design) and [ESPECIFICACAO.md](../../../ESPECIFICACAO.md) (original product spec) — executors should read both; this plan implements the design doc, which itself extends the product spec in 3 points (localStorage, custom ingredients, multi-file structure).

## Global Constraints

- No build step, no bundler, no npm runtime dependencies — the app must open directly via `index.html` in a browser (or a static file server) with zero install.
- All JS files are native ES modules (`<script type="module">` in the browser; `"type": "module"` in `package.json` for Node).
- Tailwind CSS via CDN script tag (`https://cdn.tailwindcss.com`), Google Fonts via `<link>` — no local font/CSS framework files.
- Volume base units: 1 xícara = 240ml, 1 colher de sopa = 15ml, 1 colher de chá = 5ml (exact values from the spec).
- Gas cost formula: `custoPorMinuto = valorBotijao13kg / 3000`; `custoGas = custoPorMinuto * tempoPreparoMinutos` (13kg cylinder ≈ 3000 minutes of use).
- All calculation functions are pure (no DOM access, no side effects) and return `null` (never `NaN`/`Infinity`) on invalid input.
- Reference cost example that must hold exactly: 1000g flour bought for R$5.00, 2 cups used (240g) → cost = R$1.20.

---

## File Structure

```
calculadora-cozinha/
├── package.json                 # "type": "module", "scripts.test": "node --test js/"
├── index.html                   # App shell: both screens + modal markup, hidden/shown via JS
├── css/
│   └── styles.css               # Palette variables, font-family, small Tailwind overrides
├── js/
│   ├── calculations.js          # Pure calculation engine
│   ├── calculations.test.js     # node --test suite for calculations.js
│   ├── ingredients-db.js        # Fixed 11-item ingredient database + lookup
│   ├── ingredients-db.test.js   # node --test suite for ingredients-db.js
│   ├── taco-database.js         # TACO dataset loader + fuzzy search + category density
│   ├── taco-database.test.js    # node --test suite for taco-database.js
│   ├── storage.js               # localStorage CRUD for recipes + custom ingredients
│   └── app.js                   # UI orchestration: screens, events, wiring to the above
├── data/
│   └── taco.json                # Normalized TACO dataset (built during Task 9)
└── scripts/
    └── build-taco.js            # One-off Node script that produces data/taco.json from a raw source
```

**Responsibility boundaries:**
- `calculations.js` never touches `localStorage` or the DOM — it only takes plain data in and returns plain data out.
- `storage.js` never does unit conversion or pricing math — it only serializes/deserializes plain objects to/from `localStorage`.
- `app.js` is the only file that touches the DOM; it composes the other three.

---

## Data Shapes (shared contracts — read before starting any task)

**Ingredient record** (shape shared by fixed DB, TACO DB, and custom ingredients, after normalization):
```js
{
  id: string,               // stable id: fixed items use "fixed:<slug>", custom use "custom:<uuid>", TACO matches are copied inline into the recipe, not referenced live
  nome: string,
  categoria: string,        // one of: "po", "liquido", "graos", "laticinio", "gordura", "fruta_vegetal", "outro" — used for density lookup
  densidadeGml: number | null,   // g/ml, null if not applicable (e.g. "unidade"-only ingredients)
  pesoUnidadeG: number | null,   // grams per "unidade" (e.g. 1 egg ≈ 50g), null if not applicable
  nutricao100g: {
    kcal: number | null,
    carboidratos: number | null,
    proteinas: number | null,
    gorduras: number | null,
    fibras: number | null,
    sodio: number | null
  } | null   // null means "no nutrition data at all" (only possible for custom ingredients with no TACO match and nothing filled manually)
}
```

**Recipe ingredient line** (one row in the editor's dynamic table):
```js
{
  ingredientId: string,     // references an Ingredient record's id
  nome: string,             // denormalized copy, so old lines still display correctly if an ingredient is later edited/removed
  quantidadeBruta: string,  // raw user input, e.g. "1/2", "0,5" — kept as typed
  unidade: string,          // one of: "xicara", "colherSopa", "colherCha", "g", "ml", "unidade"
  precoEmbalagem: number,
  tamanhoEmbalagem: number,
  unidadeEmbalagem: "g" | "ml",
  nutricao100g: object | null,   // snapshot copied from the ingredient at the time it was added (see note in Task 14)
  densidadeGml: number | null,
  pesoUnidadeG: number | null
}
```

**Recipe record:**
```js
{
  id: string,                 // "recipe:<uuid>"
  nome: string,
  rendimento: number,
  ingredientes: RecipeIngredientLine[],
  embalagemUnitaria: number,       // R$ cost per unit package
  tempoPreparoMinutos: number,
  valorBotijao: number,             // R$ price of a 13kg gas cylinder
  precoVendaDesejado: number | null,
  criadoEm: string,                // ISO timestamp
  atualizadoEm: string             // ISO timestamp
}
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `css/styles.css`
- Create: `js/app.js` (empty entry point for now)

**Interfaces:**
- Produces: an openable `index.html` that loads Tailwind, fonts, `css/styles.css`, and `js/app.js` as a module. No functional UI yet.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "calculadora-cozinha",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test js/"
  }
}
```

- [ ] **Step 2: Create `css/styles.css`**

```css
:root {
  --color-primary: #B5654A;      /* rosa queimado / terracota */
  --color-bg: #FBF3EC;           /* creme/bege */
  --color-accent: #7BAE7F;       /* verde suave */
  --color-danger: #D98C7A;       /* vermelho suave, para custos */
}

body {
  font-family: 'Nunito', sans-serif;
  background-color: var(--color-bg);
}

.screen {
  display: none;
}

.screen.active {
  display: block;
}
```

- [ ] **Step 3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calculadora de Cozinha</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
</head>
<body class="min-h-screen text-stone-800">
  <main id="app" class="max-w-3xl mx-auto p-4">
    <section id="screen-lista" class="screen active">
      <h1 class="text-2xl font-extrabold text-[var(--color-primary)] mb-4">Minhas Receitas</h1>
      <div id="lista-receitas" class="grid gap-3"></div>
      <button id="btn-nova-receita" class="mt-4 w-full bg-[var(--color-primary)] text-white font-bold py-3 rounded-2xl shadow-sm">
        + Nova Receita
      </button>
    </section>

    <section id="screen-editor" class="screen">
      <button id="btn-voltar" class="text-[var(--color-primary)] font-semibold mb-4">&larr; Minhas Receitas</button>
      <div id="editor-conteudo"></div>
    </section>

    <div id="modal-ingrediente" class="fixed inset-0 bg-black/40 hidden items-center justify-center">
      <div id="modal-ingrediente-conteudo" class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4"></div>
    </div>
  </main>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create empty `js/app.js`**

```js
// Entry point — wired up in later tasks.
console.log('Calculadora de Cozinha carregada.');
```

- [ ] **Step 5: Verify it opens**

Run: open `index.html` directly in a browser (double-click or `start index.html` on Windows).
Expected: page shows "Minhas Receitas" heading, a "+ Nova Receita" button, cream background, no console errors.

- [ ] **Step 6: Commit**

```bash
git add package.json index.html css/styles.css js/app.js
git commit -m "chore: scaffold project shell (html/css/js entry point)"
```

---

### Task 2: `calculations.js` — quantity parser

**Files:**
- Create: `js/calculations.js`
- Create: `js/calculations.test.js`

**Interfaces:**
- Produces: `parseQuantity(input: string): number | null`

- [ ] **Step 1: Write the failing tests**

```js
// js/calculations.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuantity } from './calculations.js';

test('parseQuantity: integer', () => {
  assert.equal(parseQuantity('2'), 2);
});

test('parseQuantity: decimal with dot', () => {
  assert.equal(parseQuantity('0.5'), 0.5);
});

test('parseQuantity: decimal with comma', () => {
  assert.equal(parseQuantity('0,5'), 0.5);
});

test('parseQuantity: simple fraction', () => {
  assert.equal(parseQuantity('1/2'), 0.5);
  assert.equal(parseQuantity('1/4'), 0.25);
  assert.equal(parseQuantity('3/4'), 0.75);
});

test('parseQuantity: mixed number', () => {
  assert.equal(parseQuantity('1 1/2'), 1.5);
});

test('parseQuantity: invalid input returns null', () => {
  assert.equal(parseQuantity('abc'), null);
  assert.equal(parseQuantity(''), null);
  assert.equal(parseQuantity('1/0'), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/calculations.test.js`
Expected: FAIL — `calculations.js` does not exist yet / does not export `parseQuantity`.

- [ ] **Step 3: Implement `parseQuantity` in `js/calculations.js`**

```js
// js/calculations.js

export function parseQuantity(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim().replace(',', '.');
  if (trimmed === '') return null;

  // Mixed number: "1 1/2"
  const mixedMatch = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den === 0) return null;
    return whole + num / den;
  }

  // Simple fraction: "1/2"
  const fractionMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (den === 0) return null;
    return num / den;
  }

  // Plain number (integer or decimal)
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/calculations.test.js`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add js/calculations.js js/calculations.test.js
git commit -m "feat: add quantity parser (fractions, mixed numbers, comma decimals)"
```

---

### Task 3: `calculations.js` — unit conversion to grams

**Files:**
- Modify: `js/calculations.js`
- Modify: `js/calculations.test.js`

**Interfaces:**
- Consumes: nothing new from other files.
- Produces: `VOLUME_ML = { xicara: 240, colherSopa: 15, colherCha: 5 }` (exported constant) and `toGrams({ quantidade, unidade, densidadeGml, pesoUnidadeG }): number | null`.

- [ ] **Step 1: Write the failing tests**

```js
// append to js/calculations.test.js
import { toGrams, VOLUME_ML } from './calculations.js';

test('VOLUME_ML has the spec-defined base units', () => {
  assert.equal(VOLUME_ML.xicara, 240);
  assert.equal(VOLUME_ML.colherSopa, 15);
  assert.equal(VOLUME_ML.colherCha, 5);
});

test('toGrams: direct grams passthrough', () => {
  assert.equal(toGrams({ quantidade: 240, unidade: 'g', densidadeGml: null, pesoUnidadeG: null }), 240);
});

test('toGrams: ml converted via density', () => {
  // densidade 1 g/ml: 100ml -> 100g
  assert.equal(toGrams({ quantidade: 100, unidade: 'ml', densidadeGml: 1, pesoUnidadeG: null }), 100);
});

test('toGrams: xicara converted via density (flour example)', () => {
  // flour density 0.5 g/ml -> 1 xicara (240ml) = 120g
  assert.equal(toGrams({ quantidade: 1, unidade: 'xicara', densidadeGml: 0.5, pesoUnidadeG: null }), 120);
});

test('toGrams: colherSopa and colherCha use the same density path', () => {
  assert.equal(toGrams({ quantidade: 1, unidade: 'colherSopa', densidadeGml: 1, pesoUnidadeG: null }), 15);
  assert.equal(toGrams({ quantidade: 1, unidade: 'colherCha', densidadeGml: 1, pesoUnidadeG: null }), 5);
});

test('toGrams: unidade (count) uses pesoUnidadeG', () => {
  // 2 eggs at 50g each -> 100g
  assert.equal(toGrams({ quantidade: 2, unidade: 'unidade', densidadeGml: null, pesoUnidadeG: 50 }), 100);
});

test('toGrams: missing density/weight needed for the given unit returns null', () => {
  assert.equal(toGrams({ quantidade: 1, unidade: 'xicara', densidadeGml: null, pesoUnidadeG: null }), null);
  assert.equal(toGrams({ quantidade: 1, unidade: 'unidade', densidadeGml: null, pesoUnidadeG: null }), null);
});

test('toGrams: unknown unit returns null', () => {
  assert.equal(toGrams({ quantidade: 1, unidade: 'litro', densidadeGml: 1, pesoUnidadeG: null }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/calculations.test.js`
Expected: FAIL — `toGrams` and `VOLUME_ML` not exported yet.

- [ ] **Step 3: Implement in `js/calculations.js`**

```js
// append to js/calculations.js

export const VOLUME_ML = {
  xicara: 240,
  colherSopa: 15,
  colherCha: 5
};

export function toGrams({ quantidade, unidade, densidadeGml, pesoUnidadeG }) {
  if (typeof quantidade !== 'number' || Number.isNaN(quantidade)) return null;

  if (unidade === 'g') {
    return quantidade;
  }

  if (unidade === 'ml') {
    if (densidadeGml == null) return null;
    return quantidade * densidadeGml;
  }

  if (unidade === 'xicara' || unidade === 'colherSopa' || unidade === 'colherCha') {
    if (densidadeGml == null) return null;
    return quantidade * VOLUME_ML[unidade] * densidadeGml;
  }

  if (unidade === 'unidade') {
    if (pesoUnidadeG == null) return null;
    return quantidade * pesoUnidadeG;
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/calculations.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/calculations.js js/calculations.test.js
git commit -m "feat: add unit-to-grams conversion (volume, weight, count)"
```

---

### Task 4: `calculations.js` — ingredient cost

**Files:**
- Modify: `js/calculations.js`
- Modify: `js/calculations.test.js`

**Interfaces:**
- Produces: `calculateIngredientCost({ gramasUsadas, gramasEmbalagem, precoEmbalagem }): number | null`

- [ ] **Step 1: Write the failing tests**

```js
// append to js/calculations.test.js
import { calculateIngredientCost } from './calculations.js';

test('calculateIngredientCost: spec reference example (flour)', () => {
  // 1000g bought for R$5.00, 240g used -> R$1.20
  const cost = calculateIngredientCost({ gramasUsadas: 240, gramasEmbalagem: 1000, precoEmbalagem: 5 });
  assert.equal(Math.round(cost * 100) / 100, 1.2);
});

test('calculateIngredientCost: zero or negative package size returns null', () => {
  assert.equal(calculateIngredientCost({ gramasUsadas: 100, gramasEmbalagem: 0, precoEmbalagem: 5 }), null);
  assert.equal(calculateIngredientCost({ gramasUsadas: 100, gramasEmbalagem: -10, precoEmbalagem: 5 }), null);
});

test('calculateIngredientCost: negative price returns null', () => {
  assert.equal(calculateIngredientCost({ gramasUsadas: 100, gramasEmbalagem: 1000, precoEmbalagem: -5 }), null);
});

test('calculateIngredientCost: missing gramasUsadas returns null', () => {
  assert.equal(calculateIngredientCost({ gramasUsadas: null, gramasEmbalagem: 1000, precoEmbalagem: 5 }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/calculations.test.js`
Expected: FAIL — `calculateIngredientCost` not exported yet.

- [ ] **Step 3: Implement in `js/calculations.js`**

```js
// append to js/calculations.js

export function calculateIngredientCost({ gramasUsadas, gramasEmbalagem, precoEmbalagem }) {
  if (typeof gramasUsadas !== 'number' || Number.isNaN(gramasUsadas)) return null;
  if (typeof gramasEmbalagem !== 'number' || gramasEmbalagem <= 0) return null;
  if (typeof precoEmbalagem !== 'number' || precoEmbalagem < 0) return null;

  return (gramasUsadas / gramasEmbalagem) * precoEmbalagem;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/calculations.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/calculations.js js/calculations.test.js
git commit -m "feat: add ingredient cost calculation"
```

---

### Task 5: `calculations.js` — gas cost

**Files:**
- Modify: `js/calculations.js`
- Modify: `js/calculations.test.js`

**Interfaces:**
- Produces: `calculateGasCost({ valorBotijao, tempoPreparoMinutos }): number | null`

- [ ] **Step 1: Write the failing tests**

```js
// append to js/calculations.test.js
import { calculateGasCost } from './calculations.js';

test('calculateGasCost: standard example', () => {
  // R$100 cylinder / 3000 min * 30 min preparo = R$1.00
  assert.equal(calculateGasCost({ valorBotijao: 100, tempoPreparoMinutos: 30 }), 1);
});

test('calculateGasCost: zero prep time is valid and costs zero', () => {
  assert.equal(calculateGasCost({ valorBotijao: 100, tempoPreparoMinutos: 0 }), 0);
});

test('calculateGasCost: negative values return null', () => {
  assert.equal(calculateGasCost({ valorBotijao: -100, tempoPreparoMinutos: 30 }), null);
  assert.equal(calculateGasCost({ valorBotijao: 100, tempoPreparoMinutos: -1 }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/calculations.test.js`
Expected: FAIL — `calculateGasCost` not exported yet.

- [ ] **Step 3: Implement in `js/calculations.js`**

```js
// append to js/calculations.js

const GAS_CYLINDER_MINUTES = 3000;

export function calculateGasCost({ valorBotijao, tempoPreparoMinutos }) {
  if (typeof valorBotijao !== 'number' || valorBotijao < 0) return null;
  if (typeof tempoPreparoMinutos !== 'number' || tempoPreparoMinutos < 0) return null;

  const custoPorMinuto = valorBotijao / GAS_CYLINDER_MINUTES;
  return custoPorMinuto * tempoPreparoMinutos;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/calculations.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/calculations.js js/calculations.test.js
git commit -m "feat: add gas cost calculation"
```

---

### Task 6: `calculations.js` — pricing and margin

**Files:**
- Modify: `js/calculations.js`
- Modify: `js/calculations.test.js`

**Interfaces:**
- Produces:
  - `calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost }): number`
  - `calculateCostPerPortion({ custoTotal, rendimento }): number | null`
  - `calculateSuggestedPrices({ custoTotal }): { preco2x: number, preco3x: number }`
  - `calculateRealMargin({ precoVenda, custoPorPorcao }): number | null` (percentage)

- [ ] **Step 1: Write the failing tests**

```js
// append to js/calculations.test.js
import {
  calculateRecipeCost,
  calculateCostPerPortion,
  calculateSuggestedPrices,
  calculateRealMargin
} from './calculations.js';

test('calculateRecipeCost: sums the three cost components', () => {
  assert.equal(calculateRecipeCost({ ingredientesCost: 10, gasCost: 2, embalagensCost: 3 }), 15);
});

test('calculateCostPerPortion: divides total by yield', () => {
  assert.equal(calculateCostPerPortion({ custoTotal: 20, rendimento: 4 }), 5);
});

test('calculateCostPerPortion: zero or missing yield returns null', () => {
  assert.equal(calculateCostPerPortion({ custoTotal: 20, rendimento: 0 }), null);
  assert.equal(calculateCostPerPortion({ custoTotal: 20, rendimento: null }), null);
});

test('calculateSuggestedPrices: returns 2x and 3x total cost', () => {
  assert.deepEqual(calculateSuggestedPrices({ custoTotal: 10 }), { preco2x: 20, preco3x: 30 });
});

test('calculateRealMargin: percentage above cost per portion', () => {
  // sell at 10, cost per portion 4 -> margin = (10-4)/10 * 100 = 60%
  assert.equal(calculateRealMargin({ precoVenda: 10, custoPorPorcao: 4 }), 60);
});

test('calculateRealMargin: zero or missing sell price returns null', () => {
  assert.equal(calculateRealMargin({ precoVenda: 0, custoPorPorcao: 4 }), null);
  assert.equal(calculateRealMargin({ precoVenda: null, custoPorPorcao: 4 }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/calculations.test.js`
Expected: FAIL — new functions not exported yet.

- [ ] **Step 3: Implement in `js/calculations.js`**

```js
// append to js/calculations.js

export function calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost }) {
  return (ingredientesCost || 0) + (gasCost || 0) + (embalagensCost || 0);
}

export function calculateCostPerPortion({ custoTotal, rendimento }) {
  if (typeof rendimento !== 'number' || rendimento <= 0) return null;
  return custoTotal / rendimento;
}

export function calculateSuggestedPrices({ custoTotal }) {
  return {
    preco2x: custoTotal * 2,
    preco3x: custoTotal * 3
  };
}

export function calculateRealMargin({ precoVenda, custoPorPorcao }) {
  if (typeof precoVenda !== 'number' || precoVenda <= 0) return null;
  if (typeof custoPorPorcao !== 'number') return null;
  return ((precoVenda - custoPorPorcao) / precoVenda) * 100;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/calculations.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/calculations.js js/calculations.test.js
git commit -m "feat: add recipe cost, cost per portion, suggested prices and margin"
```

---

### Task 7: `calculations.js` — nutrition aggregation

**Files:**
- Modify: `js/calculations.js`
- Modify: `js/calculations.test.js`

**Interfaces:**
- Consumes: `RecipeIngredientLine`-shaped items with `nutricao100g` (see Data Shapes section) and pre-computed `gramas` (from `toGrams`, Task 3).
- Produces: `calculateNutritionPerPortion({ itens, rendimento }): { kcal, carboidratos, proteinas, gorduras, fibras, sodio, ingredientesSemDados: number } | null`
  where `itens: Array<{ gramas: number, nutricao100g: object | null }>`.

- [ ] **Step 1: Write the failing tests**

```js
// append to js/calculations.test.js
import { calculateNutritionPerPortion } from './calculations.js';

test('calculateNutritionPerPortion: single ingredient, single portion', () => {
  const itens = [{
    gramas: 200,
    nutricao100g: { kcal: 100, carboidratos: 20, proteinas: 5, gorduras: 2, fibras: 1, sodio: 10 }
  }];
  const result = calculateNutritionPerPortion({ itens, rendimento: 1 });
  assert.equal(result.kcal, 200);
  assert.equal(result.carboidratos, 40);
  assert.equal(result.proteinas, 10);
  assert.equal(result.gorduras, 4);
  assert.equal(result.fibras, 2);
  assert.equal(result.sodio, 20);
  assert.equal(result.ingredientesSemDados, 0);
});

test('calculateNutritionPerPortion: divides by yield', () => {
  const itens = [{
    gramas: 100,
    nutricao100g: { kcal: 100, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0 }
  }];
  const result = calculateNutritionPerPortion({ itens, rendimento: 4 });
  assert.equal(result.kcal, 25);
});

test('calculateNutritionPerPortion: ignores ingredients with no nutrition data but counts them', () => {
  const itens = [
    { gramas: 100, nutricao100g: { kcal: 100, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0 } },
    { gramas: 50, nutricao100g: null }
  ];
  const result = calculateNutritionPerPortion({ itens, rendimento: 1 });
  assert.equal(result.kcal, 100);
  assert.equal(result.ingredientesSemDados, 1);
});

test('calculateNutritionPerPortion: zero yield returns null', () => {
  assert.equal(calculateNutritionPerPortion({ itens: [], rendimento: 0 }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/calculations.test.js`
Expected: FAIL — `calculateNutritionPerPortion` not exported yet.

- [ ] **Step 3: Implement in `js/calculations.js`**

```js
// append to js/calculations.js

const NUTRIENT_KEYS = ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio'];

export function calculateNutritionPerPortion({ itens, rendimento }) {
  if (typeof rendimento !== 'number' || rendimento <= 0) return null;

  const totals = { kcal: 0, carboidratos: 0, proteinas: 0, gorduras: 0, fibras: 0, sodio: 0 };
  let ingredientesSemDados = 0;

  for (const item of itens) {
    if (!item.nutricao100g) {
      ingredientesSemDados += 1;
      continue;
    }
    for (const key of NUTRIENT_KEYS) {
      const valorPor100g = item.nutricao100g[key];
      if (typeof valorPor100g === 'number') {
        totals[key] += (valorPor100g / 100) * item.gramas;
      }
    }
  }

  const perPortion = {};
  for (const key of NUTRIENT_KEYS) {
    perPortion[key] = totals[key] / rendimento;
  }
  perPortion.ingredientesSemDados = ingredientesSemDados;

  return perPortion;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/calculations.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/calculations.js js/calculations.test.js
git commit -m "feat: add per-portion nutrition aggregation"
```

---

### Task 8: `ingredients-db.js` — fixed ingredient database

**Files:**
- Create: `js/ingredients-db.js`
- Create: `js/ingredients-db.test.js`

**Interfaces:**
- Consumes: nothing (standalone data module).
- Produces: `FIXED_INGREDIENTS: Ingredient[]` and `findFixedIngredient(nome: string): Ingredient | null` (case/accent-insensitive exact-ish match).

Nutrition values below are standard public reference values (widely consistent across USDA/TACO-style food composition tables) for common, minimally-processed foods — treat as reasonable defaults, editable later if the user has more precise packaging data.

- [ ] **Step 1: Write the failing tests**

```js
// js/ingredients-db.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIXED_INGREDIENTS, findFixedIngredient } from './ingredients-db.js';

test('FIXED_INGREDIENTS has the 11 ingredients from the product spec', () => {
  assert.equal(FIXED_INGREDIENTS.length, 11);
});

test('every fixed ingredient has a complete nutrition profile', () => {
  for (const ing of FIXED_INGREDIENTS) {
    assert.ok(ing.nutricao100g, `${ing.nome} should have nutricao100g`);
    for (const key of ['kcal', 'carboidratos', 'proteinas', 'gorduras', 'fibras', 'sodio']) {
      assert.equal(typeof ing.nutricao100g[key], 'number', `${ing.nome}.${key}`);
    }
  }
});

test('findFixedIngredient: exact match', () => {
  const flour = findFixedIngredient('Farinha de trigo');
  assert.ok(flour);
  assert.equal(flour.id, 'fixed:farinha-de-trigo');
});

test('findFixedIngredient: case and accent insensitive', () => {
  const flour = findFixedIngredient('farinha de trigo');
  assert.ok(flour);
  assert.equal(flour.id, 'fixed:farinha-de-trigo');
});

test('findFixedIngredient: no match returns null', () => {
  assert.equal(findFixedIngredient('Ingrediente Inexistente'), null);
});

test('egg has pesoUnidadeG for "unidade" conversion', () => {
  const egg = findFixedIngredient('Ovos');
  assert.equal(egg.pesoUnidadeG, 50);
});

test('flour has densidadeGml for volume conversion', () => {
  const flour = findFixedIngredient('Farinha de trigo');
  assert.equal(flour.densidadeGml, 0.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/ingredients-db.test.js`
Expected: FAIL — `js/ingredients-db.js` does not exist yet.

- [ ] **Step 3: Implement `js/ingredients-db.js`**

```js
// js/ingredients-db.js

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalize(text).replace(/\s+/g, '-');
}

function makeIngredient({ nome, categoria, densidadeGml = null, pesoUnidadeG = null, nutricao100g }) {
  return {
    id: `fixed:${slugify(nome)}`,
    nome,
    categoria,
    densidadeGml,
    pesoUnidadeG,
    nutricao100g
  };
}

export const FIXED_INGREDIENTS = [
  makeIngredient({
    nome: 'Farinha de trigo',
    categoria: 'po',
    densidadeGml: 0.5, // 1 xicara (240ml) = 120g
    nutricao100g: { kcal: 364, carboidratos: 76.3, proteinas: 10, gorduras: 1, fibras: 2.3, sodio: 2 }
  }),
  makeIngredient({
    nome: 'Açúcar',
    categoria: 'po',
    densidadeGml: 0.83, // 1 xicara (240ml) = ~200g
    nutricao100g: { kcal: 387, carboidratos: 99.8, proteinas: 0, gorduras: 0, fibras: 0, sodio: 1 }
  }),
  makeIngredient({
    nome: 'Óleo',
    categoria: 'liquido',
    densidadeGml: 0.92,
    nutricao100g: { kcal: 884, carboidratos: 0, proteinas: 0, gorduras: 100, fibras: 0, sodio: 0 }
  }),
  makeIngredient({
    nome: 'Ovos',
    categoria: 'outro',
    pesoUnidadeG: 50,
    nutricao100g: { kcal: 155, carboidratos: 1.1, proteinas: 13, gorduras: 11, fibras: 0, sodio: 124 }
  }),
  makeIngredient({
    nome: 'Banana',
    categoria: 'fruta_vegetal',
    pesoUnidadeG: 100,
    nutricao100g: { kcal: 89, carboidratos: 22.8, proteinas: 1.1, gorduras: 0.3, fibras: 2.6, sodio: 1 }
  }),
  makeIngredient({
    nome: 'Aveia',
    categoria: 'graos',
    densidadeGml: 0.33, // 1 xicara (240ml) = ~80g
    nutricao100g: { kcal: 389, carboidratos: 66.3, proteinas: 16.9, gorduras: 6.9, fibras: 10.6, sodio: 2 }
  }),
  makeIngredient({
    nome: 'Fermento em pó',
    categoria: 'po',
    densidadeGml: 0.9,
    nutricao100g: { kcal: 53, carboidratos: 27.7, proteinas: 0.1, gorduras: 0, fibras: 0.2, sodio: 10600 }
  }),
  makeIngredient({
    nome: 'Leite Condensado',
    categoria: 'liquido',
    densidadeGml: 1.3,
    nutricao100g: { kcal: 321, carboidratos: 54.4, proteinas: 7.9, gorduras: 8.7, fibras: 0, sodio: 127 }
  }),
  makeIngredient({
    nome: 'Creme de Leite',
    categoria: 'liquido',
    densidadeGml: 1.0,
    nutricao100g: { kcal: 239, carboidratos: 3.5, proteinas: 2.4, gorduras: 25, fibras: 0, sodio: 44 }
  }),
  makeIngredient({
    nome: 'Chocolate em pó',
    categoria: 'po',
    densidadeGml: 0.5,
    nutricao100g: { kcal: 365, carboidratos: 80, proteinas: 5, gorduras: 3, fibras: 5, sodio: 100 }
  }),
  makeIngredient({
    nome: 'Manteiga',
    categoria: 'gordura',
    densidadeGml: 0.96,
    nutricao100g: { kcal: 717, carboidratos: 0.1, proteinas: 0.9, gorduras: 81, fibras: 0, sodio: 11 }
  })
];

export function findFixedIngredient(nome) {
  const target = normalize(nome);
  return FIXED_INGREDIENTS.find((ing) => normalize(ing.nome) === target) || null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/ingredients-db.test.js`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add js/ingredients-db.js js/ingredients-db.test.js
git commit -m "feat: add fixed ingredient database (11 items with nutrition and conversion data)"
```

---

### Task 9: TACO dataset + `taco-database.js`

This task has two parts: (a) acquiring a real, public TACO dataset as JSON, and (b) writing the loader/search module. **Do not fabricate nutrition rows** — the data must come from a real downloaded source.

**Files:**
- Create: `scripts/build-taco.js`
- Create: `data/taco.json`
- Create: `js/taco-database.js`
- Create: `js/taco-database.test.js`

**Interfaces:**
- Produces:
  - `data/taco.json`: array of `{ nome, categoria, nutricao100g }` (same nutrition shape as Task 8).
  - `loadTacoDatabase(jsonData: object[]): Ingredient[]` — normalizes raw `data/taco.json` rows into full `Ingredient` records (adds `id`, `densidadeGml` via category, `pesoUnidadeG: null`).
  - `findInTaco(nome: string, tacoIngredients: Ingredient[]): Ingredient | null` — fuzzy, accent/case-insensitive lookup.
  - `DENSITY_BY_CATEGORY: Record<string, number>` — g/ml fallback density per category.

- [ ] **Step 1: Acquire a real TACO dataset**

Use `WebSearch` to find a reputable, public JSON or CSV conversion of the TACO (Tabela Brasileira de Composição de Alimentos, Unicamp/NEPA) food composition table — for example, searching `"tabela taco" json github` or `"TACO 4a edição" csv dataset`. Prefer a source that includes at least: food name, food group/category, energy (kcal), carbohydrate (g), protein (g), lipids/fat (g), dietary fiber (g), and sodium (mg), per 100g edible portion.

Download the raw file with `WebFetch` (or via `curl`/`Invoke-WebRequest` if the source gives a direct file URL) and save it to `data/taco-raw.csv` or `data/taco-raw.json` (whichever format the source provides).

If no complete public dataset can be located, fall back to a curated subset of at least 60 common Brazilian cooking/baking ingredients (grains, flours, dairy, fruits, sugars, fats, eggs) with values taken from the source you did find, documenting in a comment at the top of `scripts/build-taco.js` which source and how many rows were used.

- [ ] **Step 2: Write `scripts/build-taco.js` to normalize the raw data**

The exact parsing logic depends on the raw source's column names, but the script's contract is fixed — it must read the raw file and write `data/taco.json` as an array of objects shaped exactly like:

```json
[
  {
    "nome": "Arroz, integral, cozido",
    "categoria": "graos",
    "nutricao100g": {
      "kcal": 124,
      "carboidratos": 25.8,
      "proteinas": 2.6,
      "gorduras": 1.0,
      "fibras": 2.7,
      "sodio": 1
    }
  }
]
```

Map the raw source's food group column to one of these categories (used later for density lookup): `po` (flours, starches, powders), `liquido` (milks, oils, liquid sweets), `graos` (rice, oats, grains, legumes), `laticinio` (dairy, cheese), `gordura` (butter, margarine, animal fat), `fruta_vegetal` (fruit and vegetables), `outro` (anything else, e.g. eggs, meat, fish). Skip rows missing a name or missing all nutrition fields. Run the script with `node scripts/build-taco.js` and confirm `data/taco.json` is created with a realistic row count (dozens to hundreds, not 0, not obviously truncated).

- [ ] **Step 3: Write the failing tests for `taco-database.js`**

```js
// js/taco-database.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTacoDatabase, findInTaco, DENSITY_BY_CATEGORY } from './taco-database.js';

const rawTaco = JSON.parse(readFileSync(new URL('../data/taco.json', import.meta.url)));

test('data/taco.json is non-empty', () => {
  assert.ok(rawTaco.length > 10, 'expected a real dataset, not an empty/placeholder file');
});

test('loadTacoDatabase: normalizes raw rows into full Ingredient records', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  assert.equal(ingredients.length, rawTaco.length);
  for (const ing of ingredients.slice(0, 5)) {
    assert.ok(ing.id.startsWith('taco:'));
    assert.ok(ing.nome);
    assert.ok(ing.categoria);
    assert.ok(ing.nutricao100g);
  }
});

test('loadTacoDatabase: assigns density from category', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  for (const ing of ingredients) {
    assert.equal(ing.densidadeGml, DENSITY_BY_CATEGORY[ing.categoria] ?? null);
  }
});

test('findInTaco: exact name match', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  const target = ingredients[0];
  const found = findInTaco(target.nome, ingredients);
  assert.equal(found.id, target.id);
});

test('findInTaco: case/accent-insensitive partial match', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  const target = ingredients[0];
  const query = target.nome.slice(0, 5).toUpperCase();
  const found = findInTaco(query, ingredients);
  assert.ok(found, 'expected a fuzzy match for a partial, differently-cased query');
});

test('findInTaco: no match returns null', () => {
  const ingredients = loadTacoDatabase(rawTaco);
  assert.equal(findInTaco('zzzzznaoexistequalquercoisa', ingredients), null);
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `node --test js/taco-database.test.js`
Expected: FAIL — `js/taco-database.js` does not exist yet.

- [ ] **Step 5: Implement `js/taco-database.js`**

```js
// js/taco-database.js

function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const DENSITY_BY_CATEGORY = {
  po: 0.55,
  liquido: 1.0,
  graos: 0.35,
  laticinio: 1.03,
  gordura: 0.95,
  fruta_vegetal: 0.6,
  outro: null
};

export function loadTacoDatabase(rawRows) {
  return rawRows.map((row) => ({
    id: `taco:${slugify(row.nome)}`,
    nome: row.nome,
    categoria: row.categoria,
    densidadeGml: DENSITY_BY_CATEGORY[row.categoria] ?? null,
    pesoUnidadeG: null,
    nutricao100g: row.nutricao100g
  }));
}

export function findInTaco(nomeBuscado, tacoIngredients) {
  const target = normalize(nomeBuscado);
  if (!target) return null;

  const exact = tacoIngredients.find((ing) => normalize(ing.nome) === target);
  if (exact) return exact;

  const partial = tacoIngredients.find((ing) => normalize(ing.nome).includes(target));
  if (partial) return partial;

  return null;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test js/taco-database.test.js`
Expected: PASS, all tests green. If the fuzzy-match test fails because the dataset's first row has an unusual name, that's fine — re-verify with a couple of different indices before concluding there's a real bug.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-taco.js data/taco.json js/taco-database.js js/taco-database.test.js
git commit -m "feat: add TACO nutrition dataset and fuzzy lookup module"
```

---

### Task 10: `storage.js` — recipes and custom ingredients (localStorage)

**Files:**
- Create: `js/storage.js`

**Interfaces:**
- Consumes: `Recipe` and `Ingredient` shapes (see Data Shapes section).
- Produces:
  - `getRecipes(): Recipe[]`
  - `getRecipe(id: string): Recipe | null`
  - `saveRecipe(recipe: Recipe): void` (upsert by `id`, sets `atualizadoEm`)
  - `duplicateRecipe(id: string): Recipe | null` (returns the new copy, already persisted)
  - `deleteRecipe(id: string): void`
  - `createEmptyRecipe(): Recipe`
  - `getCustomIngredients(): Ingredient[]`
  - `saveCustomIngredient(ingredient: Ingredient): void` (upsert by `id`)

No automated tests for this file (per the design doc, `storage.js` is verified manually in-browser — `localStorage` isn't available in plain Node without a DOM shim, and the logic is a thin CRUD layer with low bug risk). It will be exercised end-to-end in Task 12 onward.

- [ ] **Step 1: Implement `js/storage.js`**

```js
// js/storage.js

const RECIPES_KEY = 'calculadora-cozinha:recipes';
const CUSTOM_INGREDIENTS_KEY = 'calculadora-cozinha:custom-ingredients';

function uuid() {
  return crypto.randomUUID();
}

function readList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

export function getRecipes() {
  return readList(RECIPES_KEY);
}

export function getRecipe(id) {
  return getRecipes().find((r) => r.id === id) || null;
}

export function saveRecipe(recipe) {
  const recipes = getRecipes();
  const now = new Date().toISOString();
  const index = recipes.findIndex((r) => r.id === recipe.id);
  const updated = { ...recipe, atualizadoEm: now };

  if (index === -1) {
    recipes.push(updated);
  } else {
    recipes[index] = updated;
  }
  writeList(RECIPES_KEY, recipes);
}

export function duplicateRecipe(id) {
  const original = getRecipe(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const copy = {
    ...original,
    id: `recipe:${uuid()}`,
    nome: `${original.nome} (cópia)`,
    criadoEm: now,
    atualizadoEm: now
  };
  saveRecipe(copy);
  return copy;
}

export function deleteRecipe(id) {
  const recipes = getRecipes().filter((r) => r.id !== id);
  writeList(RECIPES_KEY, recipes);
}

export function createEmptyRecipe() {
  const now = new Date().toISOString();
  return {
    id: `recipe:${uuid()}`,
    nome: '',
    rendimento: 1,
    ingredientes: [],
    embalagemUnitaria: 0,
    tempoPreparoMinutos: 0,
    valorBotijao: 0,
    precoVendaDesejado: null,
    criadoEm: now,
    atualizadoEm: now
  };
}

export function getCustomIngredients() {
  return readList(CUSTOM_INGREDIENTS_KEY);
}

export function saveCustomIngredient(ingredient) {
  const ingredients = getCustomIngredients();
  const index = ingredients.findIndex((i) => i.id === ingredient.id);

  if (index === -1) {
    ingredients.push(ingredient);
  } else {
    ingredients[index] = ingredient;
  }
  writeList(CUSTOM_INGREDIENTS_KEY, ingredients);
}
```

- [ ] **Step 2: Manual smoke test in the browser**

Run: open `index.html`, open the browser DevTools console, and paste:
```js
const { createEmptyRecipe, saveRecipe, getRecipes, duplicateRecipe, deleteRecipe } = await import('./js/storage.js');
const r = createEmptyRecipe();
r.nome = 'Teste';
saveRecipe(r);
console.log(getRecipes()); // should show 1 recipe named "Teste"
const dup = duplicateRecipe(r.id);
console.log(getRecipes().length); // should be 2
deleteRecipe(dup.id);
console.log(getRecipes().length); // should be back to 1
deleteRecipe(r.id);
console.log(getRecipes().length); // should be 0
```
Expected: console logs match the comments, no errors thrown.

- [ ] **Step 3: Commit**

```bash
git add js/storage.js
git commit -m "feat: add localStorage-backed CRUD for recipes and custom ingredients"
```

---

### Task 11: Screen 1 — "Minhas Receitas" (recipe list)

**Files:**
- Modify: `index.html` (already has `#screen-lista`, `#lista-receitas`, `#btn-nova-receita` from Task 1)
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getRecipes`, `saveRecipe`, `duplicateRecipe`, `deleteRecipe`, `createEmptyRecipe` from `js/storage.js`; `calculateRecipeCost`, `calculateIngredientCost`, `calculateGasCost`, `toGrams` from `js/calculations.js` (for the cost preview on each card).
- Produces: `renderRecipeList()` (called on load and after any list-mutating action), `showScreen(screenId: 'screen-lista' | 'screen-editor')`.

- [ ] **Step 1: Implement screen switching and list rendering in `js/app.js`**

```js
// js/app.js
import {
  getRecipes,
  duplicateRecipe,
  deleteRecipe,
  createEmptyRecipe,
  saveRecipe
} from './storage.js';
import { toGrams, calculateIngredientCost, calculateGasCost, calculateRecipeCost } from './calculations.js';

function showScreen(screenId) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.toggle('active', el.id === screenId);
  }
}

function previewRecipeCost(recipe) {
  const ingredientesCost = recipe.ingredientes.reduce((sum, item) => {
    const gramas = toGrams({
      quantidade: parseQuantitySafe(item.quantidadeBruta),
      unidade: item.unidade,
      densidadeGml: item.densidadeGml,
      pesoUnidadeG: item.pesoUnidadeG
    });
    if (gramas == null) return sum;
    const cost = calculateIngredientCost({
      gramasUsadas: gramas,
      gramasEmbalagem: item.tamanhoEmbalagem,
      precoEmbalagem: item.precoEmbalagem
    });
    return sum + (cost ?? 0);
  }, 0);

  const gasCost = calculateGasCost({
    valorBotijao: recipe.valorBotijao,
    tempoPreparoMinutos: recipe.tempoPreparoMinutos
  }) ?? 0;

  const embalagensCost = (recipe.embalagemUnitaria || 0) * (recipe.rendimento || 0);

  return calculateRecipeCost({ ingredientesCost, gasCost, embalagensCost });
}

function parseQuantitySafe(raw) {
  // local re-import avoided by inlining: see calculations.js for the real parser
  return Number(String(raw).replace(',', '.')) || null;
}

function renderRecipeList() {
  const container = document.getElementById('lista-receitas');
  const recipes = getRecipes();
  container.innerHTML = '';

  if (recipes.length === 0) {
    container.innerHTML = '<p class="text-stone-500 text-center py-8">Nenhuma receita ainda. Crie a primeira!</p>';
    return;
  }

  for (const recipe of recipes) {
    const custoTotal = previewRecipeCost(recipe);
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl shadow-sm p-4 flex items-center justify-between';
    card.innerHTML = `
      <div>
        <h2 class="font-bold text-lg">${recipe.nome || '(sem nome)'}</h2>
        <p class="text-sm text-stone-500">Atualizado em ${new Date(recipe.atualizadoEm).toLocaleDateString('pt-BR')}</p>
        <p class="text-sm text-[var(--color-danger)] font-semibold">Custo total: R$ ${custoTotal.toFixed(2)}</p>
      </div>
      <div class="flex gap-2">
        <button data-action="abrir" class="text-[var(--color-primary)] font-semibold">Abrir</button>
        <button data-action="duplicar" class="text-stone-500">Duplicar</button>
        <button data-action="excluir" class="text-[var(--color-danger)]">Excluir</button>
      </div>
    `;
    card.querySelector('[data-action="abrir"]').addEventListener('click', () => openRecipeEditor(recipe.id));
    card.querySelector('[data-action="duplicar"]').addEventListener('click', () => {
      duplicateRecipe(recipe.id);
      renderRecipeList();
    });
    card.querySelector('[data-action="excluir"]').addEventListener('click', () => {
      if (confirm(`Excluir a receita "${recipe.nome}"?`)) {
        deleteRecipe(recipe.id);
        renderRecipeList();
      }
    });
    container.appendChild(card);
  }
}

function openRecipeEditor(recipeId) {
  // Implemented in Task 12 (renderRecipeEditor). Placeholder call kept for wiring.
  window.__openRecipeEditor(recipeId);
}

document.getElementById('btn-nova-receita').addEventListener('click', () => {
  const recipe = createEmptyRecipe();
  saveRecipe(recipe);
  openRecipeEditor(recipe.id);
});

document.getElementById('btn-voltar').addEventListener('click', () => {
  showScreen('screen-lista');
  renderRecipeList();
});

renderRecipeList();
showScreen('screen-lista');

export { showScreen, renderRecipeList };
```

Note: `openRecipeEditor` calls `window.__openRecipeEditor`, a hook that Task 12 will define. This keeps Task 11 shippable and testable on its own (list renders, new/duplicate/delete work) even before the editor exists — clicking "Abrir" will simply no-op with a console error until Task 12 lands, which is acceptable since Task 12 is next.

- [ ] **Step 2: Manual test**

Run: open `index.html` in the browser.
Expected:
- "Nenhuma receita ainda..." message shows initially.
- Clicking "+ Nova Receita" creates a recipe and switches screens (may error on `__openRecipeEditor` until Task 12 — check the console shows the expected "not a function" error, confirming the hook is reached).
- Go back to `screen-lista` manually (e.g. via `showScreen('screen-lista')` in console) and confirm the new recipe card appears with "(sem nome)" and R$ 0.00.
- "Duplicar" adds a second card; "Excluir" removes a card after confirming the dialog.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: render recipe list screen (open/duplicate/delete, cost preview)"
```

---

### Task 12: Screen 2 shell — recipe editor header, navigation, autosave

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getRecipe`, `saveRecipe` from `js/storage.js`.
- Produces: `renderRecipeEditor(recipeId: string)`, wired to `window.__openRecipeEditor`; a module-level `currentRecipe` object that later tasks (13, 15, 16, 17) read and mutate before calling `scheduleAutosave()`.

- [ ] **Step 1: Implement the editor shell in `js/app.js`**

```js
// append to js/app.js
import { getRecipe } from './storage.js';

let currentRecipe = null;
let autosaveTimer = null;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveRecipe(currentRecipe);
  }, 400);
}

function renderRecipeEditor(recipeId) {
  currentRecipe = getRecipe(recipeId);
  if (!currentRecipe) return;

  const container = document.getElementById('editor-conteudo');
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <label class="block text-sm font-semibold mb-1">Nome do Produto Final</label>
      <input id="input-nome" type="text" class="w-full border rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.nome}" placeholder="Ex: Bolo de Chocolate">

      <label class="block text-sm font-semibold mb-1">Rendimento (porções)</label>
      <input id="input-rendimento" type="number" min="0" class="w-full border rounded-xl px-3 py-2"
             value="${currentRecipe.rendimento}">
    </div>

    <div id="secao-ingredientes"></div>
    <div id="secao-custos-extras"></div>
    <div id="secao-dashboard"></div>
    <div id="secao-nutricao"></div>
  `;

  container.querySelector('#input-nome').addEventListener('input', (e) => {
    currentRecipe.nome = e.target.value;
    scheduleAutosave();
  });

  container.querySelector('#input-rendimento').addEventListener('input', (e) => {
    currentRecipe.rendimento = Number(e.target.value) || 0;
    scheduleAutosave();
    window.__onRendimentoChange?.();
  });

  showScreen('screen-editor');

  window.__onIngredientesRender?.();
  window.__onCustosExtrasRender?.();
  window.__onDashboardRender?.();
  window.__onNutricaoRender?.();
}

window.__openRecipeEditor = renderRecipeEditor;

export { currentRecipe, scheduleAutosave, renderRecipeEditor };
```

Note on the `window.__on*Render` hooks: since `currentRecipe` and `renderRecipeEditor` live in this module, later tasks (13, 15, 16, 17) each register their own render function against one of these hooks instead of editing this function's body every time. This keeps each task's diff isolated to the section it owns. When implementing this task, define all four hooks as no-ops (`window.__onIngredientesRender = () => {};` etc.) right after the `export` line, so the editor doesn't throw before those tasks exist.

- [ ] **Step 2: Add the no-op hook defaults**

```js
// append to js/app.js, right after the exports above
window.__onIngredientesRender = window.__onIngredientesRender || (() => {});
window.__onCustosExtrasRender = window.__onCustosExtrasRender || (() => {});
window.__onDashboardRender = window.__onDashboardRender || (() => {});
window.__onNutricaoRender = window.__onNutricaoRender || (() => {});
window.__onRendimentoChange = window.__onRendimentoChange || (() => {});
```

- [ ] **Step 3: Manual test**

Run: open `index.html`, click "+ Nova Receita".
Expected: switches to the editor screen, shows "Nome do Produto Final" and "Rendimento" inputs pre-filled with the new recipe's defaults. Typing a name and reloading the page (after navigating back to the list) shows the typed name persisted on the list screen within ~1 second (autosave debounce). Clicking "Minhas Receitas" returns to the list screen with the updated card.

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: add recipe editor shell (header inputs, autosave, back navigation)"
```

---

### Task 13: Ingredient rows UI — dynamic table with autocomplete

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `FIXED_INGREDIENTS`, `findFixedIngredient` from `js/ingredients-db.js`; `loadTacoDatabase`, `findInTaco` from `js/taco-database.js`; `getCustomIngredients` from `js/storage.js`; `parseQuantity`, `toGrams`, `calculateIngredientCost` from `js/calculations.js`; `data/taco.json` (fetched, since this runs in the browser, not Node).
- Produces: registers itself on `window.__onIngredientesRender`; produces `getAllIngredients(): Ingredient[]` (merged fixed + TACO + custom) and `findIngredientByName(nome): Ingredient | null` used by Task 14's custom-ingredient modal to decide whether to open it.

- [ ] **Step 1: Implement ingredient search and row rendering in `js/app.js`**

```js
// append to js/app.js
import { FIXED_INGREDIENTS, findFixedIngredient } from './ingredients-db.js';
import { loadTacoDatabase, findInTaco } from './taco-database.js';
import { getCustomIngredients } from './storage.js';
import { parseQuantity, toGrams, calculateIngredientCost } from './calculations.js';

let tacoIngredientsCache = null;

async function getTacoIngredients() {
  if (tacoIngredientsCache) return tacoIngredientsCache;
  const response = await fetch('data/taco.json');
  const raw = await response.json();
  tacoIngredientsCache = loadTacoDatabase(raw);
  return tacoIngredientsCache;
}

function getAllIngredientsSync() {
  return [...FIXED_INGREDIENTS, ...getCustomIngredients()];
}

function findIngredientByName(nome) {
  return findFixedIngredient(nome) || getCustomIngredients().find((i) => i.nome.toLowerCase() === nome.toLowerCase()) || null;
}

function computeLineCost(item) {
  const quantidade = parseQuantity(item.quantidadeBruta);
  if (quantidade == null) return null;
  const gramas = toGrams({
    quantidade,
    unidade: item.unidade,
    densidadeGml: item.densidadeGml,
    pesoUnidadeG: item.pesoUnidadeG
  });
  if (gramas == null) return null;
  return calculateIngredientCost({
    gramasUsadas: gramas,
    gramasEmbalagem: item.tamanhoEmbalagem,
    precoEmbalagem: item.precoEmbalagem
  });
}

function ensureTrailingEmptyRow() {
  const last = currentRecipe.ingredientes[currentRecipe.ingredientes.length - 1];
  if (!last || last.nome.trim() !== '') {
    currentRecipe.ingredientes.push({
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
    });
  }
}

async function applyIngredientMatch(item, nome) {
  const fixedOrCustom = findIngredientByName(nome);
  if (fixedOrCustom) {
    item.ingredientId = fixedOrCustom.id;
    item.nutricao100g = fixedOrCustom.nutricao100g;
    item.densidadeGml = fixedOrCustom.densidadeGml;
    item.pesoUnidadeG = fixedOrCustom.pesoUnidadeG;
    return true;
  }

  const taco = await getTacoIngredients();
  const tacoMatch = findInTaco(nome, taco);
  if (tacoMatch) {
    item.ingredientId = tacoMatch.id;
    item.nutricao100g = tacoMatch.nutricao100g;
    item.densidadeGml = tacoMatch.densidadeGml;
    item.pesoUnidadeG = tacoMatch.pesoUnidadeG;
    return true;
  }

  return false; // caller (Task 14) opens the custom-ingredient modal
}

function renderIngredientesSection() {
  ensureTrailingEmptyRow();
  const container = document.getElementById('secao-ingredientes');
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-bold mb-3">Ingredientes</h2>
      <div id="linhas-ingredientes" class="space-y-3"></div>
    </div>
  `;
  const linhas = container.querySelector('#linhas-ingredientes');

  currentRecipe.ingredientes.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'grid grid-cols-2 md:grid-cols-6 gap-2 items-center border-b pb-2';
    const custo = computeLineCost(item);
    row.innerHTML = `
      <input data-field="nome" class="col-span-2 md:col-span-2 border rounded-lg px-2 py-1" placeholder="Ingrediente" value="${item.nome}">
      <input data-field="quantidadeBruta" class="border rounded-lg px-2 py-1" placeholder="Qtd (ex: 1/2)" value="${item.quantidadeBruta}">
      <select data-field="unidade" class="border rounded-lg px-2 py-1">
        ${['xicara', 'colherSopa', 'colherCha', 'g', 'ml', 'unidade'].map((u) =>
          `<option value="${u}" ${item.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}
      </select>
      <input data-field="precoEmbalagem" type="number" step="0.01" class="border rounded-lg px-2 py-1" placeholder="Preço R$" value="${item.precoEmbalagem}">
      <input data-field="tamanhoEmbalagem" type="number" step="1" class="border rounded-lg px-2 py-1" placeholder="Tam. embalagem (g/ml)" value="${item.tamanhoEmbalagem}">
      <span class="text-sm font-semibold text-[var(--color-danger)] md:col-span-6">
        Custo: ${custo != null ? `R$ ${custo.toFixed(2)}` : '—'}
      </span>
    `;

    row.querySelector('[data-field="nome"]').addEventListener('change', async (e) => {
      item.nome = e.target.value;
      if (item.nome.trim() !== '') {
        const matched = await applyIngredientMatch(item, item.nome);
        if (!matched) {
          window.__onIngredientNotFound?.(item, index);
        }
      }
      scheduleAutosave();
      renderIngredientesSection();
      window.__onDashboardRender?.();
    });

    for (const field of ['quantidadeBruta', 'unidade', 'precoEmbalagem', 'tamanhoEmbalagem']) {
      row.querySelector(`[data-field="${field}"]`).addEventListener('input', (e) => {
        item[field] = field === 'precoEmbalagem' || field === 'tamanhoEmbalagem' ? Number(e.target.value) : e.target.value;
        scheduleAutosave();
        renderIngredientesSection();
        window.__onDashboardRender?.();
      });
    }

    linhas.appendChild(row);
  });
}

window.__onIngredientesRender = renderIngredientesSection;

export { getAllIngredientsSync, findIngredientByName, computeLineCost, getTacoIngredients };
```

Note on `window.__onIngredientNotFound`: Task 14 defines this hook to open the custom-ingredient modal. Add a no-op default alongside the other hook defaults from Task 12's Step 2: `window.__onIngredientNotFound = window.__onIngredientNotFound || (() => {});`.

- [ ] **Step 2: Manual test**

Run: open `index.html`, create a new recipe, type "Farinha de trigo" in the first ingredient row's name field and tab out.
Expected: a second, empty row appears automatically. Enter quantity `2`, unit `xicara`, price `5`, package size `1000` in the first row → the cost readout shows "Custo: R$ 1.20" (matching the spec's reference example).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: render dynamic ingredient rows with autocomplete matching and live cost"
```

---

### Task 14: Custom ingredient modal

**Files:**
- Modify: `js/app.js`
- Modify: `index.html` if the modal markup from Task 1 needs additional structure (it already has `#modal-ingrediente` and `#modal-ingrediente-conteudo`).

**Interfaces:**
- Consumes: `findInTaco`, `getTacoIngredients` (Task 13); `saveCustomIngredient` from `js/storage.js`.
- Produces: registers `window.__onIngredientNotFound(item, rowIndex)`.

- [ ] **Step 1: Implement the modal in `js/app.js`**

```js
// append to js/app.js
import { saveCustomIngredient } from './storage.js';

function openIngredientModal(item, rowIndex) {
  const modal = document.getElementById('modal-ingrediente');
  const content = document.getElementById('modal-ingrediente-conteudo');
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  content.innerHTML = `
    <h2 class="font-bold text-lg mb-3">Cadastrar "${item.nome}"</h2>
    <p id="taco-status" class="text-sm text-stone-500 mb-2">Buscando na tabela nutricional...</p>
    <label class="block text-sm font-semibold mb-1">Unidade de compra</label>
    <select id="modal-unidade-embalagem" class="w-full border rounded-lg px-2 py-1 mb-2">
      <option value="g">Gramas (g)</option>
      <option value="ml">Mililitros (ml)</option>
    </select>
    <label class="block text-sm font-semibold mb-1">Preço pago (R$)</label>
    <input id="modal-preco" type="number" step="0.01" class="w-full border rounded-lg px-2 py-1 mb-2">
    <label class="block text-sm font-semibold mb-1">Tamanho da embalagem</label>
    <input id="modal-tamanho" type="number" step="1" class="w-full border rounded-lg px-2 py-1 mb-4">
    <div id="modal-nutricao-fields" class="grid grid-cols-2 gap-2 mb-4"></div>
    <div class="flex justify-end gap-2">
      <button id="modal-cancelar" class="text-stone-500">Cancelar</button>
      <button id="modal-salvar" class="bg-[var(--color-primary)] text-white px-4 py-2 rounded-xl font-semibold">Salvar</button>
    </div>
  `;

  let nutricaoEncontrada = null;

  getTacoIngredients().then((taco) => {
    const match = findInTaco(item.nome, taco);
    const status = content.querySelector('#taco-status');
    const fieldsContainer = content.querySelector('#modal-nutricao-fields');
    nutricaoEncontrada = match ? match.nutricao100g : null;
    status.textContent = match
      ? `Nutrição encontrada automaticamente para "${match.nome}" (ajustável abaixo).`
      : 'Não encontrado na base nutricional — preencha manualmente se desejar (opcional).';

    const labels = { kcal: 'Kcal', carboidratos: 'Carboidratos (g)', proteinas: 'Proteínas (g)', gorduras: 'Gorduras (g)', fibras: 'Fibras (g)', sodio: 'Sódio (mg)' };
    fieldsContainer.innerHTML = Object.entries(labels).map(([key, label]) => `
      <div>
        <label class="block text-xs">${label}</label>
        <input data-nutriente="${key}" type="number" step="0.1" class="w-full border rounded-lg px-2 py-1"
               value="${nutricaoEncontrada ? nutricaoEncontrada[key] : ''}">
      </div>
    `).join('');
  });

  content.querySelector('#modal-cancelar').addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });

  content.querySelector('#modal-salvar').addEventListener('click', () => {
    const unidadeEmbalagem = content.querySelector('#modal-unidade-embalagem').value;
    const preco = Number(content.querySelector('#modal-preco').value) || 0;
    const tamanho = Number(content.querySelector('#modal-tamanho').value) || 0;

    const nutricao100g = {};
    let anyFilled = false;
    content.querySelectorAll('[data-nutriente]').forEach((input) => {
      const value = input.value === '' ? null : Number(input.value);
      nutricao100g[input.dataset.nutriente] = value;
      if (value != null) anyFilled = true;
    });

    const densidadeGml = unidadeEmbalagem === 'ml' ? 1.0 : null;

    const customIngredient = {
      id: `custom:${crypto.randomUUID()}`,
      nome: item.nome,
      categoria: 'outro',
      densidadeGml,
      pesoUnidadeG: null,
      nutricao100g: anyFilled ? nutricao100g : null
    };
    saveCustomIngredient(customIngredient);

    item.ingredientId = customIngredient.id;
    item.precoEmbalagem = preco;
    item.tamanhoEmbalagem = tamanho;
    item.unidadeEmbalagem = unidadeEmbalagem;
    item.nutricao100g = customIngredient.nutricao100g;
    item.densidadeGml = customIngredient.densidadeGml;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    scheduleAutosave();
    window.__onIngredientesRender?.();
    window.__onDashboardRender?.();
  });
}

window.__onIngredientNotFound = openIngredientModal;
```

- [ ] **Step 2: Manual test**

Run: open `index.html`, create a recipe, type a name that doesn't exist in the fixed database (e.g. "Geleia de Morango Marca X") into an ingredient row and tab out.
Expected: modal opens, shows either "Nutrição encontrada automaticamente..." (if a close TACO match exists) or "Não encontrado..." with empty, editable nutrition fields. Fill price/package size, click Salvar. Modal closes, the row now shows a computed cost once quantity is filled, and reopening the app later (after reload) shows the same custom ingredient auto-matches by name without reopening the modal.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add custom ingredient modal with TACO auto-fill and manual fallback"
```

---

### Task 15: Extra costs section (packaging + gas)

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `currentRecipe` (module state from Task 12).
- Produces: registers `window.__onCustosExtrasRender`.

- [ ] **Step 1: Implement in `js/app.js`**

```js
// append to js/app.js

function renderCustosExtrasSection() {
  const container = document.getElementById('secao-custos-extras');
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-bold mb-3">Custos Extras e Operacionais</h2>

      <label class="block text-sm font-semibold mb-1">Custo da embalagem unitária (R$)</label>
      <input id="input-embalagem" type="number" step="0.01" class="w-full border rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.embalagemUnitaria}">

      <label class="block text-sm font-semibold mb-1">Tempo de forno/fogo (minutos)</label>
      <input id="input-tempo-preparo" type="number" step="1" class="w-full border rounded-xl px-3 py-2 mb-3"
             value="${currentRecipe.tempoPreparoMinutos}">

      <label class="block text-sm font-semibold mb-1">Valor pago no botijão de 13kg (R$)</label>
      <input id="input-valor-botijao" type="number" step="0.01" class="w-full border rounded-xl px-3 py-2"
             value="${currentRecipe.valorBotijao}">
    </div>
  `;

  container.querySelector('#input-embalagem').addEventListener('input', (e) => {
    currentRecipe.embalagemUnitaria = Number(e.target.value) || 0;
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
  container.querySelector('#input-tempo-preparo').addEventListener('input', (e) => {
    currentRecipe.tempoPreparoMinutos = Number(e.target.value) || 0;
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
  container.querySelector('#input-valor-botijao').addEventListener('input', (e) => {
    currentRecipe.valorBotijao = Number(e.target.value) || 0;
    scheduleAutosave();
    window.__onDashboardRender?.();
  });
}

window.__onCustosExtrasRender = renderCustosExtrasSection;
```

- [ ] **Step 2: Manual test**

Run: open a recipe in the editor, fill "Custo da embalagem unitária", "Tempo de forno" and "Valor do botijão".
Expected: values persist after navigating away and back (autosave); no errors in console.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add packaging and gas cost inputs section"
```

---

### Task 16: Pricing dashboard

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `computeLineCost` (Task 13), `calculateGasCost`, `calculateRecipeCost`, `calculateCostPerPortion`, `calculateSuggestedPrices`, `calculateRealMargin` from `js/calculations.js`.
- Produces: registers `window.__onDashboardRender` and `window.__onRendimentoChange` (aliases to the same render function).

- [ ] **Step 1: Implement in `js/app.js`**

```js
// append to js/app.js
import { calculateRecipeCost as calcRecipeCost, calculateCostPerPortion, calculateSuggestedPrices, calculateRealMargin } from './calculations.js';

function renderDashboardSection() {
  const container = document.getElementById('secao-dashboard');

  const ingredientesCost = currentRecipe.ingredientes.reduce((sum, item) => {
    const cost = computeLineCost(item);
    return sum + (cost ?? 0);
  }, 0);
  const gasCost = calculateGasCost({
    valorBotijao: currentRecipe.valorBotijao,
    tempoPreparoMinutos: currentRecipe.tempoPreparoMinutos
  }) ?? 0;
  const embalagensCost = (currentRecipe.embalagemUnitaria || 0) * (currentRecipe.rendimento || 0);
  const custoTotal = calcRecipeCost({ ingredientesCost, gasCost, embalagensCost });
  const custoPorPorcao = calculateCostPerPortion({ custoTotal, rendimento: currentRecipe.rendimento });
  const sugeridos = calculateSuggestedPrices({ custoTotal });
  const margem = currentRecipe.precoVendaDesejado
    ? calculateRealMargin({ precoVenda: currentRecipe.precoVendaDesejado, custoPorPorcao })
    : null;

  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <h2 class="font-bold mb-3">Resultados</h2>
      <p class="text-[var(--color-danger)] font-semibold">Custo Total: R$ ${custoTotal.toFixed(2)}</p>
      <p class="text-[var(--color-danger)]">Custo por Porção: ${custoPorPorcao != null ? `R$ ${custoPorPorcao.toFixed(2)}` : '—'}</p>
      <p class="text-[var(--color-accent)] font-semibold mt-2">Preço sugerido (2x): R$ ${sugeridos.preco2x.toFixed(2)}</p>
      <p class="text-[var(--color-accent)] font-semibold">Preço sugerido (3x): R$ ${sugeridos.preco3x.toFixed(2)}</p>

      <label class="block text-sm font-semibold mt-3 mb-1">Preço que deseja vender (por porção, R$)</label>
      <input id="input-preco-venda" type="number" step="0.01" class="w-full border rounded-xl px-3 py-2"
             value="${currentRecipe.precoVendaDesejado ?? ''}">

      ${margem != null ? `<p class="mt-2 font-bold ${margem >= 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}">Margem real: ${margem.toFixed(1)}%</p>` : ''}
    </div>
  `;

  container.querySelector('#input-preco-venda').addEventListener('input', (e) => {
    currentRecipe.precoVendaDesejado = e.target.value === '' ? null : Number(e.target.value);
    scheduleAutosave();
    renderDashboardSection();
  });
}

window.__onDashboardRender = renderDashboardSection;
window.__onRendimentoChange = renderDashboardSection;
```

- [ ] **Step 2: Manual test**

Run: in a recipe with at least one priced ingredient, some gas time, and a package cost, check the dashboard values.
Expected: Custo Total = ingredients + gas + (embalagem × rendimento); Preço sugerido (2x/3x) = 2×/3× that total. Type a "Preço que deseja vender" and confirm the margin percentage matches `((venda - custoPorPorcao) / venda) * 100`.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add pricing dashboard (total cost, suggested prices, real margin)"
```

---

### Task 17: Nutrition table

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `calculateNutritionPerPortion`, `parseQuantity`, `toGrams` from `js/calculations.js`.
- Produces: registers `window.__onNutricaoRender`.

- [ ] **Step 1: Implement in `js/app.js`**

```js
// append to js/app.js
import { calculateNutritionPerPortion } from './calculations.js';

function renderNutricaoSection() {
  const container = document.getElementById('secao-nutricao');
  container.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-4">
      <button id="btn-gerar-nutricao" class="w-full bg-[var(--color-accent)] text-white font-bold py-3 rounded-2xl">
        Gerar Tabela Nutricional Média
      </button>
      <div id="resultado-nutricao" class="mt-4"></div>
    </div>
  `;

  container.querySelector('#btn-gerar-nutricao').addEventListener('click', () => {
    const itens = currentRecipe.ingredientes
      .filter((item) => item.nome.trim() !== '')
      .map((item) => {
        const quantidade = parseQuantity(item.quantidadeBruta);
        const gramas = quantidade == null ? null : toGrams({
          quantidade,
          unidade: item.unidade,
          densidadeGml: item.densidadeGml,
          pesoUnidadeG: item.pesoUnidadeG
        });
        return { gramas: gramas ?? 0, nutricao100g: gramas != null ? item.nutricao100g : null };
      });

    const resultado = calculateNutritionPerPortion({ itens, rendimento: currentRecipe.rendimento });
    const resultDiv = container.querySelector('#resultado-nutricao');

    if (!resultado) {
      resultDiv.innerHTML = '<p class="text-[var(--color-danger)]">Defina um rendimento válido para calcular a tabela nutricional.</p>';
      return;
    }

    resultDiv.innerHTML = `
      <div class="border-2 border-stone-800 rounded-xl p-4">
        <h3 class="font-extrabold text-lg border-b-4 border-stone-800 pb-1 mb-2">Informação Nutricional (por porção)</h3>
        <p>Valor Energético: <strong>${resultado.kcal.toFixed(0)} kcal</strong></p>
        <p>Carboidratos: <strong>${resultado.carboidratos.toFixed(1)} g</strong></p>
        <p>Proteínas: <strong>${resultado.proteinas.toFixed(1)} g</strong></p>
        <p>Gorduras Totais: <strong>${resultado.gorduras.toFixed(1)} g</strong></p>
        <p>Fibra Alimentar: <strong>${resultado.fibras.toFixed(1)} g</strong></p>
        <p>Sódio: <strong>${resultado.sodio.toFixed(0)} mg</strong></p>
        ${resultado.ingredientesSemDados > 0
          ? `<p class="text-sm text-[var(--color-danger)] mt-2">Cálculo incompleto — ${resultado.ingredientesSemDados} ingrediente(s) sem dados nutricionais.</p>`
          : ''}
      </div>
    `;
  });
}

window.__onNutricaoRender = renderNutricaoSection;
```

- [ ] **Step 2: Manual test**

Run: in a recipe with a few ingredients (mix of fixed-database and one without nutrition data) and a valid rendimento, click "Gerar Tabela Nutricional Média".
Expected: styled nutrition card appears with kcal/carbs/protein/fat/fiber/sodium per portion; if an ingredient lacks nutrition data, the "cálculo incompleto" warning shows with the correct count. Setting rendimento to 0 and regenerating shows the "Defina um rendimento válido" message instead of crashing.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add per-portion nutrition table generation"
```

---

### Task 18: End-to-end verification pass

**Files:** none (verification only, using files from all previous tasks).

**Interfaces:** none — this task exercises the whole app as a user would.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test` (equivalent to `node --test js/`)
Expected: PASS — all suites from Tasks 2–9 green (`calculations.test.js`, `ingredients-db.test.js`, `taco-database.test.js`).

- [ ] **Step 2: Full manual walkthrough**

Run: open `index.html` fresh (clear localStorage first via DevTools → Application → Local Storage → clear, to start from an empty state) and perform, in order:
1. Confirm "Minhas Receitas" shows the empty state.
2. Create a new recipe named "Bolo de Chocolate", rendimento 20.
3. Add "Farinha de trigo", quantity `2`, unit `xicara`, preço `5`, tamanho `1000` → confirm cost shows R$ 1.20 and a new blank row appeared automatically.
4. Add "Açúcar" and "Ovos" with plausible values.
5. Type a made-up ingredient name → confirm the custom ingredient modal opens, shows a TACO match or the manual fallback, save it.
6. Fill embalagem unitária, tempo de preparo, valor do botijão → confirm the dashboard's Custo Total updates live.
7. Type a "Preço que deseja vender" → confirm the margin % appears and is signed correctly (red if negative, green if positive).
8. Click "Gerar Tabela Nutricional Média" → confirm the styled card renders with the expected fields.
9. Click "Minhas Receitas" → confirm the recipe card shows the updated name and cost.
10. Duplicate the recipe, open the duplicate, confirm all data (ingredients, extra costs, nutrition) carried over correctly, then delete both recipes.
11. Reload the page mid-edit (after step 6, before navigating back) → confirm the autosave preserved the latest inputs.

Expected: no console errors at any step; all values match hand-calculated expectations using the formulas in the design doc.

- [ ] **Step 3: Fix any issues found**

If any step in the walkthrough fails, identify which task's code is responsible, fix it in place, re-run the relevant automated tests (if applicable) plus the manual step that failed, and commit the fix separately (`fix: <description>`), not folded into an unrelated earlier task's commit.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify end-to-end flow across recipe list, editor, custom ingredients and nutrition table"
```
