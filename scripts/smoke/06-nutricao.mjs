// Nutrição: table computed on open (no button), invalid yield message,
// table fits 390px (its own horizontal scroll only).

const ovos = { ingredientId: 'fixed:ovos', nome: 'Ovos', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 12, tamanhoEmbalagem: 12, unidadeEmbalagem: 'unidade',
  nutricao100g: { kcal: 155, carboidratos: 1.1, proteinas: 13, gorduras: 11, fibras: 0, sodio: 124 }, densidadeGml: null, pesoUnidadeG: 50 };

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:o', nome: 'Omelete', rendimento: 2, embalagemUnitaria: 0, quantidadeEmbalagens: 2, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [ovos] }]);
  await page.goto(baseUrl + '#/receita/recipe%3Ao/nutricao');
  await page.getByText('Informação Nutricional').waitFor();
  await page.getByText('Porção: 50 g').waitFor();
  await page.getByText('não substitui laudo laboratorial', { exact: false }).waitFor();
  await semRolagemHorizontal();
  await shot('tabela');

  await page.getByRole('tab', { name: 'Ingredientes' }).click();
  await page.locator('#rendimento').fill('0');
  await page.getByRole('tab', { name: 'Nutrição' }).click();
  await page.getByText('Defina um rendimento válido para calcular a tabela nutricional.').waitFor();
  assert.equal(await page.getByText('Informação Nutricional').count(), 0);
}
