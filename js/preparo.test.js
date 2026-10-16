import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textoParaPassos, passosParaTexto } from './preparo.js';

test('textoParaPassos: one step per line, blank lines dropped, trimmed', () => {
  assert.deepEqual(textoParaPassos('  Misture tudo.  \n\n\nAsse por 40 min.\n'), ['Misture tudo.', 'Asse por 40 min.']);
  assert.deepEqual(textoParaPassos('a\r\nb'), ['a', 'b']);
});

test('textoParaPassos: pasted numbering and bullets are removed (the app numbers)', () => {
  assert.deepEqual(
    textoParaPassos('1. Misture\n2) Leve ao fogo\n3 - Mexa\n4: Enrole\n- Passe no granulado\n• Sirva\n* Embale\n– Venda'),
    ['Misture', 'Leve ao fogo', 'Mexa', 'Enrole', 'Passe no granulado', 'Sirva', 'Embale', 'Venda']
  );
});

test('textoParaPassos: a number that is part of the step stays', () => {
  assert.deepEqual(textoParaPassos('2 xícaras de farinha na tigela\n180°C por 40 minutos'), ['2 xícaras de farinha na tigela', '180°C por 40 minutos']);
});

test('textoParaPassos: empty or only blanks/markers gives no steps', () => {
  assert.deepEqual(textoParaPassos(''), []);
  assert.deepEqual(textoParaPassos('\n  \n1.\n-'), []);
  assert.deepEqual(textoParaPassos(undefined), []);
});

test('passosParaTexto: inverse, for editing', () => {
  assert.equal(passosParaTexto(['Misture', 'Asse']), 'Misture\nAsse');
  assert.equal(passosParaTexto([]), '');
  assert.equal(passosParaTexto(undefined), '');
  assert.deepEqual(textoParaPassos(passosParaTexto(['Misture', 'Asse'])), ['Misture', 'Asse']);
});
