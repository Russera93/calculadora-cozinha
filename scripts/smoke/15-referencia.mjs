// Market reference prices: copying a ready-made recipe fills unpriced rows
// (tag "referência", cost computed), the sheet explains it, editing the
// price makes it hers, a newer week offers "Atualizar N preços".

const semana = (atualizadoEm, leite) => JSON.stringify({
  atualizadoEm,
  fonte: { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' },
  precos: {
    'leite condensado': { nome: 'Leite condensado', precoEmbalagem: leite, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 5 },
    'chocolate em po': { nome: 'Chocolate em pó', precoEmbalagem: 9.5, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g', produtos: 4 },
    'granulado': { nome: 'Granulado', precoEmbalagem: 6, tamanhoEmbalagem: 150, unidadeEmbalagem: 'g', produtos: 3 }
  }
});

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal }) {
  let arquivo = semana('2026-10-12', 8.79);
  await page.route('**/data/precos-referencia.json*', (route) => route.fulfill({ contentType: 'application/json', body: arquivo }));
  await page.goto(baseUrl + '#/prontas/brigadeiro');
  await page.getByRole('button', { name: 'Usar esta receita' }).click();
  await page.locator('#nome-receita').waitFor();

  // Unpriced rows came with the reference, tagged; cost computed.
  const leite = page.locator('.ing-row', { hasText: 'Leite condensado' });
  await leite.getByText('referência', { exact: true }).waitFor();
  await leite.getByText('R$ 8,79').first().waitFor(); // cost and summary both show it
  assert.equal(await page.locator('.ing-row', { hasText: 'Manteiga sem sal' }).getByText('referência', { exact: true }).count(), 0);
  await semRolagemHorizontal();
  await shot('copia');

  // Sheet explains; leaving the price field unchanged keeps it a reference
  // and never teaches the price bank.
  await leite.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText(/Preço de referência · Savegnago \(interior de SP\)/).waitFor();
  // A market estimate is not spread to other recipes as her price.
  assert.equal(await dialog.getByRole('button', { name: /Usar este preço em outras receitas/ }).count(), 0);
  await shot('painel');
  await dialog.getByLabel('Preço pago (R$)').click();
  await dialog.getByLabel('Tamanho da embalagem').click();
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await leite.getByText('referência', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => (localStorage.getItem('calculadora-cozinha:precos') || '').includes('8.79')), false);

  // A newer week with a different price: update card.
  // Requests made by the service worker bypass page.route: unregister it so
  // the reload fetches the test file.
  arquivo = semana('2026-10-19', 9.29);
  await page.evaluate(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); });
  await page.reload();
  await page.getByRole('button', { name: 'Atualizar 1 preço' }).click();
  await page.getByText('1 preço atualizado').waitFor();
  await leite.getByText('R$ 9,29').first().waitFor();
  assert.equal(await page.getByRole('button', { name: /Atualizar \d+ preço/ }).count(), 0);

  // Renaming a reference row drops the other product's price.
  await page.locator('.ing-row', { hasText: 'Granulado' }).click();
  await dialog.getByLabel('Ingrediente').fill('Confeito colorido');
  await dialog.getByLabel('Ingrediente').press('Enter');
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  const confeito = page.locator('.ing-row', { hasText: 'Confeito colorido' });
  await confeito.getByText('falta o preço').waitFor();
  assert.equal(await confeito.getByText('referência', { exact: true }).count(), 0);

  // Editing the price makes it hers: tag and note go away.
  await page.locator('.ing-row', { hasText: 'Chocolate em pó' }).click();
  await dialog.getByLabel('Preço pago (R$)').click();
  await dialog.getByLabel('Preço pago (R$)').pressSequentially('1050');
  assert.equal(await dialog.getByText(/Preço de referência/).isVisible(), false);
  await dialog.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.ing-row', { hasText: 'Chocolate em pó' }).getByText('referência', { exact: true }).count(), 0);
}
