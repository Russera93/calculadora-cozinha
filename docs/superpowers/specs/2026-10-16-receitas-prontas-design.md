# Receitas prontas + modo de preparo — design

Data: 2026-10-16 · Branch: `receitas-prontas` (a partir de
`sugestoes-categorias`, que traz os nomes padronizados de ingredientes)

## 1. Objetivo

Dar à confeiteira/salgadeira um catálogo de **receitas padronizadas**
(bolos, brigadeiros, tortas, salgados…) que ela abre, lê (ingredientes,
quantidades, passo a passo) e **traz para as receitas dela** para usar no
dia a dia — já calculando custo com os preços que ela conhece.

Decisões do usuário (2026-10-16):

- "Usar esta receita" **vira uma receita dela** em Minhas receitas
  (editável), levando ingredientes, quantidades, rendimento e modo de
  preparo.
- Lugar no app: **abas na tela inicial** — "Minhas receitas · Receitas
  prontas".
- Modo de preparo da receita dela: **seção abaixo dos ingredientes**, na
  aba Ingredientes (as 4 abas do editor continuam).
- Conteúdo em **`data/receitas-prontas.json`**, que funciona igual no site
  e no app instalado (inclusive no iPhone, cujo armazenamento é separado do
  Safari: o catálogo é arquivo do app, não dado do aparelho).
- Conteúdo: 16 receitas pesquisadas no app do Claude (§7a), convertidas
  para o formato do §2; nada é publicado antes da conversão revisada.
- Receitas escaladas para **20–30 unidades por leva** (quem trabalha
  sozinho), com óleo de fritura nos fritos (§7a).
- Água aparece na receita, **sem custo** (§4a).
- Do material extra da pesquisa, o detalhe mostra **só as seções**
  (Massa, Recheio…); tempo, dificuldade, "por que vender" e fonte não
  aparecem.

## 2. Dados: `data/receitas-prontas.json`

```json
{
  "categorias": [{ "id": "docinhos", "nome": "Docinhos e trufas" }],
  "receitas": [{
    "id": "brigadeiro",
    "nome": "Brigadeiro tradicional",
    "categoria": "docinhos",
    "rendimento": 30,
    "unidadeRendimento": "docinhos",
    "ingredientes": [
      { "nome": "Leite condensado", "quantidade": "1", "unidade": "unidade", "observacao": "lata de 395 g" },
      { "secao": "Cobertura", "nome": "Granulado", "quantidade": "100", "unidade": "g", "observacao": "a gosto" },
      { "nome": "Água", "quantidade": "500", "unidade": "ml", "semCusto": true }
    ],
    "preparo": ["Em uma panela, junte…", "Mexa em fogo baixo…"],
    "fonte": { "site": "TudoGostoso", "url": "https://…" }
  }]
}
```

- `id`: único, minúsculas com hífen (vai no endereço `#/prontas/<id>`).
- `secao` (opcional): agrupa os ingredientes no detalhe (Massa, Recheio,
  Cobertura, Para empanar…), na ordem em que aparecem. Ingredientes sem
  seção ficam numa lista só.
- `unidadeRendimento` (opcional, padrão "unidades"): só para exibir
  ("Rende 30 docinhos"); a cópia usa `rendimento` como unidades.
- `semCusto: true`: ingrediente que aparece mas não entra no custo (água
  da torneira). Na cópia vira `item.semCusto = true` (ver §4a).
- `fonte`: registro de onde a receita veio; **não é mostrado** no app
  (decisão do usuário: do material extra, o detalhe mostra só as seções).
- `unidade`: as do app — `g`, `ml`, `xicara`, `colherSopa`, `colherCha`,
  `unidade`. `quantidade`: texto que `parseQuantity` entende ("2", "1/2",
  "0,5").
- "A gosto"/"1 pitada" viram uma quantidade pequena (ex.: 1 c. chá) com
  `observacao: "a gosto"` — linha sem quantidade apareceria como "falta a
  quantidade" na cópia.
- Nomes de ingredientes seguem `js/ingredientes-sugeridos.js` (casam com
  sugestões, ingredientes fixos e banco de preços).
- Carregado sob demanda (`js/receitas-prontas-loader.js`, mesmo padrão de
  `taco-loader.js`: uma promessa em cache) só ao abrir a aba; entra no
  `PRECACHE` do `sw.js` (offline; rede primeiro traz cada atualização).

**Validação** (`js/receitas-prontas.js`, puro): `validarCatalogo(data)`
devolve a lista de problemas — id repetido/inválido, categoria
inexistente, rendimento não inteiro positivo, sem ingredientes, unidade
inválida, quantidade ilegível, preparo vazio. Teste unitário roda sobre o
arquivo real: **zero problemas**. Ingrediente fora da lista de sugestões
é aviso separado (`nomesForaDaLista`), também testado, para padronizar.

## 3. Telas e navegação

**Rotas** (`js/router.js`, testadas): `#/` Minhas receitas,
`#/prontas` catálogo, `#/prontas/<id>` detalhe. `#/ajustes` continua.
Voltar do celular percorre: detalhe → catálogo → Minhas receitas.

**Tela inicial**: título **Doce Lucro**; logo abaixo, componente `.tabs`
(o mesmo do editor) com **Minhas receitas · Receitas prontas**. O botão
"+ Nova receita" só em Minhas receitas. Estado vazio de Minhas receitas
ganha um segundo botão: **"Ver receitas prontas"**.

**Catálogo** (`js/screens/prontas.js`): campo de busca (nome, sem
acento) + chips de categoria (**Todas** + as do arquivo, `aria-pressed`);
cartões no estilo `.recipe-card` com nome e "Rende 30 unidades · 5
ingredientes" (com `unidadeRendimento`: "Rende 30 docinhos"), sem menu ⋯. Carregando: "Carregando receitas…"; falha:
"Não foi possível carregar as receitas prontas — verifique sua conexão."
Nenhum resultado: "Nenhuma receita com "…"".

**Detalhe** (`js/screens/pronta.js`, tela própria — texto longo, para ler
cozinhando): topbar com ← e o nome; etiqueta da categoria e "Rende N
docinhos"; card **Ingredientes** com linhas "1 colher de sopa de
Manteiga" (mesmo formato do WhatsApp) + observação em cinza, agrupadas
por `secao` com subtítulo (Massa, Recheio…) quando a receita tem seções;
card **Modo de preparo** com passos numerados (`.passos`).
Rodapé fixo (posição da barra de resultado do editor): botão primário
**"Usar esta receita"**. Id inexistente: aviso "Receita não encontrada" e
volta ao catálogo.

## 4. "Usar esta receita" (`js/receitas-prontas.js`, puro)

`criarReceitaDePronta(pronta, { existentes, custom, precoDe, taco, base })`
→ receita nova:

1. `base` = `createEmptyRecipe()` (id, datas, gás com o botijão salvo).
   Nome = nome da pronta; se já existir receita com esse nome (sem
   acento/maiúscula), "Nome (cópia)".
2. `rendimento` e `quantidadeEmbalagens` = rendimento da pronta;
   `modoPreparo` = cópia dos passos; `origem` = id da pronta.
3. Cada ingrediente: `emptyIngredientItem()` + nome, quantidadeBruta,
   unidade → `applyIngredientMatch` com ingrediente fixo/customizado e
   **preço já usado** (`getPreco`). Desconhecido → `findInTaco` (nutrição
   e densidade, para xícara/colher terem custo).

A tela aguarda `getTacoIngredients()` (sem TACO, segue sem nutrição),
salva, mostra o toast "Receita copiada para Minhas receitas" e abre o
editor da cópia na aba Ingredientes (os "sem preço" já aparecem).

A seção não vai para a cópia (a receita da pessoa não tem seções); a
ordem dos ingredientes é mantida. O mesmo ingrediente em duas seções
(Manteiga na massa e no recheio) vira duas linhas, como na pronta.

## 4a. Ingrediente sem custo

`item.semCusto = true` (só vem de receita pronta; não há botão para
marcar à mão nesta etapa): `computeLineCost` devolve 0, `lineIssue` não
acusa "sem preço", e ele não conta em "N sem preço" na lista. O painel do
ingrediente mostra "Não entra no custo" no lugar de "Quanto pagou".
`migrateRecipe` não mexe (campo ausente = tem custo).

## 5. Modo de preparo na receita da pessoa

- Campo `modoPreparo: string[]`; `migrateRecipe` dá `[]` às antigas;
  `createEmptyRecipe` também. Backup, transferência para iPhone e
  Duplicar levam junto sem mudança.
- Aba Ingredientes, após "Ler nota de compra": título **Modo de preparo**
  (mesmo estilo do título Ingredientes); com passos, card numerado +
  "Editar"; sem passos, "Ainda sem passo a passo." + "✏️ Escrever modo de
  preparo".
- Painel (rota `#/receita/<id>/ingredientes/preparo`, voltar fecha):
  `<textarea>` grande, dica "Um passo por linha", botão Pronto; salva ao
  digitar (autosave, "✓ Salvo").
- `textoParaPassos(texto)` (puro): separa por linha, apara, tira linhas
  vazias e numeração colada no começo ("1.", "2)", "3 -", "-", "•").
  `passosParaTexto(passos)` faz o inverso para editar.
- **WhatsApp** (`js/share.js`): depois de "Rende…", "Modo de preparo:" e
  os passos numerados, quando houver. Nada de dinheiro, como antes.

## 6. Visual

Só componentes e tokens existentes: `.tabs`, `.card`, `.recipe-card`,
`.chip`, `.btn-primary`, `.passos`, `.tag`, sheet. Nenhuma cor nova
(contraste já verificado). Largura 390 px sem rolagem lateral; temas
claro e escuro.

## 7. Testes

- Unitários: rotas novas; `validarCatalogo` e `nomesForaDaLista` (com
  fixture e com o arquivo real); `criarReceitaDePronta` (nome repetido,
  preço conhecido, fixo, TACO, sem TACO, origem, rendimento);
  `textoParaPassos`/`passosParaTexto`; `migrateRecipe`/`createEmptyRecipe`
  com `modoPreparo`; texto do WhatsApp com e sem passos; `sw.test` com os
  arquivos novos no PRECACHE.
- Smoke (`scripts/smoke/14-prontas.mjs`, claro e escuro): abas da tela
  inicial → catálogo → busca e chip → detalhe → Usar esta receita → editor
  com ingredientes e passos → editar modo de preparo → voltar do celular;
  sem rolagem lateral; capturas conferidas.
- Os unitários de `criarReceitaDePronta` usam uma fixture pequena
  (`js/fixtures/receitas-prontas.json`); `validarCatalogo` roda também
  sobre o arquivo real (zero problemas). O smoke usa o arquivo real.
- Catálogo vazio (arquivo sem receitas) mostra "Em breve: receitas prontas
  para você usar." — testado com a fixture vazia.

## 7a. Conteúdo inicial (16 receitas)

Pesquisa feita no app do Claude (TudoGostoso, mais avaliadas e fáceis de
vender): 3 bolos, 5 docinhos, 2 tortas, 6 salgados. O rascunho original
está no commit do arquivo, antes da conversão. Conversão para o formato
do §2:

- **Medidas** → unidades do app: copo americano = 190 ml (vira ml, com
  "3 copos americanos" na observação); colher de sobremesa = 2 c. chá;
  litro/kg → ml/g; intervalo ("650 a 700 g", "3 a 4 claras") → o maior,
  com o intervalo na observação; "a gosto"/"pitada"/"o suficiente" →
  quantidade pequena realista + observação.
- **Contagem**: `unidade` só para o que se compra por unidade ou é
  embalagem inteira (ovo, lata, caixinha, pacote, tablete, sachê).
  Hortifrúti e itens vendidos a peso vão em **gramas** com a contagem na
  observação ("360 g — 3 cenouras médias"), porque "1 unidade" de algo
  comprado por kg custaria o pacote inteiro.
- **Correções de conteúdo**: brigadeiro usa Chocolate em pó (achocolatado
  como alternativa na observação), como diz o preparo; coxinha empana na
  farinha de rosca (o preparo dizia farinha de trigo) e a pimenta vira
  "Pimenta dedo-de-moça"; esfiha ganha Gergelim, Cebolinha e Sal (estavam
  só no preparo/observação); enroladinho ganha "Tempero pronto" (sachê);
  pão de queijo ganha Sal e o passo "ajuste o sal" vai para a mistura;
  caldo **líquido** da torta vira Água (sem custo) + Caldo de galinha
  (tablete), para não misturar preço com o tablete da coxinha;
  Cravo-da-índia → Cravo.
- **Nomes novos na lista de sugestões**: Cenoura, Fubá, Queijo ralado,
  Mel, Biscoito maisena, Água, Gordura vegetal, Pimentão, Azeite,
  Gergelim, Pimenta dedo-de-moça, Tempero pronto.
- Saem do arquivo (não mostrados): tempo, dificuldade, custo relativo,
  "por que vender" (citava nota/avaliações de outro site).
- **Escala (decisão do usuário, 2026-10-16)**: público é o pequeno
  empresário que **trabalha sozinho e faz 20 a 30 unidades de cada** por
  leva. Cada receita é escalada para render 20–30 unidades de venda,
  com multiplicador que mantém números práticos (latas e ovos inteiros,
  no máximo 2–3 formas):

  | Receita | Fonte | Fator | Rende |
  |---|---|---|---|
  | Bolo de cenoura | 8 fatias | ×3 | 24 fatias |
  | Bolo no pote | 15 potes | ×2 | 30 potes |
  | Bolo de fubá cremoso | 20 fatias | ×1 | 20 fatias |
  | Brigadeiro | 30 | ×1 | 30 docinhos |
  | Beijinho | 50 | ×½ | 25 docinhos |
  | Trufas | 50 | ×½ | 25 trufas |
  | Palha italiana | 30 | ×1 | 30 pedaços |
  | Cajuzinho | 5 "porções" | ×1 | **30 cajuzinhos** (confirmado) |
  | Torta de frango | 15 fatias | ×2 | 30 fatias (2 formas) |
  | Torta de limão | 15 fatias | ×2 | 30 fatias (2 formas) |
  | Coxinha | 50 | ×½ | 25 coxinhas — **1 kg de farinha de rosca** (confirmado) |
  | Massa de risóis | 20 | ×1 | 20 risóis |
  | Empada de frango | 14 | ×2 | 28 empadinhas |
  | Pão de queijo | 25 | ×1 | 25 bolinhas |
  | Esfiha de carne | 30 | ×1 | 30 esfihas |
  | Enroladinho de salsicha | 30 metades | ×1 | 30 enroladinhos |

- **Óleo de fritura** (confirmado: caso de uso real): coxinha, risóis e
  enroladinho ganham, na seção "Para fritar", **Óleo 500 ml** com a
  observação "gasto por leva, em panela com ~1 L; o óleo pode ser
  reaproveitado" — a pessoa ajusta na cópia.

## 8. Fora do escopo

Modo cozinhando (um passo por tela, cronômetro, tela acesa), livro de
receitas em PDF, fotos das receitas, custo estimado no catálogo antes de
copiar, sincronizar a cópia com mudanças futuras da receita pronta.
