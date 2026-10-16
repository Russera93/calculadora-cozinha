// Sale channel and fee: pick iFood, type its fee right there, see the
// suggestions make up for it and what she earns drop; the fee is kept for
// other recipes; the list card shows "ganha".

const base = { ingredientId: null, quantidadeBruta: '', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null };
const receita = (id, nome) => ({ id, nome, rendimento: 10, embalagemUnitaria: 0, quantidadeEmbalagens: 10, tempoPreparoMinutos: 0, valorBotijao: 0,
  precoVendaDesejado: null, canalVenda: 'direto', criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z',
  // 500 g of a R$ 10/kg flour = R$ 5,00 -> R$ 0,50 per unit
  ingredientes: [{ ...base, nome: 'Farinha', quantidadeBruta: '500', precoEmbalagem: 10, tamanhoEmbalagem: 1000 }] });

export default async function ({ page, baseUrl, assert, shot, seed, semRolagemHorizontal }) {
  await page.goto(baseUrl);
  await seed([receita('recipe:t', 'Bolacha'), receita('recipe:u', 'Biscoito')]);

  await page.goto(baseUrl + '#/receita/recipe%3At/preco');
  assert.equal(await page.locator('[data-taxa]').isHidden(), true); // Pix/cash has no fee
  await page.getByRole('button', { name: '2× R$ 1,00' }).click();
  await page.getByText('Você ganha R$ 0,50 por unidade').waitFor();

  await page.getByRole('button', { name: 'iFood' }).click();
  const taxa = page.getByLabel('Taxa do iFood (%)');
  await taxa.fill('20');
  // R$ 1,00 - 0,50 de custo - 0,20 de taxa
  await page.getByText('Você ganha R$ 0,30 por unidade').waitFor();
  // 2× = 1,00 / 0,8 = 1,25 -> 1,50
  await page.getByRole('button', { name: '2× R$ 1,50' }).waitFor();
  await page.getByText('Ver detalhes do cálculo').click();
  await page.getByText('Taxa da venda: R$ 0,20 por unidade (20%)').waitFor();
  await semRolagemHorizontal();
  await shot('preco');

  // Maquininha has its own fee; iFood's is kept.
  await page.getByRole('button', { name: 'Maquininha' }).click();
  assert.equal(await page.getByLabel('Taxa da maquininha (%)').inputValue(), '');
  await page.getByRole('button', { name: 'iFood' }).click();
  assert.equal(await page.getByLabel('Taxa do iFood (%)').inputValue(), '20');

  // Another recipe sold on iFood uses the same fee without typing it again.
  await page.goto(baseUrl + '#/receita/recipe%3Au/preco');
  await page.getByRole('button', { name: 'iFood' }).click();
  assert.equal(await page.getByLabel('Taxa do iFood (%)').inputValue(), '20');

  await page.getByRole('button', { name: 'Voltar para Minhas Receitas' }).click();
  await page.locator('.recipe-card', { hasText: 'Bolacha' }).getByText('ganha R$ 0,30').waitFor();

  await page.reload();
  await page.goto(baseUrl + '#/receita/recipe%3At/preco');
  await page.getByText('Você ganha R$ 0,30 por unidade').waitFor();
  assert.equal(await page.getByRole('button', { name: 'iFood' }).getAttribute('aria-pressed'), 'true');
}
