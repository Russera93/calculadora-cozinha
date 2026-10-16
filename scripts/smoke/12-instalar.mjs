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
  await page.getByRole('heading', { name: 'Minhas Receitas' }).waitFor();
  assert.equal(await page.locator('.aviso-card').count(), 0); // nothing to offer yet
  await oferecerInstalacao(page);
  const card = page.locator('.aviso-card');
  await card.getByText('Instale a Calculadora no celular.').waitFor();
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
  await page.getByRole('heading', { name: 'Minhas Receitas' }).waitFor();
  await oferecerInstalacao(page);
  assert.equal(await page.locator('.aviso-card').count(), 0);

  // ---- iPhone (Safari has no install event: show the steps) ----
  const dark = await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const iphone = await page.context().browser().newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: IPHONE_UA, colorScheme: dark ? 'dark' : 'light', locale: 'pt-BR'
  });
  try {
    const ipage = await iphone.newPage();
    await ipage.goto(baseUrl);
    const icard = ipage.locator('.aviso-card');
    await icard.getByText('Instale a Calculadora no iPhone.').waitFor();
    await icard.getByText('"Adicionar à Tela de Início"').waitFor();
    assert.equal(await icard.getByRole('button', { name: '📲 Instalar o app' }).count(), 0);
    await ipage.screenshot({ path: `scripts/.screenshots/12-instalar-iphone-${dark ? 'dark' : 'light'}.png`, fullPage: true });
  } finally {
    await iphone.close();
  }
}
