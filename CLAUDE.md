# Calculadora de Cozinha — histórico do projeto

Este arquivo documenta o que foi construído até agora, para dar contexto a uma
próxima sessão de trabalho (possivelmente com outro modelo/ferramenta de IA)
que vai iniciar uma **reforma mobile-first** da interface.

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
  único uso de `npm`/`node` é para rodar os testes (`npm test`) e o script
  de geração de dados nutricionais (`scripts/build-taco.js`).
- **Tailwind CSS via CDN**, usando classes de valor arbitrário que
  referenciam variáveis CSS customizadas para o tema (`bg-[var(--color-x)]`),
  não cores hardcoded. Os tokens de cor ficam em `css/styles.css`.
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
- **Testes**: `npm test` roda `node --test js/*.test.js` (60 testes no
  momento). `js/calculations.js` é o núcleo de cálculo puro (sem DOM,
  totalmente testável). `js/app.js` é a camada de UI/DOM (grande, não
  testada por testes unitários — verificada via Playwright manualmente
  durante o desenvolvimento).
- Servir sempre via **HTTP** (nunca `file://`), porque o app usa `fetch()`
  para carregar `data/taco.json`, o que quebra por CORS em `file://`.
  Durante o desenvolvimento local, qualquer servidor estático simples serve
  (ex: `npx serve` ou `python -m http.server`).

## Estrutura de arquivos

```
index.html              — shell do app (tela de lista, tela de editor, modal de ingrediente customizado)
css/styles.css           — tokens de design (cores claro/escuro), fontes, estilos base
js/app.js                — orquestração de UI (o maior arquivo, cresceu bastante)
js/calculations.js       — motor de cálculo puro, testável (custos, %VD, margem, markup...)
js/storage.js            — camada de CRUD sobre localStorage (receitas, ingredientes, banco de preços)
js/ingredients-db.js     — banco fixo de ~11 ingredientes comuns com densidade/nutrição
js/taco-database.js      — carregador/busca fuzzy da base TACO
js/text-utils.js         — normalize() compartilhado (remove acento, lowercase)
js/*.test.js             — testes (node --test)
data/taco.json           — base TACO normalizada (gerada, versionada)
scripts/build-taco.js    — gera data/taco.json a partir de data/taco-raw.json
ESPECIFICACAO.md         — spec original do produto (18 tasks do build inicial)
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

## Decisões de design/UX a preservar (ou revisitar conscientemente)

- Cor de marca do WhatsApp é fixa nos dois temas (claro/escuro) — é uma cor
  de marca, não um token semântico do app.
- Modo claro: bordas de card/input levemente acinzentadas (contraste
  verificado). Modo escuro: bordas de card transparentes (decisão
  explícita do usuário — "no modo escuro mantenha como está").
- `calculateMarkup` e `calculateRealMargin` são indicadores
  **intencionalmente separados** — não substituir um pelo outro.
- Ingredientes com dado de açúcares adicionados/gordura saturada: gordura
  saturada só é somada quando vem da base TACO (dado real de laboratório);
  açúcares adicionados só quando o ingrediente tem esse campo cadastrado
  manualmente. Isso é avisado na própria tabela nutricional gerada.
- A tabela nutricional gerada **não é** um laudo certificado — isso é
  disclosed no rodapé da própria tabela.

## Testes e verificação usados neste projeto

- `npm test` — suíte Node nativa, 60 testes, cobre `calculations.js`,
  `ingredients-db.js`, `taco-database.js`.
- Verificação de UI foi sempre feita com **Playwright real** (não
  simulado): subir um servidor estático local, abrir no Chromium headless,
  interagir com os campos de verdade, e tirar screenshot pra conferência
  visual antes de considerar qualquer mudança de UI concluída.

## Próximo passo planejado (fora desta sessão)

O usuário vai abrir uma **nova conversa**, possivelmente com outro modelo
de IA, para conduzir uma **reforma mobile-first** da interface. Este
arquivo existe para dar contexto completo sobre o estado atual do projeto
sem precisar repetir todo o histórico de decisões acima.
