// js/screens/editor/preco.js — what to charge and what you earn.

import { recipeResult } from '../../results.js';
import { formatBRL, formatNumber, formatCurrencyInput } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';

const MULTIPLICADORES = [['preco2x', 2], ['preco3x', 3], ['preco4x', 4]];
const round2 = (n) => Math.round(n * 100) / 100;

function resultadoHtml(r) {
  if (r.kind === 'semRendimento' || r.kind === 'semIngredientes') {
    return html`<p class="muted" style="margin-top:12px">Complete os ingredientes e o rendimento para calcular o lucro.</p>`;
  }
  if (r.kind === 'semPreco') {
    return html`<p class="muted" style="margin-top:12px">Escolha uma sugestão ou digite seu preço.</p>`;
  }
  const lucro = r.kind === 'lucro';
  return html`
    <div class="result-box ${lucro ? 'profit' : 'loss'}">
      <p class="big ${lucro ? 'text-profit' : 'text-loss'}">
        ${lucro ? `Você lucra ${formatBRL(r.lucroPorPorcao)} por unidade` : `Você perde ${formatBRL(Math.abs(r.lucroPorPorcao))} por unidade`}
      </p>
      <p class="muted">${lucro ? `${formatBRL(r.lucroTotal)} na receita toda` : `${formatBRL(Math.abs(r.lucroTotal))} de prejuízo na receita toda`}</p>
      ${r.vezesOCusto != null ? html`<p class="muted">${r.vezesOCusto >= 1 ? `Isso é ${formatNumber(r.vezesOCusto, 1)}× o custo` : `Isso é menos do que o custo (${formatNumber(r.vezesOCusto, 1)}×)`}</p>` : ''}
    </div>`;
}

function detalhesHtml(r) {
  const linhas = [];
  if (r.margem != null) linhas.push(html`<p class="muted">Margem sobre a venda: <strong class="${r.margem >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.margem, 1)}%</strong> — de cada real que você cobra, ${formatNumber(r.margem, 1)}% é lucro</p>`);
  if (r.markup != null) linhas.push(html`<p class="muted">Markup sobre o custo: <strong class="${r.markup >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.markup, 1)}%</strong> — quanto o preço de venda passou do custo</p>`);
  if (r.embalagensPorPorcao != null) linhas.push(html`<p class="muted">Embalagem: ${formatBRL(r.embalagensPorPorcao)} por unidade (${formatBRL(r.embalagensCost)} no total)</p>`);
  if (r.gasPorPorcao != null) linhas.push(html`<p class="muted">Gás: ${formatBRL(r.gasPorPorcao)} por unidade (${formatBRL(r.gasCost)} no total)</p>`);
  return linhas.length ? html`${linhas}` : html`<p class="muted">Defina o preço para ver margem e markup.</p>`;
}

export function render(panel, { store }) {
  const events = new AbortController();
  const preco = store.recipe.precoVendaDesejado;

  setHtml(panel, html`
    <div class="card">
      <p class="muted">Custo por unidade</p>
      <p class="big-number text-cost" data-custo-un></p>
      <p class="muted" data-custo-total></p>
    </div>
    <div class="card">
      <label class="field-label" for="preco-venda">Quanto você vai cobrar? (por unidade)</label>
      <div class="chips" role="group" aria-label="Sugestões de preço" style="margin:8px 0 12px">
        ${MULTIPLICADORES.map(([key]) => html`<button type="button" class="chip" data-sugestao="${key}"></button>`)}
      </div>
      <input id="preco-venda" class="input" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off"
             value="${preco != null ? formatCurrencyInput(preco) : ''}">
      <div data-resultado></div>
      <details class="details"><summary>Ver detalhes do cálculo</summary><div class="stack" data-detalhes></div></details>
    </div>`);

  const input = panel.querySelector('#preco-venda');
  const chips = [...panel.querySelectorAll('[data-sugestao]')];

  bindCurrencyInput(input, (value) => store.update((r) => { r.precoVendaDesejado = value; }), { allowEmpty: true, signal: events.signal });

  panel.addEventListener('click', (e) => {
    const chipButton = e.target.closest('[data-sugestao]');
    if (!chipButton || chipButton.disabled) return;
    const { sugeridos } = recipeResult(store.recipe);
    const value = round2(sugeridos[chipButton.dataset.sugestao]);
    input.value = formatCurrencyInput(value);
    store.update((r) => { r.precoVendaDesejado = value; });
  }, { signal: events.signal });

  function refresh() {
    const r = recipeResult(store.recipe);
    const temCusto = r.kind !== 'semRendimento' && r.kind !== 'semIngredientes';
    panel.querySelector('[data-custo-un]').textContent = temCusto ? formatBRL(r.custoPorPorcao) : '—';
    panel.querySelector('[data-custo-total]').textContent = `Custo total da receita: ${formatBRL(r.custoTotal)}`;
    for (const chipButton of chips) {
      const mult = MULTIPLICADORES.find(([key]) => key === chipButton.dataset.sugestao)[1];
      const valor = temCusto && r.sugeridos ? round2(r.sugeridos[chipButton.dataset.sugestao]) : null;
      chipButton.textContent = valor != null ? `${mult}× ${formatBRL(valor)}` : `${mult}×`;
      chipButton.disabled = valor == null;
      chipButton.setAttribute('aria-pressed', String(valor != null && store.recipe.precoVendaDesejado === valor));
    }
    setHtml(panel.querySelector('[data-resultado]'), resultadoHtml(r));
    setHtml(panel.querySelector('[data-detalhes]'), detalhesHtml(r));
  }
  const unsubscribe = store.subscribe(refresh);
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
