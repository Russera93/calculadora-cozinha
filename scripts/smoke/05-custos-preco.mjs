// Custos: package and gas inputs update totals and the bar.
// Preço: Mínimo/Justo/Com lucro per unit, typed price, what she earns, details.

const ing = { ingredientId: null, nome: 'Farinha', quantidadeBruta: '500', unidade: 'g', precoEmbalagem: 10, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null };

export default async function ({ page, baseUrl, assert, shot, seed }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:b', nome: 'Biscoito', rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 10, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [ing] }]);

  await page.goto(baseUrl + '#/receita/recipe%3Ab/custos');
  await page.getByLabel('Custo de cada embalagem (R$)').pressSequentially('50');
  await page.getByLabel('Quantas embalagens').fill('5');
  await page.getByText('R$ 2,50', { exact: true }).waitFor(); // 5 × R$ 0,50
  await page.getByLabel('Tempo de forno/fogo (minutos)').fill('25');
  await page.getByLabel('Preço do botijão 13 kg (R$)').pressSequentially('12000');
  await page.getByText('R$ 1,00', { exact: true }).waitFor(); // 120 / 3000 × 25
  await page.getByText('R$ 8,50').waitFor(); // 5 + 2,50 + 1
  await page.getByText('Custo R$ 0,85/un.').waitFor();
  await shot('custos');

  await page.locator('.result-bar').click();
  await page.getByText('Custo de cada unidade').waitFor();
  // No "Meu negócio" yet: only Mínimo (R$ 0,85 rounded up to R$ 1,00); Justo asks for it.
  await page.getByRole('button', { name: 'Mínimo R$ 1,00' }).click();
  assert.equal(await page.getByLabel('Quanto você vai cobrar? (por unidade)').inputValue(), '1,00');
  await page.getByText('Você ganha R$ 0,15 por unidade').waitFor();
  await page.getByText('R$ 1,50 na receita toda').waitFor();
  assert.equal(await page.getByRole('button', { name: /^Justo/ }).isDisabled(), true);
  await page.getByText('Para ver o preço justo, diga quanto quer ganhar por mês.').waitFor();

  const campo = page.getByLabel('Quanto você vai cobrar? (por unidade)');
  await campo.fill('');
  await campo.pressSequentially('50');
  await page.getByText('Você perde R$ 0,35 por unidade').waitFor();
  await campo.fill('');
  await page.getByText('Escolha uma sugestão ou digite seu preço.').waitFor();
  await campo.pressSequentially('300');

  await page.getByText('Ver detalhes do cálculo').click();
  await page.getByText(/Margem sobre a venda: 71,7%/).waitFor();
  await page.getByText(/Markup sobre o custo: 252,9%/).waitFor();
  await shot('preco');

  await page.reload();
  assert.equal(await page.getByLabel('Quanto você vai cobrar? (por unidade)').inputValue(), '3,00');
}
