// Meus ingredientes: reached from Ajustes, shows what's priced and what's
// not (with the market reference as a hint), editing a price propagates
// to every recipe, and "Atualizar valor automaticamente" fills the rest.

const REF = JSON.stringify({
  atualizadoEm: '2026-10-19',
  fonte: { nome: 'Savegnago', regiao: 'interior de SP', url: 'https://www.savegnago.com.br' },
  precos: {
    'leite condensado': { nome: 'Leite condensado', precoEmbalagem: 8.79, tamanhoEmbalagem: 395, unidadeEmbalagem: 'g', produtos: 5 },
    'chocolate em po': { nome: 'Chocolate em pó', precoEmbalagem: 9.5, tamanhoEmbalagem: 200, unidadeEmbalagem: 'g', produtos: 4 }
  }
});

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });
  await page.route('**/data/precos-referencia.json*', (route) => route.fulfill({ contentType: 'application/json', body: REF }));
  await page.goto(baseUrl);

  await seed([
    {
      id: 'recipe:1', nome: 'Brigadeiro', rendimento: 30, ingredientes: [
        { nome: 'Leite condensado', quantidadeBruta: '1', unidade: 'unidade', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g' },
        { nome: 'Farinha de trigo', quantidadeBruta: '1', unidade: 'g', precoEmbalagem: 6, tamanhoEmbalagem: 1000, unidadeEmbalagem: 'g' }
      ]
    },
    {
      id: 'recipe:2', nome: 'Bolo', rendimento: 8, ingredientes: [
        { nome: 'Leite condensado', quantidadeBruta: '2', unidade: 'unidade', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g' },
        { nome: 'Chocolate em pó', quantidadeBruta: '1', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g' }
      ]
    }
  ]);
  await page.goto(baseUrl);

  // Reached from Ajustes.
  await page.getByRole('button', { name: 'Ajustes e backup' }).click();
  await page.getByRole('button', { name: '🧂 Meus ingredientes' }).click();
  await page.getByRole('heading', { name: 'Meus ingredientes' }).waitFor();

  const farinha = page.locator('.ing-row', { hasText: 'Farinha de trigo' });
  const leite = page.locator('.ing-row', { hasText: 'Leite condensado' });
  const chocolate = page.locator('.ing-row', { hasText: 'Chocolate em pó' });
  await farinha.getByText('R$ 6,00 / 1000 g').waitFor();
  await leite.getByText('sem preço').waitFor();
  await leite.getByText('referência: R$ 8,79 / 395 g').waitFor();
  await semRolagemHorizontal();
  await shot('lista');

  // Accepting the reference as her own price propagates to both recipes.
  await leite.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Preenchido com a referência de mercado', { exact: false }).waitFor();
  assert.equal(await dialog.getByLabel('Preço pago (R$)').inputValue(), '8,79');
  await shot('editar-referencia');
  await dialog.getByRole('button', { name: 'Salvar' }).click();
  await page.getByText('Preço salvo e atualizado em 2 receita(s).').waitFor();
  await leite.getByText('R$ 8,79 / 395 g').waitFor();
  assert.equal(await page.evaluate(() => (localStorage.getItem('calculadora-cozinha:precos') || '').includes('Leite condensado')), true);

  // "Atualizar valor automaticamente": fills what's still missing (Chocolate em pó).
  await chocolate.getByText('sem preço').waitFor();
  await page.getByLabel('Atualizar valor automaticamente').check();
  await page.getByText(/preço\(s\) atualizado\(s\) pela referência de mercado/).waitFor();
  await chocolate.getByText('R$ 9,50 / 200 g').waitFor();
  await chocolate.getByText('referência de mercado').waitFor(); // auto-filled, not yet confirmed as hers
  assert.equal(await page.evaluate(() => localStorage.getItem('calculadora-cozinha:atualizar-precos-auto')), 'true');

  // Back goes to Minhas receitas.
  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('heading', { name: 'Doce Valor' }).waitFor();
}
