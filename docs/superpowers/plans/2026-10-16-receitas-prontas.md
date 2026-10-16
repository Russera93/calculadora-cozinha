# Receitas prontas + modo de preparo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catálogo de 16 receitas prontas (abas na tela inicial) que a pessoa lê e copia para Minhas receitas, mais o modo de preparo nas receitas dela.

**Architecture:** Conteúdo em `data/receitas-prontas.json` (carregado sob demanda, no PRECACHE). Lógica pura e testada em `js/receitas-prontas.js` (validação, texto, cópia) e `js/preparo.js` (texto ↔ passos). Duas telas novas (`prontas.js` catálogo, `pronta.js` detalhe) com rotas `#/prontas` e `#/prontas/<id>`; a tela inicial ganha abas compartilhadas (`home-header.js`). O editor ganha a seção Modo de preparo e o painel `preparo-sheet.js`; `semCusto` (água) entra em `costing.js`.

**Tech Stack:** Vanilla JS (ES modules, sem build, sem dependências de runtime), `node --test`, Playwright (smoke 390×844), CSS próprio com tokens.

**Spec:** `docs/superpowers/specs/2026-10-16-receitas-prontas-design.md`

## Global Constraints

- Vanilla JS, ES modules nativos, **sem build step, sem framework, zero dependências de runtime**.
- **Todo arquivo novo do app entra no `PRECACHE` do `sw.js`** (`js/sw.test.js` falha se faltar); mudou a lista → subir `CACHE` (`calculadora-app-v6` → `calculadora-app-v7`).
- Cores só via tokens `--color-*`; nenhuma cor nova. Componentes existentes: `.tabs`, `.tab`, `.card`, `.recipe-card-name`, `.chip`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-link`, `.passos`, `.tag`, `.section-title`, `.sheet-section`, `.empty`, sheet (`js/ui/sheet.js`).
- Largura 390 px **sem rolagem lateral**; temas claro e escuro.
- Textos da interface em português do Brasil; comentários de código em inglês (padrão do repo).
- Texto do WhatsApp **nunca** leva dinheiro (custo, preço, margem, lucro).
- Unidades de receita: `g`, `ml`, `xicara`, `colherSopa`, `colherCha`, `unidade` (`UNIT_CHIPS` em `js/format.js`).
- `html\`\`` (`js/ui/dom.js`) escapa toda interpolação — nunca montar HTML com concatenação de string.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Trabalho na branch `receitas-prontas` (já criada, a partir de `sugestoes-categorias`).

## Review Focus

1. **Toque duplo em "Usar esta receita"** → só uma cópia é criada (botão desabilitado enquanto copia). Teste: Task 7, smoke.
2. **Renomear a linha "Água" (sem custo) para outro ingrediente** → volta a ter custo, "Quanto pagou" reaparece e "falta o preço" volta a valer. Teste: Task 8 (unitário de `limparSemCustoAoRenomear` + smoke).
3. **Texto colado no modo de preparo com numeração, marcadores e linhas vazias** ("1. Misture", "2) Asse", "• Sirva", "") → passos limpos sem numeração dupla; apagar tudo → estado vazio. Teste: Task 2.
4. **Catálogo sem internet na primeira vez / link para receita que não existe** (`#/prontas/xyz`) → mensagem clara, "Tentar de novo" funciona (o loader não guarda a falha), id inexistente volta ao catálogo com aviso. Teste: Task 4 (loader), Task 7 (smoke do id inexistente).
5. **Copiar uma receita cujo nome já existe em Minhas receitas** (mesmo com acento/maiúscula diferentes) → "Nome (cópia)". Teste: Task 4.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `js/router.js` (mod.) | rotas `prontas`, `pronta`, item `preparo` |
| `js/preparo.js` (novo) | `textoParaPassos`, `passosParaTexto` |
| `js/storage.js` (mod.) | `modoPreparo` em `createEmptyRecipe`/`migrateRecipe` |
| `js/share.js` (mod.) | passos no texto do WhatsApp |
| `js/costing.js` (mod.) | `semCusto` em `computeLineCost`/`lineIssue`; `limparSemCustoAoRenomear` |
| `js/receitas-prontas.js` (novo) | validação, `medidaTexto`, `rendeTexto`, `contarIngredientes`, `agruparPorSecao`, `criarReceitaDePronta` |
| `js/receitas-prontas-loader.js` (novo) | `getReceitasProntas()` (fetch em cache, sem guardar falha) |
| `js/fixtures/receitas-prontas.json` (novo) | 2 receitas para testes |
| `data/receitas-prontas.json` (reescrito) | 16 receitas no formato da spec |
| `js/ingredientes-sugeridos.js` (mod.) | 12 nomes novos |
| `js/screens/home-header.js` (novo) | cabeçalho + abas da tela inicial |
| `js/screens/lista.js` (mod.) | usa o cabeçalho; link para prontas no estado vazio |
| `js/screens/prontas.js` (novo) | catálogo |
| `js/screens/pronta.js` (novo) | detalhe + "Usar esta receita" |
| `js/app.js` (mod.) | monta as telas novas |
| `js/screens/editor/ingredientes.js` (mod.) | seção Modo de preparo; linha "sem custo" |
| `js/screens/editor/preparo-sheet.js` (novo) | painel de edição dos passos |
| `js/screens/editor/ingrediente-sheet.js` (mod.) | esconde "Quanto pagou" quando sem custo |
| `css/styles.css` (mod.) | abas da home, cartão do catálogo, detalhe, barra de ação, textarea |
| `sw.js` (mod.) | PRECACHE + `CACHE` v7 |
| `scripts/smoke/14-prontas.mjs` (novo), `10-pwa.mjs`, `12-instalar.mjs` (mod.) | smoke |
| `CLAUDE.md` (mod.) | histórico/estrutura |

---

### Task 1: Rotas

**Files:**
- Modify: `js/router.js`
- Test: `js/router.test.js`

**Interfaces:**
- Produces: rotas `{ screen: 'prontas' }` ↔ `#/prontas`; `{ screen: 'pronta', prontaId }` ↔ `#/prontas/<id>`; `{ screen: 'editor', recipeId, aba: 'ingredientes', item: 'preparo' }` ↔ `#/receita/<id>/ingredientes/preparo`.

- [ ] **Step 1: Write the failing tests** — append to `js/router.test.js`:

```js
test('parseRoute/buildHash: ready-made recipes catalog and detail', () => {
  assert.deepEqual(parseRoute('#/prontas'), { screen: 'prontas' });
  assert.deepEqual(parseRoute('#/prontas/brigadeiro'), { screen: 'pronta', prontaId: 'brigadeiro' });
  assert.deepEqual(parseRoute('#/prontas/a/b'), { screen: 'lista' });
  assert.equal(buildHash({ screen: 'prontas' }), '#/prontas');
  assert.equal(buildHash({ screen: 'pronta', prontaId: 'bolo de pote' }), '#/prontas/bolo%20de%20pote');
  assert.deepEqual(parseRoute(buildHash({ screen: 'pronta', prontaId: 'bolo de pote' })), { screen: 'pronta', prontaId: 'bolo de pote' });
});

test('parseRoute/buildHash: modo de preparo sheet', () => {
  const route = { screen: 'editor', recipeId: 'abc', aba: 'ingredientes', item: 'preparo' };
  assert.deepEqual(parseRoute('#/receita/abc/ingredientes/preparo'), route);
  assert.equal(buildHash(route), '#/receita/abc/ingredientes/preparo');
  assert.deepEqual(parseRoute('#/receita/abc/custos/preparo'), { screen: 'lista' });
});
```

- [ ] **Step 2: Run** `node --test js/router.test.js` — Expected: FAIL (the two new tests).

- [ ] **Step 3: Implement** in `js/router.js`. In `parseRoute`, right after the `ajustes` line:

```js
  if (parts[0] === 'prontas') {
    if (parts.length === 1) return { screen: 'prontas' };
    if (parts.length === 2 && parts[1]) return { screen: 'pronta', prontaId: parts[1] };
    return LISTA;
  }
```

Change the item line to accept `preparo`:

```js
  if (parts[3] === 'novo' || parts[3] === 'nota' || parts[3] === 'preparo') return { screen: 'editor', recipeId, aba, item: parts[3] };
```

In `buildHash`, before the final `return`:

```js
  if (route.screen === 'prontas') return '#/prontas';
  if (route.screen === 'pronta') return `#/prontas/${encodeURIComponent(route.prontaId)}`;
```

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add js/router.js js/router.test.js
git commit -m "Routes for ready-made recipes and the modo de preparo sheet"
```

---

### Task 2: Modo de preparo no modelo da receita (dados, limpeza, WhatsApp)

**Files:**
- Create: `js/preparo.js`, `js/preparo.test.js`
- Modify: `js/storage.js` (`createEmptyRecipe`, `migrateRecipe`), `js/share.js`, `sw.js`
- Test: `js/storage.test.js`, `js/share.test.js`

**Interfaces:**
- Produces: `textoParaPassos(texto: string): string[]`, `passosParaTexto(passos: string[]): string`; `recipe.modoPreparo: string[]` (sempre array após `migrateRecipe`/`createEmptyRecipe`).

- [ ] **Step 1: Write the failing tests**

`js/preparo.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoParaPassos, passosParaTexto } from './preparo.js';

test('textoParaPassos: one step per line, blank lines dropped, trimmed', () => {
  assert.deepEqual(textoParaPassos('  Misture tudo.  \n\n\nAsse por 40 min.\n'), ['Misture tudo.', 'Asse por 40 min.']);
  assert.deepEqual(textoParaPassos('a\r\nb'), ['a', 'b']);
});

test('textoParaPassos: pasted numbering and bullets are removed (the app numbers)', () => {
  assert.deepEqual(
    textoParaPassos('1. Misture\n2) Leve ao fogo\n3 - Mexa\n4: Enrole\n- Passe no granulado\n• Sirva\n* Embale\n– Venda'),
    ['Misture', 'Leve ao fogo', 'Mexa', 'Enrole', 'Passe no granulado', 'Sirva', 'Embale', 'Venda']
  );
});

test('textoParaPassos: a number that is part of the step stays', () => {
  assert.deepEqual(textoParaPassos('2 xícaras de farinha na tigela\n180°C por 40 minutos'), ['2 xícaras de farinha na tigela', '180°C por 40 minutos']);
});

test('textoParaPassos: empty or only blanks/markers gives no steps', () => {
  assert.deepEqual(textoParaPassos(''), []);
  assert.deepEqual(textoParaPassos('\n  \n1.\n-'), []);
  assert.deepEqual(textoParaPassos(undefined), []);
});

test('passosParaTexto: inverse, for editing', () => {
  assert.equal(passosParaTexto(['Misture', 'Asse']), 'Misture\nAsse');
  assert.equal(passosParaTexto([]), '');
  assert.equal(passosParaTexto(undefined), '');
  assert.deepEqual(textoParaPassos(passosParaTexto(['Misture', 'Asse'])), ['Misture', 'Asse']);
});
```

Append to `js/storage.test.js`:

```js
test('createEmptyRecipe and migrateRecipe: modoPreparo is always an array', () => {
  assert.deepEqual(createEmptyRecipe().modoPreparo, []);
  assert.deepEqual(migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [] }).modoPreparo, []);
  assert.deepEqual(migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [], modoPreparo: ['Misture'] }).modoPreparo, ['Misture']);
  assert.deepEqual(migrateRecipe({ id: 'r', rendimento: 1, ingredientes: [], modoPreparo: 'lixo' }).modoPreparo, []);
});
```

Append to `js/share.test.js` (uses the file's existing `brigadeiro` fixture and imports):

```js
test('buildRecipeShareText: modo de preparo numbered after the yield, when there is one', () => {
  const text = buildRecipeShareText({ ...brigadeiro, modoPreparo: ['Misture tudo.', ' ', 'Enrole.'] });
  assert.ok(text.endsWith('\n\nModo de preparo:\n1. Misture tudo.\n2. Enrole.'));
  assert.ok(!buildRecipeShareText({ ...brigadeiro, modoPreparo: [] }).includes('Modo de preparo'));
  assert.ok(!buildRecipeShareText(brigadeiro).includes('Modo de preparo')); // old recipe, no field
});
```

- [ ] **Step 2: Run** `npm test` — Expected: FAIL (`preparo.js` missing; storage/share new tests fail).

- [ ] **Step 3: Implement**

`js/preparo.js`:

```js
// js/preparo.js
//
// Modo de preparo: the sheet edits plain text (one step per line); the
// recipe stores an array of steps. The app numbers the steps, so numbering
// or bullets pasted from elsewhere are stripped ("1. 1. Misture" otherwise).

// "1." "2)" "3 -" "4:" or a bullet, at the start of the line.
const MARCADOR = /^\s*(?:\d+\s*[.):\-–]|[-•*–])\s*/;

export function textoParaPassos(texto) {
  return String(texto ?? '')
    .split(/\r?\n/)
    .map((linha) => linha.replace(MARCADOR, '').trim())
    .filter(Boolean);
}

export function passosParaTexto(passos) {
  return (passos || []).join('\n');
}
```

`js/storage.js` — in `migrateRecipe`, before `return migrated;`:

```js
  // Recipes saved before "modo de preparo" existed have no steps.
  if (!Array.isArray(migrated.modoPreparo)) migrated.modoPreparo = [];
```

and in `createEmptyRecipe`, after `ingredientes: [],`:

```js
    modoPreparo: [],
```

`js/share.js` — in `buildRecipeShareText`, compute the steps and append them after `rende`:

```js
  const passos = (recipe.modoPreparo || []).filter((p) => typeof p === 'string' && p.trim() !== '');
```

and replace the closing of the returned array:

```js
    rende,
    ...(passos.length ? ['', 'Modo de preparo:', ...passos.map((p, i) => `${i + 1}. ${p.trim()}`)] : [])
  ].join('\n');
```

`sw.js` — add `'js/preparo.js',` to `PRECACHE` (alphabetical, after `'js/ocr.js',`).

- [ ] **Step 4: Run** `npm test` — Expected: all PASS. If an existing storage test compares `createEmptyRecipe()` with a literal object, add `modoPreparo: []` to that literal.

- [ ] **Step 5: Commit**

```bash
git add js/preparo.js js/preparo.test.js js/storage.js js/storage.test.js js/share.js js/share.test.js sw.js
git commit -m "Modo de preparo in the recipe model, cleaned steps, WhatsApp text"
```

---

### Task 3: Ingrediente sem custo (água)

**Files:**
- Modify: `js/costing.js`
- Test: `js/costing.test.js`

**Interfaces:**
- Produces: `item.semCusto === true` → `computeLineCost` 0 (com quantidade válida), `lineIssue` só acusa quantidade; `limparSemCustoAoRenomear(item, nomeAnterior: string): boolean` (remove `semCusto` quando o nome muda de verdade; devolve se removeu).

- [ ] **Step 1: Write the failing tests** — append to `js/costing.test.js` (add `limparSemCustoAoRenomear` to its import from `./costing.js`):

```js
test('semCusto: costs 0 with a valid quantity, never asks for a price', () => {
  const agua = { nome: 'Água', quantidadeBruta: '500', unidade: 'ml', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', densidadeGml: null, pesoUnidadeG: null, semCusto: true };
  assert.equal(computeLineCost(agua), 0);
  assert.equal(lineIssue(agua), null);
  assert.equal(lineIssue({ ...agua, quantidadeBruta: '' }), 'quantidade');
  assert.equal(lineIssue({ ...agua, quantidadeBruta: 'muito' }), 'quantidadeInvalida');
  assert.equal(computeLineCost({ ...agua, quantidadeBruta: '' }), null);
});

test('limparSemCustoAoRenomear: a real rename brings the cost back; same name (accents/case) keeps it', () => {
  const item = { nome: 'Farinha', semCusto: true };
  assert.equal(limparSemCustoAoRenomear(item, 'Água'), true);
  assert.equal('semCusto' in item, false);
  const mesma = { nome: 'agua', semCusto: true };
  assert.equal(limparSemCustoAoRenomear(mesma, 'Água'), false);
  assert.equal(mesma.semCusto, true);
  assert.equal(limparSemCustoAoRenomear({ nome: 'X' }, 'Y'), false);
});
```

- [ ] **Step 2: Run** `node --test js/costing.test.js` — Expected: FAIL.

- [ ] **Step 3: Implement** in `js/costing.js`:

Add `import { normalize } from './text-utils.js';` to the imports.

In `computeLineCost`, right after `if (quantidade == null) return null;`:

```js
  // Shown in the recipe but free (tap water, from a ready-made recipe).
  if (item.semCusto) return 0;
```

In `lineIssue`, right after the `quantidadeInvalida` line:

```js
  if (item.semCusto) return null;
```

At the end of the file:

```js
// "Água" renamed to "Farinha" must cost again; retyping the same name
// (accents/case aside) keeps it free.
export function limparSemCustoAoRenomear(item, nomeAnterior) {
  if (!item.semCusto || normalize(item.nome) === normalize(nomeAnterior)) return false;
  delete item.semCusto;
  return true;
}
```

- [ ] **Step 4: Run** `npm test` — Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add js/costing.js js/costing.test.js
git commit -m "semCusto ingredients: shown in the recipe, free, never 'sem preço'"
```

---

### Task 4: Módulo das receitas prontas (puro) + loader

**Files:**
- Create: `js/receitas-prontas.js`, `js/receitas-prontas.test.js`, `js/receitas-prontas-loader.js`, `js/receitas-prontas-loader.test.js`, `js/fixtures/receitas-prontas.json`
- Modify: `sw.js`

**Interfaces:**
- Consumes: `emptyIngredientItem`, `findKnownIngredient`, `applyIngredientMatch` (`js/ingredient-match.js`); `findInTaco(nome, taco)` (`js/taco-database.js`); `parseQuantity` (`js/calculations.js`); `UNIT_CHIPS`, `unitLabel` (`js/format.js`); `CATEGORIAS` (`js/ingredientes-sugeridos.js`); `normalize` (`js/text-utils.js`).
- Produces:
  - `validarCatalogo(data): string[]` (problemas; vazio = ok)
  - `nomesForaDaLista(data): string[]` (ordenados, únicos)
  - `medidaTexto(ing): string` — `"1 colher de sopa"`
  - `rendeTexto(pronta): string` — `"Rende 30 docinhos"`
  - `contarIngredientes(pronta): number` (nomes distintos)
  - `agruparPorSecao(ingredientes): { secao: string|null, itens: object[] }[]`
  - `criarReceitaDePronta(pronta, { existentes, custom, precoDe, taco, base }): recipe`
  - `getReceitasProntas(): Promise<{ categorias, receitas }>`

- [ ] **Step 1: Create the fixture** `js/fixtures/receitas-prontas.json`:

```json
{
  "categorias": [
    { "id": "docinhos", "nome": "Docinhos e trufas" },
    { "id": "salgados", "nome": "Salgados" }
  ],
  "receitas": [
    {
      "id": "brigadeiro",
      "nome": "Brigadeiro tradicional",
      "categoria": "docinhos",
      "rendimento": 30,
      "unidadeRendimento": "docinhos",
      "ingredientes": [
        { "nome": "Leite condensado", "quantidade": "1", "unidade": "unidade", "observacao": "lata de 395 g" },
        { "nome": "Manteiga", "quantidade": "1", "unidade": "colherSopa" },
        { "nome": "Chocolate em pó", "quantidade": "4", "unidade": "colherSopa" },
        { "nome": "Coco ralado", "quantidade": "1/2", "unidade": "xicara" }
      ],
      "preparo": ["Junte tudo na panela.", "Mexa até desgrudar.", "Enrole."]
    },
    {
      "id": "coxinha",
      "nome": "Coxinha",
      "categoria": "salgados",
      "rendimento": 25,
      "ingredientes": [
        { "secao": "Massa", "nome": "Água", "quantidade": "1000", "unidade": "ml", "semCusto": true },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "500", "unidade": "g" },
        { "secao": "Recheio", "nome": "Ovos", "quantidade": "2", "unidade": "unidade" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" }
      ],
      "preparo": ["Ferva a água.", "Junte a farinha."]
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests** `js/receitas-prontas.test.js`:

```js
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
```

`js/receitas-prontas-loader.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReceitasProntas } from './receitas-prontas-loader.js';

test('getReceitasProntas: a failed load is not cached (retry works), a good one is', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new Error('offline');
    return { ok: true, json: async () => ({ categorias: [], receitas: [] }) };
  };
  await assert.rejects(getReceitasProntas());
  assert.deepEqual(await getReceitasProntas(), { categorias: [], receitas: [] });
  await getReceitasProntas();
  assert.equal(calls, 2);
});
```

- [ ] **Step 3: Run** `npm test` — Expected: FAIL (modules missing).

- [ ] **Step 4: Implement** `js/receitas-prontas.js`:

```js
// js/receitas-prontas.js
//
// Ready-made recipes (data/receitas-prontas.json): checking the file,
// texts for the catalog/detail, and turning one into the person's own
// recipe. Pure — storage, TACO and prices are passed in.

import { parseQuantity } from './calculations.js';
import { UNIT_CHIPS, unitLabel } from './format.js';
import { CATEGORIAS } from './ingredientes-sugeridos.js';
import { emptyIngredientItem, findKnownIngredient, applyIngredientMatch } from './ingredient-match.js';
import { findInTaco } from './taco-database.js';
import { normalize } from './text-utils.js';

const UNIDADES = UNIT_CHIPS.map((u) => u.value);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validarCatalogo(data) {
  if (!data || !Array.isArray(data.categorias) || !Array.isArray(data.receitas)) {
    return ['formato: faltam "categorias" e "receitas"'];
  }
  const problemas = [];
  const categorias = new Set(data.categorias.map((c) => c.id));
  const ids = new Set();
  for (const r of data.receitas) {
    const onde = r?.id || '(sem id)';
    if (!ID.test(r?.id || '')) problemas.push(`${onde}: id inválido`);
    if (ids.has(r?.id)) problemas.push(`${onde}: id repetido`);
    ids.add(r?.id);
    if (!r?.nome?.trim()) problemas.push(`${onde}: sem nome`);
    if (!categorias.has(r?.categoria)) problemas.push(`${onde}: categoria "${r?.categoria}" não existe`);
    if (!Number.isInteger(r?.rendimento) || r.rendimento < 1) problemas.push(`${onde}: rendimento inválido`);
    if (!Array.isArray(r?.ingredientes) || r.ingredientes.length === 0) problemas.push(`${onde}: sem ingredientes`);
    for (const i of r?.ingredientes || []) {
      if (!i?.nome?.trim()) problemas.push(`${onde}: ingrediente sem nome`);
      if (!UNIDADES.includes(i?.unidade)) problemas.push(`${onde}: ${i?.nome}: unidade "${i?.unidade}" inválida`);
      if (parseQuantity(i?.quantidade) == null) problemas.push(`${onde}: ${i?.nome}: quantidade "${i?.quantidade}" ilegível`);
    }
    if (!Array.isArray(r?.preparo) || r.preparo.length === 0 || r.preparo.some((p) => typeof p !== 'string' || !p.trim())) {
      problemas.push(`${onde}: modo de preparo vazio`);
    }
  }
  return problemas;
}

export function nomesForaDaLista(data) {
  const conhecidos = new Set(CATEGORIAS.flatMap((c) => c.itens).map(normalize));
  const fora = new Map(); // normalized -> first spelling seen
  for (const r of data.receitas) {
    for (const i of r.ingredientes) {
      const key = normalize(i.nome);
      if (!conhecidos.has(key) && !fora.has(key)) fora.set(key, i.nome);
    }
  }
  return [...fora.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function medidaTexto(ing) {
  return `${ing.quantidade} ${unitLabel(ing.unidade, parseQuantity(ing.quantidade))}`;
}

export function rendeTexto(pronta) {
  const unidade = pronta.unidadeRendimento || (pronta.rendimento === 1 ? 'unidade' : 'unidades');
  return `Rende ${pronta.rendimento} ${unidade}`;
}

export function contarIngredientes(pronta) {
  return new Set(pronta.ingredientes.map((i) => normalize(i.nome))).size;
}

export function agruparPorSecao(ingredientes) {
  const grupos = new Map();
  for (const ing of ingredientes) {
    const secao = ing.secao || null;
    if (!grupos.has(secao)) grupos.set(secao, { secao, itens: [] });
    grupos.get(secao).itens.push(ing);
  }
  return [...grupos.values()];
}

// The copy goes through the same recognition as a typed ingredient: fixed
// DB / custom, the price she already used, and TACO for the rest (density
// makes "1 xícara" cost something as soon as she adds a price).
export function criarReceitaDePronta(pronta, { existentes, custom, precoDe, taco, base }) {
  const usados = new Set(existentes.map((r) => normalize(r.nome || '')));
  const nome = usados.has(normalize(pronta.nome)) ? `${pronta.nome} (cópia)` : pronta.nome;

  const ingredientes = pronta.ingredientes.map((ing) => {
    const item = { ...emptyIngredientItem(), nome: ing.nome, quantidadeBruta: ing.quantidade, unidade: ing.unidade };
    if (ing.semCusto) {
      item.semCusto = true;
      return item;
    }
    const known = findKnownIngredient(ing.nome, custom);
    applyIngredientMatch(item, { known, precoConhecido: precoDe(ing.nome) });
    item.unidade = ing.unidade; // the recipe's measure wins over the eggs default
    if (!known) {
      const match = findInTaco(ing.nome, taco);
      if (match) {
        item.nutricao100g = match.nutricao100g;
        item.densidadeGml = match.densidadeGml;
      }
    }
    return item;
  });

  return {
    ...base,
    nome,
    rendimento: pronta.rendimento,
    quantidadeEmbalagens: pronta.rendimento,
    ingredientes,
    modoPreparo: [...pronta.preparo],
    origem: pronta.id
  };
}
```

`js/receitas-prontas-loader.js`:

```js
// js/receitas-prontas-loader.js
//
// Loads data/receitas-prontas.json once per page, only when the catalog is
// opened. A failed load is forgotten, so "Tentar de novo" really retries.

let promessa = null;

export function getReceitasProntas() {
  if (!promessa) {
    promessa = fetch('data/receitas-prontas.json')
      .then((response) => {
        if (!response.ok) throw new Error('receitas-prontas fetch failed: ' + response.status);
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

`sw.js` — add to `PRECACHE`: `'js/receitas-prontas.js',` and `'js/receitas-prontas-loader.js',` (alphabetical, after `'js/receipt-parser.js',`).

- [ ] **Step 5: Run** `npm test` — Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add js/receitas-prontas.js js/receitas-prontas.test.js js/receitas-prontas-loader.js js/receitas-prontas-loader.test.js js/fixtures/receitas-prontas.json sw.js
git commit -m "Ready-made recipes module: validation, texts, copy into the person's recipe, loader"
```

---

### Task 5: Conteúdo — 16 receitas convertidas + nomes novos nas sugestões

**Files:**
- Rewrite: `data/receitas-prontas.json`
- Modify: `js/ingredientes-sugeridos.js`, `js/receitas-prontas.test.js`, `sw.js`

**Interfaces:**
- Consumes: `validarCatalogo`, `nomesForaDaLista` (Task 4).
- Produces: o catálogo real (ids usados no smoke: `brigadeiro`, `coxinha-de-frango`; categorias `bolos`, `docinhos`, `tortas`, `salgados`).

- [ ] **Step 1: Write the failing test** — append to `js/receitas-prontas.test.js`:

```js
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
```

- [ ] **Step 2: Run** `node --test js/receitas-prontas.test.js` — Expected: FAIL (old draft format).

- [ ] **Step 3: Add the new names** to `js/ingredientes-sugeridos.js` (append to each category's `itens`, keeping the existing items):
  - `base`: `'Fubá'`
  - `laticinios`: `'Queijo ralado'`
  - `recheios-doces`: `'Cenoura'`, `'Mel'`
  - `aromas`: `'Biscoito maisena'`
  - `massas`: `'Água'`, `'Gordura vegetal'`
  - `recheios-salgados`: `'Queijo ralado'`
  - `temperos`: `'Pimentão'`, `'Azeite'`, `'Gergelim'`, `'Pimenta dedo-de-moça'`, `'Tempero pronto'`

- [ ] **Step 4: Rewrite** `data/receitas-prontas.json` with exactly this content:

```json
{
  "categorias": [
    { "id": "bolos", "nome": "Bolos" },
    { "id": "docinhos", "nome": "Docinhos e trufas" },
    { "id": "tortas", "nome": "Tortas" },
    { "id": "salgados", "nome": "Salgados" }
  ],
  "receitas": [
    {
      "id": "bolo-de-cenoura",
      "nome": "Bolo de cenoura com cobertura de chocolate",
      "categoria": "bolos",
      "rendimento": 24,
      "unidadeRendimento": "fatias",
      "ingredientes": [
        { "secao": "Massa", "nome": "Óleo", "quantidade": "1 1/2", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Cenoura", "quantidade": "1080", "unidade": "g", "observacao": "9 cenouras médias, raladas" },
        { "secao": "Massa", "nome": "Ovos", "quantidade": "12", "unidade": "unidade" },
        { "secao": "Massa", "nome": "Açúcar", "quantidade": "6", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "7 1/2", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Fermento em pó", "quantidade": "3", "unidade": "colherSopa" },
        { "secao": "Cobertura", "nome": "Manteiga", "quantidade": "3", "unidade": "colherSopa" },
        { "secao": "Cobertura", "nome": "Chocolate em pó", "quantidade": "9", "unidade": "colherSopa" },
        { "secao": "Cobertura", "nome": "Açúcar", "quantidade": "3", "unidade": "xicara" },
        { "secao": "Cobertura", "nome": "Leite", "quantidade": "3", "unidade": "xicara" }
      ],
      "preparo": [
        "Bata no liquidificador a cenoura ralada, os ovos e o óleo — em 3 levas, se o copo for pequeno.",
        "Acrescente o açúcar e bata por mais 5 minutos.",
        "Transfira para uma tigela grande e misture a farinha de trigo.",
        "Junte o fermento, misturando devagar com uma colher, sem bater.",
        "Divida a massa em 3 formas médias untadas e enfarinhadas.",
        "Asse em forno preaquecido a 180°C por cerca de 40 minutos.",
        "Para a cobertura, leve ao fogo a manteiga, o chocolate em pó, o açúcar e o leite, mexendo até engrossar.",
        "Despeje a calda ainda quente sobre os bolos já assados.",
        "Depois de frio, corte cada bolo em 8 fatias."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/23-bolo-de-cenoura.html" }
    },
    {
      "id": "bolo-no-pote",
      "nome": "Bolo no pote (brigadeiro e beijinho)",
      "categoria": "bolos",
      "rendimento": 30,
      "unidadeRendimento": "potes",
      "ingredientes": [
        { "secao": "Massa", "nome": "Ovos", "quantidade": "6", "unidade": "unidade" },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "4 3/4", "unidade": "xicara", "observacao": "6 copos americanos" },
        { "secao": "Massa", "nome": "Açúcar", "quantidade": "3 1/4", "unidade": "xicara", "observacao": "4 copos americanos" },
        { "secao": "Massa", "nome": "Manteiga", "quantidade": "6", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Leite", "quantidade": "380", "unidade": "ml", "observacao": "2 copos americanos" },
        { "secao": "Massa", "nome": "Chocolate em pó", "quantidade": "6", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Fermento em pó", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Brigadeiro de colher", "nome": "Leite condensado", "quantidade": "2", "unidade": "unidade", "observacao": "latas de 395 g" },
        { "secao": "Brigadeiro de colher", "nome": "Manteiga", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Brigadeiro de colher", "nome": "Chocolate em pó", "quantidade": "6", "unidade": "colherSopa" },
        { "secao": "Brigadeiro de colher", "nome": "Creme de leite", "quantidade": "2", "unidade": "unidade", "observacao": "latas, sem soro" },
        { "secao": "Beijinho de colher", "nome": "Leite condensado", "quantidade": "2", "unidade": "unidade", "observacao": "latas de 395 g" },
        { "secao": "Beijinho de colher", "nome": "Manteiga", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Beijinho de colher", "nome": "Coco ralado", "quantidade": "100", "unidade": "g" },
        { "secao": "Beijinho de colher", "nome": "Creme de leite", "quantidade": "2", "unidade": "unidade", "observacao": "latas, sem soro" },
        { "secao": "Para montar", "nome": "Leite de coco", "quantidade": "200", "unidade": "ml", "observacao": "a gosto, para molhar o bolo" },
        { "secao": "Para montar", "nome": "Coco ralado", "quantidade": "50", "unidade": "g", "observacao": "a gosto, para polvilhar" },
        { "secao": "Para montar", "nome": "Granulado", "quantidade": "50", "unidade": "g", "observacao": "a gosto, para polvilhar" }
      ],
      "preparo": [
        "Bata na batedeira os ovos, o açúcar e a manteiga até formar um creme fofo.",
        "Acrescente o leite e a farinha, misture bem e junte o chocolate em pó.",
        "Adicione o fermento por último e misture.",
        "Divida em 2 formas retangulares untadas e enfarinhadas; asse em forno preaquecido a 180°C até um palito sair limpo.",
        "Deixe esfriar e corte os bolos ao meio, na horizontal.",
        "Para o brigadeiro de colher, leve ao fogo baixo o leite condensado, a manteiga e o chocolate em pó até desgrudar do fundo da panela; fora do fogo, misture o creme de leite.",
        "Para o beijinho de colher, faça o mesmo trocando o chocolate em pó pelo coco ralado.",
        "Corte o bolo em rodelas do tamanho do pote.",
        "Monte em camadas: recheio, rodela de bolo molhada com leite de coco, mais recheio e outra rodela; finalize com coco ralado ou granulado.",
        "Tampe e leve à geladeira até a hora de vender."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/177096-bolo-no-pote.html" }
    },
    {
      "id": "bolo-de-fuba-cremoso",
      "nome": "Bolo de fubá cremoso de liquidificador",
      "categoria": "bolos",
      "rendimento": 20,
      "unidadeRendimento": "fatias",
      "ingredientes": [
        { "nome": "Ovos", "quantidade": "4", "unidade": "unidade" },
        { "nome": "Leite", "quantidade": "4", "unidade": "xicara" },
        { "nome": "Açúcar", "quantidade": "3", "unidade": "xicara" },
        { "nome": "Farinha de trigo", "quantidade": "2", "unidade": "colherSopa" },
        { "nome": "Fubá", "quantidade": "1 1/2", "unidade": "xicara" },
        { "nome": "Margarina", "quantidade": "2", "unidade": "colherSopa" },
        { "nome": "Queijo ralado", "quantidade": "100", "unidade": "g" },
        { "nome": "Fermento em pó", "quantidade": "1", "unidade": "colherSopa" }
      ],
      "preparo": [
        "Bata todos os ingredientes no liquidificador até obter um creme homogêneo.",
        "Despeje numa forma grande untada e enfarinhada.",
        "Asse em forno preaquecido a 180°C por cerca de 40 minutos.",
        "Deixe esfriar antes de cortar em 20 fatias — é assim que a textura cremosa se mantém."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/3468-bolo-de-fuba-cremoso.html" }
    },
    {
      "id": "brigadeiro",
      "nome": "Brigadeiro tradicional",
      "categoria": "docinhos",
      "rendimento": 30,
      "unidadeRendimento": "docinhos",
      "ingredientes": [
        { "nome": "Leite condensado", "quantidade": "1", "unidade": "unidade", "observacao": "lata de 395 g" },
        { "nome": "Manteiga sem sal", "quantidade": "1", "unidade": "colherSopa" },
        { "nome": "Chocolate em pó", "quantidade": "4", "unidade": "colherSopa", "observacao": "ou 7 colheres de sopa de achocolatado" },
        { "nome": "Granulado", "quantidade": "100", "unidade": "g", "observacao": "para cobrir" }
      ],
      "preparo": [
        "Coloque o leite condensado, a manteiga e o chocolate em pó numa panela funda.",
        "Leve ao fogo médio, mexendo sem parar, até a massa soltar do fundo da panela.",
        "Deixe esfriar, enrole bolinhas com as mãos untadas e passe no granulado."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/114-brigadeiro.html" }
    },
    {
      "id": "beijinho",
      "nome": "Beijinho de coco",
      "categoria": "docinhos",
      "rendimento": 25,
      "unidadeRendimento": "docinhos",
      "ingredientes": [
        { "nome": "Leite condensado", "quantidade": "1", "unidade": "unidade", "observacao": "lata de 395 g" },
        { "nome": "Manteiga", "quantidade": "1", "unidade": "colherSopa" },
        { "nome": "Coco ralado", "quantidade": "150", "unidade": "g", "observacao": "fresco e fino" },
        { "nome": "Açúcar cristal", "quantidade": "50", "unidade": "g", "observacao": "para enrolar" },
        { "nome": "Cravo", "quantidade": "2", "unidade": "g", "observacao": "cerca de 25 cravos, opcional, para decorar" }
      ],
      "preparo": [
        "Misture numa panela o leite condensado, a manteiga e o coco ralado.",
        "Leve ao fogo, mexendo por cerca de 15 minutos, até a massa desgrudar do fundo.",
        "Deixe amornar.",
        "Enrole bolinhas, passe no açúcar cristal (ou no coco ralado) e finalize com um cravo, se quiser."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/1252-beijinho.html" }
    },
    {
      "id": "trufas-de-chocolate",
      "nome": "Trufas de chocolate",
      "categoria": "docinhos",
      "rendimento": 25,
      "unidadeRendimento": "trufas",
      "ingredientes": [
        { "nome": "Chocolate meio amargo", "quantidade": "250", "unidade": "g" },
        { "nome": "Chocolate ao leite", "quantidade": "100", "unidade": "g" },
        { "nome": "Creme de leite", "quantidade": "1/2", "unidade": "unidade", "observacao": "meia caixinha (100 g)" },
        { "nome": "Margarina", "quantidade": "1/2", "unidade": "colherSopa", "observacao": "rasa" },
        { "nome": "Mel", "quantidade": "1/2", "unidade": "colherSopa" },
        { "nome": "Chocolate em pó", "quantidade": "30", "unidade": "g", "observacao": "para finalizar" }
      ],
      "preparo": [
        "Derreta os dois chocolates no micro-ondas, em etapas curtas, mexendo entre elas.",
        "Misture a margarina, o creme de leite e o mel.",
        "Leve à geladeira até a massa firmar.",
        "Modele as trufas — dá para rechear com pedaços de cereja, coco ou nozes.",
        "Passe no chocolate em pó, se quiser, e coloque em forminhas de papel."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/1380-trufas.html" }
    },
    {
      "id": "palha-italiana",
      "nome": "Palha italiana",
      "categoria": "docinhos",
      "rendimento": 30,
      "unidadeRendimento": "pedaços",
      "ingredientes": [
        { "nome": "Leite condensado", "quantidade": "1", "unidade": "unidade", "observacao": "lata de 395 g" },
        { "nome": "Chocolate em pó", "quantidade": "8", "unidade": "colherSopa" },
        { "nome": "Margarina", "quantidade": "1/2", "unidade": "colherSopa" },
        { "nome": "Biscoito maisena", "quantidade": "1", "unidade": "unidade", "observacao": "pacote de 200 g" },
        { "nome": "Açúcar de confeiteiro", "quantidade": "30", "unidade": "g", "observacao": "opcional, para passar" }
      ],
      "preparo": [
        "Quebre o biscoito maisena em pedaços pequenos e reserve.",
        "Prepare um brigadeiro com o leite condensado, a margarina e o chocolate em pó.",
        "Quando o brigadeiro começar a soltar do fundo da panela, misture o biscoito e desligue o fogo.",
        "Espalhe a massa ainda quente numa superfície untada, nivelando com as mãos.",
        "Deixe esfriar por completo e corte em 30 quadrados; passe no açúcar de confeiteiro para não grudarem, se quiser."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/499-palha-italiana.html" }
    },
    {
      "id": "cajuzinho",
      "nome": "Cajuzinho",
      "categoria": "docinhos",
      "rendimento": 30,
      "unidadeRendimento": "cajuzinhos",
      "ingredientes": [
        { "secao": "Massa", "nome": "Amendoim", "quantidade": "150", "unidade": "g", "observacao": "torrado, sem pele e moído" },
        { "secao": "Massa", "nome": "Açúcar", "quantidade": "1", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Leite condensado", "quantidade": "1/2", "unidade": "unidade", "observacao": "meia lata" },
        { "secao": "Massa", "nome": "Chocolate em pó", "quantidade": "2", "unidade": "colherSopa", "observacao": "bem cheias" },
        { "secao": "Para finalizar", "nome": "Açúcar", "quantidade": "50", "unidade": "g", "observacao": "para enrolar" },
        { "secao": "Para finalizar", "nome": "Amendoim", "quantidade": "15", "unidade": "g", "observacao": "metades, para a ponta" }
      ],
      "preparo": [
        "Misture os ingredientes da massa numa tigela até ficar homogênea.",
        "Divida em 30 porções e modele em formato de cajuzinho, com uma ponta afinada.",
        "Passe no açúcar e decore a ponta com meio amendoim."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/12294-cajuzinho-facinho.html" }
    },
    {
      "id": "torta-de-frango",
      "nome": "Torta de frango de liquidificador",
      "categoria": "tortas",
      "rendimento": 30,
      "unidadeRendimento": "fatias",
      "ingredientes": [
        { "secao": "Recheio", "nome": "Peito de frango", "quantidade": "1000", "unidade": "g", "observacao": "sem pele" },
        { "secao": "Recheio", "nome": "Água", "quantidade": "1000", "unidade": "ml", "semCusto": true, "observacao": "para cozinhar o frango" },
        { "secao": "Recheio", "nome": "Caldo de galinha", "quantidade": "2", "unidade": "unidade", "observacao": "tabletes" },
        { "secao": "Recheio", "nome": "Óleo", "quantidade": "8", "unidade": "colherSopa" },
        { "secao": "Recheio", "nome": "Alho", "quantidade": "10", "unidade": "g", "observacao": "2 dentes, amassados" },
        { "secao": "Recheio", "nome": "Cebola", "quantidade": "260", "unidade": "g", "observacao": "2 cebolas médias, picadas" },
        { "secao": "Recheio", "nome": "Tomate", "quantidade": "600", "unidade": "g", "observacao": "6 tomates, sem pele e sem sementes" },
        { "secao": "Recheio", "nome": "Ervilha", "quantidade": "2", "unidade": "xicara" },
        { "secao": "Recheio", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Pimenta-do-reino", "quantidade": "1/2", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Massa", "nome": "Leite", "quantidade": "500", "unidade": "ml" },
        { "secao": "Massa", "nome": "Óleo", "quantidade": "1 1/2", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Ovos", "quantidade": "4", "unidade": "unidade" },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "3", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Massa", "nome": "Fermento em pó", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Queijo ralado", "quantidade": "50", "unidade": "g", "observacao": "para salpicar" }
      ],
      "preparo": [
        "Cozinhe o peito de frango na água com o caldo de galinha até ficar macio; reserve 2 xícaras do caldo.",
        "Refogue no óleo o alho, a cebola e o tomate; acrescente a ervilha por último.",
        "Desfie o frango, junte ao refogado com o caldo reservado e cozinhe até secar; tempere com sal e pimenta.",
        "Bata no liquidificador o leite, o óleo e os ovos em velocidade baixa.",
        "Acrescente aos poucos a farinha, o sal e o fermento.",
        "Em 2 formas untadas, despeje metade da massa, cubra com o recheio e finalize com o restante da massa.",
        "Salpique queijo ralado e asse em forno preaquecido a 180°C até dourar.",
        "Corte cada torta em 15 fatias."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/1282-torta-de-frango.html" }
    },
    {
      "id": "torta-de-limao",
      "nome": "Torta de limão com suspiro",
      "categoria": "tortas",
      "rendimento": 30,
      "unidadeRendimento": "fatias",
      "ingredientes": [
        { "secao": "Massa", "nome": "Biscoito maisena", "quantidade": "2", "unidade": "unidade", "observacao": "pacotes de 200 g" },
        { "secao": "Massa", "nome": "Margarina", "quantidade": "300", "unidade": "g" },
        { "secao": "Recheio", "nome": "Leite condensado", "quantidade": "2", "unidade": "unidade", "observacao": "latas de 395 g" },
        { "secao": "Recheio", "nome": "Creme de leite", "quantidade": "2", "unidade": "unidade", "observacao": "caixinhas de 200 g" },
        { "secao": "Recheio", "nome": "Limão", "quantidade": "800", "unidade": "g", "observacao": "8 limões: suco de todos e raspas de 4" },
        { "secao": "Cobertura", "nome": "Ovos", "quantidade": "8", "unidade": "unidade", "observacao": "só as claras (6 a 8)" },
        { "secao": "Cobertura", "nome": "Açúcar", "quantidade": "6", "unidade": "colherSopa" }
      ],
      "preparo": [
        "Triture o biscoito maisena e misture com a margarina até formar uma farofa.",
        "Forre o fundo e as laterais de 2 formas de fundo removível com essa farofa.",
        "Asse em forno preaquecido a 180°C por cerca de 10 minutos.",
        "Bata no liquidificador o leite condensado, o creme de leite, o suco e metade das raspas até formar um creme firme.",
        "Despeje sobre as massas assadas e leve à geladeira por 30 minutos.",
        "Bata as claras em neve e acrescente o açúcar até formar um suspiro firme.",
        "Cubra as tortas com o suspiro e leve ao forno só até dourar por cima.",
        "Finalize com o restante das raspas e corte cada torta em 15 fatias."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/104383-torta-de-limao.html" }
    },
    {
      "id": "coxinha-de-frango",
      "nome": "Coxinha de frango",
      "categoria": "salgados",
      "rendimento": 25,
      "unidadeRendimento": "coxinhas",
      "ingredientes": [
        { "secao": "Massa", "nome": "Água", "quantidade": "1000", "unidade": "ml", "semCusto": true, "observacao": "de preferência a do cozimento do frango" },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "500", "unidade": "g", "observacao": "peneirada" },
        { "secao": "Massa", "nome": "Caldo de galinha", "quantidade": "1", "unidade": "unidade", "observacao": "tablete ou sachê" },
        { "secao": "Massa", "nome": "Margarina", "quantidade": "1/2", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1/2", "unidade": "colherSopa", "observacao": "rasa" },
        { "secao": "Massa", "nome": "Colorau", "quantidade": "1/2", "unidade": "colherSopa" },
        { "secao": "Recheio", "nome": "Peito de frango", "quantidade": "500", "unidade": "g" },
        { "secao": "Recheio", "nome": "Cebola", "quantidade": "130", "unidade": "g", "observacao": "1 média, picada" },
        { "secao": "Recheio", "nome": "Alho", "quantidade": "5", "unidade": "g", "observacao": "1 dente, amassado" },
        { "secao": "Recheio", "nome": "Pimenta dedo-de-moça", "quantidade": "10", "unidade": "g", "observacao": "1 pequena, picada, a gosto" },
        { "secao": "Recheio", "nome": "Salsinha", "quantidade": "1/2", "unidade": "xicara", "observacao": "picada" },
        { "secao": "Recheio", "nome": "Óleo", "quantidade": "2", "unidade": "colherSopa", "observacao": "para refogar" },
        { "secao": "Recheio", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Colorau", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Para empanar", "nome": "Ovos", "quantidade": "1", "unidade": "unidade", "observacao": "só a clara" },
        { "secao": "Para empanar", "nome": "Água", "quantidade": "500", "unidade": "ml", "semCusto": true },
        { "secao": "Para empanar", "nome": "Sal", "quantidade": "1/4", "unidade": "colherCha", "observacao": "1 pitada" },
        { "secao": "Para empanar", "nome": "Farinha de trigo", "quantidade": "1", "unidade": "xicara" },
        { "secao": "Para empanar", "nome": "Farinha de rosca", "quantidade": "1000", "unidade": "g" },
        { "secao": "Para fritar", "nome": "Óleo", "quantidade": "500", "unidade": "ml", "observacao": "gasto por leva, em panela com ~1 L; o óleo pode ser reaproveitado" }
      ],
      "preparo": [
        "Cozinhe o peito de frango em água com um pouco de sal; desfie o frango e guarde a água do cozimento.",
        "Leve ao fogo a água com o caldo de galinha, a margarina, o sal e o colorau até ferver.",
        "Acrescente a farinha peneirada de uma vez e mexa sem parar até a massa soltar do fundo da panela.",
        "Coloque a massa numa superfície untada e sove até esfriar, para não formar casca.",
        "Para o recheio, refogue no óleo o alho, a pimenta e a cebola até dourar; junte o frango e tempere com sal e colorau.",
        "Desligue o fogo, misture a salsinha e deixe esfriar.",
        "Com as mãos untadas, faça 25 bolinhas de massa, abra uma cavidade, recheie e feche puxando a ponta da coxinha.",
        "Bata a água, a clara, o sal e a farinha de trigo até formar um creme ralo; passe cada coxinha nesse creme e depois na farinha de rosca. Repita para uma casca mais crocante.",
        "Frite em óleo quente (cerca de 180°C, medido com termômetro de cozinha) até dourar; escorra em papel-toalha."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/3798-coxinha-de-frango.html" }
    },
    {
      "id": "massa-de-risoles",
      "nome": "Risoles (massa para rechear a gosto)",
      "categoria": "salgados",
      "rendimento": 20,
      "unidadeRendimento": "risoles",
      "ingredientes": [
        { "secao": "Massa", "nome": "Leite", "quantidade": "380", "unidade": "ml", "observacao": "2 copos americanos" },
        { "secao": "Massa", "nome": "Manteiga", "quantidade": "1", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1", "unidade": "colherCha" },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "1 2/3", "unidade": "xicara", "observacao": "2 copos americanos" },
        { "secao": "Para empanar", "nome": "Ovos", "quantidade": "1", "unidade": "unidade", "observacao": "batido" },
        { "secao": "Para empanar", "nome": "Farinha de rosca", "quantidade": "200", "unidade": "g" },
        { "secao": "Para fritar", "nome": "Óleo", "quantidade": "500", "unidade": "ml", "observacao": "gasto por leva, em panela com ~1 L; o óleo pode ser reaproveitado" }
      ],
      "preparo": [
        "Ferva o leite com a manteiga e o sal.",
        "Ao levantar fervura, acrescente toda a farinha de uma vez e mexa até formar uma massa lisa.",
        "Numa superfície enfarinhada, abra porções da massa, corte 20 círculos com a borda de um copo e recheie a gosto (frango, presunto e queijo, palmito…).",
        "Feche bem as bordas, passe no ovo batido e depois na farinha de rosca.",
        "Frite em óleo quente (cerca de 180°C) até dourar; escorra em papel-toalha."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/712-risolis.html" }
    },
    {
      "id": "empada-de-frango",
      "nome": "Empada de frango",
      "categoria": "salgados",
      "rendimento": 28,
      "unidadeRendimento": "empadinhas",
      "ingredientes": [
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "8", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Ovos", "quantidade": "4", "unidade": "unidade", "observacao": "2 inteiros + 2 gemas" },
        { "secao": "Massa", "nome": "Manteiga", "quantidade": "8", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Gordura vegetal", "quantidade": "2", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Peito de frango", "quantidade": "1000", "unidade": "g", "observacao": "cozido e desfiado" },
        { "secao": "Recheio", "nome": "Tomate", "quantidade": "600", "unidade": "g", "observacao": "4 grandes, picados" },
        { "secao": "Recheio", "nome": "Cebola", "quantidade": "260", "unidade": "g", "observacao": "2 médias, picadas" },
        { "secao": "Recheio", "nome": "Alho", "quantidade": "20", "unidade": "g", "observacao": "4 dentes, picados" },
        { "secao": "Recheio", "nome": "Pimentão", "quantidade": "20", "unidade": "g", "observacao": "picado" },
        { "secao": "Recheio", "nome": "Azeite", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Recheio", "nome": "Ervilha", "quantidade": "2", "unidade": "unidade", "observacao": "latas" },
        { "secao": "Recheio", "nome": "Leite", "quantidade": "500", "unidade": "ml" },
        { "secao": "Recheio", "nome": "Farinha de trigo", "quantidade": "3", "unidade": "colherSopa" },
        { "secao": "Recheio", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Salsinha", "quantidade": "2", "unidade": "colherSopa", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Azeitona", "quantidade": "120", "unidade": "g", "observacao": "28 azeitonas verdes sem caroço" },
        { "secao": "Para pincelar", "nome": "Ovos", "quantidade": "4", "unidade": "unidade", "observacao": "só as gemas" }
      ],
      "preparo": [
        "Misture os ingredientes da massa numa tigela até ficar homogênea (mais farinha se grudar, mais manteiga se ressecar).",
        "Embrulhe em filme plástico e deixe descansar enquanto prepara o recheio.",
        "Refogue no azeite a cebola, o alho, o tomate e o pimentão; acrescente o frango e refogue mais um pouco.",
        "Junte a farinha de trigo e, em seguida, o leite de uma vez, mexendo rápido para não empelotar.",
        "Acrescente a ervilha, tempere com sal e salsinha, deixe engrossar e desligue o fogo.",
        "Deixe o recheio esfriar por completo — recheio quente deixa a massa crua por dentro.",
        "Forre 28 forminhas com a massa, sem deixá-la grossa, reservando um pouco para as tampinhas.",
        "Abra o restante da massa entre dois plásticos e corte rodelas um pouco maiores que a forminha.",
        "Recheie cada forminha, coloque uma azeitona, tampe com a rodela e aperte bem as bordas.",
        "Pincele com gema batida e asse em forno preaquecido a 180°C por cerca de 20 minutos, até dourar."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/56217-empada-de-frango.html" }
    },
    {
      "id": "pao-de-queijo-3-ingredientes",
      "nome": "Pão de queijo de 3 ingredientes",
      "categoria": "salgados",
      "rendimento": 25,
      "unidadeRendimento": "pães de queijo",
      "ingredientes": [
        { "nome": "Creme de leite", "quantidade": "1", "unidade": "unidade", "observacao": "caixinha de 200 g" },
        { "nome": "Queijo ralado", "quantidade": "100", "unidade": "g", "observacao": "1 copo de requeijão" },
        { "nome": "Polvilho azedo", "quantidade": "150", "unidade": "g", "observacao": "1 copo de requeijão — mais um pouco se precisar" },
        { "nome": "Sal", "quantidade": "1/4", "unidade": "colherCha", "observacao": "1 pitada, a gosto" }
      ],
      "preparo": [
        "Misture o creme de leite, o queijo ralado, o polvilho e o sal; prove e ajuste o sal.",
        "Amasse até a massa soltar das mãos (acrescente um pouco mais de polvilho se precisar).",
        "Modele 25 bolinhas e coloque numa forma untada.",
        "Asse em forno preaquecido a 200°C até dourarem levemente."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/79996-pao-de-queijo-3-ingredientes.html" }
    },
    {
      "id": "esfiha-de-carne",
      "nome": "Esfiha de carne",
      "categoria": "salgados",
      "rendimento": 30,
      "unidadeRendimento": "esfihas",
      "ingredientes": [
        { "secao": "Massa", "nome": "Fermento biológico seco", "quantidade": "1", "unidade": "colherSopa", "observacao": "bem cheia" },
        { "secao": "Massa", "nome": "Açúcar", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1/2", "unidade": "colherCha" },
        { "secao": "Massa", "nome": "Leite", "quantidade": "100", "unidade": "ml", "observacao": "morno" },
        { "secao": "Massa", "nome": "Água", "quantidade": "200", "unidade": "ml", "semCusto": true, "observacao": "morna" },
        { "secao": "Massa", "nome": "Ovos", "quantidade": "1", "unidade": "unidade" },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "700", "unidade": "g", "observacao": "650 a 700 g" },
        { "secao": "Massa", "nome": "Óleo", "quantidade": "100", "unidade": "ml" },
        { "secao": "Recheio", "nome": "Carne moída", "quantidade": "500", "unidade": "g", "observacao": "magra" },
        { "secao": "Recheio", "nome": "Tomate", "quantidade": "300", "unidade": "g", "observacao": "3 tomates, picados" },
        { "secao": "Recheio", "nome": "Cebola", "quantidade": "130", "unidade": "g", "observacao": "1 média, picada" },
        { "secao": "Recheio", "nome": "Alho", "quantidade": "5", "unidade": "g", "observacao": "1 dente, opcional" },
        { "secao": "Recheio", "nome": "Azeitona", "quantidade": "1/2", "unidade": "xicara", "observacao": "picada" },
        { "secao": "Recheio", "nome": "Noz-moscada", "quantidade": "1/2", "unidade": "colherCha", "observacao": "opcional" },
        { "secao": "Recheio", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Salsinha", "quantidade": "2", "unidade": "colherSopa", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Cebolinha", "quantidade": "2", "unidade": "colherSopa", "observacao": "a gosto" },
        { "secao": "Para finalizar", "nome": "Ovos", "quantidade": "1", "unidade": "unidade", "observacao": "só a gema" },
        { "secao": "Para finalizar", "nome": "Gergelim", "quantidade": "1", "unidade": "colherSopa", "observacao": "a gosto" }
      ],
      "preparo": [
        "Misture numa tigela grande o fermento, o açúcar, a água morna, o leite morno, o sal e o óleo.",
        "Acrescente metade da farinha, misture, junte o ovo e continue adicionando farinha até a massa não grudar nas mãos.",
        "Sove por cerca de 5 minutos, cubra e deixe crescer por 20 minutos em lugar morno.",
        "Para o recheio, refogue a carne moída com o alho e a cebola; junte o tomate, a azeitona e a noz-moscada e tempere com sal.",
        "Desligue o fogo, misture a salsinha e a cebolinha e deixe esfriar.",
        "Abra porções da massa com o rolo, corte 30 círculos e coloque uma colher de recheio no centro de cada um.",
        "Puxe as bordas para o centro formando um triângulo e aperte bem para não abrir no forno.",
        "Arrume numa forma untada, pincele com gema batida e salpique gergelim.",
        "Asse em forno preaquecido a 150°C por 20 minutos e depois a 180°C por mais 10 minutos, até dourar."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/47884-esfiha-de-carne-adaptada-receita-turca.html" }
    },
    {
      "id": "enroladinho-de-salsicha",
      "nome": "Enroladinho de salsicha",
      "categoria": "salgados",
      "rendimento": 30,
      "unidadeRendimento": "enroladinhos",
      "ingredientes": [
        { "secao": "Massa", "nome": "Água", "quantidade": "3", "unidade": "xicara", "semCusto": true },
        { "secao": "Massa", "nome": "Farinha de trigo", "quantidade": "2 1/2", "unidade": "xicara" },
        { "secao": "Massa", "nome": "Óleo", "quantidade": "2", "unidade": "colherSopa" },
        { "secao": "Massa", "nome": "Tempero pronto", "quantidade": "1", "unidade": "unidade", "observacao": "sachê" },
        { "secao": "Massa", "nome": "Sal", "quantidade": "1", "unidade": "colherCha", "observacao": "a gosto" },
        { "secao": "Recheio", "nome": "Salsicha", "quantidade": "1000", "unidade": "g", "observacao": "cerca de 15 salsichas, cortadas ao meio" },
        { "secao": "Para empanar", "nome": "Farinha de rosca", "quantidade": "200", "unidade": "g" },
        { "secao": "Para fritar", "nome": "Óleo", "quantidade": "500", "unidade": "ml", "observacao": "gasto por leva, em panela com ~1 L; o óleo pode ser reaproveitado" }
      ],
      "preparo": [
        "Misture numa panela a água, a farinha, o óleo, o tempero pronto e o sal e leve ao fogo.",
        "Mexa bastante até a massa desgrudar do fundo; retire do fogo e deixe amornar.",
        "Corte as salsichas ao meio.",
        "Com as mãos untadas de óleo, envolva cada metade de salsicha com a massa.",
        "Passe na farinha de rosca e frite em óleo limpo e quente (cerca de 180°C, medido com termômetro de cozinha) até dourar."
      ],
      "fonte": { "site": "TudoGostoso", "url": "https://www.tudogostoso.com.br/receita/14675-enroladinho-de-salsicha.html" }
    }
  ]
}
```

- [ ] **Step 5: Add** `'data/receitas-prontas.json',` to `PRECACHE` in `sw.js` (after `'data/taco.json',`) and bump `const CACHE = 'calculadora-app-v7';`.

- [ ] **Step 6: Run** `npm test` — Expected: all PASS (including the `ingredientes-sugeridos` tests: no duplicate inside a category).

- [ ] **Step 7: Commit**

```bash
git add data/receitas-prontas.json js/ingredientes-sugeridos.js js/receitas-prontas.test.js sw.js
git commit -m "Ready-made recipes content: 16 recipes for 20-30 units, app units, frying oil"
```

---

### Task 6: Tela inicial com abas + catálogo

**Files:**
- Create: `js/screens/home-header.js`, `js/screens/prontas.js`
- Modify: `js/screens/lista.js`, `js/app.js`, `css/styles.css`, `sw.js`, `scripts/smoke/10-pwa.mjs`, `scripts/smoke/12-instalar.mjs`

**Interfaces:**
- Consumes: `getReceitasProntas` (Task 4), `rendeTexto`, `contarIngredientes` (Task 4), rotas (Task 1).
- Produces: `homeHeaderHtml(ativa: 'minhas'|'prontas')`; `renderProntas(view) → { update(route), destroy() }`. Abas: botões `data-home-tab="minhas|prontas"`, `aria-current="page"` na ativa. Cartão do catálogo: `button.pronta-card[data-pronta="<id>"]`.

**UX decisions (from the spec, made concrete):**
- Home tabs are navigation between two screens, so they use `aria-current="page"` (not `role="tab"`). "Receitas prontas" **pushes** `#/prontas` (phone back returns to Minhas receitas); "Minhas receitas" from the catalog calls `goBack({ screen: 'lista' })` (no duplicate history entry).
- The header title becomes **Doce Lucro** in both tabs, so switching tabs does not move the page.
- Empty "Minhas receitas": the main CTA stays; below it a lighter `btn-link` "📖 Ou comece por uma receita pronta" (one primary action per screen).
- Catalog: search + category chips; "Todas" without search shows recipes **grouped by category** (section title + count), filtered views show a flat list. Card = whole-card button with name, "Rende 30 docinhos · 4 ingredientes" and a `›` affordance.

- [ ] **Step 1: Create** `js/screens/home-header.js`:

```js
// js/screens/home-header.js — title and the Minhas receitas / Receitas
// prontas switch shared by both home screens. The tabs switch screens
// (routes), so they are links in spirit: aria-current, not role="tab".

import { html } from '../ui/dom.js';

export function homeHeaderHtml(ativa) {
  const tab = (id, label) => html`<button type="button" class="tab" data-home-tab="${id}" aria-current="${ativa === id ? 'page' : 'false'}">${label}</button>`;
  return html`
    <div class="sticky-head">
      <header class="topbar">
        <h1>Doce Lucro</h1>
        <button type="button" class="icon-btn outlined" data-action="ajustes" aria-label="Ajustes e backup">⚙️</button>
        <button type="button" class="icon-btn outlined" data-action="tema" aria-label="Alternar tema claro/escuro"><span data-theme-icon aria-hidden="true">🌙</span></button>
      </header>
      <nav class="tabs" aria-label="Receitas">
        ${tab('minhas', 'Minhas receitas')}
        ${tab('prontas', 'Receitas prontas')}
      </nav>
    </div>`;
}
```

- [ ] **Step 2: Modify** `js/screens/lista.js`:
  - Import: `import { homeHeaderHtml } from './home-header.js';`
  - Replace the `<div class="sticky-head">…</div>` block at the top of `setHtml(view, html\`…\`)` with `${homeHeaderHtml('minhas')}`.
  - In the empty state, after the "Criar minha primeira receita" button, add:
    ```js
          <button type="button" class="btn-link" data-home-tab="prontas" style="margin-top:8px">📖 Ou comece por uma receita pronta</button>
    ```
  - In the click handler, widen the selector and handle the tab:
    ```js
    const target = e.target.closest('[data-action], [data-open], [data-menu], [data-home-tab]');
    if (!target) return;
    if (target.dataset.homeTab === 'prontas') navigate({ screen: 'prontas' });
    else if (target.dataset.homeTab) return; // already on Minhas receitas
    else if (target.dataset.open) …(rest unchanged)
    ```

- [ ] **Step 3: Create** `js/screens/prontas.js`:

```js
// js/screens/prontas.js — "Receitas prontas": search, category chips and
// cards. Loaded on demand (data/receitas-prontas.json).

import { getReceitasProntas } from '../receitas-prontas-loader.js';
import { rendeTexto, contarIngredientes } from '../receitas-prontas.js';
import { normalize } from '../text-utils.js';
import { html, setHtml } from '../ui/dom.js';
import { navigate, goBack } from '../router.js';
import { toggleTheme, syncThemeUi } from '../theme.js';
import { homeHeaderHtml } from './home-header.js';

const TODAS = 'todas';

function cardHtml(r) {
  return html`
    <button type="button" class="card pronta-card" data-pronta="${r.id}">
      <span class="recipe-card-name">${r.nome}</span>
      <span class="muted">${rendeTexto(r)} · ${contarIngredientes(r)} ingredientes</span>
      <span class="pronta-card-seta" aria-hidden="true">›</span>
    </button>`;
}

export function renderProntas(view) {
  const events = new AbortController();
  let catalogo = null;
  let query = '';
  let categoria = TODAS;

  setHtml(view, html`
    ${homeHeaderHtml('prontas')}
    <div data-slot="filtros"></div>
    <div data-slot="lista"></div>`);
  syncThemeUi();
  const filtrosSlot = view.querySelector('[data-slot="filtros"]');
  const listaSlot = view.querySelector('[data-slot="lista"]');

  function mensagem(texto) {
    return html`<p class="muted" style="text-align:center;padding:16px">${texto}</p>`;
  }

  function renderFiltros() {
    const usadas = new Set(catalogo.receitas.map((r) => r.categoria));
    const cats = catalogo.categorias.filter((c) => usadas.has(c.id));
    setHtml(filtrosSlot, html`
      <label class="visually-hidden" for="busca-prontas">Buscar receita pronta</label>
      <input id="busca-prontas" class="input search" type="search" placeholder="🔍 Buscar receita pronta" enterkeyhint="search" autocomplete="off">
      <div class="chips prontas-chips" role="group" aria-label="Categorias">
        <button type="button" class="chip" data-categoria="${TODAS}" aria-pressed="true">Todas</button>
        ${cats.map((c) => html`<button type="button" class="chip" data-categoria="${c.id}" aria-pressed="false">${c.nome}</button>`)}
      </div>`);
    filtrosSlot.querySelector('input').addEventListener('input', (e) => { query = e.target.value; renderLista(); }, { signal: events.signal });
  }

  function renderLista() {
    if (catalogo.receitas.length === 0) {
      setHtml(listaSlot, mensagem('Em breve: receitas prontas para você usar.'));
      return;
    }
    const q = normalize(query);
    const visiveis = catalogo.receitas.filter((r) =>
      (categoria === TODAS || r.categoria === categoria) && (!q || normalize(r.nome).includes(q)));
    if (visiveis.length === 0) {
      setHtml(listaSlot, mensagem(`Nenhuma receita com "${query}".`));
      return;
    }
    if (categoria === TODAS && !q) {
      setHtml(listaSlot, html`${catalogo.categorias.map((c) => {
        const daCategoria = visiveis.filter((r) => r.categoria === c.id);
        if (daCategoria.length === 0) return '';
        return html`
          <h2 class="section-title"><span>${c.nome}</span><span class="muted">${daCategoria.length}</span></h2>
          <div class="stack">${daCategoria.map(cardHtml)}</div>`;
      })}`);
      return;
    }
    setHtml(listaSlot, html`<div class="stack prontas-filtradas">${visiveis.map(cardHtml)}</div>`);
  }

  function carregar() {
    setHtml(listaSlot, mensagem('Carregando receitas…'));
    getReceitasProntas()
      .then((data) => {
        if (events.signal.aborted) return;
        catalogo = data;
        renderFiltros();
        renderLista();
      })
      .catch(() => {
        if (events.signal.aborted) return;
        setHtml(listaSlot, html`
          <div class="card empty">
            <p>Não foi possível carregar as receitas prontas — verifique sua conexão.</p>
            <button type="button" class="btn btn-secondary" data-action="tentar">Tentar de novo</button>
          </div>`);
      });
  }

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-home-tab], [data-action], [data-categoria], [data-pronta]');
    if (!target) return;
    if (target.dataset.homeTab === 'minhas') goBack({ screen: 'lista' });
    else if (target.dataset.pronta) navigate({ screen: 'pronta', prontaId: target.dataset.pronta });
    else if (target.dataset.categoria) {
      categoria = target.dataset.categoria;
      for (const chip of filtrosSlot.querySelectorAll('[data-categoria]')) {
        chip.setAttribute('aria-pressed', String(chip.dataset.categoria === categoria));
      }
      renderLista();
    } else if (target.dataset.action === 'ajustes') navigate({ screen: 'lista', sheet: 'ajustes' });
    else if (target.dataset.action === 'tema') toggleTheme();
    else if (target.dataset.action === 'tentar') carregar();
  }, { signal: events.signal });

  carregar();

  return {
    update() {},
    destroy() { events.abort(); }
  };
}
```

- [ ] **Step 4: Modify** `js/app.js`:
  - Import: `import { renderProntas } from './screens/prontas.js';` (the detail screen `pronta` is wired in Task 7; until then `#/prontas/<id>` falls through to the list).
  - In `onRoute`, replace the final `else` branch with:
    ```js
      } else if (route.screen === 'prontas') {
        current = { ...renderProntas(view), screen: 'prontas' };
      } else {
        current = { ...renderLista(view), screen: 'lista' };
      }
    ```

- [ ] **Step 5: CSS** — in `css/styles.css`:
  - Change the selected-tab rule to also style the home tabs:
    ```css
    .tab[aria-selected="true"], .tab[aria-current="page"] { background: var(--color-tab-selected); box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); font-weight: 800; }
    ```
  - After the `.recipe-card …` rules, add:
    ```css
    /* ---------- Receitas prontas ---------- */
    .prontas-chips { margin-bottom: 4px; }
    .pronta-card {
      position: relative; display: grid; gap: 4px; text-align: left;
      padding: 12px 40px 12px 14px;
    }
    .pronta-card-seta {
      position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
      font-size: 1.5rem; color: var(--color-text-muted);
    }
    .prontas-filtradas { margin-top: 12px; }
    ```
- [ ] **Step 6: sw.js** — add `'js/screens/home-header.js',` and `'js/screens/prontas.js',` to `PRECACHE` (alphabetical in the `js/screens/` group).

- [ ] **Step 7: Update smoke** — in `scripts/smoke/10-pwa.mjs` and `scripts/smoke/12-instalar.mjs` replace `getByRole('heading', { name: 'Minhas Receitas' })` with `getByRole('heading', { name: 'Doce Lucro' })` (3 occurrences).

- [ ] **Step 8: Run** `npm test` and `npm run test:mobile` — Expected: all PASS / "tudo ok".

- [ ] **Step 9: Commit**

```bash
git add js/screens/home-header.js js/screens/prontas.js js/screens/lista.js js/app.js css/styles.css sw.js scripts/smoke/10-pwa.mjs scripts/smoke/12-instalar.mjs
git commit -m "Home tabs (Minhas receitas / Receitas prontas) and the catalog screen"
```

---

### Task 7: Detalhe da receita pronta + "Usar esta receita"

**Files:**
- Create: `js/screens/pronta.js`
- Modify: `js/app.js`, `css/styles.css`, `sw.js`

**Interfaces:**
- Consumes: `getReceitasProntas`, `medidaTexto`, `rendeTexto`, `agruparPorSecao`, `criarReceitaDePronta` (Task 4); `getRecipes`, `saveRecipe`, `createEmptyRecipe`, `getCustomIngredients`, `getPreco` (`js/storage.js`); `getTacoIngredients` (`js/taco-loader.js`).
- Produces: `renderPronta(view, prontaId) → { update(route), destroy() }`. Botão `[data-action="usar"]` com texto "Usar esta receita".

**UX decisions:**
- Own screen (long text, read while cooking). Topbar: ← + recipe name as `h1` (wraps, never truncated).
- Under the title: category `.tag` + "Rende 30 docinhos".
- Ingredients card: per section a `.sheet-section` subtitle (same orange caps as the ingredient sheet); each line "**1 colher de sopa** de Manteiga" with the observation in muted text — quantity bold for scanning while cooking.
- Steps card: `.passos` numbered list with more spacing between steps.
- Fixed bottom `.action-bar` (same place/shape as the editor's result bar, light surface) with the single primary action. While copying: disabled + "Copiando…" (prevents double copies). After copying: toast "Receita copiada para Minhas receitas" and the editor opens (replace, so ← from the copy returns to the catalog, never to a detail that would copy again).

- [ ] **Step 1: Create** `js/screens/pronta.js`:

```js
// js/screens/pronta.js — one ready-made recipe: ingredients (by section),
// steps, and "Usar esta receita" (copies it into Minhas receitas).

import { getReceitasProntas } from '../receitas-prontas-loader.js';
import { medidaTexto, rendeTexto, agruparPorSecao, criarReceitaDePronta } from '../receitas-prontas.js';
import { getRecipes, saveRecipe, createEmptyRecipe, getCustomIngredients, getPreco } from '../storage.js';
import { getTacoIngredients } from '../taco-loader.js';
import { html, setHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { navigate, goBack } from '../router.js';

function corpoHtml(pronta, categoria) {
  return html`
    <p class="pronta-meta">${categoria ? html`<span class="tag">${categoria}</span>` : ''}<span class="muted">${rendeTexto(pronta)}</span></p>
    <h2 class="section-title"><span>Ingredientes</span></h2>
    <div class="card">
      ${agruparPorSecao(pronta.ingredientes).map((g) => html`
        ${g.secao ? html`<p class="sheet-section">${g.secao}</p>` : ''}
        <ul class="pronta-ings">
          ${g.itens.map((i) => html`<li><strong>${medidaTexto(i)}</strong> de ${i.nome}${i.observacao ? html`<span class="muted"> — ${i.observacao}</span>` : ''}</li>`)}
        </ul>`)}
    </div>
    <h2 class="section-title"><span>Modo de preparo</span></h2>
    <div class="card"><ol class="passos pronta-passos">${pronta.preparo.map((p) => html`<li>${p}</li>`)}</ol></div>
    <div class="action-bar">
      <button type="button" class="btn btn-primary btn-block" data-action="usar">Usar esta receita</button>
    </div>`;
}

export function renderPronta(view, prontaId) {
  const events = new AbortController();
  let pronta = null;
  let copiando = false;

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar para Receitas prontas">←</button>
        <h1 class="pronta-title" data-titulo>Receita pronta</h1>
      </header>
    </div>
    <div data-slot="corpo"><p class="muted" style="text-align:center;padding:16px">Carregando receita…</p></div>`);
  const titulo = view.querySelector('[data-titulo]');
  const corpo = view.querySelector('[data-slot="corpo"]');

  getReceitasProntas()
    .then((data) => {
      if (events.signal.aborted) return;
      pronta = data.receitas.find((r) => r.id === prontaId) || null;
      if (!pronta) {
        showToast('Receita não encontrada');
        navigate({ screen: 'prontas' }, { replace: true });
        return;
      }
      titulo.textContent = pronta.nome;
      setHtml(corpo, corpoHtml(pronta, data.categorias.find((c) => c.id === pronta.categoria)?.nome));
    })
    .catch(() => {
      if (events.signal.aborted) return;
      setHtml(corpo, html`<p class="muted" style="text-align:center;padding:16px">Não foi possível carregar a receita — verifique sua conexão.</p>`);
    });

  async function usar(botao) {
    if (copiando || !pronta) return;
    copiando = true;
    botao.disabled = true;
    botao.textContent = 'Copiando…';
    let taco = [];
    try { taco = await getTacoIngredients(); } catch { /* offline: copy without nutrition */ }
    if (events.signal.aborted) return;
    const receita = criarReceitaDePronta(pronta, {
      existentes: getRecipes(), custom: getCustomIngredients(), precoDe: getPreco, taco, base: createEmptyRecipe()
    });
    if (!saveRecipe(receita)) {
      showToast('Não foi possível salvar. Exporte um backup em Ajustes.');
      copiando = false;
      botao.disabled = false;
      botao.textContent = 'Usar esta receita';
      return;
    }
    navigator.storage?.persist?.().catch(() => {});
    showToast('Receita copiada para Minhas receitas');
    navigate({ screen: 'editor', recipeId: receita.id, aba: 'ingredientes' }, { replace: true });
  }

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'voltar') goBack({ screen: 'prontas' });
    else if (target.dataset.action === 'usar') usar(target);
  }, { signal: events.signal });

  return {
    update() {},
    destroy() { events.abort(); }
  };
}
```

- [ ] **Step 2: Modify** `js/app.js`:
  - `import { renderPronta } from './screens/pronta.js';`
  - `sameScreen`: also compare the ready-made recipe id:
    ```js
    return current && current.screen === route.screen &&
      (route.screen !== 'editor' || current.recipeId === route.recipeId) &&
      (route.screen !== 'pronta' || current.prontaId === route.prontaId);
    ```
  - In `onRoute`, before the `prontas` branch:
    ```js
      } else if (route.screen === 'pronta') {
        current = { ...renderPronta(view, route.prontaId), screen: 'pronta', prontaId: route.prontaId };
    ```

- [ ] **Step 3: CSS** — add to the "Receitas prontas" block in `css/styles.css`:

```css
.pronta-title { flex: 1; min-width: 0; font-size: 1.25rem; font-weight: 600; line-height: 1.25; overflow-wrap: anywhere; padding: 8px 0; }
.pronta-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 4px 2px 0; }
.pronta-ings { list-style: none; margin: 0; padding: 0; }
.pronta-ings li { padding: 8px 0; border-bottom: 1px solid var(--color-card-border); }
.pronta-ings li:last-child { border-bottom: 0; }
.card > .sheet-section:first-child { margin-top: 4px; }
.pronta-passos li + li { margin-top: 10px; }
.action-bar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 15;
  width: 100%; max-width: 480px; margin: 0 auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: var(--color-bg); box-shadow: 0 -4px 16px rgb(0 0 0 / 0.12);
}
```

- [ ] **Step 4: sw.js** — add `'js/screens/pronta.js',` to `PRECACHE`.

- [ ] **Step 5: Run** `npm test` — Expected: all PASS (sw.test sees the new module).

- [ ] **Step 6: Commit**

```bash
git add js/screens/pronta.js js/app.js css/styles.css sw.js
git commit -m "Ready-made recipe detail and 'Usar esta receita'"
```

---

### Task 8: Editor — seção Modo de preparo, painel, ingrediente sem custo

**Files:**
- Create: `js/screens/editor/preparo-sheet.js`
- Modify: `js/screens/editor/ingredientes.js`, `js/screens/editor/ingrediente-sheet.js`, `css/styles.css`, `sw.js`

**Interfaces:**
- Consumes: `textoParaPassos`, `passosParaTexto` (Task 2); `limparSemCustoAoRenomear` (Task 3); rota `item: 'preparo'` (Task 1); `openSheet` (`js/ui/sheet.js`, returns `{ close, requestClose }`).
- Produces: `openPreparoSheet({ store, onRequestClose, onClose }) → sheet`.

**UX decisions:**
- Section after "Ler nota de compra" / "Sua última compra": `h2.section-title` "Modo de preparo" + "Editar" link (only when there are steps). With steps: card with numbered `.passos`. Without: card "Ainda sem passo a passo." + secondary button "✏️ Escrever modo de preparo".
- Sheet: big textarea (one step per line), hint "A numeração é feita sozinha.", "Pronto". Saves while typing (autosave + "✓ Salvo"), so closing by back/backdrop never loses text.
- Sem custo row in the list: "sem custo" in muted text instead of "R$ 0,00"; in the ingredient sheet "Quanto pagou" is replaced by "💧 Não entra no custo."

- [ ] **Step 1: Create** `js/screens/editor/preparo-sheet.js`:

```js
// js/screens/editor/preparo-sheet.js — edit the recipe's steps as plain
// text, one per line. Saved while typing (store autosave).

import { textoParaPassos, passosParaTexto } from '../../preparo.js';
import { html, toElement } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';

export function openPreparoSheet({ store, onRequestClose, onClose }) {
  const content = toElement(html`
    <form novalidate>
      <h2 class="sheet-title">Modo de preparo</h2>
      <label class="field"><span class="field-label">Um passo por linha</span>
        <textarea class="input preparo-texto" name="preparo" rows="10" autocomplete="off"
          placeholder="Ex: Misture tudo numa panela.&#10;Mexa em fogo baixo até desgrudar.">${passosParaTexto(store.recipe.modoPreparo)}</textarea></label>
      <p class="field-hint">A numeração é feita sozinha.</p>
      <div class="sheet-actions">
        <button type="submit" class="btn btn-primary" style="flex:1">Pronto</button>
      </div>
    </form>`);
  const textarea = content.elements.preparo;

  textarea.addEventListener('input', () => {
    store.update((r) => { r.modoPreparo = textoParaPassos(textarea.value); });
  });
  content.addEventListener('submit', (e) => {
    e.preventDefault();
    sheet.requestClose();
  });

  const sheet = openSheet({
    title: 'Modo de preparo',
    content,
    onRequestClose,
    onClose: () => { store.flush(); onClose?.(); },
    initialFocus: 'textarea'
  });
  return sheet;
}
```

- [ ] **Step 2: Modify** `js/screens/editor/ingredientes.js`:
  - Import: `import { openPreparoSheet } from './preparo-sheet.js';`
  - In `rowHtml`, replace `<span class="text-cost">${custo != null ? formatBRL(custo) : '—'}</span>` with:
    ```js
          ${item.semCusto ? html`<span class="muted">sem custo</span>` : html`<span class="text-cost">${custo != null ? formatBRL(custo) : '—'}</span>`}
    ```
  - In the panel HTML, after `<div data-slot="compra"></div>` add:
    ```js
    <h2 class="section-title"><span>Modo de preparo</span><button type="button" class="btn-link" data-action="preparo" data-preparo-editar hidden>Editar</button></h2>
    <div data-slot="preparo"></div>
    ```
  - After `const compraSlot = …` add `const preparoSlot = panel.querySelector('[data-slot="preparo"]');` and `const preparoEditar = panel.querySelector('[data-preparo-editar]');`
  - Add, next to `renderCompra`:
    ```js
      function renderPreparo() {
        const passos = store.recipe.modoPreparo || [];
        preparoEditar.hidden = passos.length === 0;
        setHtml(preparoSlot, passos.length
          ? html`<div class="card"><ol class="passos">${passos.map((p) => html`<li>${p}</li>`)}</ol></div>`
          : html`<div class="card"><p class="muted">Ainda sem passo a passo.</p>
              <button type="button" class="btn btn-secondary btn-block" data-action="preparo" style="margin-top:8px">✏️ Escrever modo de preparo</button></div>`);
      }
    ```
    and call `renderPreparo();` at the end of `renderRows()`.
  - Click handler: add `else if (e.target.closest('[data-action="preparo"]')) navigate({ ...tabRoute, item: 'preparo' });`
  - In `update(route)`: change the validity check to `if (key !== 'novo' && key !== 'nota' && key !== 'preparo' && !store.recipe.ingredientes[key])` and the opener to:
    ```js
      const openFn = key === 'nota' ? openNotaSheet : key === 'preparo' ? openPreparoSheet : openIngredientSheet;
    ```
    (`openPreparoSheet` ignores `index`.)

- [ ] **Step 3: Modify** `js/screens/editor/ingrediente-sheet.js`:
  - Imports: add `limparSemCustoAoRenomear` to the `../../costing.js` import.
  - Wrap the payment part: replace `<p class="sheet-section">Quanto pagou</p>` with
    ```js
      <p class="muted sem-custo-nota" data-sem-custo hidden>💧 Não entra no custo.</p>
      <div data-pago>
      <p class="sheet-section">Quanto pagou</p>
    ```
    and close it right after the cost card: replace
    `<div class="card ing-cost"><span>Custo na receita</span><strong class="text-cost" data-custo></strong></div>` with
    ```js
      <div class="card ing-cost"><span>Custo na receita</span><strong class="text-cost" data-custo></strong></div>
      </div>
    ```
  - Add after `syncPriceFields`:
    ```js
      function syncSemCusto() {
        q('[data-pago]').hidden = !!item.semCusto;
        q('[data-sem-custo]').hidden = !item.semCusto;
      }
    ```
  - In the `f.nome` change handler, first line becomes `const anterior = item.nome;` and after `item.nome = nome;` add:
    ```js
        limparSemCustoAoRenomear(item, anterior);
        syncSemCusto();
    ```
  - Call `syncSemCusto();` right before `refreshDerived();` at the bottom.

- [ ] **Step 4: CSS** — add to `css/styles.css` (cards section):

```css
textarea.input { min-height: 220px; resize: vertical; line-height: 1.5; }
.sem-custo-nota { margin: 16px 0 8px; }
```

- [ ] **Step 5: sw.js** — add `'js/screens/editor/preparo-sheet.js',` to `PRECACHE`.

- [ ] **Step 6: Run** `npm test` and `npm run test:mobile` — Expected: all PASS / "tudo ok".

- [ ] **Step 7: Commit**

```bash
git add js/screens/editor/preparo-sheet.js js/screens/editor/ingredientes.js js/screens/editor/ingrediente-sheet.js css/styles.css sw.js
git commit -m "Editor: modo de preparo section and sheet; free ingredients shown as 'sem custo'"
```

---

### Task 9: Smoke de ponta a ponta, conferência visual e CLAUDE.md

**Files:**
- Create: `scripts/smoke/14-prontas.mjs`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write** `scripts/smoke/14-prontas.mjs`:

```js
// Ready-made recipes: home tabs, catalog (search, chips, groups), detail
// with sections, "Usar esta receita" (single copy, editor with steps and a
// free water row), editing the steps, back navigation, unknown id.

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal }) {
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: 'Doce Lucro' }).waitFor();

  // Empty Minhas receitas -> light link to the catalog.
  await page.getByRole('button', { name: /Ou comece por uma receita pronta/ }).click();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Receitas prontas' }).getAttribute('aria-current'), 'page');
  await page.getByText('Rende 30 docinhos · 4 ingredientes').waitFor();
  await semRolagemHorizontal();
  await shot('catalogo');

  // Search and category chips.
  await page.getByLabel('Buscar receita pronta').fill('coxinha');
  await page.getByRole('button', { name: /^Coxinha de frango/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Brigadeiro tradicional/ }).count(), 0);
  await page.getByLabel('Buscar receita pronta').fill('');
  await page.getByRole('group', { name: 'Categorias' }).getByRole('button', { name: 'Tortas' }).click();
  await page.getByRole('button', { name: /^Torta de limão/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Brigadeiro tradicional/ }).count(), 0);
  await page.getByRole('group', { name: 'Categorias' }).getByRole('button', { name: 'Todas' }).click();

  // Detail without sections, back to the catalog.
  await page.getByRole('button', { name: /^Brigadeiro tradicional/ }).click();
  await page.getByRole('heading', { name: 'Brigadeiro tradicional' }).waitFor();
  await page.getByText('Rende 30 docinhos').waitFor();
  await page.getByText('Ou 7 colheres de sopa de achocolatado', { exact: false }).waitFor();
  await semRolagemHorizontal();
  await shot('detalhe');
  await page.goBack();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();

  // Detail with sections; double tap copies once.
  await page.getByRole('button', { name: /^Coxinha de frango/ }).click();
  await page.getByText('Para fritar').waitFor();
  await shot('detalhe-secoes');
  const usar = page.getByRole('button', { name: 'Usar esta receita' });
  await usar.dblclick();
  await page.locator('#nome-receita').waitFor();
  assert.equal(await page.locator('#nome-receita').inputValue(), 'Coxinha de frango');
  await page.getByText('Receita copiada para Minhas receitas').waitFor();
  const copias = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:recipes')).length);
  assert.equal(copias, 1);

  // Editor: steps, free water row.
  assert.equal(await page.locator('[data-slot="preparo"] .passos li').count(), 9);
  await page.locator('.ing-row', { hasText: 'Água' }).first().getByText('sem custo').waitFor();
  await semRolagemHorizontal();
  await shot('editor-copia');

  // Edit the steps (pasted numbering is cleaned).
  await page.getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Um passo por linha').fill('1. Misture\n\n2) Asse');
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await page.locator('[data-slot="preparo"] .passos li').allTextContents(), ['Misture', 'Asse']);

  // Free row: no "Quanto pagou"; renaming brings the cost back.
  await page.locator('.ing-row', { hasText: 'Água' }).first().click();
  await dialog.getByText('Não entra no custo.').waitFor();
  assert.equal(await dialog.getByLabel('Preço pago (R$)').isVisible(), false);
  await dialog.getByLabel('Ingrediente').fill('Leite');
  await dialog.getByLabel('Ingrediente').press('Tab');
  await dialog.getByLabel('Preço pago (R$)').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  // Back goes to the catalog (the detail was replaced); Minhas receitas has the copy.
  await page.getByRole('button', { name: 'Voltar para Minhas Receitas' }).click();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();
  await page.getByRole('button', { name: 'Minhas receitas' }).click();
  await page.getByText('Coxinha de frango').waitFor();

  // Unknown id -> toast and back to the catalog.
  await page.goto(baseUrl + '#/prontas/nao-existe');
  await page.getByText('Receita não encontrada').waitFor();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();
}
```

- [ ] **Step 2: Run** `npm run test:mobile -- 14` — Expected: `ok` in light and dark. Fix real failures in the code (not by weakening asserts).

- [ ] **Step 3: Look at the screenshots** `scripts/.screenshots/14-prontas-{catalogo,detalhe,detalhe-secoes,editor-copia}-{light,dark}.png`: text readable in both themes, nothing under the action bar at the end of the detail (the `.app` bottom padding covers it), tabs fit at 390 px, cards aligned with Minhas receitas.

- [ ] **Step 4: Run everything** — `npm test`, `npm run test:mobile`, `node scripts/check-contrast.mjs`. Expected: all pass.

- [ ] **Step 5: Update** `CLAUDE.md`:
  - "Testes": update the unit test count to the new `npm test` total.
  - "Estrutura de arquivos": add `js/preparo.js`, `js/receitas-prontas.js`, `js/receitas-prontas-loader.js`, `js/fixtures/`, `data/receitas-prontas.json`, and `home-header, prontas, pronta, editor/preparo-sheet` to the `js/screens/` line.
  - "Funcionalidades adicionadas depois": new bullet **Receitas prontas + modo de preparo (2026-10-16)** summarizing: abas na tela inicial (`#/prontas`, `#/prontas/<id>`), 16 receitas para 20–30 unidades (quem trabalha sozinho), seções, "Usar esta receita" (cópia com preço conhecido, fixos, TACO; nome repetido → "(cópia)"; `origem`), água `semCusto`, óleo de fritura nos fritos, modo de preparo na aba Ingredientes (`#/receita/<id>/ingredientes/preparo`), WhatsApp com passos; spec em `docs/superpowers/specs/2026-10-16-receitas-prontas-design.md`.
  - "Próximos passos planejados": in the "Receitas prontas com passo a passo" item, mark the base (modo de preparo + galeria) as done; keep "Modo cozinhando" and the PDF book as next.

- [ ] **Step 6: Commit**

```bash
git add scripts/smoke/14-prontas.mjs CLAUDE.md
git commit -m "Smoke test for ready-made recipes; CLAUDE.md"
```
