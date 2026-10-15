# Leitura de nota + correções + PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ler a nota de compra (foto/imagem/texto), preencher preço e embalagem dos ingredientes, mostrar quanto a receita gasta e quanto a compra rende; corrigir C1–C5; tornar o app instalável/offline.

**Architecture:** Toda a lógica nova em módulos puros testados (`units`, `receipt-parser`, `receipt-match`, `purchase`); DOM só em `ocr.js` e no painel `screens/editor/nota-sheet.js`. Tesseract.js carregado por `import()` sob demanda. Service worker clássico na raiz.

**Tech Stack:** Vanilla JS (ES modules, sem build), `node --test`, Playwright (smoke), Tesseract.js 7.0.0 via jsDelivr.

**Spec:** `docs/superpowers/specs/2026-10-15-leitura-nota-design.md`

## Global Constraints

- Sem build step, sem framework; única dependência de runtime nova: `tesseract.js@7.0.0` por `import()` de `https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js`.
- Chaves do `localStorage` existentes não mudam; nova: `calculadora-cozinha:apelidos-nota`. `recipe.compra` é opcional.
- Unidades guardadas: `g`, `kg`, `mg`, `ml`, `l`, `unidade` (rótulo de `l` = "L"). Receitas antigas (g/ml/unidade) calculam igual.
- Cores só por tokens `--color-*`; textos da UI em pt-BR.
- Tudo no branch `leitura-nota`; merge no `master` só com autorização do usuário.

## Review Focus

1. Cupom com OCR sujo (ponto em vez de vírgula, "x" minúsculo, código de tributo colado) — itens ainda saem com valor certo. → testes em Task 3.
2. Linhas de total/pagamento/troco viram itens falsos. → teste "rodapé ignorado" em Task 3.
3. Ingrediente "Leite" e "Leite condensado" na mesma receita — "LEITE COND" vai para o certo. → Task 4.
4. Item da nota casado com ingrediente medido em xícara mas comprado em kg/L — rendimento usa densidade. → Task 5.
5. Usuário remove/renomeia o ingrediente depois de aplicar a nota — cartão "última compra" não quebra (item vira "faltando"/ignorado). → Task 5 + Task 7.

---

### Task 1: Unidades de embalagem (C5) + correções C1–C3

**Files:** Create `js/units.js`, `js/units.test.js`. Modify `js/costing.js`, `js/nutrition-table.js`, `js/ingredient-match.js`, `js/format.js`, `js/screens/editor/ingrediente-sheet.js`, tests `js/costing.test.js`, `js/nutrition-table.test.js`, `js/ingredient-match.test.js`, `js/format.test.js`.

**Interfaces — Produces:**
- `PACKAGE_UNITS: Record<'g'|'kg'|'mg'|'ml'|'l'|'unidade', { base: 'g'|'ml'|'unidade', fator: number }>`
- `packageInBase(tamanho: number, unidade: string) → { valor: number, base } | null`
- `PACKAGE_UNIT_CHIPS` = g, kg, mg, ml, L, unidade; `packageUnitShort('l') === 'L'`
- `buildCustomIngredient({ ..., densidadeTaco })`

- [ ] Testes `units`: `packageInBase(1,'kg') → {valor:1000, base:'g'}`; `(1.5,'l') → {1500,'ml'}`; `(500,'mg') → {0.5,'g'}`; `(12,'unidade') → {12,'unidade'}`; unidade desconhecida → `null`.
- [ ] Testes costing: 1 kg de farinha a R$ 5, usa 500 g → R$ 2,50; óleo 1 L (0,92 g/ml) R$ 9,20, usa 100 g → R$ 1,00; "1 unidade" de leite condensado com embalagem 0,395 kg → custo = preço inteiro e `gramsUsed` 395; embalagem kg + receita em xícara usa densidade.
- [ ] Teste C1: `nutritionPerPortion` com "1 unidade" de leite condensado (395 g, sem pesoUnidadeG) → `ingredientesSemDados 0`, kcal/porção = 321×3,95/rendimento.
- [ ] Teste C2: `buildCustomIngredient({ unidadeEmbalagem:'g', densidadeTaco: 0.55, ... }).densidadeGml === 0.55`; sem TACO e `ml` → 1.0; sem TACO e `g` → null.
- [ ] Teste C3: `quantidadeConvertidaEmGramas` de "1 unidade" sem peso médio, embalagem 395 g → 395.
- [ ] Rodar, ver falhar; implementar; rodar `npm test` verde.
- [ ] Painel: chips novos; ao achar na TACO, `item.densidadeGml = match.densidadeGml` (live) e passar `densidadeTaco` no `finalize`.
- [ ] Commit.

### Task 2: Smoke acha Chrome/Edge instalado (C4)

**Files:** Modify `scripts/smoke-mobile.mjs`, `CLAUDE.md` (nota de teste).

- [ ] Se `CHROMIUM_PATH` não definido e `chromium.executablePath()` não existe, testar caminhos conhecidos (Windows Chrome/Edge, macOS Chrome, Linux `/usr/bin/google-chrome`, `/usr/bin/chromium`); usar o primeiro que existir.
- [ ] `npm run test:mobile` sem variável → passa. Commit.

### Task 3: Parser da nota

**Files:** Create `js/receipt-parser.js`, `js/receipt-parser.test.js`.

**Produces:** `parseReceiptText(texto: string) → Array<{ descricao: string, quantidade: number, tamanho: number|null, unidade: 'g'|'kg'|'mg'|'ml'|'l'|'unidade'|null, valorTotal: number }>`; `extractPackageSize(descricao) → { tamanho, unidade } | null`.

Casos de teste (entrada → saída):
- `001 7891000100103 LEITE COND MOCA 395G 2 UN X 7,49 14,98` → `{ descricao:'LEITE COND MOCA 395G', quantidade:2, tamanho:395, unidade:'g', valorTotal:14.98 }`.
- Duas linhas: `002 7896005800027 CHOC PO 50% NESTLE 200G` / `1,000 UN x 12,90 F1 12,90` → quantidade 1, 200 g, 12.90.
- Pesado: `003 2000123000000 BANANA PRATA` / `0,875 KG X 6,99 6,12` → quantidade 1, tamanho 0.875, 'kg', 6.12.
- Dúzia: `OVOS BRANCOS GRANDES C/12 1 UN X 11,90 11,90` → 12 'unidade'. `OVOS DZ` → 12.
- Litro: `LEITE INTEGRAL ITALAC 1L 6 UN X 4,79 28,74` → 1 'l', quantidade 6.
- SEFAZ: `MANTEIGA C/SAL AVIACAO 200G (Código: 7896) Qtde.:1 UN: UN Vl. Unit.: 15,99 Vl. Total 15,99` → 200 g, 15.99.
- OCR sujo: `004 FARINHA TRIGO DONA BENTA 1KG 2 un x 5.49 10.98` → 1 kg, 2, 10.98; `T18%`/`I1` no fim ignorado.
- Linha simples: `ACUCAR UNIAO REFINADO 1KG 4,99` → quantidade 1, 1 kg, 4.99.
- Rodapé: `TOTAL R$ 64,60`, `SUBTOTAL 64,60`, `CARTAO DEBITO 64,60`, `TROCO 0,00`, `Valor aproximado dos tributos R$ 12,30`, `QTD. TOTAL DE ITENS 6` → nenhum item.
- Sem valor total, com unitário: `CREME LEITE 200G 3 UN X 3,50` → valorTotal 10.50.
- `extractPackageSize`: `395G`, `1,5L`, `200 ML`, `500GR`, `10MG`, `C/30` → 30 unidade, `CART 30`, sem tamanho → null.

- [ ] Escrever testes, ver falhar, implementar, verde, commit.

### Task 4: Casamento item ↔ ingrediente + apelidos

**Files:** Create `js/receipt-match.js`, `js/receipt-match.test.js`. Modify `js/storage.js` (+ `getApelidosNota`, `saveApelidoNota`, export/import), `js/storage.test.js`.

**Produces:**
- `expandTokens(descricao) → string[]`
- `matchScore(descricao, nomeIngrediente) → number` (0..~1.1)
- `aliasKey(descricao) → string` (normalizado sem números/tamanhos)
- `suggestMatches(itens, nomesIngredientes: string[], apelidos: Array<{chave,nome}>) → Array<number|null>` (índice do ingrediente por item)
- storage: `getApelidosNota() → Array<{chave,nome}>`, `saveApelidoNota(descricao, nome)`; export inclui `apelidosNota`; import pula chaves existentes.

Testes:
- "LEITE COND MOCA 395G" com ["Leite", "Leite condensado"] → "Leite condensado"; "LEITE INTEGRAL 1L" → "Leite".
- "CR LEITE NESTLE 200G" → "Creme de leite"; "FAR TRIGO 1KG" → "Farinha de trigo"; "ACUC REF UNIAO" → "Açúcar"; "OVOS BRANCOS C/12" → "Ovos"; "CHOC PO 50%" → "Chocolate em pó"; "MANT C/SAL" → "Manteiga".
- "DETERGENTE YPE 500ML" → null.
- 1-para-1: dois itens "LEITE COND MOCA" e "LEITE COND PIRACANJUBA", só um ingrediente → só o de maior pontuação (primeiro em empate) ganha.
- Apelido `{chave: aliasKey('BOMBOM GAROTO SERENATA'), nome: 'Chocolate ao leite'}` vence quando o ingrediente existe; ignorado quando não existe.
- storage: salvar apelido duas vezes com a mesma chave substitui; import não sobrescreve.

- [ ] Testes, falhar, implementar, verde, commit.

### Task 5: Compra na receita — aplicar e rendimento

**Files:** Create `js/purchase.js`, `js/purchase.test.js`.

**Consumes:** `computeLineCost` (costing.js), `normalize`.

**Produces:**
- `unitPrice(item) → number` (= valorTotal / quantidade, 2 casas)
- `applyPurchase(recipe, escolhas: Array<{ item, ingredienteIndex }>, agora: string) → Array<{ nome, precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem }>` — muta as linhas da receita e grava `recipe.compra`; devolve o que aplicou (para `savePreco`).
- `purchaseYield(recipe) → null | { itens: Array<{ nome, receitas: number|null, gasto: number|null, valorTotal }>, receitasPossiveis: number|null, unidadesPossiveis: number|null, limitante: string|null, gastoPorReceita: number, totalNota: number, faltando: string[] }`

Testes:
- Aplicar "2 × lata 395 g por 14,98" em "Leite condensado" (usa 1 unidade) → linha preço 7,49, 395 g; `compra.itens[0]` correto.
- Rendimento: leite condensado 2 latas (usa 1/receita) + chocolate 200 g (usa 30 g) → receitas 2 e 6,67; possíveis 2; limitante Leite condensado; rendimento 20 → 40 unidades; gasto por receita = 7,49 + 12,90×30/200.
- Dúzia de ovos (12 un., usa 3) → 4 receitas.
- Óleo 1 L comprado, receita usa 1 xícara (densidade 0,92) → 1000×0,92/(240×0,92) = 4,17.
- Menos de uma receita: usa 2 latas, comprou 1 → receitasPossiveis 0, limitante.
- Ingrediente da receita fora da nota → em `faltando`; ingrediente removido depois → item ignorado (não quebra).
- Item sem conversão (receita em xícara, sem densidade, comprado em g) → `receitas null`, não entra no mínimo.
- Sem `recipe.compra` → `null`.

- [ ] Testes, falhar, implementar, verde, commit.

### Task 6: Leitor OCR

**Files:** Create `js/ocr.js`.

**Produces:** `readReceiptImage(file: Blob, onProgress: (fraction:number, status:string) => void) → Promise<string>`; erros com `err.code` `'offline'` | `'falha'`.

- [ ] `preprocess(file)`: `createImageBitmap(file, { imageOrientation: 'from-image' })`, lado maior ≤ 2000, mínimo 1200 (aumenta foto pequena), cinza + contraste por percentis 2%/98%.
- [ ] `import(TESSERACT_URL)`, `createWorker('por', 1, { logger })`, `setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })`, `recognize(canvas)`, `terminate()` em `finally`.
- [ ] Mapear status do logger para pt-BR ("Baixando o leitor…", "Lendo a nota…").
- [ ] Verificado pelo smoke `09-ocr` (Task 8).

### Task 7: Painel "Ler nota" + cartão "Sua última compra"

**Files:** Create `js/screens/editor/nota-sheet.js`, `js/screens/editor/compra-resumo.js`. Modify `js/router.js` (+ `item: 'nota'`), `js/router.test.js`, `js/screens/editor/ingredientes.js`, `css/styles.css`, `scripts/check-contrast.mjs` se houver par novo.

**Consumes:** Tasks 3–6, `bindCurrencyInput`, `openSheet`, `savePreco`, `saveApelidoNota`.

**Produces:** `openNotaSheet({ store, onRequestClose, onClose })`; `compraResumoHtml(yieldResult, recipe) → fragment`.

- [ ] Router: `#/receita/x/ingredientes/nota` → `{ item: 'nota' }`; teste.
- [ ] Passos escolher → lendo → conferir → resumo, conforme spec §3; "Aplicar" desabilitado com item marcado incompleto (mensagem no item).
- [ ] Aba Ingredientes: botão "📷 Ler nota de compra"; cartão "Sua última compra" com resumo e "Remover" quando `recipe.compra`.
- [ ] Commit.

### Task 8: Smoke da nota

**Files:** Create `scripts/smoke/08-nota.mjs`, `scripts/smoke/09-ocr.mjs`.

- [ ] 08: seed receita (Leite condensado 1 un., Chocolate em pó 30 g, Manteiga 20 g, rende 20) → aba Ingredientes → "Ler nota" → "Colar texto" com cupom de 5 linhas (leite cond 2 un., choc pó, detergente, total, cartão) → conferir: leite → Leite condensado, choc → Chocolate em pó, detergente "Não usar" → Aplicar → resumo "2 receitas = 40 unidades", "Não vieram na nota: Manteiga" → Pronto → linha do leite mostra R$ 7,49 / 395 g → cartão presente → recarregar e conferir persistência. Capturas `conferir`, `resumo`, `cartao`.
- [ ] 09 (só `SMOKE_OCR=1`): `page.setContent` de um cupom em fonte mono, screenshot → `setInputFiles` no "Escolher imagem" → espera a conferência com ≥2 itens casados.
- [ ] Rodar ambos, olhar capturas claro/escuro, commit.

### Task 9: PWA

**Files:** Create `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `scripts/build-icons.mjs`, `icons/*.png`, `js/sw.test.js`. Modify `index.html`, `js/app.js`, `scripts/smoke-mobile.mjs` (servir `.webmanifest`/`.png`), `scripts/smoke/01-lista.mjs`.

- [ ] Teste `sw.test.js`: lê `sw.js`, extrai a lista entre `// PRECACHE-START` e `// PRECACHE-END`; todo `js/*.js` não-teste, `js/ui/*.js`, `js/screens/**/*.js`, `css/styles.css`, `index.html`, `data/taco.json`, `manifest.webmanifest`, ícones estão nela e todos existem.
- [ ] `sw.js`: install pré-carrega; activate apaga caches antigos + `clients.claim()`; fetch: mesma origem rede-primeiro com fallback do cache (navegação → `index.html`); jsDelivr/Google Fonts cache-primeiro.
- [ ] Ícone SVG (cupcake/colher simples nas cores do app) → PNGs via Playwright.
- [ ] `index.html`: manifest, apple-touch-icon, ícone. `app.js` registra o SW em http(s).
- [ ] Smoke 01: `navigator.serviceWorker.ready` resolve; manifest responde 200.
- [ ] Commit.

### Task 10: Docs + verificação final

- [ ] `CLAUDE.md`: funcionalidade, estrutura de arquivos, exceção do Tesseract, contagem de testes, PWA.
- [ ] `npm test`, `npm run test:mobile`, `SMOKE_OCR=1 npm run test:mobile -- 09`, `node scripts/check-contrast.mjs`.
- [ ] Revisão do branch inteiro (subagente revisor), corrigir achados, commit.
- [ ] Perguntar ao usuário antes do merge no `master`.
