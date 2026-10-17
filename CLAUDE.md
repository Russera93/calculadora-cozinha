# Doce Valor (Calculadora de Cozinha) — histórico do projeto

> **⚠️ AVISO (2026-10-16) — sessão interrompida em outro computador.**
> O computador onde se trabalhava até ~15h20 de 16/10/2026 perdeu a conexão
> no meio de uma sessão remota. O trabalho **continua em outro computador**
> a partir do `master` em `9ed0a28`. Se você está naquele computador antigo:
>
> 1. **Não continue** a tarefa que ficou aberta e **não faça merge** de nada
>    em `master` a partir dali.
> 2. `git fetch origin` e confira o que ficou só nesta máquina:
>    `git status`, `git log --branches --not --remotes --oneline`,
>    `git stash list`.
> 3. Se houver qualquer coisa (arquivo alterado, commit não enviado, stash,
>    branch local), guarde tudo numa branch de resgate e envie:
>    `git switch -c resgate-2026-10-16` → `git add -A` →
>    `git commit -m "Resgate: trabalho interrompido em 2026-10-16"` →
>    `git push -u origin resgate-2026-10-16` (stash: `git stash branch
>    resgate-stash-2026-10-16` e push dela). Branch local que não está no
>    remoto: push dela como está.
> 4. Depois: `git switch master` e `git pull` (precisa estar limpo). Pare aí
>    e avise o usuário — quem decide o que aproveitar é a outra máquina.
>
> Se nada ficou para trás, só `git pull`. Quando o resgate (se houver) for
> revisado, remova este aviso.

Este arquivo documenta o que foi construído até agora, para dar contexto a
uma próxima sessão de trabalho (possivelmente com outro modelo/ferramenta de
IA). A **reforma mobile-first** (etapas A+B) já foi feita — ver o fim de
"Funcionalidades adicionadas depois".

## O que é o projeto

Calculadora de precificação de receitas para confeiteiras/cozinheiras
brasileiras: cadastra ingredientes com preço/embalagem, calcula custo por
porção, sugere preço de venda, calcula margem/lucro, e gera uma tabela
nutricional no estilo ANVISA (IN 75/2020) a partir dos ingredientes
cadastrados.

**Link ao vivo:** https://russera93.github.io/calculadora-cozinha/
(GitHub Pages, deploy automático a cada push no branch `master`. O
repositório é **público** — só assim o GitHub Pages funciona de graça.)

## Stack e restrições arquiteturais (importante manter em mente)

- **Vanilla JS puro**, ES modules nativos (`type="module"`), **sem build
  step**, **sem framework**, **zero dependências de runtime via npm**. O
  único uso de `npm`/`node` é para rodar os testes (`npm test`) e os
  scripts (`scripts/build-taco.js`, `scripts/build-icons.mjs`).
  **Única exceção consciente**: o leitor de notas (Tesseract.js 7.0.0) é
  carregado por `import()` de jsDelivr, versão fixa, só quando alguém
  escolhe uma foto (`js/ocr.js`); o resto do app funciona sem ele.
- **PWA**: `manifest.webmanifest` + `sw.js` (arquivos do site rede
  primeiro com cache offline; CDN cache primeiro). **Todo arquivo novo do
  app precisa entrar no `PRECACHE` do `sw.js`** — `js/sw.test.js` falha
  se faltar. Mudou a lista → suba o número em `CACHE`.
- **CSS próprio, sem Tailwind** (removido na reforma mobile-first: o Play
  CDN gerava CSS em runtime, lento em Android de entrada). Componentes em
  `css/styles.css` (card, chip, sheet, tabs, result-bar, toast, menu…),
  cores só via tokens `--color-*`. Contraste dos pares novos verificado
  por `node scripts/check-contrast.mjs`.
- **Persistência via `localStorage`** — não há backend, não há banco de
  dados. Tudo (receitas, ingredientes customizados, banco de preços central)
  fica no navegador de cada pessoa, sob chaves prefixadas
  `calculadora-cozinha:*`.
- **Dark mode** via atributo `[data-theme="dark"]` no `<html>` + fallback por
  `prefers-color-scheme`. Paleta escura é "espresso/cacau", não preto
  genérico — decisão de design deliberada.
- Base nutricional **TACO** (Tabela Brasileira de Composição de Alimentos),
  normalizada de `data/taco-raw.json` para `data/taco.json` via
  `scripts/build-taco.js`. Já versionado, não precisa regerar a menos que a
  fonte mude.
- **Testes**: `npm test` roda `node --test js/*.test.js scripts/precos-referencia/*.test.js` (285 testes). Toda
  a lógica fica em módulos puros testados; as telas (`js/screens/`) são
  verificadas pelo smoke Playwright `npm run test:mobile`.
- Servir sempre via **HTTP** (nunca `file://`), porque o app usa `fetch()`
  para carregar `data/taco.json`, o que quebra por CORS em `file://`.
  Durante o desenvolvimento local, qualquer servidor estático simples serve
  (ex: `npx serve` ou `python -m http.server`).

## Estrutura de arquivos

```
index.html                 — shell mínimo (#view, #overlay-root, #toast-root)
css/styles.css             — tokens (claro/escuro) + componentes
js/app.js                  — bootstrap: tema, router, troca de tela
js/router.js               — rotas por hash + History API (voltar do celular)
js/store.js                — receita aberta, autosave (400ms), status de salvamento
js/session.js              — receitas novas desta sessão (descarte da receita vazia)
js/calculations.js         — motor de cálculo puro
js/costing.js              — custo por ingrediente, gramas usados, problemas da linha
js/results.js              — números de uma receita: custo, "você ganha", sugestões 2×/3×/4×
js/taxas.js                — taxa da maquininha/iFood por canal de venda
js/protecao.js             — qual cartão vai no topo da lista: instalar o app ou salvar backup
js/instalar.js             — botão "Instalar o app" (beforeinstallprompt), detecção de iPhone/app instalado
js/transferencia.js        — texto copiado Safari → app instalado no iPhone (marcador + backup JSON)
js/format.js               — moeda/números pt-BR, máscara de moeda, rótulos de unidade
js/share.js                — texto do WhatsApp (só a receita, sem custos)
js/ingredient-match.js     — reconhecer ingrediente, ingrediente customizado
js/ingredientes-sugeridos.js — ingredientes mais usados por categoria + busca das sugestões
js/receitas-prontas.js     — receitas prontas: validação do arquivo, textos, cópia para Minhas receitas
js/receitas-prontas-loader.js — carrega data/receitas-prontas.json sob demanda (não guarda falha)
js/preparo.js              — modo de preparo: texto (um passo por linha) ↔ lista de passos
js/precos-referencia.js    — origem do preço (referência de mercado): aplicar, limpar, atualizar, antiga
js/precos-referencia-loader.js — carrega data/precos-referencia.json sob demanda
js/fixtures/               — dados de teste (receitas prontas de exemplo)
js/nutrition-table.js      — nutrição por porção e tabela ANVISA
js/storage.js              — CRUD em localStorage + migrateRecipe + apelidos da nota
js/units.js                — unidades de embalagem (g, kg, mg, ml, l, unidade) → g/ml/peças
js/receipt-parser.js       — texto da nota (cupom SAT/NFC-e, página da SEFAZ) → itens
js/receipt-match.js        — item da nota ↔ ingrediente (abreviações, apelidos aprendidos)
js/purchase.js             — aplicar a compra na receita; quantas receitas rende, gasto por receita
js/ocr.js                  — leitura da foto no aparelho (Tesseract.js sob demanda)
js/taco-loader.js, js/taco-database.js, js/ingredients-db.js, js/text-utils.js
js/theme.js                — tema automático/claro/escuro
js/ui/                     — dom (html`` com escape, campo de moeda), sheet, toast, menu, confirm, icons, sugestoes (lista sob o campo do ingrediente)
js/screens/                — home-header (título + abas da tela inicial), lista, prontas (catálogo), pronta (detalhe), ajustes, instalar-passos, transferir, editor, result-bar, editor/{ingredientes, ingrediente-sheet, preparo-sheet, nota-sheet, compra-resumo, custos, preco, nutricao}
js/*.test.js               — testes unitários (node --test)
sw.js, manifest.webmanifest, icons/ — PWA (ícones gerados por scripts/build-icons.mjs)
scripts/smoke-mobile.mjs   — smoke test Playwright 390×844 (cenários em scripts/smoke/)
scripts/find-browser.mjs   — usa o Chrome/Edge instalado se o Chromium do Playwright não foi baixado
scripts/check-contrast.mjs — verificação WCAG dos pares de cor novos
data/taco.json             — base TACO normalizada (gerada, versionada)
data/precos-referencia.json — preços de referência (robô diário, não editar à mão)
data/receitas-prontas.json — 16 receitas prontas (conteúdo; validado por js/receitas-prontas.test.js)
scripts/build-taco.js      — gera data/taco.json a partir de data/taco-raw.json
scripts/precos-referencia.mjs (+ .config.json, precos-referencia/calculo.js) — robô de preços (`npm run precos`)
.github/workflows/precos-referencia.yml — roda o robô todo dia 06:00 (Brasília) e commita o arquivo
js/meus-ingredientes.js, js/screens/meus-ingredientes.js — tela "Meus ingredientes" (preços de todas as receitas, num só lugar)
js/cardapio.js, js/fotos.js, js/screens/cardapio.js — cardápio compartilhável (seleção, foto por receita no IndexedDB, PDF/imagem)
ESPECIFICACAO.md           — spec original do produto (18 tasks do build inicial)
docs/superpowers/          — specs e planos (inclui a reforma mobile-first)
```

## O que já foi construído (histórico resumido)

### Build inicial
App completo construído via plano de 18 tarefas: cadastro de receita,
ingredientes com conversão de unidade (peso/volume/unidade), custo por
ingrediente e por receita, preço sugerido, margem, tabela nutricional
ANVISA-style, dark mode, modal de ingrediente customizado, export/import de
backup em JSON.

### Funcionalidades adicionadas depois (em ordem)
- **Banco de preços central**: ao editar o preço de um ingrediente numa
  receita, dá pra propagar esse preço pra todas as outras receitas que usam
  o mesmo ingrediente (botão "🔄 Usar este preço em outras receitas").
- **Compartilhar receita via WhatsApp**: link direto `wa.me` (sem precisar
  de permissão do navegador), com botão de marca (`#25D366` fundo, texto
  verde bem escuro pra contraste AA — branco sobre esse verde reprova
  WCAG). Disponível tanto no editor quanto em cada card da lista "Minhas
  Receitas" (pra compartilhar sem precisar abrir a receita).
- **Export/Import de backup**: backup completo em JSON, import com política
  de "pular duplicadas, manter as existentes".
- **Correção de custo para ingrediente comprado em pacote fechado** (ex: 1
  lata de leite condensado de 395g): antes exigia peso médio por unidade
  (só existe pra ovo/banana) e retornava custo indefinido. Agora, quando
  `unidade === 'unidade'` e não há peso médio conhecido, cada unidade usada
  é tratada como "um pacote inteiro comprado".
- **Quantidade de embalagens utilizadas**: campo novo em "Custos Extras",
  desacoplado do rendimento (antes assumia implicitamente 1 embalagem por
  porção). Ex: 20 brigadeiros, 4 por saquinho = 5 embalagens. Receitas
  antigas são migradas automaticamente ao abrir (mantendo o comportamento
  anterior como valor inicial).
- **Indicador de lucro além da margem**: "margem real" (sobre a venda) trava
  matematicamente em 100%; foi adicionado **markup** ("lucro sobre o
  custo", `js/calculations.js:calculateMarkup`), que não tem teto — bate
  como confeiteiros realmente pensam ("lucro de 200%").
- **Simplificação da seção "Resultados"**: virou hierárquica — custo por
  porção e preço sugerido sempre visíveis, resultado central em
  linguagem simples ("Você lucra R$X por unidade"), detalhes técnicos
  (margem %, markup %, breakdown de embalagem) escondidos atrás de um
  `<details>` "Ver detalhes do cálculo".
- **Remoção do "Escalar Receita"**: feature de multiplicar receita por um
  fator foi removida a pedido do usuário (função `escalarReceita` e botão
  excluídos por completo).
- **Melhorias na entrada de dados de ingredientes**:
  - Dica de conversão em gramas (`≈ 60g`) abaixo da quantidade quando há
    conversão de volume/densidade acontecendo (xícara/colher, ou "unidade"
    com peso médio conhecido).
  - Agrupamento visual "Usado na receita" vs "Embalagem comprada" nas
    colunas da tabela de ingredientes.
  - (Chips de fração rápida 1/4, 1/3, 1/2... foram adicionados e depois
    **removidos** a pedido do usuário — o placeholder "Qtd (ex: 1/2)" já
    basta.)
  - (Colapsar linhas de ingrediente já preenchidas num resumo compacto foi
    **implementado e depois revertido** a pedido do usuário — ele quer
    todas as colunas sempre visíveis, sem esconder nada.)
- **Ordenação alfabética**: lista "Minhas Receitas" e o datalist de sugestão
  de nome de ingrediente agora ordenam por `localeCompare` com locale
  `pt-BR` e `sensitivity: 'base'` (ignora acento/maiúscula).
- **Duplicar receita**: a cópia agora entra logo depois da receita original
  na lista (antes ia sempre pro final).
- **Botão "Gerar Tabela Nutricional Média"**: removido o card branco atrás
  dele — agora é um botão solto, no mesmo estilo visual dos botões
  Salvar/Editar.
- **Receita existente aberta**: seção "Custos Extras e Operacionais" agora
  vem **recolhida por padrão** (`<details>` fechado) ao abrir uma receita
  já salva, mostrando só Ingredientes de cara. Fica aberta normalmente ao
  criar uma receita nova ou clicar em "Editar". O campo "Quanto você vai
  cobrar?" (em Resultados) passou a ser **editável mesmo com a receita
  travada** — calcular lucro não deveria exigir destravar a receita
  inteira.
- **Deploy**: repositório tornado público e publicado via GitHub Pages
  (branch `master`, raiz `/`). Um servidor local (`server.js` +
  `Abrir Calculadora.bat`) chegou a ser criado para uso 100% offline, mas
  foi removido depois que o GitHub Pages resolveu o caso de uso real
  ("mandar o link pra alguém abrir").
- **Reforma mobile-first (A+B)** — spec em
  `docs/superpowers/specs/2026-09-24-mobile-first-design.md`. Lista em
  cartões com menu ⋯, busca e "Desfazer"; editor em abas (Ingredientes ·
  Custos · Preço · Nutrição) com barra de resultado fixa; ingrediente
  editado num painel que sobe de baixo (substitui a tabela de colunas e o
  modal de ingrediente customizado); **modo travado Salvar/Editar
  removido** (autosave + "✓ Salvo"); preço sugerido corrigido para **por
  unidade** (antes multiplicava o custo total); WhatsApp envia **só a
  receita**, sem custos; voltar do celular navega dentro do app; campos de
  moeda funcionam como app de banco (dígito sempre entra à direita).
  Várias decisões anteriores foram revisitadas conscientemente pelo usuário
  (todas as colunas visíveis → painel; seção Custos recolhida → aba).
- **Leitura de nota de compra + PWA** — spec em
  `docs/superpowers/specs/2026-10-15-leitura-nota-design.md`. Na aba
  Ingredientes, "📷 Ler nota de compra": foto, imagem escaneada ou texto
  colado (e-mail/SEFAZ) → itens lidos (quantidade, tamanho em
  g/kg/mg/ml/L/unidades, valor) → **tela de conferência obrigatória**
  (leitura por foto erra) com cada item ligado a um ingrediente → aplica
  preço/embalagem, banco de preços e apelidos ("LEITE COND MOCA" →
  Leite condensado, lembrado na próxima nota) → resumo "esta receita gasta
  R$ X do que você comprou, dá para fazer N receitas = M unidades, acaba
  primeiro: …", guardado em `recipe.compra` (cartão "Sua última compra").
  Só **foto ou print** do cupom (PDF fora, decisão do usuário em
  2026-10-15). Leitura **no aparelho** (decisão do usuário: grátis, sem conta, foto não
  sai do celular) — não usa IA nem servidor. Embalagem passou a aceitar
  kg, mg e L. Correções junto: tabela nutricional agora conta "1 lata"
  (antes saía "sem dados"); ingrediente novo achado na TACO guarda a
  densidade (xícara/colher convertem). App instalável e offline (PWA,
  antecipado da etapa D).
- **Lucro de verdade (etapa C)** — spec em
  `docs/superpowers/specs/2026-10-15-lucro-de-verdade-design.md`. Painel
  **"Meu negócio"** (Ajustes ou convite na aba Preço): quanto quer ganhar
  por mês + horas/semana → valor da hora; contas fixas do mês rateadas
  **por hora trabalhada**; taxas de maquininha e iFood; lucro extra (%).
  Na receita: **tempo de trabalho** e **perda (%)** (aba Custos), **onde
  vende** (aba Preço). Sugestões **Mínimo** (não perde) · **Justo** (paga a
  hora) · **Com lucro**, arredondadas para cima a preço fácil de cobrar
  (substituíram 2×/3×/4×, decisão do usuário). Número principal da barra e
  da lista: **"Você ganha"** (trabalho + lucro juntos, decisão do usuário)
  e **"sua hora rendeu R$ X"** contra a meta. Sem "Meu negócio" a conta é
  a de antes. Junto: "porções" → "unidades"; etiqueta "N sem preço" na
  lista; aviso para salvar backup / instalar no iPhone;
  `navigator.storage.persist()` ao criar receita.
- **Lucro de verdade recolhido (2026-10-16, pedido do usuário)** — "quero
  algo mais simples pro usuário casual". Saíram "Meu negócio" (salário,
  horas, contas fixas, lucro extra), tempo de trabalho, perda (%), "sua
  hora rendeu" e Mínimo/Justo/Com lucro. Ficou: **Custos = Embalagem +
  Gás**; **custo = ingredientes + embalagem + gás**; aba Preço com **onde
  vende** e a **taxa da maquininha/iFood digitada ali mesmo** (global,
  `js/taxas.js`, mesma chave `calculadora-cozinha:negocio` para não perder
  taxa já digitada); sugestões **2× · 3× · 4× o custo** (decisão do
  usuário), arredondadas para cima e já compensando a taxa; "Você ganha" =
  preço − custo − taxa. Também: regra global `[hidden] { display: none
  !important }` (o campo de taxa não sumia por causa de `.field`).
  **Para retomar o Lucro de verdade:** a versão completa está nos commits
  `1e72a80` (conta) e `5acd1a6` (telas) — `git show 5acd1a6 --stat` lista
  os arquivos; a spec continua em
  `docs/superpowers/specs/2026-10-15-lucro-de-verdade-design.md`.
- **Instalar o app (2026-10-16)** — cartão no topo da lista: no
  Chrome/Android, botão **"📲 Instalar o app"** que abre o pedido de
  instalação do próprio navegador (`beforeinstallprompt`, guardado em
  `js/instalar.js`); no iPhone, passo a passo com o ícone de Compartilhar
  (a Apple não permite instalar por botão). Some quando o app já está
  instalado; "Agora não" esconde por 30 dias. Um cartão por vez: instalar
  vem antes do lembrete de backup (`js/protecao.js`). Também em Ajustes →
  "App no celular". Publicar nas lojas ficou para depois: Google Play
  (conta US$ 25 + arquivo de verificação na raiz do domínio) e App Store
  (US$ 99/ano, risco de recusa de app que é só site).
- **Nome "Doce Lucro" + ícone de cupcake (2026-10-16)** — o nome curto
  "Calculadora" se confundia com a calculadora do sistema. Agora
  `short_name`/`apple-mobile-web-app-title` = **Doce Lucro** (10 letras,
  cabe sob o ícone); `name`/`<title>` = "Doce Lucro — Calculadora de
  Cozinha". Ícone **desenho original** (não copiado do Flaticon: a licença
  grátis exige crédito e proíbe uso como logo), no estilo que o usuário
  mandou: cobertura rosa-clara com escorrido, massa, forminha listrada
  azul-clara e branca, cereja, sobre fundo framboesa. O endereço do site
  não mudou. O texto do WhatsApp **não tem mais assinatura** (vai para
  cliente, e "Doce Lucro" fala em lucro).
- **Receitas no app instalado (2026-10-16)** — Android/Chrome: o app
  instalado usa o mesmo armazenamento do Chrome (nada a fazer). iPhone: o
  app da Tela de Início tem armazenamento **separado** do Safari e começa
  vazio. Por isso, no Safari, "📋 Copiar minhas receitas" (backup inteiro
  na área de transferência, com o marcador `DOCE-LUCRO-RECEITAS:`) e, no
  app instalado vazio, cartão "Trazer suas receitas do Safari" com "📋
  Colar minhas receitas" (se o iPhone negar a leitura, campo para colar à
  mão). Também em Ajustes → App no celular. Importa com a mesma regra do
  backup (não duplica).
- **Sugestões de ingrediente por categoria (2026-10-16)** — o `<datalist>`
  (11 fixos + customizados) foi trocado por uma lista própria sob o campo
  "Ingrediente" (`js/ui/sugestoes.js`). Campo vazio: botões de categoria
  (**Confeitaria**: Base, Lácteos, Chocolates, Recheios e coberturas,
  Aromas e outros; **Salgados**: Massas, Recheios, Temperos, Empanar e
  fritar; "Meus ingredientes" se houver customizados). Digitando: nomes
  que combinam (sem acento/maiúscula; começo do nome → começo de palavra →
  qualquer parte), com a categoria ao lado. Tocar preenche o nome e
  dispara `change` (mesmo fluxo de antes: fixo, preço conhecido, TACO).
  Só nomes em `js/ingredientes-sugeridos.js` — nutrição continua vindo dos
  fixos/TACO. Um item pode estar em mais de uma categoria; na busca
  aparece uma vez. Atum, sardinha e bacalhau foram retirados a pedido do
  usuário. Classes CSS `ing-sug*` (`.sugestoes`/`.sugestao` já são os
  botões 2×/3×/4× da aba Preço). A lista e o contêiner ficam fora da
  ordem do Tab (`tabindex=-1`): o Chrome torna focável a caixa com
  rolagem, e como ela some no blur o foco caía no `<body>`.
- **Receitas prontas + modo de preparo (2026-10-16)** — spec em
  `docs/superpowers/specs/2026-10-16-receitas-prontas-design.md`. Tela
  inicial com título **Doce Lucro** e abas **Minhas receitas · Receitas
  prontas** (`#/prontas`; detalhe em `#/prontas/<id>`). 16 receitas
  (bolos, docinhos, tortas, salgados) em `data/receitas-prontas.json`,
  pesquisadas no TudoGostoso e escaladas para **20–30 unidades por leva**
  (quem trabalha sozinho, decisão do usuário); fritos com **óleo de
  fritura** (500 ml por leva); água com `semCusto` (aparece, não custa;
  renomear a linha devolve o custo). Detalhe com ingredientes por **seção**
  (Massa, Recheio…) e passos; fonte, tempo e dificuldade não aparecem
  (decisão do usuário). **"Usar esta receita"** copia para Minhas receitas
  (preço já usado, fixos, TACO na hora; nome repetido → "(cópia)";
  `origem` = id da pronta) e abre o editor (o ← volta ao catálogo).
  Receitas da pessoa ganharam **Modo de preparo** na aba Ingredientes
  (painel `#/receita/<id>/ingredientes/preparo`, um passo por linha,
  numeração colada é limpa) e o WhatsApp leva os passos. Na cópia, a
  TACO vem **só pelo nome exato curado** (`taco` no JSON; adivinhar por
  trecho casava "Sal" com biscoito salgado e "Mel" com "verMELho"), e o
  JSON traz `densidadeGml`/`nutricao100g` quando a TACO não tem — um teste
  garante que toda linha calcula custo depois de ter preço. Só embalagem
  inteira vai em "unidade" (lata, caixinha, pacote, ovo); tablete/sachê e
  hortifrúti em gramas. Linhas com o mesmo nome (Óleo para refogar e para
  fritar) compartilham o preço, e a nota soma todas no rendimento.
- **Preço de referência de mercado (2026-10-16)** — spec em
  `docs/superpowers/specs/2026-10-16-precos-referencia-design.md`. Robô
  semanal (GitHub Actions, segunda 06:00 de Brasília; à mão:
  `npm run precos`, `-- --dry-run` só mostra) busca no catálogo público do
  **Savegnago** (VTEX; Mercado Livre exige login e responde 403; o
  navegador não pode consultar direto por CORS) os ingredientes de
  `scripts/precos-referencia.config.json` (termo, palavras obrigatórias e
  proibidas por palavra inteira, embalagem típica e janela de tamanho em
  g/ml/unidade). Preço = **mediana da embalagem típica**, mínimo 2
  produtos; senão fica sem referência (melhor vazio que errado). Proteção:
  menos de 70% da semana anterior → não grava e o job falha (e-mail).
  Primeira carga: 42/47. No app: ao copiar receita pronta, linha sem preço
  dela recebe a referência (`origemPreco: 'referencia'`, `referenciaEm`),
  com etiqueta "referência" (ou "referência antiga" após 30 dias), aviso
  no painel ("Savegnago, interior de SP") e cartão "Atualizar N preços"
  quando chega semana nova. Preço digitado, da nota, do banco ou
  propagado tira a marca; a referência **nunca** entra no banco de preços.
  Backup antes: tag `backup-2026-10-16-pre-precos-referencia`.
- **Nome "Doce Valor" + ícone de fatia de bolo (2026-10-17)** — resolvida a
  pendência de troca de nome: **Doce Valor** substitui "Doce Lucro"
  (10 letras, mesmo tamanho, cabe sob o ícone). Trocado em `<title>`,
  `apple-mobile-web-app-title`, `application-name`, `manifest.webmanifest`
  (`name`/`short_name`), cabeçalho da tela inicial
  (`js/screens/home-header.js`), textos de instalar/transferir
  (`js/screens/instalar-passos.js`, `js/screens/lista.js`) e no
  User-Agent do robô de preços (`DoceValorBot/1.0`). **Decisão
  consciente:** o marcador interno `DOCE-LUCRO-RECEITAS:` (prefixo
  invisível usado por "Copiar/Colar minhas receitas" no iPhone,
  `js/transferencia.js`) **não foi renomeado** — é um protocolo interno,
  nunca aparece pro usuário, e trocar quebraria quem já copiou no Safari
  numa versão antiga e ainda não colou. Ícone: desenho original (mesmo
  estilo chapado, mesmo fundo framboesa/gradiente), agora uma **fatia de
  bolo em corte** (ponta para baixo, duas camadas de massa com recheio,
  cobertura com escorrido, cereja no topo) no lugar do cupcake — gerado
  por `node scripts/build-icons.mjs` a partir de `icons/icon.svg` e
  `icons/icon-maskable.svg`. Não foi preciso subir o `CACHE` do `sw.js`
  (mesmos nomes de arquivo, conteúdo novo — o app usa network-first pros
  arquivos do próprio site, então a atualização chega sozinha).
- **Modo cozinhando (2026-10-17)** — fecha a feature "Receitas prontas com
  passo a passo". Botão **"👩‍🍳 Modo cozinhando"** tanto na receita pronta
  (ao lado de "Usar esta receita") quanto no card de Modo de preparo de
  qualquer receita da pessoa: abre uma tela cheia (`js/ui/cozinhando.js`),
  um passo por vez, letra grande, com **Wake Lock** (`navigator.wakeLock`,
  best-effort — silencioso onde não existe) pra tela não apagar, e
  reativado se o app volta a ficar visível. Quando o próprio texto do
  passo menciona um tempo ("asse por 40 minutos", "1h30", intervalos como
  "30-40 min" usam o maior valor), aparece um **cronômetro** regressivo
  (iniciar/pausar/retomar/reiniciar; vibra no fim se o aparelho suportar) —
  detecção pura e testada em `js/cozinhando.js`
  (`detectarDuracaoMs`/`formatarDuracao`). Trocar de passo sempre para o
  cronômetro do passo anterior (decisão: ele pertence ao passo que você
  estava lendo, não é um timer de fundo). Roteado como os outros painéis
  do editor (`#/receita/<id>/ingredientes/cozinhar`) e como um item novo
  da receita pronta (`#/prontas/<id>/cozinhar`), então o botão de voltar
  do celular fecha o modo cozinhando antes de sair da tela.
- **Meus ingredientes + robô diário (2026-10-17)** — tela nova
  (`#/meus-ingredientes`, aberta por Ajustes → Preços → "🧂 Meus
  ingredientes"): todo ingrediente usado em alguma receita, numa lista só,
  com o preço efetivo (o que ela já pagou — banco de preços — ou, na
  falta dele, o que alguma receita já tiver, mesmo vindo da referência) e
  "sem preço" com a referência de mercado como dica para quem não tem
  nada ainda. Tocar abre a mesma ficha de preço do editor (preço,
  tamanho, unidade), **pré-preenchida com a referência** quando é o caso;
  salvar grava no banco de preços e propaga pra todas as receitas (mesmo
  fluxo de "🔄 Usar este preço em outras receitas" já existente — nunca
  muda sozinho depois disso). O robô de preços passou a rodar **todo dia**
  às 06:00 de Brasília (antes: só segunda; `.github/workflows/precos-referencia.yml`,
  cron `0 9 * * *`). Toggle **"Atualizar valor automaticamente"** (OFF
  por padrão, `calculadora-cozinha:atualizar-precos-auto`): liga e já
  roda uma vez; enquanto ligado, roda sozinho (no boot do app,
  `js/app.js`) preenchendo linhas sem preço e atualizando linhas antigas
  da referência **em todas as receitas**, sem precisar abrir cada uma
  (`atualizarPrecosAutomaticamente`/`aplicarAtualizacaoAutomatica` —
  mesma lógica do cartão "Atualizar N preços" por receita, só que pra
  todas de uma vez). Também dá pra forçar isso a qualquer momento com
  "🔄 Atualizar agora", com o toggle desligado. **A exceção continua
  valendo**: preço que ela digitou nunca é sobrescrito automaticamente —
  só filling de linha vazia ou atualização de linha que já era
  referência. Textos que diziam "semana de DD/MM" viraram "atualizado em
  DD/MM" (não fazia mais sentido falar em semana com o robô diário).
- **Cardápio compartilhável (2026-10-17)** — tela nova
  (`#/cardapio`, aberta por Ajustes → Vender → "🛍️ Cardápio para o
  cliente"): escolhe quais receitas entram (confirma uma a uma, nada vai
  sem querer), cada uma com **foto**, **quantidade** e **preço pro
  cliente** em texto livre dela — nunca custo, margem ou qualquer número
  interno, igual ao texto do WhatsApp. A foto fica por receita no
  IndexedDB (`js/fotos.js`, primeiro uso de IndexedDB no código do app —
  localStorage não aguenta binário; falha em silêncio onde não existe),
  reduzida pro maior lado ter até 640px antes de guardar. Duas saídas,
  geradas só com o que estiver marcado, nomeado e com preço
  (`itensProntos`, `js/cardapio.js`):
  **PDF** — monta a lista de novo num bloco escondido
  (`.cardapio-print`) e chama `window.print()`; CSS de impressão troca
  pra ele com uma classe no `<body>` (`cardapio-imprimindo`), não
  `:has()` — um `:has()` reavaliado a cada re-render (o app re-renderiza
  bastante) travou a aba de verdade num teste, por isso a troca.
  **Imagem** — desenha tudo num `<canvas>` (foto, nome, quantidade,
  preço, uma por linha) e exporta PNG; com `navigator.share` capaz de
  `files` (Android/Chrome) abre o seletor do sistema (WhatsApp incluído);
  sem isso, baixa o arquivo pra anexar à mão. Mesma regra de sempre: só
  o que o cliente vê, nada de números do negócio.

## Decisões de design/UX a preservar (ou revisitar conscientemente)

- Cor de marca do WhatsApp é fixa nos dois temas (claro/escuro) — é uma cor
  de marca, não um token semântico do app.
- Modo claro: bordas de card/input levemente acinzentadas (contraste
  verificado). Modo escuro: bordas de card transparentes (decisão
  explícita do usuário — "no modo escuro mantenha como está").
- `calculateMarkup` e `calculateRealMargin` são indicadores
  **intencionalmente separados** — não substituir um pelo outro. Ambos
  são calculados sobre o gasto por unidade (ingredientes + embalagem +
  gás + taxa da venda).
- Simplicidade para o usuário casual (decisão de 2026-10-16): não pedir
  tempo de trabalho, salário nem contas fixas — Custos só tem Embalagem e
  Gás.
- Dados só no aparelho (decisão do usuário, 2026-10-15): sem login/nuvem.
- Ingredientes com dado de açúcares adicionados/gordura saturada: gordura
  saturada só é somada quando vem da base TACO (dado real de laboratório);
  açúcares adicionados só quando o ingrediente tem esse campo cadastrado
  manualmente. Isso é avisado na própria tabela nutricional gerada.
- A tabela nutricional gerada **não é** um laudo certificado — isso é
  disclosed no rodapé da própria tabela.

## Testes e verificação usados neste projeto

- `npm test` — testes unitários de todos os módulos puros.
- `npm run test:mobile` — Playwright em 390×844, temas claro e escuro,
  capturas em `scripts/.screenshots/` (ignorado pelo git). Confira as
  capturas antes de dar uma mudança de UI por concluída. Sem o Chromium
  do Playwright baixado, usa o Chrome/Edge instalado (ou
  `CHROMIUM_PATH=/caminho/chrome`). `npm run test:mobile -- 08` roda só
  um cenário.
- `SMOKE_OCR=1 npm run test:mobile -- 09` — leitura real de uma imagem de
  cupom com o Tesseract (precisa de internet; sem a variável, "skip").
- `node scripts/check-contrast.mjs` — contraste WCAG dos pares de cor.

## Próximos passos planejados

- **Lucro de verdade** (recolhido, ver acima) — mantido simples por ora,
  a pedido do usuário (2026-10-17); retomar só quando ele pedir: mão de
  obra, contas fixas, perda, preço justo, "sua hora rendeu".
- **Meus ingredientes**: **feito** (tela + robô diário + "Atualizar valor
  automaticamente" — ver Funcionalidades). A nota fiscal já atualiza o
  banco de preços de onde essa tela lê (`savePreco` em
  `js/screens/editor/nota-sheet.js`), então aplicar uma nota também
  atualiza "Meus ingredientes" sozinho. Falta só o "aviso de preço
  velho" (banco com um preço digitado há muito tempo, sem checar se
  ainda é esse o valor) — pequeno, pode entrar depois.
- **Meu mês** — registrar vendas em 2 toques; faturamento, gasto com
  matéria-prima e lucro do mês. Confirmado pelo usuário (2026-10-17) que
  fica para depois.
- **Receitas prontas com passo a passo**: **feito** (modo de preparo,
  galeria "Receitas prontas" e modo cozinhando — ver Funcionalidades).
  Falta só o livro em PDF, abaixo.
- **Apostila / livro de receitas (ebook)** (ideia do usuário, 2026-10-16;
  implementar depois). Dois caminhos possíveis:
  - **"Meu livro de receitas"** gerado pelo app a partir das receitas da
    pessoa (e das prontas): capa, sumário, cada receita com ingredientes,
    rendimento e passo a passo — **sem custos** (como o WhatsApp). Exporta
    em PDF com CSS de impressão (`window.print()` → "Salvar como PDF"),
    sem dependência nova. Serve para presentear ou vender.
  - **Apostila que ensina a cozinhar**: técnicas (ponto do brigadeiro,
    temperar chocolate, massa de bolo), boas práticas e como precificar —
    é conteúdo autoral, mais escrita que código; poderia ser vendida fora
    do app (Hotmart/Kiwify).
  - Dependências já prontas (modo de preparo, receitas prontas, modo
    cozinhando); é o único passo que falta dessa sequência.
- **Cardápio compartilhável**: **feito** (2026-10-17 — ver Funcionalidades).
  Original do backlog também citava orçamento para cliente, link que
  importa receita e receitas modelo — ainda não detalhado/implementado.
- **Leitura de nota, ingrediente novo da nota**: **feito** (2026-10-17) —
  no "Usar para" de cada item lido, "+ Novo ingrediente" cria a linha na
  receita (nome digitado ali, preço/embalagem vêm da nota; "quanto usa na
  receita" fica para ela preencher depois, a nota não tem como saber
  isso). QR Code da NFC-e e leitura por IA **ficam de fora por enquanto**
  (decisão do usuário, 2026-10-17) — a leitura continua só por foto ou
  print, no aparelho, sem servidor nem IA.
