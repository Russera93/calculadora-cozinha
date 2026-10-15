# Lucro de verdade (etapa C) + ajustes de praticidade — design

Data: 2026-10-15 · Branch: `lucro-de-verdade`

## 1. Objetivo

A doceira precisa saber, sem conta de cabeça: **quanto gasta**, **quanto
cobrar** e **quanto ganha**. Hoje o "lucro" é preço − (ingredientes +
embalagem + gás): ignora o tempo dela, as contas fixas, a taxa da
maquininha/iFood e a perda, então mostra mais do que ela ganha de fato.

Decisões do usuário (2026-10-15):

- Sugestões de preço: **Mínimo · Justo · Com lucro** (saem 2×/3×/4×).
- Número principal na barra e na lista: **"Você ganha"** = o que sobra
  depois de pagar todos os gastos (trabalho + lucro juntos), com
  **"sua hora rendeu R$ X"** ao lado.
- Dados continuam **só no aparelho** (sem conta/nuvem); reforçar proteção
  contra perda.

## 2. "Meu negócio" (configurado uma vez)

Painel aberto pela lista (botão em Ajustes e rota `#/negocio`) e pelo
convite da aba Preço (rota `#/receita/<id>/preco/negocio`; "voltar" fecha).

| Campo | Uso |
|---|---|
| Quanto quer ganhar por mês (R$) | meta de salário |
| Horas por semana na cozinha | horas/mês = horas/semana × 52 ÷ 12 |
| Contas fixas do mês: Luz, Água, Internet/telefone, Aluguel, MEI (DAS), Outros (R$ cada) | rateio por hora trabalhada |
| Taxa da maquininha (%) · Taxa do iFood (%) | descontada do preço no canal escolhido |
| Lucro extra do negócio (%) — padrão 20 | sugestão "Com lucro" |

Mostrado ao vivo: "**Sua hora vale R$ 18,75**" e "Contas fixas: R$ 2,30
por hora trabalhada". Guardado em `calculadora-cozinha:negocio`, entra no
backup (import não sobrescreve um já configurado).

`configurado` = meta mensal > 0 e horas/semana > 0. Sem isso o app
funciona como hoje (sem mão de obra/fixos) e a aba Preço mostra o convite
"Quer saber quanto sua hora rende? Configure em 1 minuto ›".

## 3. Na receita

- Aba **Custos**: novo cartão **"Seu trabalho"** — "Quanto tempo você
  trabalha nesta receita (do preparo até embalar)?", texto livre
  interpretado (`1h30`, `1:30`, `90`, `45 min`, `2h`, `1,5h`) → minutos;
  dica mostra como entendeu ("= 1h30"). Diferente do tempo de forno/fogo
  (gás). Novo campo **"Perda (%)"** (massa que gruda, doce que quebra)
  aplicado sobre os ingredientes.
- Aba **Preço**: "**Onde você vende?**" chips Pix/dinheiro · Maquininha
  (x%) · iFood (y%), guardado por receita.
- Campos novos na receita (migração com padrão): `tempoTrabalhoMinutos: null`,
  `perdaPercent: 0`, `canalVenda: 'direto'`.

## 4. Contas (`js/profit.js`, puro; `results.js` passa a recebê-lo)

Por receita inteira:

- `material` = ingredientes × (1 + perda%) + embalagens + gás
- `horas` = tempoTrabalhoMinutos ÷ 60
- `fixos` = fixosPorHora × horas · `maoDeObra` = valorHora × horas
- `custoPorUnidade` = (material + fixos) ÷ rendimento (sem taxa)
- `taxa` = % do canal (0 para Pix/dinheiro; limitada a 0–90%)

Com o preço `p` por unidade:

- `gastoPorUnidade` = custoPorUnidade + p × taxa
- `ganhoPorUnidade` = p − gastoPorUnidade · `ganhoTotal` = × rendimento
- `horaRendeu` = ganhoTotal ÷ horas (só com horas > 0)
- `bateuMeta` = horaRendeu ≥ valorHora

Sugestões (por unidade, arredondadas **para cima** a um "preço bonito"):

- **Mínimo** (não perde dinheiro) = custoPorUnidade ÷ (1 − taxa)
- **Justo** (paga sua hora) = (material + fixos + maoDeObra) ÷ rendimento ÷ (1 − taxa)
  — só com negócio configurado e tempo informado; senão o chip fica
  desabilitado com "informe seu tempo" / "configure Meu negócio".
- **Com lucro** = Justo × (1 + lucro extra%).

Preço bonito: < R$ 10 → múltiplo de 0,50 acima; < R$ 50 → R$ 1; < R$ 200
→ R$ 5; acima → R$ 10. Sempre ≥ o valor calculado (arredondar nunca faz
perder dinheiro).

Margem e markup continuam separados (CLAUDE.md), agora sobre o
`gastoPorUnidade`.

## 5. Telas

- **Barra de resultado**: "Custo R$ 0,62/un. · **Você ganha R$ 1,88/un.**"
  (ou "Você perde …"); linha de baixo "sua hora rendeu R$ 24,00" (verde se
  bateu a meta, aviso se abaixo) ou "N ingrediente(s) sem preço".
- **Aba Preço**: (1) "Quanto custa cada unidade" com o detalhamento
  (matéria-prima, embalagem, gás, contas fixas); (2) onde vende; (3)
  chips Mínimo/Justo/Com lucro + campo do preço; (4) resultado "Você
  ganha R$ X por unidade · R$ Y na receita toda · sua hora rendeu R$ Z
  (meta R$ W)"; (5) detalhes (margem, markup, taxa, perda, seu trabalho,
  contas fixas). Convite quando não configurado.
- **Lista**: cartão mostra "Custo R$ x/un." e "ganha R$ y" / etiqueta
  "prejuízo" / "definir preço" / **"N sem preço"**.

## 6. Ajustes de praticidade

- **"porções" → "unidades"** em toda a interface (a tabela nutricional
  mantém "porção", termo da ANVISA; o texto do WhatsApp também passa a
  "unidades").
- **Proteção dos dados**: `navigator.storage.persist()` pedido ao criar a
  primeira receita; cartão na lista (fechável por 14 dias) quando (a) é
  iPhone/iPad no Safari sem o app instalado — "instale na Tela de Início
  para o iPhone não apagar suas receitas" — ou (b) há ≥ 3 receitas e o
  último backup foi há > 30 dias (ou nunca) — "Salvar backup agora".
  Data do último export em `calculadora-cozinha:ultimo-backup`.

## 7. Testes

- Unitários: `parseDuration`/`formatDuration`, `precoBonito`, `negocio`
  (valor hora, fixos por hora, configurado, padrões, migração),
  `profit` (material com perda, fixos e mão de obra por tempo, taxa por
  canal, mínimo/justo/com lucro, hora rendeu, sem configuração = conta de
  hoje), `results` atualizado, `migrateRecipe`, storage do negócio e
  backup, `result-bar`, aviso de proteção (regras de quando mostrar).
- Smoke `11-negocio.mjs`: configurar Meu negócio → tempo na aba Custos →
  Preço com Mínimo/Justo/Com lucro, "sua hora rendeu", troca para iFood
  muda o ganho → lista mostra "ganha". Atualizar cenários existentes
  (2×/3×/4×, "lucra", "porções").

## 8. Fora do escopo

Vendas do mês ("Meu mês"), "Meus ingredientes" (lista única de preços),
receitas modelo, encomendas — specs próprias depois. Botijão global.
