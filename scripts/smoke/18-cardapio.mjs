// Cardápio compartilhável: pick a recipe, add a photo (kept in IndexedDB,
// still there after a reload), confirm quantity/price, "Baixar PDF" prints
// just the cardápio, "Compartilhar imagem" falls back to a download when
// the Web Share API can't take files (desktop Chromium, here forced off
// so the test is deterministic either way).

export default async function ({ page, baseUrl, assert, shot, seed, semRolagemHorizontal }) {
  await page.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve();
    window.print = () => { window.__impresso = (window.__impresso || 0) + 1; };
    navigator.canShare = () => false; // exercise the download fallback, deterministically
  });
  await page.goto(baseUrl);
  await seed([
    { id: 'recipe:a', nome: 'Brigadeiro', rendimento: 30, ingredientes: [], precoVendaDesejado: 2.5 },
    { id: 'recipe:b', nome: 'Beijinho', rendimento: 20, ingredientes: [], precoVendaDesejado: null }
  ]);
  await page.goto(baseUrl);

  await page.getByRole('button', { name: 'Ajustes e backup' }).click();
  await page.getByRole('button', { name: '🛍️ Cardápio para o cliente' }).click();
  await page.getByRole('heading', { name: 'Cardápio' }).waitFor();

  const brigadeiro = page.locator('.card', { hasText: 'Brigadeiro' });
  const beijinho = page.locator('.card', { hasText: 'Beijinho' });
  await brigadeiro.getByRole('checkbox').check();
  await brigadeiro.getByLabel('Quantidade').waitFor();
  assert.equal(await brigadeiro.getByLabel('Quantidade').inputValue(), '1 unidade');
  assert.equal(await brigadeiro.getByLabel('Preço pro cliente (R$)').inputValue(), '2,50');

  // A tiny photo for the product, drawn right here in the page (no
  // navigation — setContent()/goto() back to the same hash was seen to
  // collapse into a same-document no-op and leave the app un-rendered).
  const fotoBase64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 40;
    c.getContext('2d').fillRect(0, 0, 40, 40);
    return c.toDataURL('image/png').split(',')[1];
  });
  const foto = Buffer.from(fotoBase64, 'base64');
  await brigadeiro.getByRole('button', { name: '📷 Adicionar foto' }).click();
  await brigadeiro.locator('input[type="file"]').setInputFiles({ name: 'produto.png', mimeType: 'image/png', buffer: foto });
  await brigadeiro.getByRole('button', { name: 'Trocar foto' }).waitFor();
  await brigadeiro.locator('img.cardapio-thumb').waitFor();
  await semRolagemHorizontal();
  await shot('selecionado');

  // Beijinho has no price yet: stays out of what's generated.
  await beijinho.getByRole('checkbox').check();
  await beijinho.getByLabel('Preço pro cliente (R$)').waitFor();

  await page.getByRole('button', { name: '📄 Baixar PDF' }).click();
  assert.equal(await page.evaluate(() => window.__impresso), 1);
  assert.equal(await page.locator('.cardapio-print-lista li').count(), 1); // só o Brigadeiro, com preço

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '🖼️ Compartilhar imagem' }).click()
  ]);
  assert.equal(download.suggestedFilename(), 'cardapio.png');
  await page.getByText('Imagem baixada', { exact: false }).waitFor();

  // The photo survives a reload (it lives in IndexedDB, not in the recipe).
  await page.reload();
  await page.getByRole('heading', { name: 'Cardápio' }).waitFor();
  await brigadeiro.getByRole('checkbox').check();
  await brigadeiro.locator('img.cardapio-thumb').waitFor();

  await brigadeiro.getByRole('button', { name: 'Remover foto' }).click();
  await brigadeiro.getByRole('button', { name: '📷 Adicionar foto' }).waitFor();

  await page.getByRole('button', { name: 'Voltar' }).click();
  await page.getByRole('heading', { name: 'Doce Valor' }).waitFor();
}
