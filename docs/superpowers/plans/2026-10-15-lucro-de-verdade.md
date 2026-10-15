# Lucro de verdade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preço e ganho que contam tempo de trabalho, contas fixas, taxas de venda e perda; sugestões Mínimo/Justo/Com lucro; "Você ganha" + "sua hora rendeu"; ajustes de praticidade.

**Architecture:** Lógica pura nova em `js/duration.js`, `js/negocio.js`, `js/profit.js`; `results.js` passa a receber o negócio. Telas: painel `screens/negocio-sheet.js`, abas Custos/Preço, barra, lista, aviso de proteção.

**Tech Stack:** Vanilla JS, `node --test`, Playwright smoke.

**Spec:** `docs/superpowers/specs/2026-10-15-lucro-de-verdade-design.md`

## Global Constraints

- Sem build, sem dependências novas. Cores só por tokens. Textos pt-BR.
- Receitas antigas: `tempoTrabalhoMinutos: null`, `perdaPercent: 0`, `canalVenda: 'direto'` via `migrateRecipe`; sem negócio configurado o ganho = preço − custo (conta de hoje).
- Margem e markup continuam separados.
- Todo arquivo novo de `js/` entra no `PRECACHE` do `sw.js` (+ bump `CACHE`).

## Review Focus

1. Negócio não configurado / tempo vazio → nada quebra, Justo/Com lucro desabilitados com motivo. → Task 3, 6.
2. Taxa de 100% ou mais → limitada (sem divisão por zero). → Task 3.
3. Preço bonito nunca abaixo do calculado (ex.: 2,50 exato fica 2,50). → Task 2.
4. Tempo digitado em formatos variados ("1h30", "1:30", "90", "1,5 h", "45min") e lixo ("abc") → null sem quebrar. → Task 1.
5. Backup importado com negócio não sobrescreve o já configurado. → Task 2.

### Task 1: `duration.js` — `parseDuration(text) → minutos|null`, `formatDuration(min) → "1h30" | "45 min" | "2h"`.
### Task 2: `negocio.js` + storage + `precoBonito` (format.js)
- `NEGOCIO_PADRAO`, `normalizeNegocio(raw)`, `horasPorMes(n)`, `valorHora(n)`, `fixosPorHora(n)`, `totalFixos(n)`, `isConfigurado(n)`, `taxaDoCanal(n, canal)`.
- storage: `getNegocio()`, `saveNegocio(n)`, export `negocio`, import só se local não configurado; `migrateRecipe` com os 3 campos.
- `precoBonito(v)`.
### Task 3: `profit.js` + `results.js(recipe, negocio)`; remove `calculateSuggestedPrices`; kinds `ganho`/`prejuizo`; campos `ganhoPorUnidade`, `ganhoTotal`, `horaRendeu`, `bateuMeta`, `sugeridos: { minimo, justo, comLucro }`, `motivoSemJusto`.
### Task 4: Router `#/negocio` e `#/receita/x/<aba>/negocio` (`sheet: 'negocio'`); painel Meu negócio.
### Task 5: Aba Custos (Seu trabalho, Perda) + porções→unidades.
### Task 6: Aba Preço, barra, lista (ganha / sem preço).
### Task 7: Proteção dos dados (persist, aviso iPhone/backup) — regra pura `protectionNotice({ ... })`.
### Task 8: Smoke 11 + atualizar 02/03/05/07; capturas; CLAUDE.md; merge só com autorização.
