// js/screens/editor/custos.js — working time, packaging, gas and waste.

import { recipeResult } from '../../results.js';
import { getNegocio } from '../../storage.js';
import { parseDuration, formatDuration } from '../../duration.js';
import { formatBRL, formatCurrencyInput, formatDecimalInput, parseDecimal, parseInteger } from '../../format.js';
import { html, setHtml, bindCurrencyInput } from '../../ui/dom.js';
import { navigate } from '../../router.js';

export function render(panel, { store }) {
  const events = new AbortController();
  const r = store.recipe;

  setHtml(panel, html`
    <div class="card">
      <h2 class="card-title">Seu trabalho</h2>
      <label class="field"><span class="field-label">Quanto tempo você trabalha nesta receita?</span>
        <input class="input" name="tempoTrabalho" autocomplete="off" placeholder="Ex: 1h30 ou 45 min" value="${formatDuration(r.tempoTrabalhoMinutos)}">
        <span class="field-hint" data-hint="tempo"></span></label>
      <p class="muted">Do preparo até embalar — é o que paga a sua hora e a parte das contas fixas.</p>
      <p class="line-total" data-linha="fixos" hidden><span>Contas fixas desta receita</span><strong class="text-cost" data-total="fixos"></strong></p>
      <button type="button" class="btn-link" data-action="negocio"></button>
    </div>
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
    <div class="card">
      <h2 class="card-title">Perda</h2>
      <label class="field"><span class="field-label">Quanto se perde (%)</span>
        <input class="input" name="perdaPercent" inputmode="decimal" placeholder="Ex: 5" value="${r.perdaPercent ? formatDecimalInput(r.perdaPercent) : ''}" autocomplete="off">
        <span class="field-hint">Massa que gruda na panela, doce que quebra, prova… entra sobre os ingredientes.</span></label>
      <p class="line-total"><span>Custo da perda</span><strong class="text-cost" data-total="perda"></strong></p>
    </div>
    <div class="card line-total"><span>Custo total da receita</span><strong class="text-cost" data-total="receita"></strong></div>`);

  const field = (name) => panel.querySelector(`[name="${name}"]`);
  const set = (name) => (value) => store.update((recipe) => { recipe[name] = value; });
  const { signal } = events;

  bindCurrencyInput(field('embalagemUnitaria'), set('embalagemUnitaria'), { signal });
  bindCurrencyInput(field('valorBotijao'), set('valorBotijao'), { signal });
  field('quantidadeEmbalagens').addEventListener('input', (e) => set('quantidadeEmbalagens')(parseInteger(e.target.value)), { signal });
  field('tempoPreparoMinutos').addEventListener('input', (e) => set('tempoPreparoMinutos')(parseDecimal(e.target.value)), { signal });
  field('perdaPercent').addEventListener('input', (e) => set('perdaPercent')(Math.min(parseDecimal(e.target.value), 90)), { signal });
  field('tempoTrabalho').addEventListener('input', (e) => set('tempoTrabalhoMinutos')(parseDuration(e.target.value)), { signal });

  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="negocio"]')) {
      navigate({ screen: 'editor', recipeId: r.id, aba: 'custos', sheet: 'negocio' });
    }
  }, { signal });

  function refresh() {
    const recipe = store.recipe;
    const res = recipeResult(recipe, getNegocio());
    const texto = field('tempoTrabalho').value.trim();
    panel.querySelector('[data-hint="tempo"]').textContent = !texto ? ''
      : recipe.tempoTrabalhoMinutos ? `= ${formatDuration(recipe.tempoTrabalhoMinutos)}` : 'não entendi — use 1h30, 90 ou 45 min';
    panel.querySelector('[data-linha="fixos"]').hidden = !(res.fixosCost > 0);
    panel.querySelector('[data-total="fixos"]').textContent = formatBRL(res.fixosCost);
    panel.querySelector('[data-action="negocio"]').textContent = res.configurado
      ? `Sua hora: ${formatBRL(res.valorHora)} · ajustar Meu negócio ›`
      : 'Configure quanto vale a sua hora (Meu negócio) ›';
    panel.querySelector('[data-total="embalagens"]').textContent = formatBRL(res.embalagensCost);
    panel.querySelector('[data-total="gas"]').textContent = formatBRL(res.gasCost);
    panel.querySelector('[data-total="perda"]').textContent = formatBRL(res.perdaCost);
    panel.querySelector('[data-total="receita"]').textContent = formatBRL(res.custoTotal);
  }
  const unsubscribe = store.subscribe(refresh);
  refresh();

  return { destroy() { unsubscribe(); events.abort(); } };
}
