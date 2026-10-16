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
- O conteúdo real vem de um arquivo que o usuário vai enviar; nada é
  publicado antes disso.

## 2. Dados: `data/receitas-prontas.json`

```json
{
  "categorias": [{ "id": "docinhos", "nome": "Docinhos" }],
  "receitas": [{
    "id": "brigadeiro-tradicional",
    "nome": "Brigadeiro tradicional",
    "categoria": "docinhos",
    "rendimento": 30,
    "ingredientes": [
      { "nome": "Leite condensado", "quantidade": "1", "unidade": "unidade", "observacao": "lata de 395 g" },
      { "nome": "Manteiga", "quantidade": "1", "unidade": "colherSopa" }
    ],
    "preparo": ["Em uma panela, junte…", "Mexa em fogo baixo…"],
    "dica": "opcional"
  }]
}
```

- `id`: único, minúsculas com hífen (vai no endereço `#/prontas/<id>`).
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
ingredientes", sem menu ⋯. Carregando: "Carregando receitas…"; falha:
"Não foi possível carregar as receitas prontas — verifique sua conexão."
Nenhum resultado: "Nenhuma receita com "…"".

**Detalhe** (`js/screens/pronta.js`, tela própria — texto longo, para ler
cozinhando): topbar com ← e o nome; etiqueta da categoria e "Rende N
unidades"; card **Ingredientes** com linhas "1 colher de sopa de
Manteiga" (mesmo formato do WhatsApp) + observação em cinza; card **Modo
de preparo** com passos numerados (`.passos`); card **Dica** se houver.
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
- Até o arquivo real chegar, `data/receitas-prontas.json` existe com
  `{"categorias": [], "receitas": []}` (a validação passa; a aba mostra
  "Em breve: receitas prontas para você usar."). As receitas de exemplo
  ficam **só em fixture de teste** (`js/fixtures/receitas-prontas.json`):
  os unitários usam a fixture e o smoke a serve no lugar do arquivo
  (`page.route`). A branch só vai para o `master` com o conteúdo real.

## 8. Fora do escopo

Modo cozinhando (um passo por tela, cronômetro, tela acesa), livro de
receitas em PDF, fotos das receitas, custo estimado no catálogo antes de
copiar, sincronizar a cópia com mudanças futuras da receita pronta.
