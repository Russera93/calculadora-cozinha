// Ingredient sheet: add known + unknown ingredients, chips, conversion hint,
// money mask with focus kept, TACO lookup, price propagation, remove + undo,
// deep-linked sheet closing inside the app, persistence after reload.

export default async function ({ page, baseUrl, assert, shot, seed }) {
  await page.goto(baseUrl);
  await seed([
    { id: 'recipe:outra', nome: 'Bolo', rendimento: 8, embalagemUnitaria: 0, quantidadeEmbalagens: 8, tempoPreparoMinutos: 0, valorBotijao: 0, precoVendaDesejado: null,
      criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z',
      ingredientes: [{ ingredientId: 'fixed:manteiga', nome: 'Manteiga', quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 9, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: 0.96, pesoUnidadeG: null }] },
    { id: 'recipe:b', nome: 'Brigadeiro', rendimento: 20, embalagemUnitaria: 0, quantidadeEmbalagens: 20, tempoPreparoMinutos: 0, valorBotijao: 0, precoVendaDesejado: null,
      criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [] }
  ]);
  await page.goto(baseUrl + '#/receita/recipe%3Ab');

  // 1) Known ingredient from the fixed DB, measured in colheres de sopa.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  const dialog = page.getByRole('dialog');
  await page.waitForFunction(() => document.activeElement?.name === 'nome');
  await dialog.getByLabel('Ingrediente').fill('Manteiga');
  await dialog.getByLabel('Ingrediente').press('Enter'); // change -> match; Enter moves to the next field
  await dialog.getByLabel('Quantidade usada').fill('2');
  await dialog.getByRole('button', { name: 'c. sopa' }).click();
  assert.equal(await dialog.getByRole('button', { name: 'c. sopa' }).getAttribute('aria-pressed'), 'true');
  await dialog.getByText('≈ 28,8 g').waitFor(); // 2 × 15 ml × 0.96 g/ml

  // Review focus 3: typing digit by digit keeps focus and the full value.
  const preco = dialog.getByLabel('Preço pago (R$)');
  await preco.click();
  await preco.pressSequentially('1150');
  assert.equal(await preco.inputValue(), '11,50');
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'precoEmbalagem');
  await dialog.getByLabel('Tamanho da embalagem').fill('200');
  await dialog.getByText('R$ 1,66').waitFor(); // 28.8 g of R$ 11,50 / 200 g
  await shot('painel');

  // Price propagation to the other recipe (confirmation sheet).
  await dialog.getByRole('button', { name: /Usar este preço em outras receitas/ }).click();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  await page.getByText('Preço atualizado em 1 outra(s) receita(s).').waitFor();

  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByText('2 colheres de sopa · R$ 11,50 / 200 g').waitFor();

  // 2) Unknown ingredient -> nutrition section with TACO lookup.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await dialog.getByLabel('Ingrediente').fill('Leite de coco');
  await dialog.getByLabel('Ingrediente').press('Tab');
  await dialog.getByText('Nutrição (opcional)').waitFor();
  await dialog.getByText(/Encontrado na tabela TACO|Não encontrado na tabela nutricional/).waitFor();
  await dialog.getByLabel('Quantidade usada').fill('1');
  await dialog.getByRole('button', { name: 'unidade', exact: true }).first().click();
  await dialog.getByLabel('Preço pago (R$)').pressSequentially('590');
  await dialog.getByLabel('Tamanho da embalagem').fill('200');
  await dialog.getByRole('group', { name: 'Unidade da embalagem' }).getByRole('button', { name: 'ml' }).click();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByText('1 unidade · R$ 5,90 / 200 ml').waitFor();
  const custom = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:custom-ingredients') || '[]'));
  assert.ok(custom.some((c) => c.nome === 'Leite de coco' && c.densidadeGml === 1));

  // 3) Remove + undo. (Rows are located by class: the toast repeats the name.)
  const cocoRow = page.locator('.ing-row', { hasText: 'Leite de coco' });
  await cocoRow.click();
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await cocoRow.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await cocoRow.waitFor();

  // 4) Review focus 2: sheet opened by a deep link closes inside the app.
  await page.goto(baseUrl + '#/receita/recipe%3Ab/ingredientes/0');
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('#/receita/recipe%3Ab/ingredientes'));

  // 5) New sheet closed (tap outside it) with no name adds nothing.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await page.getByRole('dialog').waitFor();
  await page.mouse.click(195, 60); // backdrop, above the sheet
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.ing-row').count(), 2);

  // Everything persisted.
  await page.reload();
  await page.getByText('2 colheres de sopa · R$ 11,50 / 200 g').waitFor();
  const outra = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:recipes')).find((r) => r.id === 'recipe:outra'));
  assert.equal(outra.ingredientes[0].precoEmbalagem, 11.5);
}
