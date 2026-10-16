# Preço de referência de mercado — design

Data: 2026-10-16 · Branch: `precos-referencia` · Backup antes: tag
`backup-2026-10-16-pre-precos-referencia` (= `cc74ef8`, site publicado)

## 1. Objetivo

Quem começa no app (sobretudo ao copiar uma receita pronta) não quer
digitar o preço de 15–20 ingredientes. O app passa a oferecer um **preço
de referência de mercado**, pesquisado automaticamente uma vez por semana,
que preenche o que falta — sempre marcado como referência, nunca no lugar
do preço que a pessoa digitou ou leu da nota.

Decisões do usuário (2026-10-16):

- Fonte: **Savegnago para todos, com aviso de região** ("interior de SP —
  no seu mercado pode variar"). A estrutura permite outras redes depois.
- Onde aparece: **ao copiar uma receita pronta** (preenche os que faltam)
  + **botão "Atualizar preços de referência"** na receita quando houver
  semana nova (só mexe nas linhas que vieram da referência).
- Pesquisa por **robô agendado no GitHub** (semanal), com o mesmo script
  rodável à mão (`npm run precos`) como plano B.

Evidência (sondagem de 2026-10-16, só leitura):

- Mercado Livre: `api.mercadolibre.com/sites/MLB/search` responde **403**
  sem autenticação → fora.
- Savegnago: catálogo VTEX público
  (`/api/catalog_system/pub/products/search?ft=…`) com nome, marca e preço
  (`items[0].sellers[0].commertialOffer.Price`); **sem CORS** → o navegador
  não pode consultar direto (por isso o robô).
- Busca ingênua (nome do ingrediente, sem curadoria): **18/51** com preço
  confiável, e erros como "Leite" a R$ 65,88/L (pegou leite em pó) e
  "Leite condensado" trazendo pudim, suspiro e bolo. → curadoria por
  ingrediente e preço da **embalagem típica**, não média por kg.

## 2. Robô semanal

**Configuração** `scripts/precos-referencia.config.json` (só o robô usa),
uma entrada por ingrediente (nomes de `js/ingredientes-sugeridos.js`):

```json
{
  "nome": "Leite condensado",
  "busca": "leite condensado",
  "incluir": ["leite condensado"],
  "excluir": ["pudim", "bolo", "suspiro", "doce", "zero", "semidesnatado"],
  "embalagem": { "tamanho": 395, "unidade": "g" },
  "janela": [350, 400]
}
```

- `incluir`: todos devem aparecer no nome (sem acento/maiúscula);
  `excluir`: nenhum pode aparecer; `janela`: tamanho aceito, na unidade
  da embalagem (g/ml/unidade; kg e L convertidos).
- Primeira versão cobre os ingredientes das 16 receitas prontas (51 nomes,
  menos Água). Ingrediente sem entrada ou sem resultado fica sem
  referência.

**Cálculo** (`scripts/precos-referencia/calculo.js`, puro e testado):

1. Até 50 produtos por busca (`_from=0&_to=49`).
2. Filtra por `incluir`/`excluir`; lê o tamanho do nome com
   `extractPackageSize` (`js/receipt-parser.js`), também quando a unidade
   vem grudada ("395gLata"); descarta fora da `janela` e sem preço.
3. Converte cada um para o preço da embalagem típica
   (`preço × tamanhoTípico / tamanho`).
4. **Mediana**, com **mínimo de 2 produtos**; senão, sem referência.
   Arredonda para centavos.

**Saída** `data/precos-referencia.json`:

```json
{
  "atualizadoEm": "2026-10-19",
  "fonte": { "nome": "Savegnago", "regiao": "interior de SP", "url": "https://www.savegnago.com.br" },
  "precos": {
    "leite condensado": { "nome": "Leite condensado", "precoEmbalagem": 8.79, "tamanhoEmbalagem": 395, "unidadeEmbalagem": "g", "produtos": 5 }
  }
}
```

Chave = nome normalizado (`normalize`). `unidadeEmbalagem` usa os valores
do app (`g`, `kg`, `mg`, `ml`, `l`, `unidade`).

**Script** `scripts/precos-referencia.mjs` (`npm run precos`): uma busca a
cada 0,5 s, `User-Agent: DoceLucroBot/1.0 (+https://github.com/Russera93/calculadora-cozinha)`.
**Proteção**: se achar referência para menos de 70% dos ingredientes da
semana anterior, **não grava** e sai com erro (o site pode ter mudado).
Imprime um resumo (com/sem referência, mediana, nº de produtos).

**Agendamento** `.github/workflows/precos-referencia.yml`: toda
segunda-feira 09:00 UTC (06:00 de Brasília) + disparo manual;
Node 24; `npm ci` com `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; roda o script;
se o arquivo mudou, commit "Preços de referência: semana de AAAA-MM-DD"
pelo `github-actions[bot]` (`permissions: contents: write`). O push
republica o GitHub Pages. Falha → e-mail do GitHub ao dono do repositório.
(O GitHub desliga agendamentos após 60 dias sem atividade; o commit
semanal conta como atividade, e o app mostra "referência antiga" se parar.)

## 3. No app

**Dados** (`js/precos-referencia.js`, puro; `js/precos-referencia-loader.js`
carrega sob demanda, sem guardar falha):

- Linha de ingrediente ganha `origemPreco: 'referencia'` e
  `referenciaEm: 'AAAA-MM-DD'` **só** quando o preço veio da referência.
- `referenciaDe(nome, ref)` → entrada ou null.
- `aplicarReferencia(item, ref)`: preenche preço/tamanho/unidade e marca.
  Só em linha sem preço (preço 0 e tamanho 0) e sem `semCusto`.
- `limparOrigem(item)`: remove a marca (o preço passa a ser dela).
- `referenciasParaAtualizar(recipe, ref)` → linhas com
  `origemPreco: 'referencia'`, `referenciaEm` anterior a `ref.atualizadoEm`
  e preço/embalagem diferentes; `atualizarReferencias(recipe, ref)` aplica
  e devolve quantas.
- `referenciaAntiga(item, hoje)`: mais de 30 dias desde `referenciaEm`.

**A marca some** (preço vira da pessoa) quando: ela muda preço, tamanho
ou unidade da embalagem no painel; aplica uma nota (`applyPurchase`);
"Usar este preço em outras receitas" (`applyPricingToAllRecipes`); ou o
preço vem do banco de preços (`applyIngredientMatch` com preço conhecido).
`sincronizarPrecoMesmoNome` copia também a origem da linha de onde veio.

**A referência nunca entra no banco de preços**: `learnPrice` no painel
não grava linha com `origemPreco: 'referencia'` (abrir e sair do campo
sem mudar não "aprende" a referência).

**Cópia de receita pronta** (`criarReceitaDePronta` recebe `referencia`):
prioridade **preço já usado (banco) → referência → sem preço**. Sem
arquivo/sem internet, segue como hoje. A tela de detalhe carrega a
referência junto com a TACO antes de copiar.

**Na tela**:

- Linha da lista de ingredientes: resumo como hoje + etiqueta `.tag`
  **"referência"** (ou **"referência antiga"**).
- Painel do ingrediente, acima de "Quanto pagou", quando a linha é de
  referência: "💡 Preço de referência · Savegnago (interior de SP) ·
  semana de 19/10. Confira o preço que você paga." — some quando ela muda
  o preço.
- Aba Ingredientes: se `referenciasParaAtualizar` > 0, cartão
  "Preços de referência novos (semana de 19/10) · **Atualizar N preços**"
  (estilo `.aviso-card`); ao tocar, atualiza, toast "N preços
  atualizados" e o cartão some.

`sw.js`: novos módulos e `data/precos-referencia.json` no PRECACHE;
`CACHE` sobe para `calculadora-app-v8`.

## 4. Testes

- Robô (unitários, **sem internet**, respostas VTEX gravadas em
  `scripts/precos-referencia/fixtures/`): pudim descartado por `excluir`;
  "395gLata" lido como 395 g; fora da janela descartado; kg/L convertidos;
  mediana; menos de 2 produtos → sem referência; proteção dos 70%;
  formato da saída.
- App (unitários): prioridade na cópia; marca e `referenciaEm`; marca some
  em cada caminho listado no §3; `learnPrice` ignora referência;
  atualização só nas linhas de referência e só se mudou; referência
  antiga; `sincronizarPrecoMesmoNome` leva a origem.
- Smoke `scripts/smoke/15-referencia.mjs` (claro e escuro), servindo um
  arquivo de referência de teste no lugar do real (`page.route`): copiar a
  coxinha → etiquetas "referência" e custo calculado → painel com o aviso
  → mudar o preço tira a marca → semana nova → "Atualizar N preços" →
  conferir.
- **Primeira carga**: rodar o robô aqui, mostrar o resultado ao usuário
  (preços e quem ficou sem referência) e só então publicar.

## 5. Fora do escopo

Outras redes/regiões, escolha de região pela pessoa, tela "Meus
ingredientes", referência no painel de ingredientes fora da cópia,
histórico de preços, hortifrúti por peso com preço do dia.
