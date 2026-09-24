// Regressions found in the final review:
// 1) undo while another ingredient's sheet is open must not remove/duplicate the wrong row
// 2) an unknown ingredient closed before TACO answers must not be saved as an empty custom ingredient
// 3) double-tapping "Pronto" must go back only once (never leave the app)
// 4) pasting "R$ 1.234,56" with the caret at the start of a money field gives 1234,56

const ing = (nome) => ({ ingredientId: null, nome, quantidadeBruta: '100', unidade: 'g', precoEmbalagem: 10, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null });
const nomesSalvos = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:recipes'))[0].ingredientes.map((i) => i.nome));

export default async function ({ page, baseUrl, assert, seed }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:r', nome: 'Receita', rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 10, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-09-01T00:00:00Z', atualizadoEm: '2026-09-01T00:00:00Z', ingredientes: [ing('Alfa'), ing('Beta')] }]);

  // 3) Double tap on Pronto: lista -> recipe -> sheet; must end on the tab, not the list.
  await page.reload();
  await page.getByRole('button', { name: /Receita/ }).first().click();
  await page.locator('.ing-row', { hasText: 'Alfa' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Pronto' }).dblclick();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  assert.ok(page.url().endsWith('/ingredientes'), `double tap went to ${page.url()}`);

  // 1) Remove Alfa, open Beta, undo -> Beta's sheet must still edit Beta.
  await page.locator('.ing-row', { hasText: 'Alfa' }).click();
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.locator('.ing-row', { hasText: 'Beta' }).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.waitForTimeout(600);
  assert.deepEqual(await nomesSalvos(page), ['Alfa']);

  // 4) Paste with the caret at the start of "0,00".
  await page.getByRole('tab', { name: 'Preço' }).click();
  const campo = page.getByLabel('Quanto você vai cobrar? (por unidade)');
  await campo.focus();
  await page.evaluate(() => {
    const el = document.querySelector('#preco-venda');
    el.value = '0,00';
    el.setSelectionRange(0, 0);
    const data = new DataTransfer();
    data.setData('text/plain', 'R$ 1.234,56');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  assert.equal(await campo.inputValue(), '1234,56');

  // 2) Unknown ingredient closed while TACO is still loading.
  await page.route('**/data/taco.json', async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.continue(); });
  await page.getByRole('tab', { name: 'Ingredientes' }).click();
  await page.getByRole('button', { name: '+ Adicionar ingrediente' }).click();
  await page.getByRole('dialog').getByLabel('Ingrediente').fill('Xarope inventado');
  await page.getByRole('dialog').getByLabel('Ingrediente').press('Tab');
  await page.getByRole('button', { name: 'Pronto' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  const custom = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:custom-ingredients') || '[]'));
  assert.ok(!custom.some((c) => c.nome === 'Xarope inventado'), 'empty custom ingredient was saved');
  await page.waitForTimeout(3500); // let the delayed lookup finish; nothing may be saved afterwards either
  const depois = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:custom-ingredients') || '[]'));
  assert.ok(!depois.some((c) => c.nome === 'Xarope inventado' && c.nutricao100g === null));
}
