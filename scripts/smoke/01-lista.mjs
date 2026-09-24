// Minhas Receitas: empty state, cards with profit, long names, ⋯ menu,
// rename, duplicate, delete + undo, search, settings sheet and back button.

function receita(id, nome, precoVendaDesejado) {
  return {
    id, nome, rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 10, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado, criadoEm: '2026-09-01T00:00:00.000Z', atualizadoEm: '2026-09-01T00:00:00.000Z',
    ingredientes: [{ ingredientId: null, nome: 'Farinha', quantidadeBruta: '500', unidade: 'g', precoEmbalagem: 10, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null }]
  };
}

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.goto(baseUrl);
  await page.getByText('Nenhuma receita ainda').waitFor();
  await shot('vazia');

  await seed([
    receita('recipe:a', 'Brownie', 0.3),
    receita('recipe:b', 'Bolo de pote de ninho com Nutella e morango do sul de Minas Gerais', 1234.5),
    receita('recipe:c', 'Coxinha', null),
    receita('recipe:d', 'Açaí na tigela', 2)
  ]);
  await page.reload();

  // Sorted pt-BR, with profit/loss/price tags.
  await page.locator('.recipe-card-name').first().waitFor();
  const nomes = await page.locator('.recipe-card-name').allTextContents();
  assert.deepEqual(nomes, ['Açaí na tigela', 'Bolo de pote de ninho com Nutella e morango do sul de Minas Gerais', 'Brownie', 'Coxinha']);
  await page.getByText('Custo R$ 0,50/un.').first().waitFor();
  await page.getByText('lucro R$ 1.234,00').waitFor();
  await page.getByText('prejuízo R$ 0,20').waitFor();
  await page.getByText('definir preço').waitFor();
  await semRolagemHorizontal();
  await shot('lista');

  // Search (shown from 4 recipes on), accent-insensitive.
  await page.getByPlaceholder('🔍 Buscar receita').fill('acai');
  assert.deepEqual(await page.locator('.recipe-card-name').allTextContents(), ['Açaí na tigela']);
  await page.getByPlaceholder('🔍 Buscar receita').fill('');

  // Rename through the ⋯ menu.
  await page.getByRole('button', { name: 'Ações para Coxinha' }).click();
  await page.getByRole('menuitem', { name: /Renomear/ }).click();
  await page.getByRole('dialog').locator('input').fill('Coxinha de frango');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Coxinha de frango').waitFor();

  // Duplicate. (Cards are located by class: the toast repeats the name.)
  const copia = page.locator('.recipe-card-name', { hasText: 'Brownie (cópia)' });
  await page.getByRole('button', { name: 'Ações para Brownie', exact: true }).click();
  await page.getByRole('menuitem', { name: /Duplicar/ }).click();
  await copia.waitFor();

  // Delete + undo.
  await page.getByRole('button', { name: 'Ações para Brownie (cópia)' }).click();
  await page.getByRole('menuitem', { name: /Excluir/ }).click();
  await copia.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Desfazer' }).click();
  await copia.waitFor();

  // Settings sheet opens as a route; the browser back button closes it.
  await page.getByRole('button', { name: 'Ajustes e backup' }).click();
  await page.getByRole('dialog', { name: 'Ajustes' }).waitFor();
  assert.ok(page.url().endsWith('#/ajustes'));
  await shot('ajustes');
  await page.goBack();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('#/'));
}
