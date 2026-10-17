// Ready-made recipes: home tabs, catalog (search, chips, groups), detail
// with sections, "Usar esta receita" (single copy, editor with steps and a
// free water row), editing the steps, back navigation, unknown id.

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal }) {
  // This scenario checks the copy without market prices (15-referencia
  // covers them): serve an empty reference file.
  // The service worker claims the open page right after it installs, and its
  // requests skip page.route: keep it out of this scenario.
  await page.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
  await page.route('**/data/precos-referencia.json*', (route) => route.fulfill({ contentType: 'application/json', body: '{"atualizadoEm":"2026-01-01","fonte":{"nome":"Savegnago","regiao":"interior de SP"},"precos":{}}' }));
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: 'Doce Valor' }).waitFor();

  // Empty Minhas receitas -> light link to the catalog.
  await page.getByRole('button', { name: /Ou comece por uma receita pronta/ }).click();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Receitas prontas' }).getAttribute('aria-current'), 'page');
  await page.getByText('Rende 30 docinhos · 4 ingredientes').waitFor();
  await semRolagemHorizontal();
  await shot('catalogo');

  // Search and category chips.
  await page.getByLabel('Buscar receita pronta').fill('coxinha');
  await page.getByRole('button', { name: /^Coxinha de frango/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Brigadeiro tradicional/ }).count(), 0);
  await page.getByLabel('Buscar receita pronta').fill('');
  await page.getByRole('group', { name: 'Categorias' }).getByRole('button', { name: 'Tortas' }).click();
  await page.getByRole('button', { name: /^Torta de limão/ }).waitFor();
  assert.equal(await page.getByRole('button', { name: /^Brigadeiro tradicional/ }).count(), 0);
  await page.getByRole('group', { name: 'Categorias' }).getByRole('button', { name: 'Todas' }).click();

  // Detail without sections, back to the catalog.
  await page.getByRole('button', { name: /^Brigadeiro tradicional/ }).click();
  await page.getByRole('heading', { name: 'Brigadeiro tradicional' }).waitFor();
  await page.getByText('Rende 30 docinhos').waitFor();
  await page.getByText('ou 7 colheres de sopa de achocolatado', { exact: false }).waitFor();
  await semRolagemHorizontal();
  await shot('detalhe');
  await page.goBack();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();

  // Detail with sections; double tap copies once.
  await page.getByRole('button', { name: /^Coxinha de frango/ }).click();
  await page.getByText('Para fritar').waitFor();
  await shot('detalhe-secoes');
  const usar = page.getByRole('button', { name: 'Usar esta receita' });
  await usar.dblclick();
  await page.locator('#nome-receita').waitFor();
  assert.equal(await page.locator('#nome-receita').inputValue(), 'Coxinha de frango');
  await page.getByText('Receita copiada para Minhas receitas').waitFor();
  const copias = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:recipes')).length);
  assert.equal(copias, 1);

  // Editor: steps, free water row.
  assert.equal(await page.locator('[data-slot="preparo"] .passos li').count(), 9);
  await page.locator('.ing-row', { hasText: 'Água' }).first().getByText('sem custo').waitFor();
  await semRolagemHorizontal();
  await shot('editor-copia');

  // A price typed on one "Farinha de trigo" row reaches the other one.
  const farinhas = page.locator('.ing-row', { hasText: 'Farinha de trigo' });
  assert.equal(await farinhas.count(), 2);
  await farinhas.first().click();
  await page.getByRole('dialog').getByLabel('Preço pago (R$)').click(); // as in 04: type only once it has focus
  await page.getByRole('dialog').getByLabel('Preço pago (R$)').pressSequentially('600');
  await page.getByRole('dialog').getByLabel('Tamanho da embalagem').fill('1000');
  await page.getByRole('dialog').getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await farinhas.nth(1).getByText('R$ 6,00 / 1000 g').waitFor();
  assert.equal(await farinhas.nth(1).getByText('falta o preço').count(), 0);

  // Edit the steps (pasted numbering is cleaned).
  await page.getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Um passo por linha').fill('1. Misture\n\n2) Asse');
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.deepEqual(await page.locator('[data-slot="preparo"] .passos li').allTextContents(), ['Misture', 'Asse']);

  // Free row: no "Quanto pagou"; renaming brings the cost back.
  await page.locator('.ing-row', { hasText: 'Água' }).first().click();
  await dialog.getByText('Não entra no custo.').waitFor();
  assert.equal(await dialog.getByLabel('Preço pago (R$)').isVisible(), false);
  await dialog.getByLabel('Ingrediente').fill('Leite');
  await dialog.getByLabel('Ingrediente').press('Tab');
  await dialog.getByLabel('Preço pago (R$)').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  // Back goes to the catalog (the detail was replaced); Minhas receitas has the copy.
  await page.getByRole('button', { name: 'Voltar para Minhas Receitas' }).click();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();
  await page.getByRole('button', { name: 'Minhas receitas' }).click();
  await page.getByText('Coxinha de frango').waitFor();

  // Unknown id -> toast and back to the catalog.
  await page.goto(baseUrl + '#/prontas/nao-existe');
  await page.getByText('Receita não encontrada').waitFor();
  await page.getByRole('heading', { name: 'Docinhos e trufas' }).waitFor();
}
