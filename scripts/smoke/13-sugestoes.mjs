// Ingredient name suggestions: category chips on an empty field, browsing a
// category, typing to search (with the category shown), picking fills the
// name and runs the usual matching, Escape closes the list but not the sheet.

export default async function ({ page, baseUrl, assert, shot, seed, semRolagemHorizontal }) {
  await page.goto(baseUrl);
  await seed([
    { id: 'recipe:c', nome: 'Coxinha', rendimento: 20, embalagemUnitaria: 0, quantidadeEmbalagens: 20, tempoPreparoMinutos: 0, valorBotijao: 0, precoVendaDesejado: null,
      criadoEm: '2026-10-16T00:00:00Z', atualizadoEm: '2026-10-16T00:00:00Z', ingredientes: [] }
  ]);
  await page.goto(baseUrl + '#/receita/recipe%3Ac');

  const dialog = page.getByRole('dialog');
  const nome = dialog.getByLabel('Ingrediente');
  const lista = dialog.getByRole('region', { name: 'Sugestões' });

  // 1) Empty field: categories of both areas; browse Temperos and pick one.
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await page.waitForFunction(() => document.activeElement?.name === 'nome');
  await lista.waitFor();
  await lista.getByText('Confeitaria').waitFor();
  await lista.getByText('Salgados').waitFor();
  await semRolagemHorizontal();
  await shot('categorias');
  await lista.getByRole('button', { name: 'Temperos' }).click();
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'nome'); // chip tap kept the focus
  await shot('temperos');
  await lista.getByRole('button', { name: 'Orégano' }).click();
  assert.equal(await nome.inputValue(), 'Orégano');
  await lista.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.name), 'quantidadeBruta');
  await dialog.getByText(/Encontrado na tabela TACO|Não encontrado na tabela nutricional|Base nutricional indisponível/).waitFor();
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.locator('.ing-row', { hasText: 'Orégano' }).waitFor();

  // 2) Typing searches (accents ignored) and shows the category; picking a
  // fixed ingredient matches it (no nutrition section).
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await nome.pressSequentially('leite co');
  const condensado = lista.getByRole('button', { name: /^Leite condensado/ });
  await condensado.waitFor();
  await lista.getByText('Lácteos').waitFor();
  await shot('busca');
  await condensado.click();
  assert.equal(await nome.inputValue(), 'Leite condensado');
  assert.equal(await dialog.locator('[data-nutricao]').isHidden(), true);
  // Autosave is debounced (400ms): wait for the row to land.
  const row = await page.waitForFunction(() => JSON.parse(localStorage.getItem('calculadora-cozinha:recipes'))
    .find((r) => r.id === 'recipe:c').ingredientes.find((i) => i.nome === 'Leite condensado'));
  assert.equal(await row.evaluate((r) => r.ingredientId), 'fixed:leite-condensado');

  // 3) Nothing matches -> no list; typing a new name still works.
  await nome.fill('');
  await lista.waitFor(); // back to categories
  await nome.pressSequentially('xyzw');
  await lista.waitFor({ state: 'hidden' });

  // 4) Escape closes the list only.
  await nome.fill('');
  await lista.waitFor();
  await nome.press('Escape');
  await lista.waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('dialog').count(), 1);
}
