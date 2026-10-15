// js/screens/editor/compra-resumo.js — "how much does it use, how much
// does it make" for the receipt applied to a recipe. Markup only (no DOM),
// so it is unit-tested; shown at the end of the receipt sheet and in the
// "Sua última compra" card.

import { formatBRL, formatNumber } from '../../format.js';
import { html } from '../../ui/dom.js';

const plural = (n, um, varios) => (n === 1 ? um : varios);

export function compraResumoHtml(y) {
  const linhas = [];
  if (y.gastoPorReceita > 0) {
    linhas.push(html`<p class="compra-gasto">Esta receita gasta <strong class="text-cost">${formatBRL(y.gastoPorReceita)}</strong> do que você comprou</p>`);
  }
  if (y.receitasPossiveis != null && y.receitasPossiveis >= 1) {
    const n = y.receitasPossiveis;
    const un = y.unidadesPossiveis != null
      ? ` = ${formatNumber(y.unidadesPossiveis, 0)} ${plural(y.unidadesPossiveis, 'unidade', 'unidades')}`
      : '';
    linhas.push(html`<p>Com essa compra dá para fazer <strong>${n} ${plural(n, 'receita', 'receitas')}${un}</strong></p>`);
    if (y.itens.length > 1 && y.limitante) linhas.push(html`<p class="muted">Acaba primeiro: ${y.limitante}</p>`);
  } else if (y.receitasPossiveis === 0) {
    linhas.push(html`<p class="text-loss">A compra não dá para uma receita inteira — falta ${y.limitante}</p>`);
  }

  const semConversao = y.itens.some((i) => i.receitas == null);
  return html`
    <div class="compra-resumo">
      ${linhas}
      <ul class="compra-itens">
        ${y.itens.map((i) => html`<li><span>${i.nome}</span><span class="muted">${i.receitas != null ? `dá ${formatNumber(i.receitas, 1)} ${plural(Math.round(i.receitas * 10) / 10, 'receita', 'receitas')}` : '—'}</span></li>`)}
      </ul>
      ${semConversao ? html`<p class="muted">— não dá para converter a medida da receita para a embalagem da nota.</p>` : ''}
      ${y.faltando.length ? html`<p class="muted">Não vieram na nota: ${y.faltando.join(', ')} — entram com o preço que já está na receita.</p>` : ''}
      <p class="muted">Total pago nesses itens: ${formatBRL(y.totalNota)}</p>
    </div>`;
}
