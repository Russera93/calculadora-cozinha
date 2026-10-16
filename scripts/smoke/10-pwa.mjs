// Installable + offline: manifest and icons served, the service worker
// takes over, and with the network off the app (and a recipe) still opens.

export default async function ({ page, baseUrl, assert, seed }) {
  await page.goto(baseUrl);
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const r = await fetch(href);
    return { ok: r.ok, json: await r.json() };
  });
  assert.ok(manifest.ok);
  assert.equal(manifest.json.display, 'standalone');
  for (const icon of manifest.json.icons) {
    const ok = await page.evaluate(async (src) => (await fetch(src)).ok, icon.src);
    assert.ok(ok, `ícone não encontrado: ${icon.src}`);
  }

  await page.evaluate(() => navigator.serviceWorker.ready);
  await seed([{ id: 'recipe:p', nome: 'Pudim', rendimento: 8, embalagemUnitaria: 0, quantidadeEmbalagens: 8, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z', ingredientes: [] }]);
  // Second load: now controlled by the service worker.
  await page.reload();
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker não assumiu a página');

  await page.context().setOffline(true);
  try {
    await page.reload();
    await page.getByRole('heading', { name: 'Doce Lucro' }).waitFor();
    await page.getByText('Pudim').click();
    await page.getByRole('tab', { name: 'Nutrição' }).click();
    await page.getByText('Informação Nutricional').waitFor();
    await page.getByRole('tab', { name: 'Ingredientes' }).click();
    await page.getByRole('button', { name: '+ Adicionar ingrediente' }).waitFor();
  } finally {
    await page.context().setOffline(false);
  }
}
