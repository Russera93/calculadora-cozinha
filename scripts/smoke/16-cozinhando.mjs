// Modo cozinhando: one step at a time from a ready-made recipe and from
// the person's own recipe, the timer a timed step offers, and closing
// back to where it was opened from.

export default async function ({ page, baseUrl, assert, shot, semRolagemHorizontal, seed }) {
  await page.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.resolve(); });

  // From a ready-made recipe.
  await page.goto(baseUrl + '#/prontas/bolo-de-fuba-cremoso');
  await page.getByRole('heading', { name: 'Bolo de fubá cremoso de liquidificador' }).waitFor();
  await page.getByRole('button', { name: '👩‍🍳 Modo cozinhando' }).click();
  const dialog1 = page.getByRole('dialog', { name: /Modo cozinhando/ });
  await dialog1.waitFor();
  await dialog1.getByText('1 / 4').waitFor();
  await dialog1.getByText('Bata todos os ingredientes no liquidificador até obter um creme homogêneo.').waitFor();
  assert.equal(await dialog1.getByRole('button', { name: '← Anterior' }).count(), 0, 'sem "Anterior" no primeiro passo');
  await semRolagemHorizontal();
  await shot('passo-1');

  await dialog1.getByRole('button', { name: 'Próximo →' }).click();
  await dialog1.getByText('2 / 4').waitFor();
  await dialog1.getByRole('button', { name: '← Anterior' }).waitFor();

  // The timed step (3/4): starting, pausing and resetting the countdown.
  await dialog1.getByRole('button', { name: 'Próximo →' }).click();
  await dialog1.getByText('3 / 4').waitFor();
  await dialog1.getByText(/por cerca de 40 minutos/).waitFor();
  await dialog1.getByText('40:00').waitFor();
  await dialog1.getByRole('button', { name: '⏱ Iniciar cronômetro' }).click();
  await dialog1.getByRole('button', { name: 'Pausar' }).waitFor();
  await dialog1.getByRole('button', { name: 'Pausar' }).click();
  await dialog1.getByRole('button', { name: 'Retomar' }).waitFor();
  await dialog1.getByRole('button', { name: 'Reiniciar' }).click();
  await dialog1.getByRole('button', { name: '⏱ Iniciar cronômetro' }).waitFor();

  // The last step: "Próximo" becomes "Concluir"; closing returns to the detail.
  await dialog1.getByRole('button', { name: 'Próximo →' }).click();
  await dialog1.getByText('4 / 4').waitFor();
  assert.equal(await dialog1.getByRole('button', { name: 'Próximo →' }).count(), 0);
  await dialog1.getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Usar esta receita' }).waitFor();

  // From the person's own recipe: same overlay, reached from the editor.
  await seed([{
    id: 'recipe:1', nome: 'Minha receita', rendimento: 4, ingredientes: [],
    modoPreparo: ['Misture tudo.', 'Leve ao forno por 10 minutos.']
  }]);
  await page.goto(baseUrl + '#/receita/recipe:1/ingredientes');
  await page.getByRole('button', { name: '👩‍🍳 Modo cozinhando' }).click();
  const dialog2 = page.getByRole('dialog', { name: /Modo cozinhando/ });
  await dialog2.waitFor();
  await dialog2.getByText('1 / 2').waitFor();
  await dialog2.getByText('Misture tudo.').waitFor();
  await semRolagemHorizontal();
  await shot('minha-receita');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '👩‍🍳 Modo cozinhando' }).waitFor(); // back on the ingredients tab
}
