// js/screens/editor/preco.js — what each unit costs, where it is sold,
// what to charge (Mínimo / Justo / Com lucro) and what she earns.

import { recipeResult } from '../../results.js';
import { getNegocio } from '../../storage.js';
import { CANAIS } from '../../negocio.js';
import { formatBRL, formatNumber, formatCurrencyInput } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';
import { navigate } from '../../router.js';

const SUGESTOES = [
  ['minimo', 'Mínimo', 'não perde dinheiro'],
  ['justo', 'Justo', 'paga sua hora'],
  ['comLucro', 'Com lucro', '']
];

function custoHtml(r) {
  const linhas = [
    ['Ingredientes', r.ingredientesPorUnidade],
    ['Perda', r.perdaPorUnidade],
    ['Embalagem', r.embalagensPorUnidade],
    ['Gás', r.gasPorUnidade],
    ['Contas fixas', r.fixosPorUnidade]
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
  let hora = '';
  if (r.horaRendeu != null) {
    const cor = r.bateuMeta === false ? 'text-loss' : r.bateuMeta ? 'text-profit' : '';
    hora = html`<p class="hora-rendeu ${cor}">Sua hora rendeu <strong>${formatBRL(r.horaRendeu)}</strong>${r.valorHora != null ? html` <span class="muted">(meta ${formatBRL(r.valorHora)})</span>` : ''}</p>`;
  } else if (ganho) {
    hora = html`<p class="muted">Diga quanto tempo leva (aba Custos) para saber quanto sua hora rende.</p>`;
  }
  return html`
    <div class="result-box ${ganho ? 'profit' : 'loss'}">
      <p class="big ${ganho ? 'text-profit' : 'text-loss'}">
        ${ganho ? `Você ganha ${formatBRL(r.ganhoPorUnidade)} por unidade` : `Você perde ${formatBRL(Math.abs(r.ganhoPorUnidade))} por unidade`}
      </p>
      <p class="muted">${ganho ? `${formatBRL(r.ganhoTotal)} na receita toda` : `${formatBRL(Math.abs(r.ganhoTotal))} de prejuízo na receita toda`}</p>
      ${hora}
    </div>`;
}

function detalhesHtml(r) {
  const linhas = [];
  if (r.margem != null) linhas.push(html`<p class="muted">Margem sobre a venda: <strong class="${r.margem >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.margem, 1)}%</strong> — de cada real que você cobra, ${formatNumber(r.margem, 1)}% fica com você</p>`);
  if (r.markup != null) linhas.push(html`<p class="muted">Markup sobre o custo: <strong class="${r.markup >= 0 ? 'text-profit' : 'text-loss'}">${formatNumber(r.markup, 1)}%</strong> — quanto o preço de venda passou do custo</p>`);
  if (r.taxaPorUnidade > 0) linhas.push(html`<p class="muted">Taxa da venda: ${formatBRL(r.taxaPorUnidade)} por unidade (${formatNumber(r.taxa * 100, 1)}%)</p>`);
  if (r.maoDeObraPorUnidade > 0) linhas.push(html`<p class="muted">Seu trabalho no preço justo: ${formatBRL(r.maoDeObraPorUnidade)} por unidade (${formatBRL(r.maoDeObraCost)} na receita)</p>`);
  if (r.fixosPorUnidade > 0) linhas.push(html`<p class="muted">Contas fixas: ${formatBRL(r.fixosPorUnidade)} por unidade (${formatBRL(r.fixosCost)} na receita)</p>`);
  if (r.embalagensPorUnidade > 0) linhas.push(html`<p class="muted">Embalagem: ${formatBRL(r.embalagensPorUnidade)} por unidade (${formatBRL(r.embalagensCost)} no total)</p>`);
  if (r.gasPorUnidade > 0) linhas.push(html`<p class="muted">Gás: ${formatBRL(r.gasPorUnidade)} por unidade (${formatBRL(r.gasCost)} no total)</p>`);
  return linhas.length ? html`${linhas}` : html`<p class="muted">Defina o preço para ver margem e markup.</p>`;
}

export function render(panel, { store }) {
  const events = new AbortController();
  const preco = store.recipe.precoVendaDesejado;
  const recipeId = store.recipe.id;

  setHtml(panel, html`
    <div class="card">
      <p class="muted">Custo de cada unidade</p>
      <p class="big-number text-cost" data-custo-un></p>
      <div data-custo-linhas></div>
      <p class="muted" data-custo-total></p>
    </div>
    <div class="card">
      <p class="field-label">Onde você vende?</p>
      <div class="chips" role="group" aria-label="Onde você vende" data-canais style="margin-bottom:12px"></div>
      <label class="field-label" for="preco-venda">Quanto você vai cobrar? (por unidade)</label>
      <div class="sugestoes" role="group" aria-label="Sugestões de preço">
        ${SUGESTOES.map(([key, label]) => html`
          <button type="button" class="sugestao" data-sugestao="${key}"><span class="sugestao-label">${label}</span> <strong class="sugestao-valor"></strong> <span class="sugestao-sub"></span></button>`)}
      </div>
      <p class="field-hint" data-motivo></p>
      <input id="preco-venda" class="input" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off" style="margin-top:8px"
             value="${preco != null ? formatCurrencyInput(preco) : ''}">
      <div data-resultado></div>
      <details class="details"><summary>Ver detalhes do cálculo</summary><div class="stack" data-detalhes></div></details>
    </div>`);

  const input = panel.querySelector('#preco-venda');
  const botoes = [...panel.querySelectorAll('[data-sugestao]')];

  bindCurrencyInput(input, (value) => store.update((r) => { r.precoVendaDesejado = value; }), { allowEmpty: true, signal: events.signal });

  panel.addEventListener('click', (e) => {
    const canal = e.target.closest('[data-canal]');
    if (canal) {
      store.update((r) => { r.canalVenda = canal.dataset.canal; });
      return;
    }
    const motivo = e.target.closest('[data-ir]');
    if (motivo) {
      navigate(motivo.dataset.ir === 'negocio'
        ? { screen: 'editor', recipeId, aba: 'preco', sheet: 'negocio' }
        : { screen: 'editor', recipeId, aba: 'custos' }, { replace: motivo.dataset.ir !== 'negocio' });
      return;
    }
    const botao = e.target.closest('[data-sugestao]');
    if (!botao || botao.disabled) return;
    const value = recipeResult(store.recipe, getNegocio()).sugeridos?.[botao.dataset.sugestao];
    if (value == null) return;
    input.value = formatCurrencyInput(value);
    store.update((r) => { r.precoVendaDesejado = value; });
  }, { signal: events.signal });

  function refresh() {
    const negocio = getNegocio();
    const r = recipeResult(store.recipe, negocio);
    const temCusto = r.kind !== 'semRendimento' && r.kind !== 'semIngredientes';
    panel.querySelector('[data-custo-un]').textContent = temCusto ? formatBRL(r.custoPorUnidade) : '—';
    setHtml(panel.querySelector('[data-custo-linhas]'), temCusto ? custoHtml(r) : html``);
    panel.querySelector('[data-custo-total]').textContent = `Custo total da receita: ${formatBRL(r.custoTotal)}`;

    const taxas = { direto: 0, maquininha: negocio.taxaMaquininha, ifood: negocio.taxaIfood };
    setHtml(panel.querySelector('[data-canais]'), html`${CANAIS.map(([key, label]) => html`
      <button type="button" class="chip" data-canal="${key}" aria-pressed="${store.recipe.canalVenda === key}">${label}${taxas[key] > 0 ? ` (${formatNumber(taxas[key], 1)}%)` : ''}</button>`)}`);

    for (const botao of botoes) {
      const key = botao.dataset.sugestao;
      const valor = temCusto && r.sugeridos ? r.sugeridos[key] : null;
      botao.querySelector('.sugestao-valor').textContent = valor != null ? formatBRL(valor) : '—';
      botao.querySelector('.sugestao-sub').textContent = key === 'comLucro' ? `+${formatNumber(negocio.lucroExtra, 0)}% pro negócio` : SUGESTOES.find(([k]) => k === key)[2];
      botao.disabled = valor == null;
      botao.setAttribute('aria-pressed', String(valor != null && store.recipe.precoVendaDesejado === valor));
    }

    const motivo = panel.querySelector('[data-motivo]');
    if (temCusto && r.motivoSemJusto === 'negocio') {
      setHtml(motivo, html`Para ver o preço justo, diga quanto quer ganhar por mês. <button type="button" class="btn-link" data-ir="negocio">Configurar Meu negócio (1 minuto) ›</button>`);
    } else if (temCusto && r.motivoSemJusto === 'tempo') {
      setHtml(motivo, html`Para ver o preço justo, diga quanto tempo leva esta receita. <button type="button" class="btn-link" data-ir="custos">Informar o tempo ›</button>`);
    } else {
      motivo.textContent = '';
    }

    setHtml(panel.querySelector('[data-resultado]'), resultadoHtml(r));
    setHtml(panel.querySelector('[data-detalhes]'), detalhesHtml(r));
  }
  const unsubscribe = store.subscribe(refresh);
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
