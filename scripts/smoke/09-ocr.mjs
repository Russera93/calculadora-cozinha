// Real OCR of a receipt image (Tesseract from the CDN). Needs internet and
// takes a while, so it only runs with SMOKE_OCR=1:
//   SMOKE_OCR=1 npm run test:mobile -- 09

const base = { ingredientId: null, quantidadeBruta: '', unidade: 'g', precoEmbalagem: 0, tamanhoEmbalagem: 0, unidadeEmbalagem: 'g', nutricao100g: null, densidadeGml: null, pesoUnidadeG: null };

const CUPOM_HTML = `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#f4f1ea">
<pre style="font:22px/1.5 'Courier New',monospace;color:#222;padding:40px;width:720px;margin:0">
  SUPERMERCADO BOM PRECO LTDA
  CNPJ: 12.345.678/0001-90
  CUPOM FISCAL ELETRONICO - SAT
  ------------------------------------
  001 7891000100103 LEITE COND MOCA 395G
      2 UN X 7,49              14,98
  002 7896005800027 CHOC PO NESTLE 200G
      1 UN X 12,90             12,90
  003 7891024134702 DETERGENTE YPE 500ML
      1 UN X 2,49               2,49
  ------------------------------------
  TOTAL R$                     30,37
  CARTAO DEBITO                30,37
</pre></body>`;

export default async function ({ page, baseUrl, assert, shot, seed }) {
  if (!process.env.SMOKE_OCR) return;

  await page.setContent(CUPOM_HTML);
  const imagem = await page.locator('pre').screenshot({ type: 'png' });

  await page.goto(baseUrl);
  await seed([{ id: 'recipe:o', nome: 'Brigadeiro', rendimento: 20, embalagemUnitaria: 0, quantidadeEmbalagens: 20, tempoPreparoMinutos: 0, valorBotijao: 0,
    precoVendaDesejado: null, criadoEm: '2026-10-01T00:00:00Z', atualizadoEm: '2026-10-01T00:00:00Z',
    ingredientes: [
      { ...base, nome: 'Leite Condensado', quantidadeBruta: '1', unidade: 'unidade', densidadeGml: 1.3 },
      { ...base, nome: 'Chocolate em pó', quantidadeBruta: '30', densidadeGml: 0.5 }
    ] }]);
  await page.goto(baseUrl + '#/receita/recipe%3Ao/ingredientes/nota');
  const sheet = page.getByRole('dialog', { name: 'Ler nota de compra' });
  await sheet.locator('[data-file="galeria"]').setInputFiles({ name: 'cupom.png', mimeType: 'image/png', buffer: imagem });

  await sheet.locator('.nota-item').first().waitFor({ timeout: 180000 });
  const texto = await sheet.locator('.nota-bruto').textContent();
  const usados = sheet.locator('.nota-lista').first().locator('.nota-item');
  assert.ok(await usados.count() >= 2, `esperava 2 itens casados; texto lido:\n${texto}`);
  await sheet.getByText('= R$ 7,49 por embalagem de 395 g', { exact: false }).waitFor();
  await shot('conferir');
}
