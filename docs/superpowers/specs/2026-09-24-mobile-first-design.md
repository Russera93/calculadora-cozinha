# Reforma Mobile-First (etapas A + B) — Design

Data: 2026-09-24
Contexto do projeto: [CLAUDE.md](../../../CLAUDE.md)
Spec anterior: [2026-09-21-calculadora-cozinha-design.md](2026-09-21-calculadora-cozinha-design.md)

## 1. Objetivo

A calculadora é usada predominantemente **no celular** por autônomas(os) que
vendem doces e salgados. A interface atual foi desenhada para desktop e
adaptada para telas pequenas: no celular (390px) o editor de uma receita com
3 ingredientes tem ~2.800px de altura, o resultado ("você lucra R$ X") fica no
fim da rolagem, cada ingrediente ocupa uma tela inteira e as ações têm alvos
de toque pequenos. Além disso há erros de cálculo/dados visíveis.

Esta reforma cobre duas etapas de um roteiro maior:

- **A — Correções e reorganização do código** (base para o resto).
- **B — Nova interface mobile-first** das telas de lista e editor.

Fora do escopo (cada uma terá spec própria depois):

- **C** — mão de obra, custos fixos e taxas (maquininha/iFood) no preço.
- **D** — cardápio compartilhável, orçamento para cliente, link que importa
  receita, receitas modelo, PWA instalável/offline.

### Critérios de sucesso

1. Em 390×844, custo por unidade e lucro por unidade estão **sempre visíveis**
   enquanto a pessoa preenche qualquer campo.
2. Adicionar um ingrediente completo leva um painel, sem rolar a página.
3. O botão "voltar" do Android / gesto de voltar do iOS navega dentro do app
   (fecha painel → volta de tela), em vez de sair dele.
4. Receitas, ingredientes customizados, banco de preços e backups existentes
   continuam funcionando sem nenhuma ação da pessoa.
5. `npm test` passa (60 testes atuais + novos), e o smoke test mobile passa.

## 2. Decisões tomadas no brainstorming

| Decisão | Escolha | Motivo |
|---|---|---|
| Entrada de ingredientes | Lista de linhas-resumo + **painel que sobe de baixo** (bottom sheet) com todos os campos | Lista curta e legível; campos completos a um toque. Substitui a preferência anterior de "todas as colunas sempre visíveis", que só funcionava no desktop |
| Estrutura do editor | **Abas**: Ingredientes · Custos · Preço · Nutrição | Escolha explícita do usuário (preferida à página única com seções dobráveis) |
| Resultado | **Barra fixa no rodapé** em todas as abas; tocar leva à aba Preço | Resultado sempre à vista; a aba Preço é o "resultado aberto", sem conteúdo duplicado |
| Modo travado (Salvar/Editar) | **Removido** — tudo sempre editável, autosave, selo "✓ Salvo" | Menos toques; o travamento não protegia contra nada que o autosave + desfazer não cubra |
| Lista de receitas | **Cartões + menu ⋯**, botão flutuante "+ Nova receita", busca | Ações descobríveis (preferido ao gesto de arrastar) |
| Excluir receita | Exclui na hora + aviso com **"Desfazer"** (5s), sem `confirm()` | Menos atrito, erro recuperável |
| Envio pelo WhatsApp | **Só a receita**: nome, ingredientes com quantidades, rendimento (porções + peso total quando calculável). **Nenhum custo ou preço** | Pedido do usuário; também evita revelar margem a clientes |
| CSS | **Remover Tailwind CDN**; CSS próprio de componentes em `css/styles.css`, sem build | Tailwind Play CDN (~300KB, gera CSS em runtime) é lento em Android de entrada, pisca sem estilo e impede offline; não é para produção |
| Trabalho em branch | Branch `mobile-first`, merge em `master` só após verificação | Push em `master` publica no GitHub Pages |

Restrições do projeto que continuam valendo: vanilla JS com ES modules
nativos, sem build step, zero dependências de runtime, `localStorage`,
paleta clara + "espresso" escura, cor de marca do WhatsApp fixa, margem e
markup como indicadores separados, avisos da tabela nutricional.

## 3. Etapa A — Código

### 3.1 Estrutura de módulos

```
index.html            shell mínimo: <header>, <main id="view">, raiz de painéis/avisos
css/styles.css         tokens (inalterados) + base + componentes
js/
  app.js               bootstrap: tema, router, primeira renderização
  router.js            parseRoute(hash) puro + navigate()/onRouteChange()
  store.js             receita aberta, autosave com debounce, flush, subscribe(fn)
  calculations.js      (existente, puro)
  costing.js           NOVO, puro: computeLineCost, gramsUsed, quantidadeConvertidaEmGramas
  format.js            NOVO, puro: formatBRL, formatCurrencyInput, applyCurrencyMask*,
                       parseDecimal, unitLabel(unidade, quantidade)
  share.js             NOVO, puro: buildRecipeShareText(recipe)
  storage.js           (existente) + migrateRecipe(recipe); writeList com try/catch
  ingredients-db.js, taco-database.js, text-utils.js   (inalterados)
  ui/
    dom.js             h()/html helpers, escapeHtml
    sheet.js           painel de baixo (abrir/fechar, foco, Esc, integração com router)
    menu.js            menu ⋯ ancorado
    toast.js           aviso temporário com ação opcional ("Desfazer")
    confirm.js         confirmação em painel (substitui confirm()/alert())
  screens/
    lista.js           tela Minhas Receitas
    ajustes.js         painel ⚙ (backup, tema)
    editor.js          cabeçalho, abas, barra de resultado
    editor/ingredientes.js, editor/ingrediente-sheet.js,
    editor/custos.js, editor/preco.js, editor/nutricao.js
    result-bar.js      barra fixa
```

\* `applyCurrencyMask` mexe no elemento de input; a parte pura (dígitos →
número/texto) é separada em `maskCurrencyDigits(raw, {allowEmpty})`, que é a
parte testada.

Cada módulo de tela exporta `render(container, ctx)` e devolve uma função
`destroy()` (remove listeners). Os hooks globais `window.__on*Render` e
`window.__openRecipeEditor` deixam de existir.

### 3.2 Estado e renderização

- `store.js` guarda `currentRecipe` e expõe `update(mutator)`, que aplica a
  mudança, agenda autosave (400ms, como hoje) e notifica os inscritos.
  `flush()` é chamado em mudança de rota e em `pagehide`/`visibilitychange`
  (mais confiável que `beforeunload` no celular).
- **Campos não são recriados a cada tecla.** Cada tela cria seus inputs uma
  vez; os inscritos atualizam só os valores derivados (custos, totais,
  barra) via `textContent`. Isso elimina `preserveFocus` e impede que o
  teclado do celular feche ou o cursor pule.
- Estado de salvamento exposto pelo store: `'salvo' | 'salvando' | 'erro'`,
  exibido no selo do cabeçalho.

### 3.3 Rotas

`parseRoute(hash)` → objeto; hash desconhecido → lista.

| Hash | Tela |
|---|---|
| `#/` | Minhas Receitas |
| `#/ajustes` | lista + painel ⚙ aberto |
| `#/receita/:id` | editor, aba Ingredientes |
| `#/receita/:id/:aba` | editor, aba `ingredientes`, `custos`, `preco` ou `nutricao` |
| `#/receita/:id/ingredientes/:n` | aba Ingredientes + painel do ingrediente de índice `n` |
| `#/receita/:id/ingredientes/novo` | aba Ingredientes + painel de novo ingrediente |

Abrir um painel empurra uma entrada no histórico; "voltar" fecha o painel.
Trocar de aba usa `replaceState` (voltar sai do editor, não percorre abas).
Receita inexistente → volta para `#/` com aviso "Receita não encontrada".

### 3.4 Correções

1. **Preço sugerido por unidade.** `calculateSuggestedPrices({ custoPorPorcao })`
   → `{ preco2x, preco3x, preco4x }` ou `null` se `custoPorPorcao` for `null`.
   (Hoje multiplica o custo **total** da receita e é exibido como se fosse
   por porção.)
2. **Moeda em pt-BR em todo lugar** via `formatBRL` (`Intl.NumberFormat`
   `pt-BR`, BRL): "R$ 33,51", nunca "R$ 33.51".
3. **Unidades legíveis** via `unitLabel`: `xicara`→"xícara(s)",
   `colherSopa`→"colher(es) de sopa", `colherCha`→"colher(es) de chá",
   `g`→"g", `ml`→"ml", `unidade`→"unidade(s)"; singular quando quantidade ≤ 1.
   O valor salvo no `localStorage` não muda.
4. **Texto do WhatsApp** (ver 4.8).
5. `writeList` protegido com try/catch; falha vira estado `'erro'` no store.

### 3.5 `costing.js`

Move de `app.js` sem mudar a lógica: `computeLineCost(item)` e
`quantidadeConvertidaEmGramas(item, quantidade)`. Adiciona
`gramsUsed(item)`: gramas efetivamente usados de um ingrediente, ou `null`
se não calculável — usa `toGrams`, e para `unidade` sem `pesoUnidadeG` com
embalagem em `g` usa `quantidade × tamanhoEmbalagem` (mesma regra do
"pacote fechado" de `computeLineCost`); com embalagem em `ml`, converte via
densidade. Usado no peso total do texto do WhatsApp.

### 3.6 `migrateRecipe(recipe)` (puro, em `storage.js`)

Aplicado a toda receita lida para o editor e a lista:

- `quantidadeEmbalagens == null` → `rendimento` (regra atual, movida para cá).
- Remove linhas de ingrediente com `nome` vazio (a UI atual salva uma linha
  vazia no fim; a nova UI adiciona ingredientes pelo painel).
- Não altera nenhum outro campo. Formato e chaves do `localStorage` e do
  backup (`version: 1`) inalterados.

## 4. Etapa B — Interface

### 4.1 Regras gerais

- Coluna única, `max-width: 480px` centralizada (no desktop vira um "celular"
  no meio da tela).
- Alvos de toque ≥ 44×44px; espaçamento mínimo de 8px entre alvos.
- Inputs com `font-size: 16px` (evita zoom automático do iOS),
  `inputmode="decimal"`/`"numeric"` nos numéricos, `enterkeyhint`.
- `env(safe-area-inset-bottom)` na barra fixa, no botão flutuante e nos painéis.
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  e `<meta name="theme-color">` seguindo o tema.
- Tokens de cor atuais preservados (claro e "espresso"); novos tokens só se
  necessários para a barra/painel, com contraste AA verificado e registrado
  em comentário como os existentes. Bordas de card: acinzentadas no claro,
  transparentes no escuro (preferência registrada).
- `prefers-reduced-motion`: painéis e avisos aparecem sem animação.

### 4.2 Minhas Receitas (`#/`)

- Cabeçalho: título "Minhas Receitas", botões ⚙ (ajustes) e 🌙/☀️ (tema).
- Campo de busca (filtra por nome, ignorando acento/maiúscula via `normalize`).
  Só aparece com 4+ receitas.
- Cartões ordenados por nome (`localeCompare` pt-BR, `sensitivity: 'base'`):
  - nome; "Custo R$ X/un."; à direita: "lucro R$ Y" (verde), ou etiqueta
    "prejuízo R$ Y" (terracota), ou etiqueta "definir preço" quando
    `precoVendaDesejado == null`;
  - tocar no cartão abre a receita; botão ⋯ (alvo 44px) abre menu:
    Renomear · Duplicar · Enviar no WhatsApp · Excluir.
- Renomear: painel com campo de nome.
- Duplicar: cópia entra logo após a original (regra atual) e o aviso
  "Cópia criada" aparece.
- Excluir: remove na hora; aviso "Receita excluída · Desfazer" por 5s;
  Desfazer reinsere na mesma posição.
- Lista vazia: "Nenhuma receita ainda" + texto curto + botão "Criar minha
  primeira receita".
- Botão flutuante "+ Nova receita" (canto inferior direito).

### 4.3 Ajustes (`#/ajustes`, painel)

Exportar backup · Importar backup (resultado mostrado no próprio painel, sem
`alert`) · Tema (claro / escuro / automático).

### 4.4 Editor — cabeçalho, abas e barra

- **Cabeçalho**: ← (volta para `#/`), nome da receita como campo de texto
  com aparência de título (placeholder "Nome da receita"), selo de
  salvamento ("✓ Salvo" / "Salvando…" / "⚠ Não salvo"), botão do WhatsApp
  (ícone).
- **Nova receita**: cria, abre em `#/receita/:id` com o campo de nome em
  foco. Se a pessoa voltar sem ter preenchido nome nem ingredientes, a
  receita vazia é descartada.
- **Abas** (`role="tablist"`): Ingredientes · Custos · Preço · Nutrição; fixas
  abaixo do cabeçalho.
- **Barra de resultado** (fixa no rodapé, `aria-live="polite"`), estados em
  ordem de prioridade:
  1. `rendimento <= 0` → "Defina quantas porções a receita rende".
  2. nenhum ingrediente com custo → "Adicione ingredientes para ver o custo".
  3. sem preço de venda → "Custo R$ X/un. · **Defina seu preço ›**".
  4. com preço → "Custo R$ X/un." e "**Lucro R$ Y/un.**" (verde) ou
     "**Prejuízo R$ Y/un.**" (terracota).
  Linha secundária quando `ingredientesSemCusto > 0`: "N ingrediente(s) sem
  preço". Tocar na barra → aba Preço. Na própria aba Preço a barra fica oculta.

### 4.5 Aba Ingredientes

- Linha "Rende": `[−] N [+]` porções (mínimo 1; campo também digitável).
- Título "Ingredientes · R$ total dos ingredientes".
- Uma linha-resumo por ingrediente (botão de largura total):
  - "**Leite condensado**" ··· "R$ 14,98"
  - "2 unidades · R$ 7,49 / 395 g"
  - Incompleto: custo "—" e dica em terracota ("falta o preço", "falta o
    tamanho da embalagem", "falta a quantidade").
- Botão "+ Adicionar ingrediente" (tracejado, largura total).
- Vazia: texto "Comece adicionando o primeiro ingrediente".

### 4.6 Painel de ingrediente (`…/ingredientes/:n` ou `/novo`)

`role="dialog"`, `aria-modal`, foco preso no painel, Esc/voltar/toque fora
fecham. Arrastar para baixo pela alça também fecha.

Campos (de cima para baixo):
1. **Nome**, com sugestões (datalist ordenada pt-BR, como hoje).
2. Seção "**Quanto usa na receita**": número (aceita "1/2", "1 1/2", vírgula)
   + unidade em chips: g · ml · xícara · c. sopa · c. chá · unidade. Dica
   "≈ 60 g" quando há conversão (regra atual).
3. Seção "**Quanto pagou**": R$ (máscara de moeda atual) + tamanho da
   embalagem + unidade em chips: g · ml · unidade.
4. Custo na receita, ao vivo.
5. Botão "🔄 Usar este preço em outras receitas" (mesma regra atual:
   visível com nome, preço e tamanho > 0; confirmação via `ui/confirm`).
6. Ações: **Pronto** (primário) · **Remover** (texto terracota; remove com
   aviso "Desfazer").

Comportamento:
- Edições valem na hora (store + autosave), como no resto do editor.
- Ao definir o nome (evento `change`): aplica a regra atual de
  `applyIngredientMatch` (banco fixo/customizado, unidades padrão para
  itens contados por unidade, preço conhecido do banco de preços).
- **Nome não reconhecido**: em vez do modal separado atual, o painel mostra a
  seção "**Nutrição (opcional)**" com os campos do modal atual, preenchidos
  pela busca na TACO quando encontrar ("Encontrado na tabela TACO: …"), ou
  "Base nutricional indisponível" sem internet. O ingrediente customizado é
  salvo ao fechar o painel (mesmos campos e regras do modal atual, incluindo
  preservar `gordurasSaturadas` vinda da TACO).
- Preço aprendido no banco de preços ao sair dos campos de preço/tamanho/
  unidade (regra atual, `savePreco`).
- Novo ingrediente: só entra na lista quando o nome é preenchido; fechar com
  nome vazio descarta.

### 4.7 Abas Custos, Preço e Nutrição

**Custos**: cartões com
- Embalagem: "Custo de cada embalagem (R$)" + "Quantas embalagens" (dica "Ex.:
  20 brigadeiros, 4 por embalagem = 5 embalagens") → "Total R$ X".
- Gás: "Tempo de forno/fogo (min)" + "Preço do botijão 13 kg (R$)" → "Total R$ X".
- Rodapé: "Custo total da receita R$ X".

**Preço**:
- "Custo por unidade" em destaque; "Custo total da receita R$ X".
- "Quanto você vai cobrar?" — chips **2× R$ a · 3× R$ b · 4× R$ c** (por
  unidade; tocar preenche o campo) + campo R$ (vazio = não definido,
  regra atual).
- Resultado: "Você lucra R$ Y por unidade" / "Você perde R$ Y por unidade",
  "R$ Z na receita toda", "Isso é N× o custo".
- "Ver detalhes do cálculo" (`<details>`): margem sobre a venda, markup sobre
  o custo (indicadores separados, textos atuais), embalagem por unidade, gás.

**Nutrição**: tabela ANVISA calculada ao abrir a aba (sem botão), com o mesmo
conteúdo, avisos e rodapé "não substitui laudo" atuais. Tabela com rolagem
horizontal própria se não couber. Sem rendimento válido: mensagem atual.

### 4.8 Texto do WhatsApp

Disponível no cabeçalho do editor e no menu ⋯ da lista. `wa.me/?text=`
(mecanismo atual). Formato:

```
*Brigadeiro Gourmet*

Ingredientes:
- 2 unidades de Leite condensado
- 100 g de Chocolate 50%
- 1 colher de sopa de Manteiga

Rende: 30 porções (≈ 904 g no total)

Enviado pela Calculadora de Cozinha
```

- Quantidade como digitada + `unitLabel`; sem quantidade → só o nome.
- "(≈ N g no total)" só quando `gramsUsed` for calculável para **todos** os
  ingredientes; senão só "Rende: 30 porções".
- Nenhum custo, preço ou margem.

## 5. Tratamento de erros

| Situação | Comportamento |
|---|---|
| `localStorage` cheio/bloqueado | Selo "⚠ Não salvo" + aviso "Não foi possível salvar. Exporte um backup." |
| TACO indisponível | Painel mostra "Base nutricional indisponível"; nutrição manual continua possível |
| Receita inexistente na rota | Vai para `#/` com aviso "Receita não encontrada" |
| Backup inválido | Resultado no painel de ajustes: "Arquivo inválido", sem travar |
| Quantidade não interpretável ("meia") | Custo "—" e dica "quantidade não reconhecida (use 1/2, 0,5…)" |

## 6. Testes

**Unitários (`node --test`, escritos antes do código):**
- `costing.test.js`: casos de `computeLineCost` hoje só verificados via UI
  (ml→g, lata inteira, dúzia de ovos, ovo por peso), `gramsUsed`.
- `format.test.js`: `formatBRL`, `maskCurrencyDigits` (incl. `allowEmpty`),
  `parseDecimal`, `unitLabel` (singular/plural).
- `share.test.js`: formato completo, sem custos, peso total presente/ausente.
- `storage` / `migrateRecipe`: backfill de embalagens, remoção de linhas
  vazias, idempotência.
- `router.test.js`: `parseRoute` para todas as rotas e hash inválido.
- `calculations.test.js`: novo contrato de `calculateSuggestedPrices`.

**Smoke mobile (`scripts/smoke-mobile.mjs`, `npm run test:mobile`)**:
Playwright (apenas `devDependencies`) em 390×844, servidor estático embutido
no script. Roteiro: criar receita → nomear → adicionar 3 ingredientes pelo
painel (incl. um desconhecido com TACO) → conferir custo/un. na barra →
aba Preço, tocar 3× → conferir lucro → voltar do navegador fecha painel e
volta à lista → excluir e desfazer → recarregar e conferir persistência.
Captura de tela de cada tela nos dois temas em `scripts/.screenshots/`
(ignorada pelo git).

## 7. Entrega

- Tudo no branch `mobile-first`; merge em `master` após `npm test`,
  `npm run test:mobile` e conferência visual das capturas.
- `.superpowers/` e `scripts/.screenshots/` adicionados ao `.gitignore`.
- `CLAUDE.md` atualizado ao final (estrutura nova, decisões novas, remoção
  do Tailwind e do modo travado).
