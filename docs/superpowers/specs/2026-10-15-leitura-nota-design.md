# Leitura de nota de compra + correções + PWA — design

Data: 2026-10-15 · Branch: `leitura-nota`

## 1. Objetivo

A confeiteira fotografa (ou envia a imagem escaneada de) a nota/cupom do
mercado. O app lê cada produto — **quantidade comprada, tamanho da
embalagem (kg, g, mg, L, ml, unidades) e valor** — liga cada item ao
ingrediente da receita aberta e preenche sozinho o que hoje é digitado à
mão (preço pago, tamanho e unidade da embalagem). Depois mostra **quanto
a receita gasta dessa compra** e **quanto a compra rende** (quantas
receitas/unidades dá para fazer e qual ingrediente acaba primeiro).

Decisões do usuário (2026-10-15):

- Leitura **no próprio aparelho** (Tesseract.js no navegador): grátis,
  sem conta, a foto não sai do celular. Como erra, **nada é aplicado sem
  a tela de conferência**.
- Incluir o **PWA instalável/offline** (antecipado da etapa D).

Junto vão correções encontradas na revisão do código (seção 2).

## 2. Correções

| # | Problema | Correção |
|---|---|---|
| C1 | Tabela nutricional ignora "1 lata" (unidade sem peso médio): o ingrediente conta como "sem dados" e soma 0 kcal — custo usa a regra do pacote inteiro, nutrição não. | `nutritionPerPortion` passa a usar `gramsUsed` (costing.js), a mesma regra do custo. |
| C2 | Ingrediente novo achado na TACO, comprado em g e medido em xícara/colher, mostra "não dá para converter" — a densidade da TACO (por categoria) é descartada. | O painel aplica a densidade da TACO assim que acha o ingrediente; `buildCustomIngredient` recebe `densidadeTaco` e a guarda (ml sem TACO continua 1,0). |
| C3 | Dica "≈ g" não aparece em "1 lata" (pacote inteiro). | `quantidadeConvertidaEmGramas` cobre esse caso via `gramsUsed`. |
| C4 | `npm run test:mobile` quebra sem o Chromium do Playwright baixado. | O smoke procura Chrome/Edge instalados quando o navegador do Playwright não existe. |
| C5 | Embalagem só aceita g, ml e unidade (1 kg vira "1000 g" à mão). | Chips de embalagem: **g, kg, mg, ml, L, unidade**. |

C5 em detalhe: novo módulo puro `js/units.js` com
`PACKAGE_UNITS = { g, kg, mg, ml, l, unidade }` → `{ base: 'g'|'ml'|'unidade', fator }`
e `packageInBase(tamanho, unidade) → { valor, base }`. `computeLineCost`,
`gramsUsed` e a regra do pacote inteiro passam a usar a quantidade da
embalagem já em g/ml. Valor guardado continua o digitado (`tamanhoEmbalagem: 1`,
`unidadeEmbalagem: 'kg'`), então receitas antigas (g/ml/unidade) não mudam.
Rótulo de `l` é "L".

## 3. Leitura da nota — fluxo

1. Aba **Ingredientes** ganha o botão **"📷 Ler nota de compra"** (abaixo de
   "+ Adicionar ingrediente"). Abre um painel (rota
   `#/receita/<id>/ingredientes/nota`, então o "voltar" do celular fecha).
2. Passo **Escolher**: "Tirar foto" (`<input type=file accept=image/* capture=environment>`),
   "Escolher print ou foto" (galeria/arquivo escaneado, sem `capture`) e
   "Colar texto da nota" (textarea — para nota recebida por e-mail ou
   copiada da página da SEFAZ; também é como o smoke testa o fluxo).
   PDF não é aceito — decisão do usuário: só foto ou print do cupom.
3. Passo **Lendo**: barra de progresso com o status do Tesseract. Na
   primeira vez baixa o leitor (~5 MB, avisado). Sem internet na primeira
   vez → mensagem clara e opção de colar texto.
4. Passo **Conferir**: um cartão por item lido, com
   - descrição como saiu da nota (texto pequeno);
   - **"Usar para"**: `<select>` com os ingredientes da receita + "Não usar"
     (pré-selecionado pelo casamento automático, seção 5);
   - **Qtd. comprada**, **Tamanho** + chips de unidade (g, kg, mg, ml, L, un.),
     **Valor pago** (total da linha, campo de moeda);
   - linha derivada: "= R$ 7,49 por embalagem de 395 g".
   Itens não usados ficam recolhidos no fim ("Outros itens da nota (5)").
   "Ver texto lido" (details) mostra o texto bruto. Botão
   **"Aplicar na receita (N)"**; desabilitado com aviso no item quando um
   item marcado está sem tamanho ou sem valor.
5. **Aplicar**: para cada item ligado a um ingrediente:
   `precoEmbalagem = valorTotal / quantidade`, `tamanhoEmbalagem = tamanho`,
   `unidadeEmbalagem = unidade`; o preço entra no banco de preços
   (`savePreco`) e a descrição vira apelido (seção 5). A receita guarda a
   compra em `recipe.compra` (seção 6). Em seguida o painel mostra o
   **Resumo** (seção 6) com "Pronto".

Item **pesado** (`0,875 KG X 6,99 6,12`): quantidade 1, tamanho 0,875 kg,
valor 6,12.

## 4. Interpretação do texto (`js/receipt-parser.js`, puro)

`parseReceiptText(texto) → [{ descricao, quantidade, tamanho, unidade, valorTotal }]`
(`tamanho`/`unidade` = `null` quando a descrição não traz).

Formatos reconhecidos (linhas em maiúsculas, espaços colapsados; vírgula
ou ponto como decimal; "x", "X" ou "*" como multiplicador):

- **Cupom (SAT/NFC-e impresso)**, numa linha ou quebrado em duas:
  `001 7891000100103 LEITE COND MOCA 395G 2 UN X 7,49 14,98`
  `001 7891000100103 LEITE COND MOCA 395G` ↵ `2,000 UN x 7,49 F1 14,98`.
  Remove número do item e código de barras do começo e o código de
  tributo (F1, T1, I1, N1, T18%…) do fim.
- **Página da SEFAZ copiada**:
  `LEITE COND MOCA 395G (Código: 789…) Qtde.:2 UN: UN Vl. Unit.: 7,49 Vl. Total 14,98`.
- **Linha simples** `DESCRIÇÃO … 14,98` (quantidade 1), só quando a
  descrição tem letras e não é linha de rodapé.

Linhas de rodapé/cabeçalho ignoradas: TOTAL, SUBTOTAL, TROCO, DINHEIRO,
CARTÃO/CREDITO/DEBITO, PIX, DESCONTO, ACRÉSCIMO, CPF, CNPJ, IE, TRIBUTOS,
"VALOR APROXIMADO", QTD. ITENS, FORMA DE PAGAMENTO, CONSUMIDOR, etc.

Tamanho na descrição (última ocorrência): `395G`, `1KG`, `1,5L`, `200 ML`,
`500GR`, `10MG`, `LT 1L`; unidades por embalagem: `C/12`, `12UN`, `DZ`/`DUZIA`
(12), `CART 30`. Unidade da linha `KG` (pesado) usa a quantidade como tamanho.
Valor total ausente → `quantidade × unitário`.

## 5. Casamento item ↔ ingrediente (`js/receipt-match.js`, puro)

- Normaliza (sem acento, minúsculas) e expande abreviações comuns de nota
  (`COND`→condensado, `CR`→creme, `LT`/`LTE`→leite, `FAR`→farinha,
  `TRIG`/`TRG`→trigo, `ACUC`→açúcar, `MANT`→manteiga, `MARG`→margarina,
  `CHOC`→chocolate, `ACHOC`→achocolatado, `FERM`→fermento, `OL`→óleo,
  `RAL`→ralado, `GRAN`→granulado, `AMEND`→amendoim, `REQ`→requeijão,
  `ESS`→essência, `BAUN`→baunilha, `PO`→pó…).
- Pontuação por par: fração das palavras do nome do ingrediente (sem
  "de/do/da/em/com/e") encontradas na descrição (igual ou prefixo com ≥3
  letras, nos dois sentidos para plural "ovo/ovos"); desempate pela
  fração das palavras da descrição usadas ("LEITE COND" prefere "Leite
  condensado" a "Leite").
- Mínimo 0,5 (ingrediente de uma palavra precisa casar a palavra).
  Atribuição gulosa 1-para-1, maior pontuação primeiro.
- **Apelidos aprendidos**: ao aplicar, guarda
  `descrição normalizada sem números/tamanhos → nome do ingrediente` em
  `calculadora-cozinha:apelidos-nota`. Na próxima nota, apelido que aponta
  para um ingrediente da receita vence a pontuação. Entra no backup
  (export/import, "pular duplicadas").

## 6. Quanto gasta e quanto rende (`js/purchase.js`, puro)

`recipe.compra = { lidaEm: ISO, itens: [{ nome, quantidade, tamanho, unidade, valorTotal }] }`
(campo opcional; receitas antigas não têm).

`purchaseYield(recipe) → { itens, receitasPossiveis, unidadesPossiveis, limitante, gastoPorReceita, totalNota, faltando }`:

- Para cada item da compra cujo `nome` casa (normalizado) com um
  ingrediente da receita: fração de embalagem usada por receita =
  `computeLineCost({ ...linha, precoEmbalagem: 1, tamanhoEmbalagem: compra.tamanho, unidadeEmbalagem: compra.unidade })`
  (reaproveita todas as regras de conversão: lata, dúzia, ml→g).
  `receitas = quantidade / fração`; `gasto = (valorTotal / quantidade) × fração`.
- `receitasPossiveis = floor(min(receitas))`, `limitante` = item do mínimo,
  `unidadesPossiveis = receitasPossiveis × rendimento`,
  `gastoPorReceita = Σ gasto`, `totalNota = Σ valorTotal` dos itens usados,
  `faltando` = ingredientes da receita que não vieram na nota.
- Item sem conversão possível → `receitas = null` (mostrado como "—", não
  entra no mínimo).

Resumo mostrado (no fim do painel e num cartão "Sua última compra" na aba
Ingredientes, com "Remover"):

> **Esta receita gasta R$ 9,80** do que você comprou
> Com essa compra dá para fazer **2 receitas = 40 unidades**
> Acaba primeiro: Leite condensado
> Leite condensado: dá 2 receitas · Chocolate em pó: dá 6,5 receitas …
> Não vieram na nota: Manteiga (use o preço que já está na receita)
> Total pago nesses itens: R$ 30,00

Menos de uma receita → "A compra não dá para uma receita inteira — falta
Leite condensado".

## 7. Leitor (`js/ocr.js`, DOM)

- Carrega `https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js`
  por `import()` só quando a pessoa escolhe uma imagem (o resto do app não
  paga esse custo). Idioma `por`; o Tesseract guarda o arquivo de idioma
  no IndexedDB.
- Pré-processamento num canvas: respeita a orientação EXIF, redimensiona
  (lado maior ≤ 2000 px), tons de cinza e esticamento de contraste.
- `tessedit_pageseg_mode = 6` (bloco único — cupom) e
  `preserve_interword_spaces = 1`. Worker encerrado ao fim.
- Exceção à regra "zero dependências de runtime": é carregado sob demanda,
  versão fixa, de CDN; o app continua funcionando inteiro sem ele.

## 8. PWA

- `manifest.webmanifest` (nome, `display: standalone`, cores do tema,
  `start_url`/`scope` `./`), ícones `icons/icon.svg`, `icon-192.png`,
  `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`
  (PNGs gerados por `scripts/build-icons.mjs` a partir do SVG e versionados).
- `sw.js` na raiz: pré-carrega o app (HTML, CSS, todos os JS, `data/taco.json`,
  manifest, ícones); arquivos do próprio site **rede primeiro, cache se
  offline** (deploy novo aparece na hora, sem "versão presa"); CDN
  (Tesseract, Google Fonts) **cache primeiro**. Navegação offline cai no
  `index.html`. Nome do cache versionado; caches antigos apagados.
- Registro em `app.js` só em HTTP(S). Teste unitário garante que todo
  arquivo de `js/` (exceto testes), `css/`, `data/taco.json` e ícones está
  na lista de pré-carga.

## 9. Testes

- Unitários (TDD): `units`, `receipt-parser` (cupom 1 linha, 2 linhas,
  SEFAZ, pesado, dúzia, rodapé ignorado, ruído de OCR com ponto/vírgula),
  `receipt-match` (abreviações, desempate Leite × Leite condensado,
  apelido vence, 1-para-1), `purchase` (lata, dúzia, ml→g, limitante,
  menos de uma receita, faltando), correções C1–C3 e C5, lista do `sw.js`.
- Smoke `08-nota.mjs`: receita com leite condensado/chocolate/manteiga →
  "Ler nota" → colar texto de cupom → conferir casamentos → aplicar →
  preços nos ingredientes → resumo "dá para fazer" → cartão na aba →
  voltar fecha o painel. Capturas nos dois temas.
- `09-ocr.mjs` (só com `SMOKE_OCR=1`, precisa de internet): gera a imagem
  de um cupom, envia pelo campo de arquivo e confere que os itens
  aparecem na conferência.
- Smoke `01` confere manifest e registro do service worker.

## 10. Fora do escopo

Leitura do QR Code da NFC-e (consulta à SEFAZ exige servidor por causa de
CORS), PDF, leitura por IA, adicionar à receita um ingrediente que só
apareceu na nota, histórico de várias compras (guarda só a última por
receita), etapa C.
