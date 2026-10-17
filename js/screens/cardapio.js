// js/screens/cardapio.js
//
// Cardápio compartilhável: pick which recipes go, a photo + quantity +
// price for the client (never cost or margin — like the WhatsApp text),
// then export as a PDF (print) or a PNG image to share. The photo is
// kept per recipe in IndexedDB (js/fotos.js) so it is still there next
// time; everything else here starts fresh each visit.

import { getRecipes } from '../storage.js';
import { lerFoto, salvarFoto, removerFoto } from '../fotos.js';
import { itemPadrao, itensProntos } from '../cardapio.js';
import { formatBRL, formatCurrencyInput } from '../format.js';
import { html, setHtml, bindCurrencyInput } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { goBack } from '../router.js';

// Resized before it's stored: quick to draw later, and IndexedDB does not
// need to hold a 12-megapixel photo to show a thumbnail.
const LADO_MAX_FOTO = 640;

function comprimirFoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, LADO_MAX_FOTO / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao gerar imagem'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('não foi possível ler a foto'));
    img.src = URL.createObjectURL(file);
  });
}

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('falha ao carregar imagem'));
    img.src = url;
  });
}

// One tall PNG: title, then a row per item (photo, name, quantity, price).
async function desenharImagem(itens) {
  await document.fonts?.ready?.catch(() => {});
  const LARGURA = 900;
  const PADDING = 40;
  const ALTURA_LINHA = 140;
  const TOPO = 110;
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = TOPO + itens.length * ALTURA_LINHA + PADDING;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FBF3EC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3A2A22';
  ctx.font = "700 44px 'Fraunces', Georgia, serif";
  ctx.fillText('Cardápio', PADDING, 70);

  let y = TOPO;
  const ladoFoto = ALTURA_LINHA - 24;
  for (const it of itens) {
    if (it.fotoUrl) {
      try {
        const img = await carregarImagem(it.fotoUrl);
        const lado = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, PADDING, y, ladoFoto, ladoFoto);
      } catch { /* sem a foto, a linha segue só com texto */ }
    }
    const textoX = PADDING + ladoFoto + 24;
    ctx.fillStyle = '#3A2A22';
    ctx.font = "700 30px 'Nunito', sans-serif";
    ctx.fillText(it.nome, textoX, y + 38);
    ctx.fillStyle = '#7D6A5D';
    ctx.font = "400 24px 'Nunito', sans-serif";
    ctx.fillText(it.quantidade, textoX, y + 72);
    ctx.fillStyle = '#9C4E36';
    ctx.font = "800 30px 'Nunito', sans-serif";
    ctx.fillText(formatBRL(it.precoCliente), textoX, y + 108);
    y += ALTURA_LINHA;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao gerar imagem'))), 'image/png');
  });
}

export function renderCardapio(view) {
  const events = new AbortController();
  const itens = getRecipes().map((r) => ({ ...itemPadrao(r), incluido: false, fotoUrl: null }));

  setHtml(view, html`
    <div class="cardapio-tela">
      <div class="sticky-head">
        <header class="topbar">
          <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar">←</button>
          <h1>Cardápio</h1>
        </header>
      </div>
      <p class="muted">Escolha as receitas, adicione uma foto, confira a quantidade e o preço — isso é o que o cliente vê, sem custos nem detalhes internos.</p>
      <p class="muted" data-vazio hidden style="text-align:center;padding:16px">Cadastre uma receita primeiro.</p>
      <ul class="stack" data-list></ul>
      <div class="action-bar">
        <button type="button" class="btn btn-secondary btn-block" data-action="pdf">📄 Baixar PDF</button>
        <button type="button" class="btn btn-primary btn-block" data-action="imagem">🖼️ Compartilhar imagem</button>
      </div>
    </div>
    <div class="cardapio-print" data-print></div>`);

  const list = view.querySelector('[data-list]');
  const vazio = view.querySelector('[data-vazio]');
  vazio.hidden = itens.length > 0;

  function itemHtml(it, i) {
    return html`
      <li class="card" data-i="${i}">
        <label class="line-total" style="cursor:pointer">
          <span class="recipe-card-name">${it.nome}</span>
          <input type="checkbox" data-campo="incluido" ${it.incluido ? html`checked` : ''} style="min-width:24px;min-height:24px">
        </label>
        ${it.incluido ? html`
          <div style="margin-top:10px">
            <div class="cardapio-foto-linha">
              ${it.fotoUrl ? html`<img class="cardapio-thumb" src="${it.fotoUrl}" alt="">` : html`<span class="cardapio-thumb cardapio-thumb-vazia" aria-hidden="true">🖼️</span>`}
              <div class="stack" style="flex:1">
                <button type="button" class="btn-link" style="display:block;text-align:left" data-action="foto">${it.fotoUrl ? 'Trocar foto' : '📷 Adicionar foto'}</button>
                <input type="file" accept="image/*" hidden data-campo="fotoArquivo">
                ${it.fotoUrl ? html`<button type="button" class="btn-link btn-danger-link" style="display:block;text-align:left" data-action="remover-foto">Remover foto</button>` : ''}
              </div>
            </div>
            <div class="row-2" style="margin-top:8px">
              <label class="field"><span class="field-label">Quantidade</span>
                <input class="input" data-campo="quantidade" autocomplete="off" value="${it.quantidade}"></label>
              <label class="field"><span class="field-label">Preço pro cliente (R$)</span>
                <input class="input" data-campo="preco" inputmode="numeric" autocomplete="off" value="${formatCurrencyInput(it.precoCliente)}"></label>
            </div>
          </div>` : ''}
      </li>`;
  }

  function renderList() {
    setHtml(list, html`${itens.map(itemHtml)}`);
    for (const li of list.querySelectorAll('[data-i]')) {
      const i = Number(li.dataset.i);
      const it = itens[i];
      const campo = (name) => li.querySelector(`[data-campo="${name}"]`);
      campo('incluido').addEventListener('change', (e) => { it.incluido = e.target.checked; renderList(); });
      if (!it.incluido) continue;
      campo('quantidade').addEventListener('input', (e) => { it.quantidade = e.target.value; });
      bindCurrencyInput(campo('preco'), (v) => { it.precoCliente = v ?? 0; }, { allowEmpty: true });
      campo('fotoArquivo').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = ''; // the same photo can be picked again
        if (!file) return;
        try {
          const blob = await comprimirFoto(file);
          await salvarFoto(it.recipeId, blob);
          if (it.fotoUrl) URL.revokeObjectURL(it.fotoUrl);
          it.fotoUrl = URL.createObjectURL(blob);
          renderList();
        } catch {
          showToast('Não foi possível usar essa foto.');
        }
      });
    }
  }
  renderList();

  // Photos saved from an earlier visit.
  Promise.all(itens.map(async (it) => {
    const blob = await lerFoto(it.recipeId);
    if (blob) it.fotoUrl = URL.createObjectURL(blob);
  })).then(() => { if (!events.signal.aborted) renderList(); });

  function gerarPdf() {
    const prontos = itensProntos(itens);
    if (prontos.length === 0) { showToast('Marque ao menos uma receita com preço.'); return; }
    setHtml(view.querySelector('[data-print]'), html`
      <h1 class="font-display">Cardápio</h1>
      <ul class="cardapio-print-lista">
        ${prontos.map((it) => html`
          <li>
            ${it.fotoUrl ? html`<img src="${it.fotoUrl}" alt="">` : html`<span class="cardapio-thumb cardapio-thumb-vazia" aria-hidden="true"></span>`}
            <span class="cardapio-print-nome"><strong>${it.nome}</strong><br><span class="muted">${it.quantidade}</span></span>
            <span class="cardapio-print-preco">${formatBRL(it.precoCliente)}</span>
          </li>`)}
      </ul>`);
    document.body.classList.add('cardapio-imprimindo');
    const limpar = () => document.body.classList.remove('cardapio-imprimindo');
    window.addEventListener('afterprint', limpar, { once: true });
    window.print();
    // Browsers that never fire afterprint for a programmatic print() in
    // some automated/embedded contexts still get the class removed.
    setTimeout(limpar, 2000);
  }

  async function gerarImagem(botao) {
    const prontos = itensProntos(itens);
    if (prontos.length === 0) { showToast('Marque ao menos uma receita com preço.'); return; }
    botao.disabled = true;
    const textoOriginal = botao.textContent;
    botao.textContent = 'Gerando…';
    try {
      const blob = await desenharImagem(prontos);
      const arquivo = new File([blob], 'cardapio.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: 'Cardápio' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cardapio.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('Imagem baixada — já pode anexar no WhatsApp.');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('Não foi possível gerar a imagem.');
    } finally {
      botao.disabled = false;
      botao.textContent = textoOriginal;
    }
  }

  view.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="voltar"]')) { goBack({ screen: 'lista' }); return; }
    if (e.target.closest('[data-action="pdf"]')) { gerarPdf(); return; }
    const imgBtn = e.target.closest('[data-action="imagem"]');
    if (imgBtn) { gerarImagem(imgBtn); return; }
    if (e.target.closest('[data-action="foto"]')) { e.target.closest('li').querySelector('[data-campo="fotoArquivo"]').click(); return; }
    if (e.target.closest('[data-action="remover-foto"]')) {
      const li = e.target.closest('li');
      const it = itens[Number(li.dataset.i)];
      removerFoto(it.recipeId);
      if (it.fotoUrl) URL.revokeObjectURL(it.fotoUrl);
      it.fotoUrl = null;
      renderList();
    }
  }, { signal: events.signal });

  return {
    update() {},
    destroy() {
      events.abort();
      document.body.classList.remove('cardapio-imprimindo');
      for (const it of itens) if (it.fotoUrl) URL.revokeObjectURL(it.fotoUrl);
    }
  };
}
