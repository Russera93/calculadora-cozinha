// js/screens/meus-ingredientes.js
//
// One list with every ingredient the person's recipes use, so prices can
// be reviewed and fixed from a single place. "Atualizar valor
// automaticamente" (off by default) fills unpriced rows from the daily
// market reference without her having to open each recipe — a price she
// types herself is never touched (js/precos-referencia.js).

import {
  getRecipes, getPreco, savePreco, applyPricingToAllRecipes, getAtualizarPrecosAuto, setAtualizarPrecosAuto,
  atualizarPrecosAutomaticamente
} from '../storage.js';
import { nomesIngredientes, precoEfetivo } from '../meus-ingredientes.js';
import { referenciaDe } from '../precos-referencia.js';
import { getPrecosReferencia } from '../precos-referencia-loader.js';
import { formatBRL, formatCurrencyInput, formatDecimalInput, packageUnitShort, PACKAGE_UNIT_CHIPS, parseDecimal } from '../format.js';
import { html, setHtml, toElement, bindCurrencyInput } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';
import { showToast } from '../ui/toast.js';
import { goBack } from '../router.js';

function medida({ precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem }) {
  return `${formatBRL(precoEmbalagem)} / ${formatDecimalInput(tamanhoEmbalagem)} ${packageUnitShort(unidadeEmbalagem)}`;
}

function abrirPrecoSheet({ nome, inicial, deReferencia, onSaved }) {
  const content = toElement(html`
    <form novalidate>
      <h2 class="sheet-title">${nome}</h2>
      ${deReferencia ? html`<p class="referencia-nota">💡 Preenchido com a referência de mercado — confira o preço que você paga, ou ajuste.</p>` : ''}
      <div class="row-2">
        <label class="field"><span class="field-label">Preço pago (R$)</span>
          <input class="input" name="precoEmbalagem" inputmode="numeric" value="${formatCurrencyInput(inicial?.precoEmbalagem ?? 0)}" autocomplete="off" enterkeyhint="next"></label>
        <label class="field"><span class="field-label">Tamanho da embalagem</span>
          <input class="input" name="tamanhoEmbalagem" inputmode="decimal" value="${inicial?.tamanhoEmbalagem ? formatDecimalInput(inicial.tamanhoEmbalagem) : ''}" placeholder="Ex: 395" autocomplete="off" enterkeyhint="done"></label>
      </div>
      <div class="chips" role="group" aria-label="Unidade da embalagem" data-chips="unidadeEmbalagem">
        ${PACKAGE_UNIT_CHIPS.map((c) => html`<button type="button" class="chip" data-value="${c.value}" aria-pressed="${c.value === (inicial?.unidadeEmbalagem ?? 'g')}">${c.label}</button>`)}
      </div>
      <div class="sheet-actions">
        <button type="submit" class="btn btn-primary" style="flex:1">Salvar</button>
      </div>
    </form>`);

  const f = content.elements;
  let precoEmbalagem = inicial?.precoEmbalagem ?? 0;
  let unidadeEmbalagem = inicial?.unidadeEmbalagem ?? 'g';
  bindCurrencyInput(f.precoEmbalagem, (v) => { precoEmbalagem = v ?? 0; });

  content.addEventListener('click', (e) => {
    const chipBtn = e.target.closest('[data-value]');
    if (!chipBtn) return;
    unidadeEmbalagem = chipBtn.dataset.value;
    for (const b of chipBtn.parentElement.children) b.setAttribute('aria-pressed', String(b === chipBtn));
  });

  const sheet = openSheet({ title: nome, content, initialFocus: 'input[name="precoEmbalagem"]' });
  content.addEventListener('submit', (e) => {
    e.preventDefault();
    const tamanhoEmbalagem = parseDecimal(f.tamanhoEmbalagem.value);
    if (precoEmbalagem > 0 && tamanhoEmbalagem > 0) onSaved({ precoEmbalagem, tamanhoEmbalagem, unidadeEmbalagem });
    sheet.close();
  });
  return sheet;
}

export function renderMeusIngredientes(view) {
  const events = new AbortController();
  let referencia = null;

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar">←</button>
        <h1>Meus ingredientes</h1>
      </header>
    </div>
    <div class="card aviso-card" role="note">
      <label class="line-total" style="cursor:pointer">
        <span><strong>Atualizar valor automaticamente</strong><br>
          <span class="muted">Preenche sozinho os ingredientes sem preço com a referência de mercado (robô diário).</span></span>
        <input type="checkbox" data-auto style="min-width:24px;min-height:24px">
      </label>
      <button type="button" class="btn-link" data-action="atualizar-agora" style="margin-top:4px">🔄 Atualizar agora</button>
    </div>
    <p class="muted" data-vazio hidden style="text-align:center;padding:16px">Nenhum ingrediente ainda — adicione receitas para começar.</p>
    <ul class="ing-list stack" data-list></ul>`);

  const list = view.querySelector('[data-list]');
  const vazio = view.querySelector('[data-vazio]');
  const autoCheckbox = view.querySelector('[data-auto]');
  autoCheckbox.checked = getAtualizarPrecosAuto();

  function rowHtml(nome, recipes) {
    const efetivo = precoEfetivo(nome, recipes, getPreco(nome));
    const deReferencia = efetivo?.origemPreco === 'referencia';
    const sugestao = !efetivo ? referenciaDe(nome, referencia) : null;
    return html`
      <li>
        <button type="button" class="card ing-row" data-nome="${nome}">
          <span class="ing-row-top">
            <span class="ing-row-name">${nome}</span>
            ${efetivo ? html`<span class="text-cost">${medida(efetivo)}</span>` : html`<span class="muted">sem preço</span>`}
          </span>
          ${deReferencia ? html`<span class="muted ing-row-detail">referência de mercado</span>`
            : sugestao ? html`<span class="muted ing-row-detail">referência: ${medida(sugestao)}</span>` : ''}
        </button>
      </li>`;
  }

  function renderList() {
    const recipes = getRecipes();
    const nomes = nomesIngredientes(recipes);
    vazio.hidden = nomes.length > 0;
    setHtml(list, html`${nomes.map((n) => rowHtml(n, recipes))}`);
  }
  renderList();

  function abrirEdicao(nome) {
    const recipes = getRecipes();
    const efetivo = precoEfetivo(nome, recipes, getPreco(nome));
    const deReferencia = efetivo?.origemPreco === 'referencia';
    const sugestao = !efetivo ? referenciaDe(nome, referencia) : null;
    abrirPrecoSheet({
      nome,
      inicial: efetivo ?? sugestao,
      deReferencia: deReferencia || (!efetivo && !!sugestao),
      onSaved: (valores) => {
        savePreco({ nome, ...valores });
        const n = applyPricingToAllRecipes(nome, valores);
        showToast(n > 0 ? `Preço salvo e atualizado em ${n} receita(s).` : 'Preço salvo.');
        renderList();
      }
    });
  }

  function atualizarAgora() {
    getPrecosReferencia()
      .then((ref) => {
        if (events.signal.aborted) return;
        referencia = ref;
        const n = atualizarPrecosAutomaticamente(ref);
        showToast(n > 0 ? `${n} preço(s) atualizado(s) pela referência de mercado.` : 'Nenhum preço novo para atualizar agora.');
        renderList();
      })
      .catch(() => { if (!events.signal.aborted) showToast('Não foi possível buscar a referência agora.'); });
  }

  view.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="voltar"]')) { goBack({ screen: 'lista' }); return; }
    if (e.target.closest('[data-action="atualizar-agora"]')) { atualizarAgora(); return; }
    const row = e.target.closest('[data-nome]');
    if (row) abrirEdicao(row.dataset.nome);
  }, { signal: events.signal });

  autoCheckbox.addEventListener('change', () => {
    setAtualizarPrecosAuto(autoCheckbox.checked);
    if (autoCheckbox.checked) atualizarAgora();
  }, { signal: events.signal });

  getPrecosReferencia()
    .then((ref) => {
      if (events.signal.aborted) return;
      referencia = ref;
      renderList(); // reference hints for still-unpriced rows
    })
    .catch(() => {});

  return {
    update() {},
    destroy() { events.abort(); }
  };
}
