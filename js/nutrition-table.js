// js/nutrition-table.js
//
// ANVISA-style (IN 75/2020) nutrition table. A calculation aid built from
// the recipe's own ingredient data — not a certified label, and %VD uses
// simple rounding; both are disclosed in the footnotes.

import {
  parseQuantity, toGrams, calculateNutritionPerPortion, calculateVD, VALORES_DIARIOS_REFERENCIA
} from './calculations.js';
import { html } from './ui/dom.js';
import { formatNumber } from './format.js';

export function nutritionPerPortion(recipe) {
  const itens = recipe.ingredientes
    .filter((item) => item.nome && item.nome.trim() !== '')
    .map((item) => {
      const quantidade = parseQuantity(item.quantidadeBruta);
      const gramas = quantidade == null ? null : toGrams({
        quantidade, unidade: item.unidade, densidadeGml: item.densidadeGml, pesoUnidadeG: item.pesoUnidadeG
      });
      return { gramas: gramas ?? 0, nutricao100g: gramas != null ? item.nutricao100g : null };
    });
  return calculateNutritionPerPortion({ itens, rendimento: recipe.rendimento });
}

const LINHAS = [
  { label: 'Valor energético', unidade: 'kcal', key: 'kcal', casas: 0 },
  { label: 'Carboidratos', unidade: 'g', key: 'carboidratos', casas: 1 },
  { label: 'Açúcares adicionados', unidade: 'g', key: 'acucaresAdicionados', casas: 1 },
  { label: 'Proteínas', unidade: 'g', key: 'proteinas', casas: 1 },
  { label: 'Gorduras totais', unidade: 'g', key: 'gorduras', casas: 1 },
  { label: 'Gorduras saturadas', unidade: 'g', key: 'gordurasSaturadas', casas: 1 },
  { label: 'Fibra alimentar', unidade: 'g', key: 'fibras', casas: 1 },
  { label: 'Sódio', unidade: 'mg', key: 'sodio', casas: 0 }
];

export function nutritionRows(resultado) {
  const peso = resultado.pesoPorcao;
  return LINHAS.map(({ label, unidade, key, casas }) => {
    const porPorcao = resultado[key];
    return {
      label, unidade, casas,
      porPorcao,
      por100g: peso ? (porPorcao / peso) * 100 : 0,
      vd: calculateVD(porPorcao, VALORES_DIARIOS_REFERENCIA[key])
    };
  });
}

export function nutritionTableHtml(resultado, rendimento) {
  const peso = formatNumber(resultado.pesoPorcao, 0);
  const avisos = [];
  if (resultado.ingredientesSemDados > 0) {
    avisos.push(`Cálculo incompleto — ${resultado.ingredientesSemDados} ingrediente(s) sem dados nutricionais (não entraram na conta).`);
  }
  avisos.push('Gorduras saturadas: somadas apenas quando o ingrediente veio da base TACO, que é quem traz esse dado.');
  avisos.push('Açúcares adicionados: somados apenas a partir de ingredientes com esse dado cadastrado (ex: açúcar, mel, leite condensado) — não inclui açúcar natural de frutas, leite etc.');

  return html`
    <div class="nutri">
      <h3>Informação Nutricional</h3>
      <p>Porções por embalagem: cerca de ${rendimento}</p>
      <p>Porção: ${peso} g</p>
      <div class="nutri-scroll">
        <table>
          <thead><tr><th></th><th>100 g</th><th>${peso} g</th><th>%VD*</th></tr></thead>
          <tbody>
            ${nutritionRows(resultado).map((r) => html`
              <tr>
                <td>${r.label} (${r.unidade})</td>
                <td>${formatNumber(r.por100g, r.casas)}</td>
                <td>${formatNumber(r.porPorcao, r.casas)}</td>
                <td>${r.vd != null ? `${r.vd}%` : '—'}</td>
              </tr>`)}
          </tbody>
        </table>
      </div>
      <p class="nutri-note">*% de Valores Diários fornecidos pela porção, com base em uma dieta de 2.000 kcal. Seus valores diários podem ser maiores ou menores dependendo das suas necessidades energéticas.</p>
      <p class="nutri-note">Valores calculados a partir dos ingredientes cadastrados nesta receita — não substitui laudo laboratorial nem segue automaticamente todas as regras de arredondamento da ANVISA (IN 75/2020).</p>
      ${avisos.map((a) => html`<p class="nutri-warn">${a}</p>`)}
    </div>`;
}
