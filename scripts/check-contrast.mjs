// Checks WCAG contrast of the text/background token pairs introduced by the
// mobile redesign. Run: node scripts/check-contrast.mjs  (exit 1 on failure)

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const PAIRS = [
  ['barra (claro): texto', '#F6ECE1', '#3A2A22'],
  ['barra (claro): secundário', '#C9B6A8', '#3A2A22'],
  ['barra (claro): lucro', '#8FCB96', '#3A2A22'],
  ['barra (claro): prejuízo', '#E8967C', '#3A2A22'],
  ['barra (escuro): texto', '#F6ECE1', '#4A362C'],
  ['barra (escuro): secundário', '#C9B6A8', '#4A362C'],
  ['barra (escuro): lucro', '#8FCB96', '#4A362C'],
  ['barra (escuro): prejuízo', '#E8967C', '#4A362C'],
  ['abas (claro): texto', '#3A2A22', '#EFE3D8'],
  ['abas (claro): selecionada', '#3A2A22', '#FFFFFF'],
  ['abas (escuro): texto', '#F6ECE1', '#33241D'],
  ['abas (escuro): selecionada', '#F6ECE1', '#4A362C'],
  ['chip selecionado', '#FFFFFF', '#9C4E36'],
  ['etiqueta (claro)', '#8F4A32', '#EEDDD3'],
  ['etiqueta (escuro)', '#E8916B', '#4A2E24']
];

let failed = false;
for (const [name, fg, bg] of PAIRS) {
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2)}:1  ${name}`);
}
process.exit(failed ? 1 : 0);
