// "Instalar o app": on Chrome/Android the card's button opens the browser's
// install dialog (beforeinstallprompt, simulated here); "Agora não" hides
// it for a month; on iPhone the card shows the home-screen steps.

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function oferecerInstalacao(page, outcome = 'accepted') {
  await page.evaluate((outcome) => {
    window.__pediuInstalar = false;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__pediuInstalar = true; };
    e.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(e);
  }, outcome);
}

export default async function ({ page, baseUrl, assert, shot }) {
  // ---- Android / Chrome ----
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: 'Doce Lucro' }).waitFor();
  assert.equal(await page.locator('.aviso-card').count(), 0); // nothing to offer yet
  await oferecerInstalacao(page);
  const card = page.locator('.aviso-card');
  await card.getByText('Instale o Doce Lucro no celular.').waitFor();
  await shot('card');
  await card.getByRole('button', { name: '📲 Instalar o app' }).click();
  await page.getByText('Pronto! O app está na tela inicial do seu celular.').waitFor();
  assert.equal(await page.evaluate(() => window.__pediuInstalar), true);
  await card.waitFor({ state: 'detached' });

  // Ajustes always has the option (here: no install prompt pending).
  await page.getByRole('button', { name: 'Ajustes e backup' }).click();
  const ajustes = page.getByRole('dialog', { name: 'Ajustes' });
  await ajustes.getByText('App no celular').waitFor();
  await oferecerInstalacao(page, 'dismissed');
  await ajustes.getByRole('button', { name: '📲 Instalar o app' }).click();
  assert.equal(await page.evaluate(() => window.__pediuInstalar), true);
  await page.goBack();
  await ajustes.waitFor({ state: 'detached' });

  // "Agora não" keeps the card away, even after reloading.
  await oferecerInstalacao(page);
  await card.getByRole('button', { name: 'Agora não' }).click();
  await card.waitFor({ state: 'detached' });
  await page.reload();
  await page.getByRole('heading', { name: 'Doce Lucro' }).waitFor();
  await oferecerInstalacao(page);
  assert.equal(await page.locator('.aviso-card').count(), 0);

  // ---- iPhone (Safari has no install event: show the steps) ----
  // Its home-screen app gets separate, empty storage: copy in Safari,
  // paste in the app.
  const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const tema = dark ? 'dark' : 'light';
  const novoIphone = async ({ instalado = false, semLeitura = false } = {}) => {
    const ctx = await page.context().browser().newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: IPHONE_UA, colorScheme: tema, locale: 'pt-BR'
    });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(baseUrl).origin });
    if (instalado) await ctx.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    if (semLeitura) await ctx.addInitScript(() => { navigator.clipboard.readText = () => Promise.reject(new Error('negado')); });
    return ctx;
  };

  const safari = await novoIphone();
  let copiado;
  try {
    const ipage = await safari.newPage();
    await ipage.goto(baseUrl);
    await ipage.evaluate(() => localStorage.setItem('calculadora-cozinha:recipes', JSON.stringify([
      { id: 'recipe:ios', nome: 'Pudim de leite', rendimento: 8, embalagemUnitaria: 0, quantidadeEmbalagens: 8, tempoPreparoMinutos: 0, valorBotijao: 0,
        precoVendaDesejado: null, canalVenda: 'direto', criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z', ingredientes: [] }
    ])));
    await ipage.reload();
    const icard = ipage.locator('.aviso-card');
    await icard.getByText('Instale o Doce Lucro no iPhone.').waitFor();
    await icard.getByText('"Adicionar à Tela de Início"').waitFor();
    assert.equal(await icard.getByRole('button', { name: '📲 Instalar o app' }).count(), 0);
    await ipage.screenshot({ path: `scripts/.screenshots/12-instalar-iphone-${tema}.png`, fullPage: true });
    await icard.getByRole('button', { name: '📋 Copiar minhas receitas' }).click();
    await ipage.getByText('Receitas copiadas!', { exact: false }).waitFor();
    copiado = await ipage.evaluate(() => navigator.clipboard.readText());
    assert.ok(copiado.startsWith('DOCE-LUCRO-RECEITAS:') && copiado.includes('Pudim de leite'));
  } finally {
    await safari.close();
  }

  for (const semLeitura of [false, true]) {
    const app = await novoIphone({ instalado: true, semLeitura });
    try {
      const apage = await app.newPage();
      await apage.goto(baseUrl);
      const acard = apage.locator('.aviso-card');
      await acard.getByText('Trazer suas receitas do Safari.').waitFor();
      if (!semLeitura) {
        await apage.evaluate((t) => navigator.clipboard.writeText(t), copiado);
        await apage.screenshot({ path: `scripts/.screenshots/12-instalar-app-iphone-${tema}.png`, fullPage: true });
        await acard.getByRole('button', { name: '📋 Colar minhas receitas' }).click();
      } else {
        // Clipboard read refused: paste by hand into the field.
        await acard.getByRole('button', { name: '📋 Colar minhas receitas' }).click();
        await acard.getByLabel('Toque e segure no campo e escolha "Colar"').fill('texto qualquer');
        await acard.getByRole('button', { name: 'Trazer receitas' }).click();
        await acard.getByText('Não encontrei receitas copiadas.', { exact: false }).waitFor();
        await acard.getByLabel('Toque e segure no campo e escolha "Colar"').fill(copiado);
        await acard.getByRole('button', { name: 'Trazer receitas' }).click();
      }
      await apage.getByText('1 receita(s) trazida(s) do Safari.').waitFor();
      await apage.locator('.recipe-card', { hasText: 'Pudim de leite' }).waitFor();
      await acard.waitFor({ state: 'detached' });
    } finally {
      await app.close();
    }
  }
}
