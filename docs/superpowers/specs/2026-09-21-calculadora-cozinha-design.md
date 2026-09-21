# Calculadora de Precificação e Nutrição para Confeitaria/Culinária — Design

Data: 2026-09-21
Spec de produto original: [ESPECIFICACAO.md](../../../ESPECIFICACAO.md)

## 1. Contexto e objetivo

Aplicação web front-end, sem backend, para cozinheiras/confeiteiras de pequeno/médio
porte calcularem o custo real de uma receita (ingredientes + gás + embalagens),
receberem sugestão de preço de venda, e gerarem uma tabela nutricional por porção.

Este documento registra as decisões tomadas durante o brainstorming que **estendem**
a spec de produto original em três pontos:

1. **Persistência via localStorage** (a spec original não previa persistência).
2. **Cadastro de ingredientes customizados**, além do banco fixo de ~11 itens.
3. **Estrutura em múltiplos arquivos** (HTML/CSS/JS separados), em vez de um único
   `.html` monolítico como pedido no prompt final da spec original.

## 2. Decisões de requisitos

| Decisão | Escolha | Motivo |
|---|---|---|
| Persistência | localStorage, múltiplas receitas salvas (lista, abrir, duplicar, excluir) | Sem isso o usuário perde o trabalho ao fechar a aba; uso real envolve várias receitas |
| Ingredientes customizados | Banco pessoal global (não por receita) | Evita recadastro do mesmo ingrediente em receitas diferentes |
| Dados nutricionais de customizados | Busca automática na tabela TACO (Unicamp, ~600 alimentos) por nome; fallback para preenchimento manual opcional se não encontrado | Cobre a maioria dos casos automaticamente sem travar o cadastro nos casos raros |
| Conversão volume→peso para itens da TACO | Densidade genérica por categoria de alimento (pós, líquidos, grãos, etc.) | TACO não traz conversão caseira; densidade por categoria cobre os ~600 itens sem cadastro manual item a item |
| Lista de receitas salvas | Lista simples (nome + data + ações), sem busca/filtro | Volume esperado é de dezenas de receitas, não centenas |
| Estrutura de arquivos | Múltiplos arquivos (html/css/js separados) | Facilita manutenção conforme a lógica cresce (parser, conversões, nutrição, storage) |

## 3. Arquitetura e estrutura de arquivos

```
calculadora-cozinha/
├── index.html                  # Shell da app (troca entre telas via JS, sem router)
├── css/
│   └── styles.css              # Ajustes finos sobre Tailwind (paleta, fontes)
├── js/
│   ├── app.js                  # Orquestração de UI, navegação entre telas, event listeners
│   ├── calculations.js         # Motor de cálculo puro (sem DOM) — testável isoladamente
│   ├── storage.js              # CRUD de receitas e ingredientes customizados no localStorage
│   ├── ingredients-db.js       # Banco fixo da spec original (11 itens) + merge com customizados
│   └── taco-database.js        # Carrega/expõe o dataset TACO + densidades por categoria
└── data/
    └── taco.json               # Dataset bruto da TACO (fonte de dados)
```

Tailwind via CDN (conforme spec original). Google Fonts (Poppins/Nunito) via `<link>`.

O motor de cálculo (`calculations.js`) é isolado do DOM deliberadamente: é a parte de
maior risco de bug silencioso (conversões, frações, precificação), e precisa ser
testável sem simular UI.

## 4. Telas e fluxo de navegação

Confirmado com o usuário: interface dividida em telas (não tudo em uma tela só),
para reduzir a quantidade de informação exposta de uma vez.

**Tela 1 — Minhas Receitas** (tela inicial)
- Lista simples de cards: nome do produto, data de última edição, custo total (preview).
- Ações por card: Abrir, Duplicar, Excluir (com confirmação).
- Botão "+ Nova Receita" em destaque.

**Tela 2 — Editor de Receita**
- Botão "Voltar para Minhas Receitas".
- Auto-save (debounced) a cada alteração — sem botão "Salvar" explícito.
- Seções, conforme spec original:
  1. Cabeçalho (nome do produto, rendimento)
  2. Tabela dinâmica de ingredientes (linha nova auto-criada ao preencher a última)
  3. Custos extras (embalagens, gás)
  4. Dashboard de precificação (custo total, por porção, sugestões de preço, margem real)
  5. Tabela nutricional (sob demanda, botão "Gerar Tabela Nutricional Média")

**Modal — Cadastro de Ingrediente Customizado**
- Aberto quando o nome digitado não bate com banco fixo, TACO, nem customizados salvos.
- Campos: nome, unidade de compra, preço pago, tamanho da embalagem.
- Busca automática na TACO por nome aproximado:
  - Se encontrar: preenche nutrição automaticamente, indica "encontrado automaticamente
    (ajustável)", campos ficam editáveis.
  - Se não encontrar: campos nutricionais ficam abertos e opcionais.
- Ao salvar, entra no banco pessoal global (via `storage.js`), disponível no
  autocomplete de todas as receitas futuras.

## 5. Motor de cálculo (`calculations.js`)

Todas as funções abaixo são puras (sem efeitos colaterais, sem acesso a DOM) e devem
retornar erro explícito (não `NaN`/`Infinity`) em casos inválidos.

### Parser de quantidade
`parseQuantity(input: string): number | null`
- Aceita inteiro (`"1"`), decimal com ponto ou vírgula (`"0.5"`, `"0,5"`), fração
  simples (`"1/2"`) e número misto (`"1 1/2"`).
- Retorna `null` se o formato não for reconhecido.

### Conversão de unidade → gramas/ml
- Tabela fixa de volume: 1 xícara = 240ml, 1 colher de sopa = 15ml, 1 colher de chá = 5ml.
- Unidades de peso (g) e volume (ml) usadas diretamente, sem conversão.
- Unidade "unidade" (ex.: 2 ovos) usa peso médio por unidade cadastrado no ingrediente.
- Conversão volume→peso usa densidade (g/ml): do banco fixo, ou por categoria genérica
  para itens vindos da TACO (pós, líquidos, grãos, etc.).

### Custo do ingrediente utilizado
```
custoUtilizado = (quantidadeUsadaEmGramas / quantidadeCompradaEmGramas) * precoEmbalagem
```
Ambas as quantidades convertidas para a mesma unidade base (gramas) antes da divisão.

### Custo do gás
```
custoPorMinuto = valorBotijao13kg / 3000
custoGas = custoPorMinuto * tempoPreparoMinutos
```

### Precificação
```
custoTotal = somaIngredientes + custoGas + custoEmbalagens
custoPorPorcao = custoTotal / rendimento
precoSugerido2x = custoTotal * 2
precoSugerido3x = custoTotal * 3
margemReal (%) = ((precoVenda - custoPorPorcao) / precoVenda) * 100   // se usuário informar preço desejado
```

### Nutrição (por porção)
Para cada ingrediente com dado nutricional disponível:
```
nutrienteTotal += (valorPor100g / 100) * gramasUsadas
```
Resultado final dividido pelo `rendimento`. Ingredientes sem dado nutricional são
ignorados no somatório; a UI exibe aviso "cálculo nutricional incompleto — N
ingrediente(s) sem dados" quando aplicável.

### Tratamento de erros e edge cases
- Rendimento = 0 ou vazio → cálculo não executa; UI mostra aviso, não `NaN`/`Infinity`.
- Preço ou tamanho de embalagem = 0/negativo → input marcado inválido, ignorado nos
  somatórios até correção.

## 6. Testes

- `calculations.js`: testado isoladamente (Node nativo, `node --test`, sem framework
  externo). Casos mínimos:
  - Parser: `"1/2"`, `"1 1/2"`, `"0,5"`, entradas inválidas.
  - Conversão xícara→grama com densidade.
  - Exemplo de referência da spec original: 1000g de farinha por R$5,00, uso de 2
    xícaras (240g) → custo esperado R$1,20.
  - Custo do gás, margem de lucro real.
  - Edge cases: rendimento zero, ingrediente sem dado nutricional.
- `storage.js`: verificado manualmente no navegador (CRUD simples, baixo risco).
- UI: verificação manual end-to-end (criar receita, cadastrar ingrediente customizado,
  salvar, reabrir, duplicar, excluir, gerar tabela nutricional).

## 7. Fora de escopo (YAGNI para esta versão)

- Backend, contas de usuário, sincronização entre dispositivos.
- Busca/filtro na lista de receitas.
- Exportação/impressão da tabela nutricional ou da receita.
- Edição de ingredientes do banco fixo original (somente customizados são editáveis).
