// js/screens/pronta.js — one ready-made recipe: ingredients (by section),
// steps, and "Usar esta receita" (copies it into Minhas receitas).

import { getReceitasProntas } from '../receitas-prontas-loader.js';
import { medidaTexto, rendeTexto, agruparPorSecao, criarReceitaDePronta } from '../receitas-prontas.js';
import { getRecipes, saveRecipe, createEmptyRecipe, getCustomIngredients, getPreco } from '../storage.js';
import { getTacoIngredients } from '../taco-loader.js';
import { html, setHtml } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { navigate, goBack } from '../router.js';

function corpoHtml(pronta, categoria) {
  return html`
    <p class="pronta-meta">${categoria ? html`<span class="tag">${categoria}</span>` : ''}<span class="muted">${rendeTexto(pronta)}</span></p>
    <h2 class="section-title"><span>Ingredientes</span></h2>
    <div class="card">
      ${agruparPorSecao(pronta.ingredientes).map((g) => html`
        ${g.secao ? html`<p class="sheet-section">${g.secao}</p>` : ''}
        <ul class="pronta-ings">
          ${g.itens.map((i) => html`<li><strong>${medidaTexto(i)}</strong> de ${i.nome}${i.observacao ? html`<span class="muted"> — ${i.observacao}</span>` : ''}</li>`)}
        </ul>`)}
    </div>
    <h2 class="section-title"><span>Modo de preparo</span></h2>
    <div class="card"><ol class="passos pronta-passos">${pronta.preparo.map((p) => html`<li>${p}</li>`)}</ol></div>
    <div class="action-bar">
      <button type="button" class="btn btn-primary btn-block" data-action="usar">Usar esta receita</button>
    </div>`;
}

export function renderPronta(view, prontaId) {
  const events = new AbortController();
  let pronta = null;
  let copiando = false;

  setHtml(view, html`
    <div class="sticky-head">
      <header class="topbar">
        <button type="button" class="icon-btn" data-action="voltar" aria-label="Voltar para Receitas prontas">←</button>
        <h1 class="pronta-title" data-titulo>Receita pronta</h1>
      </header>
    </div>
    <div data-slot="corpo"><p class="muted" style="text-align:center;padding:16px">Carregando receita…</p></div>`);
  const titulo = view.querySelector('[data-titulo]');
  const corpo = view.querySelector('[data-slot="corpo"]');

  getReceitasProntas()
    .then((data) => {
      if (events.signal.aborted) return;
      pronta = data.receitas.find((r) => r.id === prontaId) || null;
      if (!pronta) {
        showToast('Receita não encontrada');
        navigate({ screen: 'prontas' }, { replace: true });
        return;
      }
      titulo.textContent = pronta.nome;
      setHtml(corpo, corpoHtml(pronta, data.categorias.find((c) => c.id === pronta.categoria)?.nome));
    })
    .catch(() => {
      if (events.signal.aborted) return;
      setHtml(corpo, html`<p class="muted" style="text-align:center;padding:16px">Não foi possível carregar a receita — verifique sua conexão.</p>`);
    });

  async function usar(botao) {
    if (copiando || !pronta) return;
    copiando = true;
    botao.disabled = true;
    botao.textContent = 'Copiando…';
    let taco = [];
    try { taco = await getTacoIngredients(); } catch { /* offline: copy without nutrition */ }
    if (events.signal.aborted) return;
    const receita = criarReceitaDePronta(pronta, {
      existentes: getRecipes(), custom: getCustomIngredients(), precoDe: getPreco, taco, base: createEmptyRecipe()
    });
    if (!saveRecipe(receita)) {
      showToast('Não foi possível salvar. Exporte um backup em Ajustes.');
      copiando = false;
      botao.disabled = false;
      botao.textContent = 'Usar esta receita';
      return;
    }
    navigator.storage?.persist?.().catch(() => {});
    showToast('Receita copiada para Minhas receitas');
    navigate({ screen: 'editor', recipeId: receita.id, aba: 'ingredientes' }, { replace: true });
  }

  view.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    if (target.dataset.action === 'voltar') goBack({ screen: 'prontas' });
    else if (target.dataset.action === 'usar') usar(target);
  }, { signal: events.signal });

  return {
    update() {},
    destroy() { events.abort(); }
  };
}
