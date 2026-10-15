// js/screens/editor/nota-sheet.js
//
// "Ler nota de compra": photo / image / pasted text -> the items read ->
// a review step where every item is checked and tied to a recipe
// ingredient -> applied (prices, package sizes, price bank, aliases) ->
// what the recipe uses of it and how many batches it makes. Nothing is
// applied without the review: OCR gets things wrong.

import { parseReceiptText } from '../../receipt-parser.js';
import { suggestMatches } from '../../receipt-match.js';
import { applyPurchase, purchaseYield, unitPrice } from '../../purchase.js';
import { computeLineCost } from '../../costing.js';
import { readReceiptImage } from '../../ocr.js';
import { getApelidosNota, saveApelidoNota, savePreco } from '../../storage.js';
import {
  PACKAGE_UNIT_CHIPS, formatBRL, formatCurrencyInput, formatDecimalInput, parseDecimal, packageUnitShort
} from '../../format.js';
import { html, setHtml, toElement, bindCurrencyInput } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { compraResumoHtml } from './compra-resumo.js';

function chip({ value, label }, selected) {
  return html`<button type="button" class="chip" data-value="${value}" aria-pressed="${value === selected}">${label}</button>`;
}

// What is still missing on a ticked item before it can be applied.
function itemProblem(item) {
  if (!(item.quantidade > 0)) return 'falta a quantidade comprada';
  if (!(item.valorTotal > 0)) return 'falta o valor pago';
  if (!(item.tamanho > 0)) return 'falta o tamanho da embalagem';
  if (!item.unidade) return 'escolha a unidade do tamanho';
  return null;
}

export function openNotaSheet({ store, onRequestClose, onClose }) {
  const recipeId = store.recipe.id;
  let closed = false;
  let itens = [];
  let alvos = []; // per item: ingredient index or null
  let textoLido = '';

  const content = toElement(html`
    <div>
      <h2 class="sheet-title">Ler nota de compra</h2>
      <div data-passo></div>
    </div>`);
  const passo = content.querySelector('[data-passo]');
  const nomes = () => store.recipe.ingredientes.map((i) => i.nome);

  // ---------- 1. Escolher ----------
  function showEscolher(erro = '') {
    const semIngredientes = store.recipe.ingredientes.length === 0;
    setHtml(passo, html`
      <p class="muted">Tire uma foto da nota ou do cupom — reta, com boa luz e sem cortar as linhas. O app lê os produtos e você confere tudo antes de aplicar.</p>
      ${semIngredientes ? html`<p class="ing-row-issue">Esta receita ainda não tem ingredientes — adicione-os primeiro para a nota preencher os preços.</p>` : ''}
      <div class="stack" style="margin-top:12px">
        <button type="button" class="btn btn-primary btn-block" data-action="camera">📷 Tirar foto</button>
        <button type="button" class="btn btn-secondary btn-block" data-action="galeria">🖼️ Escolher print ou foto</button>
        <input type="file" accept="image/*" capture="environment" hidden data-file="camera">
        <input type="file" accept="image/*" hidden data-file="galeria">
      </div>
      <details class="details">
        <summary>Colar o texto da nota</summary>
        <label class="field"><span class="visually-hidden">Texto da nota</span>
          <textarea class="input nota-texto" rows="6" data-texto placeholder="Cole aqui o texto da nota (do e-mail ou do site da Sefaz)"></textarea></label>
        <button type="button" class="btn btn-secondary btn-block" data-action="ler-texto">Ler o texto</button>
      </details>
      <p class="ing-row-issue" data-erro role="alert">${erro}</p>`);
  }

  // ---------- 2. Lendo ----------
  async function lerImagem(file) {
    if (!file) return;
    if (!String(file.type).startsWith('image/')) {
      showEscolher('Envie uma foto ou um print do cupom fiscal (PDF não é aceito).');
      return;
    }
    setHtml(passo, html`
      <p data-status role="status">Preparando a imagem…</p>
      <progress class="nota-progresso" max="1" value="0"></progress>
      <p class="muted" style="margin-top:8px">Pode levar alguns segundos. A foto não sai do seu aparelho.</p>`);
    const status = passo.querySelector('[data-status]');
    const barra = passo.querySelector('progress');
    try {
      const texto = await readReceiptImage(file, (fracao, msg) => {
        if (closed) return;
        status.textContent = msg;
        barra.value = fracao;
      });
      if (!closed) showConferir(texto);
    } catch (err) {
      if (closed) return;
      showEscolher(err.code === 'offline'
        ? 'Sem internet para baixar o leitor de notas (só na primeira vez). Conecte-se ou cole o texto da nota.'
        : 'Não foi possível ler essa imagem. Tente outra foto, mais reta e com mais luz.');
    }
  }

  // ---------- 3. Conferir ----------
  function itemHtml(item, i) {
    const alvo = alvos[i];
    return html`
      <li class="card nota-item" data-i="${i}">
        <p class="nota-desc">${item.descricao}</p>
        <label class="field"><span class="field-label">Usar para</span>
          <select class="input" data-campo="alvo">
            <option value="">Não usar</option>
            ${nomes().map((nome, j) => html`<option value="${j}" ${j === alvo ? html`selected` : ''}>${nome}</option>`)}
          </select></label>
        <div class="row-2">
          <label class="field"><span class="field-label">Qtd. comprada</span>
            <input class="input" data-campo="quantidade" inputmode="decimal" autocomplete="off" value="${formatDecimalInput(item.quantidade)}"></label>
          <label class="field"><span class="field-label">Valor pago (R$)</span>
            <input class="input" data-campo="valor" inputmode="numeric" autocomplete="off" value="${formatCurrencyInput(item.valorTotal)}"></label>
        </div>
        <label class="field"><span class="field-label">Tamanho de cada embalagem</span>
          <input class="input" data-campo="tamanho" inputmode="decimal" autocomplete="off" placeholder="Ex: 395" value="${item.tamanho ? formatDecimalInput(item.tamanho) : ''}"></label>
        <div class="chips" role="group" aria-label="Unidade do tamanho" data-campo="unidade">
          ${PACKAGE_UNIT_CHIPS.map((c) => chip(c, item.unidade))}
        </div>
        <p class="field-hint" data-derivado></p>
        <p class="ing-row-issue" data-problema></p>
      </li>`;
  }

  function showConferir(texto) {
    textoLido = texto;
    itens = parseReceiptText(texto);
    alvos = suggestMatches(itens, nomes(), getApelidosNota());

    if (itens.length === 0) {
      setHtml(passo, html`
        <p class="ing-row-issue">Não encontrei produtos com preço nesse texto.</p>
        <p class="muted" style="margin-top:8px">Tente outra foto (reta, com luz, a nota inteira) ou cole o texto da nota.</p>
        ${texto.trim() ? html`<details class="details"><summary>Ver texto lido</summary><pre class="nota-bruto">${texto}</pre></details>` : ''}
        <div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-action="voltar-escolher">Tentar de novo</button></div>`);
      return;
    }

    const usados = itens.map((_, i) => i).filter((i) => alvos[i] != null);
    const outros = itens.map((_, i) => i).filter((i) => alvos[i] == null);
    setHtml(passo, html`
      <p class="muted">Confira o que foi lido, corrija o que estiver errado e escolha a qual ingrediente cada produto corresponde.</p>
      <ul class="ing-list stack nota-lista">${usados.map((i) => itemHtml(itens[i], i))}</ul>
      ${outros.length ? html`
        <details class="details" ${usados.length ? '' : html`open`}>
          <summary>Outros itens da nota (${outros.length})</summary>
          <ul class="ing-list stack nota-lista">${outros.map((i) => itemHtml(itens[i], i))}</ul>
        </details>` : ''}
      <details class="details"><summary>Ver texto lido</summary><pre class="nota-bruto">${textoLido}</pre></details>
      <div class="sheet-actions">
        <button type="button" class="btn btn-secondary" data-action="voltar-escolher">Outra nota</button>
        <button type="button" class="btn btn-primary" style="flex:1" data-action="aplicar"></button>
      </div>`);

    for (const li of passo.querySelectorAll('.nota-item')) {
      const i = Number(li.dataset.i);
      const item = itens[i];
      const campo = (name) => li.querySelector(`[data-campo="${name}"]`);
      campo('alvo').addEventListener('change', (e) => { alvos[i] = e.target.value === '' ? null : Number(e.target.value); refreshItem(li); });
      campo('quantidade').addEventListener('input', (e) => { item.quantidade = parseDecimal(e.target.value); refreshItem(li); });
      campo('tamanho').addEventListener('input', (e) => { item.tamanho = parseDecimal(e.target.value); refreshItem(li); });
      bindCurrencyInput(campo('valor'), (value) => { item.valorTotal = value; refreshItem(li); });
      refreshItem(li, false);
    }
    refreshAplicar();
  }

  function refreshItem(li, updateButton = true) {
    const i = Number(li.dataset.i);
    const item = itens[i];
    for (const b of li.querySelector('[data-campo="unidade"]').children) b.setAttribute('aria-pressed', String(b.dataset.value === item.unidade));
    const problema = itemProblem(item);
    const usado = alvos[i] != null;
    li.classList.toggle('nota-item-off', !usado);
    li.querySelector('[data-problema]').textContent = usado && problema ? problema : '';

    let derivado = '';
    if (!problema) {
      derivado = `= ${formatBRL(unitPrice(item))} por embalagem de ${formatDecimalInput(item.tamanho)} ${packageUnitShort(item.unidade)}`;
      const linha = usado ? store.recipe.ingredientes[alvos[i]] : null;
      if (linha) {
        const custo = computeLineCost({ ...linha, precoEmbalagem: unitPrice(item), tamanhoEmbalagem: item.tamanho, unidadeEmbalagem: item.unidade });
        derivado += custo != null ? ` · na receita: ${formatBRL(custo)}` : ' · não dá para converter para a medida usada na receita';
      }
    }
    li.querySelector('[data-derivado]').textContent = derivado;
    if (updateButton) refreshAplicar();
  }

  function refreshAplicar() {
    const button = passo.querySelector('[data-action="aplicar"]');
    if (!button) return;
    const marcados = itens.filter((_, i) => alvos[i] != null);
    const algumIncompleto = marcados.some((item) => itemProblem(item));
    // Two receipt lines pointing at the same ingredient: the second would
    // silently overwrite the first.
    const repetido = new Set(alvos.filter((a) => a != null)).size !== marcados.length;
    button.disabled = marcados.length === 0 || algumIncompleto || repetido;
    button.textContent = marcados.length ? `Aplicar na receita (${marcados.length})` : 'Aplicar na receita';
    let aviso = passo.querySelector('[data-aviso]');
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.className = 'ing-row-issue';
      aviso.dataset.aviso = '';
      button.parentElement.before(aviso);
    }
    aviso.textContent = repetido ? 'Dois produtos estão ligados ao mesmo ingrediente — escolha só um.'
      : algumIncompleto ? 'Complete os itens marcados em vermelho.'
        : marcados.length === 0 ? 'Escolha pelo menos um ingrediente em "Usar para".' : '';
  }

  // ---------- 4. Aplicar + resumo ----------
  function aplicar() {
    if (store.recipe?.id !== recipeId) return;
    const escolhas = itens.map((item, i) => ({ item, ingredienteIndex: alvos[i] })).filter((e) => e.ingredienteIndex != null);
    let aplicados = [];
    store.update((r) => { aplicados = applyPurchase(r, escolhas, new Date().toISOString()); });
    store.flush();
    for (const a of aplicados) savePreco(a);
    for (const { item, ingredienteIndex } of escolhas) saveApelidoNota(item.descricao, store.recipe.ingredientes[ingredienteIndex].nome);
    showResumo();
  }

  function showResumo() {
    const y = purchaseYield(store.recipe);
    setHtml(passo, html`
      <p class="muted">Pronto! Os preços e embalagens foram preenchidos nos ingredientes.</p>
      ${y ? compraResumoHtml(y) : ''}
      <div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" data-action="fechar">Pronto</button></div>`);
  }

  content.addEventListener('click', (e) => {
    const chipButton = e.target.closest('[data-campo="unidade"] .chip');
    if (chipButton) {
      const li = chipButton.closest('.nota-item');
      itens[Number(li.dataset.i)].unidade = chipButton.dataset.value;
      refreshItem(li);
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'camera' || action === 'galeria') passo.querySelector(`[data-file="${action}"]`).click();
    else if (action === 'ler-texto') {
      const texto = passo.querySelector('[data-texto]').value;
      if (texto.trim()) showConferir(texto);
    } else if (action === 'voltar-escolher') showEscolher();
    else if (action === 'aplicar') aplicar();
    else if (action === 'fechar') sheet.requestClose();
  });

  content.addEventListener('change', (e) => {
    const input = e.target.closest('[data-file]');
    if (!input) return;
    const file = input.files[0];
    input.value = ''; // the same photo can be picked again
    lerImagem(file);
  });

  showEscolher();
  const sheet = openSheet({
    title: 'Ler nota de compra',
    content,
    onRequestClose,
    onClose: () => { closed = true; onClose?.(); }
  });
  return sheet;
}
