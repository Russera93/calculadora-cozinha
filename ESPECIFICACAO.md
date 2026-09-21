# Especificação Técnica e UX/UI: Calculadora de Precificação e Nutrição para Confeitaria/Culinária

## 1. Visão Geral do Projeto
**Objetivo:** Desenvolver uma aplicação web front-end (Single Page Application) em um único arquivo `.html` (com CSS e JS embutidos) para ser executada diretamente no navegador, sem necessidade de servidor ou instalação.
**Público-alvo:** Cozinheiras e confeiteiras de pequeno a médio porte (venda direta), muitas vezes sem conhecimento aprofundado em gestão financeira ou nutrição.
**Funcionalidades Principais:**
- Cálculo exato de custo de receitas com suporte a medidas fracionadas (1/2, 1/4).
- Adição de custos invisíveis (gás de cozinha, embalagens).
- Sugestão inteligente de preço de venda (markup mínimo de 100% ou regra de 3).
- Geração automática de Tabela Nutricional baseada nos ingredientes selecionados.

---

## 2. Diretrizes de UX/UI (Para o ClaudeCode)
- **Framework de Estilo:** Utilizar **Tailwind CSS via CDN** (`<script src="https://cdn.tailwindcss.com"></script>`) para garantir um design moderno, limpo e responsivo de forma rápida.
- **Paleta de Cores:** Tons pastéis, quentes e convidativos que remetem a doces e comida caseira. 
  - Primária: Rosa queimado ou Terracota.
  - Secundária: Creme/Bege para o fundo da página (evitar branco puro para não cansar a vista).
  - Acentos: Verde suave para botões de sucesso/lucro.
- **Tipografia:** Fonte sem serifa moderna, legível e arredondada (ex: *Poppins* ou *Nunito* importadas via Google Fonts).
- **Usabilidade (UX):**
  - **Zero Fricção:** A interface não deve parecer uma "planilha de contador". Deve ser fluida.
  - **Inputs Inteligentes:** O sistema deve adicionar novas linhas de ingredientes automaticamente conforme o usuário preenche a última.
  - **Feedback Visual:** Mostrar o lucro e o custo destacando em cores (ex: Custo em vermelho suave, Lucro/Preço Sugerido em verde destaque).

---

## 3. Estrutura de Layout (Grid/Colunas)

### Seção 1: Cabeçalho e Cadastro da Receita
- **Input de Texto:** "Nome do Produto Final" (Ex: Bolo de Chocolate).
- **Input de Número:** "Rendimento" (Quantas unidades, fatias ou potes essa receita rende). Ex: 20 porções.

### Seção 2: Tabela Dinâmica de Ingredientes
Cada linha de ingrediente deve conter o seguinte fluxo da esquerda para a direita:
1. **Nome do Ingrediente (Busca/Select):** Input com autocomplete baseado no banco de dados local.
2. **Quantidade Utilizada:** Input numérico que aceita frações (ex: 1, 1/2, 0.5, 1/4).
3. **Unidade de Medida Utilizada (Select):** Xícara, Colher de Sopa, Colher de Chá, Gramas (g), Mililitros (ml), Unidade.
4. **Custo de Compra (Inputs Agrupados):** 
   - Preço pago na embalagem fechada (R$).
   - Tamanho da embalagem comprada (Ex: 1000g, 1L).
5. **Custo Calculado (Output):** Campo não editável (somente leitura) mostrando o valor exato gasto daquele ingrediente na receita.
*Regra de UX:* Ao selecionar/preencher o 3º ingrediente, criar automaticamente uma 4ª linha em branco abaixo.

### Seção 3: Custos Extras e Operacionais
- **Embalagens:**
  - Custo da embalagem unitária (R$). Se render 20 porções, o sistema multiplica o custo da embalagem por 20 (caso a venda seja fracionada).
- **Custo do Gás de Cozinha:**
  - Input: Tempo de forno/fogo (em minutos).
  - Input: Valor pago no botijão de 13kg (R$).

### Seção 4: Resultados (Dashboard de Precificação)
- **Custo Total da Receita:** Soma de (Ingredientes + Gás + Embalagens).
- **Custo por Porção (Unidade):** Custo Total / Rendimento.
- **Preço de Venda Sugerido (Regra do Triplo ou Markup de 100%+):** 
  - Mostrar uma sugestão de base: `Custo Total x 3` (1/3 material, 1/3 trabalho/energia, 1/3 lucro livre) ou no mínimo `Custo Total x 2` (100% de lucro).
  - Permitir que o usuário digite o "Preço que deseja vender" e mostrar a ele qual será a Margem de Lucro Real em % e em R$.

### Seção 5: Tabela Nutricional
- Um botão grande: "Gerar Tabela Nutricional Média".
- Ao clicar, exibe um modal ou card estilizado igual à tabela da ANVISA (Kcal, Carboidratos, Proteínas, Gorduras Totais, Fibras, Sódio) calculada para **1 porção**.

---

## 4. Especificações Técnicas e Lógica de Negócio

### A. Banco de Dados Local (Mock Data em JS)
O ClaudeCode deve criar um array de objetos em JavaScript contendo os ingredientes mais comuns da confeitaria/cozinha com os seguintes atributos: `nome`, `densidade` (g/ml), e valores nutricionais por 100g.
*Exemplo:* Farinha de trigo, Açúcar, Açúcar mascavo, Óleo, Ovos, Achocolatado, Leite, Fermento em pó, Aveia, Banana, etc.

### B. Lógica de Conversão de Medidas e Frações
O sistema DEVE converter frações em texto (como "1/2", "1/4", "3/4") para números decimais (0.5, 0.25, 0.75) antes do cálculo.
**Tabela de Volume Padrão (Base):**
- 1 Xícara de chá = 240 ml
- 1 Colher de sopa = 15 ml
- 1 Colher de chá = 5 ml
*Nota para a IA:* Como o usuário insere volume (xícara) mas a embalagem é comprada em peso (gramas), use a densidade do ingrediente do mock de dados para converter. Se for muito complexo, converta tudo para uma base comum ou instrua o usuário a cadastrar a compra na mesma medida (Ex: farinha convertida usando 1 xícara = 120g).

### C. Cálculo do Gás de Cozinha
Fórmula padrão para botijão de 13kg (dura em média 50 horas ou 3000 minutos em fogo médio):
`Custo por minuto = Valor do Botijão (R$) / 3000`
`Custo do Gás = Custo por minuto * Tempo de preparo (minutos)`

### D. Cálculo do Custo do Ingrediente Utilizado
Fórmula: `Custo Utilizado = (Quantidade Utilizada em G ou ML / Quantidade Comprada em G ou ML) * Valor Pago na Embalagem`
*Exemplo:* Comprei 1000g de farinha por R$ 5,00. Usei 2 xícaras (240g). Custo = (240 / 1000) * 5,00 = R$ 1,20.

### E. Lógica da Tabela Nutricional
1. Iterar sobre todos os ingredientes válidos inseridos.
2. Descobrir a quantidade de gramas totais de cada ingrediente usado na receita inteira.
3. Calcular os nutrientes totais da receita baseando-se na proporção (Valor Nutricional do Banco / 100) * Gramas Utilizadas.
4. Dividir o total da receita pelo número de **Porções (Rendimento)** informado no passo 1.
5. Renderizar na tela.

---

## 5. Prompt de Instrução Final para o ClaudeCode

**Mensagem Direta para o LLM Gerador de Código:**
"Atue como um Desenvolvedor Front-end Sênior e um Especialista em UX. A partir desta especificação, gere um arquivo `index.html` único que contenha todo o HTML estruturado, Tailwind CSS para estilização requintada e Vanilla JavaScript para a reatividade. 
A aplicação DEVE ser funcional offline após carregada. Crie um banco de dados falso robusto no JS com os ingredientes citados pelo usuário (Farinha, Açúcar, Óleo, Ovos, Banana, Aveia, Fermento, Leite Condensado, Creme de Leite, Chocolate em pó, Manteiga). 
Implemente um parseador com `Regex` ou lógica simples para aceitar strings como '1/2' no input de quantidade e converter para 0.5. 
O design deve parecer um App Mobile/Web moderno (cards arredondados, sombras suaves, inputs com bom padding). Foque em não deixar a tela poluída. O resultado nutricional deve aparecer de forma elegante. NÃO entregue partes do código, gere o arquivo final completo e pronto para uso."
