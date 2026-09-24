// Editor shell: new recipe focuses the name, tabs switch with replaceState,
// result bar opens Preço, save badge, empty new recipe is discarded on back,
// unknown recipe id goes back to the list.

export default async function ({ page, baseUrl, assert, shot }) {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: '+ Nova receita' }).click();
  await page.getByRole('tab', { name: 'Ingredientes' }).waitFor();
  await page.waitForFunction(() => document.activeElement?.id === 'nome-receita');

  // Leaving an untouched new recipe discards it.
  await page.getByRole('button', { name: 'Voltar para Minhas Receitas' }).click();
  await page.getByText('Nenhuma receita ainda').waitFor();

  // A named one is kept, and autosaves.
  await page.getByRole('button', { name: '+ Nova receita' }).click();
  await page.locator('#nome-receita').fill('Brigadeiro');
  await page.getByText('✓ Salvo').waitFor();
  await page.getByText('Adicione ingredientes para ver o custo').waitFor();
  await shot('ingredientes');

  // Tabs replace the history entry: back from any tab returns to the list.
  await page.getByRole('tab', { name: 'Custos' }).click();
  assert.ok(page.url().endsWith('/custos'));
  assert.equal(await page.getByRole('tab', { name: 'Custos' }).getAttribute('aria-selected'), 'true');
  await page.locator('.result-bar').click();
  assert.ok(page.url().endsWith('/preco'));
  assert.equal(await page.locator('.result-bar').isVisible(), false);
  await page.goBack();
  await page.getByText('Brigadeiro').waitFor();
  assert.ok(page.url().endsWith('#/'));

  // Unknown recipe in the URL -> list + message.
  await page.goto(baseUrl + '#/receita/recipe%3Anao-existe/custos');
  await page.getByText('Receita não encontrada').waitFor();
  assert.ok(page.url().endsWith('#/'));
}
