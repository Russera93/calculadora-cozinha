// "Ler nota de compra" with pasted text: items matched to the recipe,
// review, apply -> prices filled, summary (batches it makes), the
// "Sua última compra" card, persistence, and back closing the sheet.
// Also: an item with no match can join the recipe as "+ Novo ingrediente".

const base = { ingredientId: null, quantidadeBruta: '', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null };
const ingredientes = [
  { ...base, nome: 'Leite Condensado', quantidadeBruta: '1', unidade: 'unidade', densidadeGml: 1.3 },
  { ...base, nome: 'Chocolate em pó', quantidadeBruta: '30', densidadeGml: 0.5 },
  { ...base, nome: 'Manteiga', quantidadeBruta: '20', precoEmbalagem: 11.5, tamanhoEmbalagem: 200 }
];

const CUPOM = [
  'SUPERMERCADO BOM PRECO LTDA',
  'CNPJ: 12.345.678/0001-90',
  '001 7891000100103 LEITE COND MOCA 395G 2 UN X 7,49 14,98',
  '002 7896005800027 CHOC PO 50% NESTLE 200G',
  '1,000 UN x 12,90 F1 12,90',
  '003 7891024134702 DETERGENTE YPE 500ML 1 UN X 2,49 2,49',
  '004 7891035000127 GRANULADO CHOC 150G 1 UN X 6,90 6,90',
  'TOTAL R$ 37,27',
  'CARTAO DEBITO 37,27'
].join('\n');

export default async function ({ page, baseUrl, assert, shot, seed, semRolagemHorizontal }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:n', nome: 'Brigadeiro', rendimento: 20, embalagemUnitaria: 0, quantidadeEmbalagens: 20, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z', ingredientes }]);

  await page.goto(baseUrl + '#/receita/recipe%3An/ingredientes');
  await page.getByRole('button', { name: '📷 Ler nota de compra' }).click();
  const sheet = page.getByRole('dialog', { name: 'Ler nota de compra' });
  await sheet.waitFor();
  assert.ok(page.url().endsWith('/ingredientes/nota'), page.url());

  await sheet.getByText('Colar o texto da nota').click();
  await sheet.getByLabel('Texto da nota').fill(CUPOM);
  await sheet.getByRole('button', { name: 'Ler o texto' }).click();

  const cards = sheet.locator('.nota-item');
  await cards.first().waitFor();
  assert.equal(await cards.count(), 4);
  const leite = cards.filter({ hasText: 'LEITE COND MOCA 395G' });
  const choc = cards.filter({ hasText: 'CHOC PO 50% NESTLE 200G' });
  const detergente = cards.filter({ hasText: 'DETERGENTE YPE 500ML' });
  const granulado = cards.filter({ hasText: 'GRANULADO CHOC 150G' });
  assert.equal(await leite.getByLabel('Usar para').locator('option:checked').textContent(), 'Leite Condensado');
  assert.equal(await choc.getByLabel('Usar para').locator('option:checked').textContent(), 'Chocolate em pó');
  assert.equal(await detergente.getByLabel('Usar para').locator('option:checked').textContent(), 'Não usar');
  assert.equal(await granulado.getByLabel('Usar para').locator('option:checked').textContent(), 'Não usar'); // no match: not an ingredient yet
  await leite.getByText('= R$ 7,49 por embalagem de 395 g · na receita: R$ 7,49').waitFor();
  assert.equal(await leite.getByLabel('Qtd. comprada').inputValue(), '2');
  await semRolagemHorizontal();
  await shot('conferir');

  // An incomplete ticked item blocks "Aplicar".
  const tamanhoChoc = choc.getByLabel('Tamanho de cada embalagem');
  await tamanhoChoc.fill('');
  await choc.getByText('falta o tamanho da embalagem').waitFor();
  assert.equal(await sheet.locator('[data-action="aplicar"]').isDisabled(), true);
  await tamanhoChoc.fill('200');

  // An item with no match joins the recipe as a new ingredient (it starts
  // collapsed under "Outros itens da nota", same as Detergente).
  await sheet.getByText(/Outros itens da nota/).click();
  await granulado.getByLabel('Usar para').selectOption('novo');
  await granulado.getByText('dê um nome para o novo ingrediente').waitFor();
  assert.equal(await sheet.locator('[data-action="aplicar"]').isDisabled(), true);
  await granulado.getByLabel('Nome do novo ingrediente').fill('Granulado');
  await granulado.getByText('= R$ 6,90 por embalagem de 150 g').waitFor();
  await shot('novo-ingrediente');

  await sheet.getByRole('button', { name: 'Aplicar na receita (3)' }).click();
  await sheet.getByText('Esta receita gasta').waitFor();
  await sheet.getByText('2 receitas = 40 unidades').waitFor();
  await sheet.getByText('Acaba primeiro: Leite Condensado').waitFor();
  await sheet.getByText(/Não vieram na nota: Manteiga/).waitFor();
  await sheet.getByText('Total pago nesses itens: R$ 34,78').waitFor();
  await shot('resumo');

  await sheet.getByRole('button', { name: 'Pronto' }).click();
  await sheet.waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('/ingredientes'), page.url());
  await page.locator('.ing-row', { hasText: 'Leite Condensado' }).getByText('R$ 7,49 / 395 g').waitFor();
  await page.locator('.ing-row', { hasText: 'Chocolate em pó' }).getByText('R$ 12,90 / 200 g').waitFor();
  const novoGranulado = page.locator('.ing-row', { hasText: 'Granulado' });
  await novoGranulado.getByText('R$ 6,90 / 150 g').waitFor();
  await novoGranulado.getByText('falta a quantidade').waitFor(); // bought, but how much a batch uses is still hers to fill in
  await page.getByRole('heading', { name: 'Sua última compra' }).waitFor();
  await shot('cartao');

  const precos = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:precos') || '[]'));
  assert.ok(precos.some((p) => p.nome === 'Leite Condensado' && p.precoEmbalagem === 7.49), JSON.stringify(precos));
  assert.ok(precos.some((p) => p.nome === 'Granulado' && p.precoEmbalagem === 6.9), JSON.stringify(precos));
  const apelidos = await page.evaluate(() => JSON.parse(localStorage.getItem('calculadora-cozinha:apelidos-nota') || '[]'));
  assert.deepEqual(apelidos.map((a) => a.nome), ['Leite Condensado', 'Chocolate em pó', 'Granulado']);

  await page.reload();
  await page.getByRole('heading', { name: 'Sua última compra' }).waitFor();
  await page.getByText('2 receitas = 40 unidades').waitFor();

  // The phone's back button closes the sheet and stays in the recipe.
  await page.getByRole('button', { name: '📷 Ler nota de compra' }).click();
  await sheet.waitFor();
  await page.goBack();
  await sheet.waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('/ingredientes'), page.url());

  await page.getByRole('button', { name: 'Remover' }).click();
  await page.getByRole('heading', { name: 'Sua última compra' }).waitFor({ state: 'detached' });
}
