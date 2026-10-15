// "Lucro de verdade": set up Meu negócio from the Preço tab, give the
// recipe its working time, pick the fair price, see the hour it paid,
// switch to iFood, and find "ganha" on the list card.

const base = { ingredientId: null, quantidadeBruta: '', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null };

export default async function ({ page, baseUrl, assert, shot, seed, semRolagemHorizontal }) {
  await page.goto(baseUrl);
  await seed([{ id: 'recipe:g', nome: 'Brigadeiro', rendimento: 20, embalagemUnitaria: 0, quantidadeEmbalagens: 20, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z',
    ingredientes: [
      { ...base, nome: 'Leite Condensado', quantidadeBruta: '1', unidade: 'unidade', densidadeGml: 1.3, precoEmbalagem: 7.49, tamanhoEmbalagem: 395 },
      { ...base, nome: 'Chocolate em pó', quantidadeBruta: '30', densidadeGml: 0.5, precoEmbalagem: 12.9, tamanhoEmbalagem: 200 }
    ] }]);

  // Ingredients R$ 9,43 / 20 = R$ 0,47 per unit, nothing else yet.
  await page.goto(baseUrl + '#/receita/recipe%3Ag/preco');
  await page.getByRole('button', { name: 'Configurar Meu negócio (1 minuto) ›' }).click();
  const sheet = page.getByRole('dialog', { name: 'Meu negócio' });
  await sheet.waitFor();
  assert.ok(page.url().endsWith('/preco/negocio'), page.url());
  await sheet.getByLabel('Quanto você quer ganhar por mês? (R$)').pressSequentially('208000');
  await sheet.getByLabel('Quantas horas por semana você trabalha na cozinha?').fill('24');
  await sheet.getByText('Sua hora vale R$ 20,00 (104 horas por mês)').waitFor();
  await sheet.getByLabel('Luz (R$)').pressSequentially('20800');
  await sheet.getByText('Total R$ 208,00 por mês = R$ 2,00 por hora trabalhada').waitFor();
  await sheet.getByLabel('iFood (%)').fill('20');
  await semRolagemHorizontal();
  await shot('negocio');
  await sheet.getByRole('button', { name: 'Pronto' }).click();
  await sheet.waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('/preco'), page.url());

  // Configured, but this recipe has no working time yet.
  await page.getByRole('button', { name: 'Informar o tempo ›' }).click();
  await page.getByLabel('Quanto tempo você trabalha nesta receita?').fill('1h30');
  await page.getByText('= 1h30').waitFor();
  await page.getByText('Contas fixas desta receita').waitFor(); // 1,5 h × R$ 2,00 = R$ 3,00
  await page.getByText('Sua hora: R$ 20,00 · ajustar Meu negócio ›').waitFor();
  await shot('custos');

  // (9,43 + 3) / 20 = R$ 0,62; Justo = (12,43 + 30) / 20 = 2,12 -> R$ 2,50
  await page.locator('.result-bar').click();
  await page.getByText('Custo de cada unidade').waitFor();
  assert.equal(await page.locator('[data-custo-un]').textContent(), 'R$ 0,62');
  await page.getByRole('button', { name: 'Justo R$ 2,50' }).click();
  await page.getByText('Você ganha R$ 1,88 por unidade').waitFor();
  await page.locator('.hora-rendeu').getByText(/Sua hora rendeu R\$ 25,0\d/).waitFor();
  await page.getByText('(meta R$ 20,00)').waitFor();
  await page.getByRole('button', { name: 'Com lucro R$ 3,00' }).waitFor();
  await shot('preco');

  // iFood keeps 20% of R$ 2,50 = R$ 0,50.
  await page.getByRole('button', { name: 'iFood (20%)' }).click();
  await page.getByText('Você ganha R$ 1,38 por unidade').waitFor();
  await page.getByRole('button', { name: 'Justo R$ 3,00' }).waitFor(); // 2,12 / 0,8 = 2,65

  await page.getByRole('button', { name: 'Voltar para Minhas Receitas' }).click();
  await page.locator('.recipe-card', { hasText: 'Brigadeiro' }).getByText('ganha R$ 1,38').waitFor();

  await page.reload();
  await page.getByRole('button', { name: 'Ajustes e backup' }).click();
  await page.getByRole('button', { name: /Meu negócio/ }).click();
  await sheet.waitFor();
  assert.equal(await sheet.getByLabel('Quanto você quer ganhar por mês? (R$)').inputValue(), '2080,00');
  await page.goBack();
  await sheet.waitFor({ state: 'detached' });
  assert.ok(page.url().endsWith('#/'), page.url());
}
