// build-taco.js
//
// Source: TACO.json from https://github.com/marcelosanto/tabela_taco (MIT licensed),
// a JSON conversion of the "Tabela Brasileira de Composição de Alimentos" (TACO),
// 4th edition, published by NEPA/UNICAMP (Núcleo de Estudos e Pesquisas em
// Alimentação, Universidade Estadual de Campinas).
// Downloaded raw from:
//   https://raw.githubusercontent.com/marcelosanto/tabela_taco/main/TACO.json
// and saved unmodified as data/taco-raw.json (597 food rows).
//
// This script normalizes those 597 raw rows into data/taco.json, matching the
// shape used by the rest of the app: { nome, categoria, nutricao100g }.
//
// Field mapping (raw -> nutricao100g):
//   description     -> nome
//   energy_kcal      -> kcal
//   carbohydrate_g   -> carboidratos
//   protein_g        -> proteinas
//   lipid_g          -> gorduras
//   fiber_g          -> fibras
//   sodium_mg        -> sodio
//   saturated_g      -> gordurasSaturadas (only field kept null, not 0, when
//                       the raw source has no value — unlike the six core
//                       fields, its absence should read as "not tracked for
//                       this ingredient", not "zero saturated fat")
//
// Rows missing a name, or missing/non-numeric values for ALL of the six
// nutrition fields, are skipped. Non-numeric placeholder values in the raw
// data (e.g. "NA", "Tr", "") for an individual field are treated as 0 for
// that field, mirroring how TACO itself annotates trace/unmeasured amounts.
//
// The raw `category` (a Portuguese food-group label) is mapped to one of the
// coarse categories used elsewhere in the app for density lookup:
//   po            - flours, starches, powders
//   liquido       - milks, oils, liquid sweets, beverages
//   graos         - rice, oats, grains, legumes, nuts/seeds
//   laticinio     - dairy, cheese
//   gordura       - butter, margarine, animal fat
//   fruta_vegetal - fruit and vegetables
//   outro         - anything else (eggs, meat, fish, prepared dishes, misc.)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_PATH = path.join(__dirname, '..', 'data', 'taco-raw.json');
const OUT_PATH = path.join(__dirname, '..', 'data', 'taco.json');

const CATEGORY_MAP = {
  'Cereais e derivados': 'graos',
  'Leguminosas e derivados': 'graos',
  'Nozes e sementes': 'graos',
  'Verduras, hortaliças e derivados': 'fruta_vegetal',
  'Frutas e derivados': 'fruta_vegetal',
  'Leite e derivados': 'laticinio',
  'Gorduras e óleos': 'gordura',
  'Bebidas (alcoólicas e não alcoólicas)': 'liquido',
  'Produtos açucarados': 'liquido',
  'Ovos e derivados': 'outro',
  'Carnes e derivados': 'outro',
  'Pescados e frutos do mar': 'outro',
  'Alimentos preparados': 'outro',
  'Outros alimentos industrializados': 'outro',
  'Miscelâneas': 'outro'
};

function toNumberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toUpperCase() === 'NA' || trimmed.toUpperCase() === 'TR') {
      return null;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function mapCategoria(rawCategory) {
  return CATEGORY_MAP[rawCategory] ?? 'outro';
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildTaco() {
  const raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));

  const result = [];
  for (const row of raw) {
    const nome = typeof row.description === 'string' ? row.description.trim() : '';
    if (!nome) continue;

    const kcal = toNumberOrNull(row.energy_kcal);
    const carboidratos = toNumberOrNull(row.carbohydrate_g);
    const proteinas = toNumberOrNull(row.protein_g);
    const gorduras = toNumberOrNull(row.lipid_g);
    const fibras = toNumberOrNull(row.fiber_g);
    const sodio = toNumberOrNull(row.sodium_mg);
    const gordurasSaturadas = toNumberOrNull(row.saturated_g);

    const allMissing = [kcal, carboidratos, proteinas, gorduras, fibras, sodio].every(
      (v) => v === null
    );
    if (allMissing) continue;

    result.push({
      nome,
      categoria: mapCategoria(row.category),
      nutricao100g: {
        kcal: round(kcal ?? 0, 1),
        carboidratos: round(carboidratos ?? 0, 2),
        proteinas: round(proteinas ?? 0, 2),
        gorduras: round(gorduras ?? 0, 2),
        fibras: round(fibras ?? 0, 2),
        sodio: round(sodio ?? 0, 2),
        gordurasSaturadas: gordurasSaturadas === null ? null : round(gordurasSaturadas, 2)
      }
    });
  }

  writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${result.length} rows to ${OUT_PATH}`);
}

buildTaco();
