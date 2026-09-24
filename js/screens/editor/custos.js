// js/screens/editor/custos.js — packaging and gas.

import { recipeResult } from '../../results.js';
import { formatBRL, formatCurrencyInput, formatDecimalInput, parseDecimal, parseInteger } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';

export function render(panel, { store }) {
  const events = new AbortController();
  const r = store.recipe;

  setHtml(panel, html`
    <div class="card">
      <h2 class="card-title">Embalagem</h2>
      <label class="field"><span class="field-label">Custo de cada embalagem (R$)</span>
        <input class="input" name="embalagemUnitaria" inputmode="numeric" value="${formatCurrencyInput(r.embalagemUnitaria)}" autocomplete="off"></label>
      <label class="field"><span class="field-label">Quantas embalagens</span>
        <input class="input" name="quantidadeEmbalagens" inputmode="numeric" pattern="[0-9]*" value="${r.quantidadeEmbalagens}" autocomplete="off">
        <span class="field-hint">Ex.: 20 brigadeiros, 4 por embalagem = 5 embalagens</span></label>
      <p class="line-total"><span>Total de embalagens</span><strong class="text-cost" data-total="embalagens"></strong></p>
    </div>
    <div class="card">
      <h2 class="card-title">Gás</h2>
      <label class="field"><span class="field-label">Tempo de forno/fogo (minutos)</span>
        <input class="input" name="tempoPreparoMinutos" inputmode="decimal" value="${formatDecimalInput(r.tempoPreparoMinutos)}" autocomplete="off"></label>
      <label class="field"><span class="field-label">Preço do botijão 13 kg (R$)</span>
        <input class="input" name="valorBotijao" inputmode="numeric" value="${formatCurrencyInput(r.valorBotijao)}" autocomplete="off"></label>
      <p class="line-total"><span>Total de gás</span><strong class="text-cost" data-total="gas"></strong></p>
    </div>
    <div class="card line-total"><span>Custo total da receita</span><strong class="text-cost" data-total="receita"></strong></div>`);

  const field = (name) => panel.querySelector(`[name="${name}"]`);
  const set = (name) => (value) => store.update((recipe) => { recipe[name] = value; });
  const { signal } = events;

  bindCurrencyInput(field('embalagemUnitaria'), set('embalagemUnitaria'), { signal });
  bindCurrencyInput(field('valorBotijao'), set('valorBotijao'), { signal });
  field('quantidadeEmbalagens').addEventListener('input', (e) => set('quantidadeEmbalagens')(parseInteger(e.target.value)), { signal });
  field('tempoPreparoMinutos').addEventListener('input', (e) => set('tempoPreparoMinutos')(parseDecimal(e.target.value)), { signal });

  function refresh() {
    const res = recipeResult(store.recipe);
    panel.querySelector('[data-total="embalagens"]').textContent = formatBRL(res.embalagensCost);
    panel.querySelector('[data-total="gas"]').textContent = formatBRL(res.gasCost);
    panel.querySelector('[data-total="receita"]').textContent = formatBRL(res.custoTotal);
  }
  const unsubscribe = store.subscribe(refresh);
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
