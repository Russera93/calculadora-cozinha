// js/screens/editor/ingrediente-sheet.js
//
// Bottom sheet with every field of one ingredient. Edits apply live
// (store + autosave). A new ingredient joins the recipe once it has a name.
// An unrecognized name shows the optional nutrition section (TACO lookup)
// that used to be a separate modal; the custom ingredient is saved when the
// sheet closes.

import { parseQuantity } from '../../calculations.js';
import { computeLineCost, quantidadeConvertidaEmGramas, lineIssue, ISSUE_TEXT } from '../../costing.js';
import {
  UNIT_CHIPS, PACKAGE_UNIT_CHIPS, formatBRL, formatCurrencyInput, formatDecimalInput,
  formatNumber, parseDecimal, packageUnitShort
} from '../../format.js';
import {
  emptyIngredientItem, findKnownIngredient, applyIngredientMatch, buildCustomIngredient,
  NUTRIENT_LABELS, ingredientNameSuggestions
} from '../../ingredient-match.js';
import { getCustomIngredients, saveCustomIngredient, getPreco, savePreco, applyPricingToAllRecipes } from '../../storage.js';
import { getTacoIngredients } from '../../taco-loader.js';
import { findInTaco } from '../../taco-database.js';
import { html, setHtml, toElement, bindCurrencyInput } from '../../ui/dom.js';
import { openSheet } from '../../ui/sheet.js';
import { confirmSheet } from '../../ui/confirm.js';
import { showToast } from '../../ui/toast.js';

function chip({ value, label }, selected) {
  return html`<button type="button" class="chip" data-value="${value}" aria-pressed="${value === selected}">${label}</button>`;
}

export function openIngredientSheet({ store, index, onRequestClose, onClose }) {
  const isNew = index === 'novo';
  const item = isNew ? emptyIngredientItem() : store.recipe.ingredientes[index];
  const recipeId = store.recipe.id;
  // Whether `item` is in the recipe. Its position is always looked up by
  // identity (positionOf), never cached: an undo toast can shift rows while
  // this sheet is open.
  let added = !isNew;
  const positionOf = () => (store.recipe ? store.recipe.ingredientes.indexOf(item) : -1);
  let pendingCustom = false;
  let tacoNutricao = null;
  let lookupToken = 0;
  let removed = false;
  let closed = false;

  const content = toElement(html`
    <form novalidate>
      <h2 class="sheet-title">${isNew ? 'Novo ingrediente' : item.nome}</h2>

      <label class="field"><span class="field-label">Ingrediente</span>
        <input class="input" name="nome" list="ingredientes-sugestoes" value="${item.nome}" placeholder="Ex: Leite condensado" autocomplete="off" enterkeyhint="next"></label>
      <datalist id="ingredientes-sugestoes">
        ${ingredientNameSuggestions(getCustomIngredients()).map((nome) => html`<option value="${nome}">`)}
      </datalist>

      <p class="sheet-section">Quanto usa na receita</p>
      <label class="field"><span class="visually-hidden">Quantidade usada</span>
        <input class="input" name="quantidadeBruta" value="${item.quantidadeBruta}" placeholder="Ex: 2, 1/2 ou 0,5" autocomplete="off" enterkeyhint="next"></label>
      <div class="chips" role="group" aria-label="Unidade usada na receita" data-chips="unidade">
        ${UNIT_CHIPS.map((c) => chip(c, item.unidade))}
      </div>
      <p class="field-hint" data-conversao></p>

      <p class="sheet-section">Quanto pagou</p>
      <div class="row-2">
        <label class="field"><span class="field-label">Preço pago (R$)</span>
          <input class="input" name="precoEmbalagem" inputmode="numeric" value="${formatCurrencyInput(item.precoEmbalagem)}" autocomplete="off" enterkeyhint="next"></label>
        <label class="field"><span class="field-label">Tamanho da embalagem</span>
          <input class="input" name="tamanhoEmbalagem" inputmode="decimal" value="${item.tamanhoEmbalagem ? formatDecimalInput(item.tamanhoEmbalagem) : ''}" placeholder="Ex: 395" autocomplete="off" enterkeyhint="done"></label>
      </div>
      <div class="chips" role="group" aria-label="Unidade da embalagem" data-chips="unidadeEmbalagem">
        ${PACKAGE_UNIT_CHIPS.map((c) => chip(c, item.unidadeEmbalagem))}
      </div>

      <div class="card ing-cost"><span>Custo na receita</span><strong class="text-cost" data-custo></strong></div>
      <p class="ing-row-issue" data-issue></p>
      <button type="button" class="btn-link" data-action="propagar" hidden>🔄 Usar este preço em outras receitas</button>

      <div data-nutricao hidden>
        <p class="sheet-section">Nutrição (opcional)</p>
        <p class="muted" data-taco-status></p>
        <div class="row-2" data-nutri-fields style="margin-top:8px"></div>
      </div>

      <div class="sheet-actions">
        ${isNew ? '' : html`<button type="button" class="btn btn-danger-link" data-action="remover">Remover</button>`}
        <button type="submit" class="btn btn-primary" style="flex:1">Pronto</button>
      </div>
    </form>`);

  const f = content.elements;
  const q = (selector) => content.querySelector(selector);

  // Existing ingredient -> store update (autosave). New one joins the
  // recipe as soon as it has a name.
  function persist() {
    if (!added) {
      if (item.nome.trim()) {
        store.update((r) => { r.ingredientes.push(item); });
        added = true;
      }
    } else {
      store.update(() => {});
    }
    refreshDerived();
  }

  function refreshDerived() {
    const custo = computeLineCost(item);
    q('[data-custo]').textContent = custo != null ? formatBRL(custo) : '—';
    const issue = item.nome.trim() ? lineIssue(item) : null;
    q('[data-issue]').textContent = issue ? ISSUE_TEXT[issue] : '';
    const gramas = quantidadeConvertidaEmGramas(item, parseQuantity(item.quantidadeBruta));
    q('[data-conversao]').textContent = gramas != null ? `≈ ${formatNumber(gramas, 1)} g` : '';
    q('[data-action="propagar"]').hidden = !(item.nome.trim() && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0);
  }

  function syncChips() {
    for (const group of content.querySelectorAll('[data-chips]')) {
      for (const b of group.children) b.setAttribute('aria-pressed', String(b.dataset.value === item[group.dataset.chips]));
    }
  }

  function syncPriceFields() {
    f.precoEmbalagem.value = formatCurrencyInput(item.precoEmbalagem);
    f.tamanhoEmbalagem.value = item.tamanhoEmbalagem ? formatDecimalInput(item.tamanhoEmbalagem) : '';
  }

  function learnPrice() {
    if (item.nome.trim() && item.precoEmbalagem > 0 && item.tamanhoEmbalagem > 0) {
      savePreco({ nome: item.nome, precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem });
    }
  }

  function renderNutriFields(nutricao) {
    setHtml(q('[data-nutri-fields]'), html`${Object.entries(NUTRIENT_LABELS).map(([key, label]) => html`
      <label class="field"><span class="field-label">${label}</span>
        <input class="input" data-nutriente="${key}" inputmode="decimal" autocomplete="off"
               value="${nutricao && nutricao[key] != null ? formatDecimalInput(nutricao[key]) : ''}"></label>`)}`);
  }

  function readNutri() {
    const out = {};
    for (const input of content.querySelectorAll('[data-nutriente]')) {
      const v = input.value.trim();
      out[input.dataset.nutriente] = v === '' ? null : parseDecimal(v);
    }
    return out;
  }

  function showNutricao(nome) {
    q('[data-nutricao]').hidden = false;
    const status = q('[data-taco-status]');
    status.textContent = 'Buscando na tabela nutricional…';
    tacoNutricao = null;
    renderNutriFields(null);
    const token = ++lookupToken;
    getTacoIngredients()
      .then((taco) => {
        if (token !== lookupToken || closed) return;
        const match = findInTaco(nome, taco);
        tacoNutricao = match ? match.nutricao100g : null;
        status.textContent = match
          ? `Encontrado na tabela TACO: "${match.nome}" (ajustável).`
          : 'Não encontrado na tabela nutricional — preencha se quiser (opcional).';
        renderNutriFields(tacoNutricao);
      })
      .catch(() => {
        if (token !== lookupToken || closed) return;
        status.textContent = 'Base nutricional indisponível — verifique sua conexão. Você pode preencher à mão.';
      });
  }

  f.nome.addEventListener('change', () => {
    const nome = f.nome.value.trim();
    item.nome = nome;
    if (nome) {
      const matched = applyIngredientMatch(item, {
        known: findKnownIngredient(nome, getCustomIngredients()),
        precoConhecido: getPreco(nome)
      });
      pendingCustom = !matched;
      syncChips();
      syncPriceFields();
      if (pendingCustom) showNutricao(nome);
      else q('[data-nutricao]').hidden = true;
    } else {
      pendingCustom = false;
      q('[data-nutricao]').hidden = true;
    }
    persist();
  });

  f.quantidadeBruta.addEventListener('input', () => { item.quantidadeBruta = f.quantidadeBruta.value; persist(); });
  bindCurrencyInput(f.precoEmbalagem, (value) => { item.precoEmbalagem = value; persist(); });
  f.tamanhoEmbalagem.addEventListener('input', () => { item.tamanhoEmbalagem = parseDecimal(f.tamanhoEmbalagem.value); persist(); });
  f.precoEmbalagem.addEventListener('blur', learnPrice);
  f.tamanhoEmbalagem.addEventListener('blur', learnPrice);

  async function propagar() {
    const ok = await confirmSheet({
      title: 'Usar este preço em outras receitas?',
      message: `"${item.nome}" passa a custar ${formatBRL(item.precoEmbalagem)} por ${formatDecimalInput(item.tamanhoEmbalagem)} ${packageUnitShort(item.unidadeEmbalagem)} em todas as outras receitas que usam esse ingrediente.`,
      confirmLabel: 'Atualizar'
    });
    if (!ok) return;
    const n = applyPricingToAllRecipes(
      item.nome,
      { precoEmbalagem: item.precoEmbalagem, tamanhoEmbalagem: item.tamanhoEmbalagem, unidadeEmbalagem: item.unidadeEmbalagem },
      recipeId
    );
    showToast(n > 0 ? `Preço atualizado em ${n} outra(s) receita(s).` : 'Nenhuma outra receita usa esse ingrediente ainda.');
  }

  function remover() {
    const position = positionOf();
    if (position === -1) return;
    removed = true;
    store.update((r) => { r.ingredientes.splice(position, 1); });
    sheet.requestClose();
    showToast(`"${item.nome}" removido`, {
      actionLabel: 'Desfazer',
      onAction: () => {
        if (store.recipe?.id !== recipeId) return; // left the recipe meanwhile
        if (store.recipe.ingredientes.includes(item)) return;
        store.update((r) => { r.ingredientes.splice(Math.min(position, r.ingredientes.length), 0, item); });
      }
    });
  }

  content.addEventListener('click', (e) => {
    const chipButton = e.target.closest('[data-chips] .chip');
    if (chipButton) {
      const field = chipButton.parentElement.dataset.chips;
      item[field] = chipButton.dataset.value;
      syncChips();
      persist();
      if (field === 'unidadeEmbalagem') learnPrice();
      return;
    }
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'propagar') propagar();
    if (action === 'remover') remover();
  });

  // Enter moves to the next field; "Pronto" (or Enter on the last field) closes.
  content.addEventListener('submit', (e) => {
    e.preventDefault();
    const order = [f.nome, f.quantidadeBruta, f.precoEmbalagem, f.tamanhoEmbalagem];
    const i = order.indexOf(document.activeElement);
    if (i >= 0 && i < order.length - 1) {
      order[i + 1].focus();
      return;
    }
    sheet.requestClose();
  });

  function finalize() {
    closed = true;
    if (store.recipe?.id === recipeId && added && !removed) {
      if (!item.nome.trim()) {
        const position = positionOf();
        if (position !== -1) store.update((r) => { r.ingredientes.splice(position, 1); });
      } else if (pendingCustom) {
        const custom = buildCustomIngredient({
          id: `custom:${crypto.randomUUID()}`,
          nome: item.nome,
          unidadeEmbalagem: item.unidadeEmbalagem,
          nutricaoDigitada: readNutri(),
          nutricaoTaco: tacoNutricao
        });
        // Only a custom ingredient with nutrition is worth remembering. One
        // with nothing (a typo, or closed before TACO answered) would shadow
        // TACO for that name forever, so it stays a plain row instead.
        if (custom.nutricao100g) saveCustomIngredient(custom);
        store.update(() => {
          item.ingredientId = custom.nutricao100g ? custom.id : null;
          item.nutricao100g = custom.nutricao100g;
          item.densidadeGml = custom.densidadeGml;
          item.pesoUnidadeG = null;
        });
        learnPrice();
      }
      store.flush();
    }
    const finalPosition = positionOf();
    onClose?.(removed || finalPosition === -1 ? null : finalPosition);
  }

  refreshDerived();
  const sheet = openSheet({
    title: isNew ? 'Novo ingrediente' : item.nome,
    content,
    onRequestClose,
    onClose: finalize,
    initialFocus: isNew ? 'input[name="nome"]' : null
  });
  return sheet;
}
