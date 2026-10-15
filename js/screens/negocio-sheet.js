// js/screens/negocio-sheet.js — "Meu negócio": what the cook wants to earn,
// the hours she works, monthly bills and sale fees. Set once; every
// recipe's fair price and "sua hora rendeu" come from here. Saved on every
// change; onChange lets the open screen refresh its numbers.

import { getNegocio, saveNegocio } from '../storage.js';
import { CONTAS_FIXAS, valorHora, fixosPorHora, totalFixos, horasPorMes } from '../negocio.js';
import { formatBRL, formatCurrencyInput, formatDecimalInput, formatNumber, parseDecimal, parseInteger } from '../format.js';
import { html, toElement, bindCurrencyInput } from '../ui/dom.js';
import { openSheet } from '../ui/sheet.js';

export function openNegocioSheet({ onRequestClose, onClose, onChange }) {
  const negocio = getNegocio();

  const content = toElement(html`
    <form novalidate>
      <h2 class="sheet-title">Meu negócio</h2>
      <p class="muted">Preencha uma vez. Com isso o app calcula o preço justo de cada receita e quanto a sua hora rende.</p>

      <p class="sheet-section">Seu trabalho</p>
      <label class="field"><span class="field-label">Quanto você quer ganhar por mês? (R$)</span>
        <input class="input" name="ganhoMensal" inputmode="numeric" autocomplete="off" value="${formatCurrencyInput(negocio.ganhoMensal)}"></label>
      <label class="field"><span class="field-label">Quantas horas por semana você trabalha na cozinha?</span>
        <input class="input" name="horasSemana" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Ex: 30" value="${negocio.horasSemana || ''}"></label>
      <div class="card destaque-card" data-hora></div>

      <p class="sheet-section">Contas fixas do mês</p>
      <p class="muted" style="margin-bottom:8px">Só a parte que é da cozinha (ex.: metade da conta de luz). Deixe em branco o que não tiver.</p>
      <div class="row-2">
        ${CONTAS_FIXAS.map(([key, label]) => html`
          <label class="field"><span class="field-label">${label} (R$)</span>
            <input class="input" data-conta="${key}" inputmode="numeric" autocomplete="off" value="${formatCurrencyInput(negocio.contasFixas[key])}"></label>`)}
      </div>
      <p class="field-hint" data-fixos></p>

      <p class="sheet-section">Taxas de venda</p>
      <div class="row-2">
        <label class="field"><span class="field-label">Maquininha (%)</span>
          <input class="input" name="taxaMaquininha" inputmode="decimal" autocomplete="off" placeholder="Ex: 3,5" value="${negocio.taxaMaquininha ? formatDecimalInput(negocio.taxaMaquininha) : ''}"></label>
        <label class="field"><span class="field-label">iFood (%)</span>
          <input class="input" name="taxaIfood" inputmode="decimal" autocomplete="off" placeholder="Ex: 27" value="${negocio.taxaIfood ? formatDecimalInput(negocio.taxaIfood) : ''}"></label>
      </div>

      <p class="sheet-section">Lucro do negócio</p>
      <label class="field"><span class="field-label">Lucro extra além da sua hora (%)</span>
        <input class="input" name="lucroExtra" inputmode="decimal" autocomplete="off" value="${formatDecimalInput(negocio.lucroExtra)}">
        <span class="field-hint">Usado na sugestão "Com lucro" — dinheiro para reinvestir, imprevistos, crescer.</span></label>

      <div class="sheet-actions">
        <button type="submit" class="btn btn-primary btn-block">Pronto</button>
      </div>
    </form>`);

  const f = content.elements;

  function refresh() {
    const hora = valorHora(negocio);
    content.querySelector('[data-hora]').textContent = hora > 0
      ? `Sua hora vale ${formatBRL(hora)} (${formatNumber(horasPorMes(negocio), 0)} horas por mês)`
      : 'Preencha quanto quer ganhar e as horas para saber quanto vale a sua hora.';
    const total = totalFixos(negocio);
    content.querySelector('[data-fixos]').textContent = total > 0
      ? `Total ${formatBRL(total)} por mês${fixosPorHora(negocio) > 0 ? ` = ${formatBRL(fixosPorHora(negocio))} por hora trabalhada` : ''}`
      : '';
  }

  function changed() {
    saveNegocio(negocio);
    refresh();
    onChange?.();
  }

  bindCurrencyInput(f.ganhoMensal, (v) => { negocio.ganhoMensal = v; changed(); });
  f.horasSemana.addEventListener('input', () => { negocio.horasSemana = Math.min(parseInteger(f.horasSemana.value), 112); changed(); });
  for (const input of content.querySelectorAll('[data-conta]')) {
    bindCurrencyInput(input, (v) => { negocio.contasFixas[input.dataset.conta] = v; changed(); });
  }
  for (const name of ['taxaMaquininha', 'taxaIfood']) {
    f[name].addEventListener('input', () => { negocio[name] = Math.min(parseDecimal(f[name].value), 90); changed(); });
  }
  f.lucroExtra.addEventListener('input', () => { negocio.lucroExtra = parseDecimal(f.lucroExtra.value); changed(); });

  content.addEventListener('submit', (e) => {
    e.preventDefault();
    sheet.requestClose();
  });

  refresh();
  const sheet = openSheet({ title: 'Meu negócio', content, onRequestClose, onClose });
  return sheet;
}
