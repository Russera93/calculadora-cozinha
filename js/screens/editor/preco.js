// js/screens/editor/preco.js — what each unit costs, where it is sold
// (and that channel's fee), what to charge (2×/3×/4×) and what she earns.

import { recipeResult } from '../../results.js';
import { getTaxas, saveTaxas } from '../../storage.js';
import { CANAIS, campoDoCanal } from '../../taxas.js';
import { formatBRL, formatNumber, formatCurrencyInput, formatDecimalInput, parseDecimal } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';

const SUGESTOES = [['preco2x', '2×'], ['preco3x', '3×'], ['preco4x', '4×']];
const NOME_TAXA = { maquininha: 'Taxa da maquininha (%)', ifood: 'Taxa do iFood (%)' };

function custoHtml(r) {
  const linhas = [
    ['Ingredientes', r.ingredientesPorUnidade],
    ['Embalagem', r.embalagensPorUnidade],
    ['Gás', r.gasPorUnidade]
  ].filter(([, v]) => v > 0);
  return html`${linhas.map(([label, v]) => html`<p class="line-total muted"><span>${label}</span><span>${formatBRL(v)}</span></p>`)}`;
}

function resultadoHtml(r) {
  if (r.kind === 'semRendimento' || r.kind === 'semIngredientes') {
    return html`<p class="muted" style="margin-top:12px">Complete os ingredientes e o rendimento para calcular quanto você ganha.</p>`;
  }
  if (r.kind === 'semPreco') {
    return html`<p class="muted" style="margin-top:12px">Escolha uma sugestão ou digite seu preço.</p>`;
  }
  const ganho = r.kind === 'ganho';
  return html`
    <div class="result-box ${ganho ? 'profit' : 'loss'}">
      <p class="big ${ganho ? 'text-profit' : 'text-loss'}">
        ${ganho ? `Você ganha ${formatBRL(r.ganhoPorUnidade)} por unidade` : `Você perde ${formatBRL(Math.abs(r.ganhoPorUnidade))} por unidade`}
      </p>
      <p class="muted">${ganho ? `${formatBRL(r.ganhoTotal)} na receita toda` : `${formatBRL(Math.abs(r.ganhoTotal))} de prejuízo na receita toda`}</p>
    </div>`;
}

function detalhesHtml(r) {
  const linhas = [];
  if (r.margem != null) linhas.push(html`<p class="muted">Margem sobre a venda: <strong class="${r.margem >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.margem, 1)}%</strong> — de cada real que você cobra, ${formatNumber(r.margem, 1)}% fica com você</p>`);
  if (r.markup != null) linhas.push(html`<p class="muted">Markup sobre o custo: <strong class="${r.markup >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.markup, 1)}%</strong> — quanto o preço de venda passou do custo</p>`);
  if (r.taxaPorUnidade > 0) linhas.push(html`<p class="muted">Taxa da venda: ${formatBRL(r.taxaPorUnidade)} por unidade (${formatNumber(r.taxa * 100, 1)}%)</p>`);
  if (r.embalagensPorUnidade > 0) linhas.push(html`<p class="muted">Embalagem: ${formatBRL(r.embalagensPorUnidade)} por unidade (${formatBRL(r.embalagensCost)} no total)</p>`);
  if (r.gasPorUnidade > 0) linhas.push(html`<p class="muted">Gás: ${formatBRL(r.gasPorUnidade)} por unidade (${formatBRL(r.gasCost)} no total)</p>`);
  return linhas.length ? html`${linhas}` : html`<p class="muted">Defina o preço para ver margem e markup.</p>`;
}

export function render(panel, { store }) {
  const events = new AbortController();
  const preco = store.recipe.precoVendaDesejado;

  setHtml(panel, html`
    <div class="card">
      <p class="muted">Custo de cada unidade</p>
      <p class="big-number text-cost" data-custo-un></p>
      <div data-custo-linhas></div>
      <p class="muted" data-custo-total></p>
    </div>
    <div class="card">
      <p class="field-label">Onde você vende?</p>
      <div class="chips" role="group" aria-label="Onde você vende" style="margin-bottom:12px">
        ${CANAIS.map(([key, label]) => html`<button type="button" class="chip" data-canal="${key}" aria-pressed="false">${label}</button>`)}
      </div>
      <label class="field" data-taxa hidden><span class="field-label" data-taxa-label></span>
        <input class="input" name="taxa" inputmode="decimal" autocomplete="off" placeholder="Ex: 3,5">
        <span class="field-hint">Vale para todas as receitas vendidas assim.</span></label>
      <label class="field-label" for="preco-venda">Quanto você vai cobrar? (por unidade)</label>
      <div class="sugestoes" role="group" aria-label="Sugestões de preço">
        ${SUGESTOES.map(([key, label]) => html`
          <button type="button" class="sugestao" data-sugestao="${key}"><span class="sugestao-label">${label}</span> <strong class="sugestao-valor"></strong> <span class="sugestao-sub">o custo</span></button>`)}
      </div>
      <input id="preco-venda" class="input" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off" style="margin-top:12px"
             value="${preco != null ? formatCurrencyInput(preco) : ''}">
      <div data-resultado></div>
      <details class="details"><summary>Ver detalhes do cálculo</summary><div class="stack" data-detalhes></div></details>
    </div>`);

  const input = panel.querySelector('#preco-venda');
  const botoes = [...panel.querySelectorAll('[data-sugestao]')];
  const canais = [...panel.querySelectorAll('[data-canal]')];
  const taxaField = panel.querySelector('[data-taxa]');
  const taxaInput = taxaField.querySelector('input');
  const { signal } = events;

  bindCurrencyInput(input, (value) => store.update((r) => { r.precoVendaDesejado = value; }), { allowEmpty: true, signal });

  // The fee field belongs to the chosen channel; filled only when it changes,
  // never on each keystroke (re-filling would fight the phone keyboard).
  function syncCanal() {
    const canal = store.recipe.canalVenda;
    for (const c of canais) c.setAttribute('aria-pressed', String(c.dataset.canal === canal));
    const campo = campoDoCanal(canal);
    taxaField.hidden = !campo;
    if (!campo) return;
    taxaField.querySelector('[data-taxa-label]').textContent = NOME_TAXA[canal];
    const valor = getTaxas()[campo];
    taxaInput.value = valor ? formatDecimalInput(valor) : '';
  }

  taxaInput.addEventListener('input', () => {
    const campo = campoDoCanal(store.recipe.canalVenda);
    if (!campo) return;
    saveTaxas({ ...getTaxas(), [campo]: parseDecimal(taxaInput.value) });
    store.refresh(); // every number here depends on it; the recipe itself didn't change
  }, { signal });

  panel.addEventListener('click', (e) => {
    const canal = e.target.closest('[data-canal]');
    if (canal) {
      store.update((r) => { r.canalVenda = canal.dataset.canal; });
      syncCanal();
      return;
    }
    const botao = e.target.closest('[data-sugestao]');
    if (!botao || botao.disabled) return;
    const value = recipeResult(store.recipe, getTaxas()).sugeridos?.[botao.dataset.sugestao];
    if (value == null) return;
    input.value = formatCurrencyInput(value);
    store.update((r) => { r.precoVendaDesejado = value; });
  }, { signal });

  function refresh() {
    const r = recipeResult(store.recipe, getTaxas());
    const temCusto = r.kind !== 'semRendimento' && r.kind !== 'semIngredientes';
    panel.querySelector('[data-custo-un]').textContent = temCusto ? formatBRL(r.custoPorUnidade) : '—';
    setHtml(panel.querySelector('[data-custo-linhas]'), temCusto ? custoHtml(r) : html``);
    panel.querySelector('[data-custo-total]').textContent = `Custo total da receita: ${formatBRL(r.custoTotal)}`;

    for (const botao of botoes) {
      const valor = temCusto && r.sugeridos ? r.sugeridos[botao.dataset.sugestao] : null;
      botao.querySelector('.sugestao-valor').textContent = valor != null ? formatBRL(valor) : '—';
      botao.disabled = valor == null;
      botao.setAttribute('aria-pressed', String(valor != null && store.recipe.precoVendaDesejado === valor));
    }
    setHtml(panel.querySelector('[data-resultado]'), resultadoHtml(r));
    setHtml(panel.querySelector('[data-detalhes]'), detalhesHtml(r));
  }
  const unsubscribe = store.subscribe(refresh);
  syncCanal();
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
