// Ingredientes tab: yield stepper, rows with cost/summary/issue, totals,
// long names, and deep links to missing ingredients.

const ing = (o) => ({ ingredientId: null, nome: 'X', quantidadeBruta: '', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null, ...o });

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.goto(baseUrl);
  await seed([{
    id: 'recipe:b', nome: 'Brigadeiro Gourmet', rendimento: 30, embalagemUnitaria: 0.35, quantidadeEmbalagens: 30,
    tempoPreparoMinutos: 20, valorBotijao: 120, precoVendaDesejado: 3.5, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z',
    ingredientes: [
      ing({ nome: 'Leite condensado', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 7.49, tamanhoEmbalagem: 395 }),
      ing({ nome: 'Chocolate meio amargo 50% cacau da marca preferida da confeiteira', quantidadeBruta: '100', precoEmbalagem: 12.9, tamanhoEmbalagem: 200 }),
      ing({ nome: 'Manteiga', quantidadeBruta: '1', unidade: 'colherSopa', precoEmbalagem: 11.5, tamanhoEmbalagem: 200, densidadeGml: 0.91 }),
      ing({ nome: 'Granulado', quantidadeBruta: '50' })
    ]
  }]);
  await page.goto(baseUrl + '#/receita/recipe%3Ab');

  await page.getByText('2 unidades · R$ 7,49 / 395 g').waitFor();
  await page.getByText('R$ 14,98').waitFor();
  await page.getByText('1 colher de sopa · R$ 11,50 / 200 g').waitFor();
  await page.getByText('falta o preço').waitFor();
  await page.getByText('R$ 22,21').waitFor(); // ingredients total
  await page.getByText('Lucro R$ 2,38/un.').waitFor();
  await page.getByText('1 ingrediente(s) sem preço').waitFor();
  await semRolagemHorizontal();
  await shot('lista');

  // Stepper: 30 -> 31 changes cost per unit; typing 0 shows the yield message.
  await page.getByRole('button', { name: 'Aumentar porções' }).click();
  assert.equal(await page.locator('#rendimento').inputValue(), '31');
  await page.locator('#rendimento').fill('0');
  await page.getByText('Defina quantas porções a receita rende').waitFor();
  await page.getByRole('button', { name: 'Diminuir porções' }).click();
  assert.equal(await page.locator('#rendimento').inputValue(), '1');
  await page.locator('#rendimento').fill('30');

  // Tapping a row opens its sheet (push), back closes it.
  await page.getByRole('button', { name: /Manteiga/ }).click();
  await page.getByRole('dialog').waitFor();
  assert.ok(page.url().endsWith('/ingredientes/2'));
  await page.goBack();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('/ingredientes'));

  // Review focus 1: deep link to a missing ingredient -> no sheet, URL fixed.
  await page.goto(baseUrl + '#/receita/recipe%3Ab/ingredientes/99');
  await page.getByText('Leite condensado').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.ok(page.url().endsWith('/ingredientes'));
}
