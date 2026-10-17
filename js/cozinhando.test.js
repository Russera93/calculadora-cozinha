import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectarDuracaoMs, formatarDuracao } from './cozinhando.js';

test('detectarDuracaoMs: minutes ("40 minutos", "5 min")', () => {
  assert.equal(detectarDuracaoMs('Asse em forno preaquecido por cerca de 40 minutos.'), 40 * 60000);
  assert.equal(detectarDuracaoMs('Deixe descansar 5 min.'), 5 * 60000);
});

test('detectarDuracaoMs: a range keeps the higher bound ("30-40 min")', () => {
  assert.equal(detectarDuracaoMs('Forno a 180°C por 30-40 min.'), 40 * 60000);
});

test('detectarDuracaoMs: hours, with or without minutes ("1h", "1h30", "1 hora e 30 minutos")', () => {
  assert.equal(detectarDuracaoMs('Deixe crescer por 1h.'), 60 * 60000);
  assert.equal(detectarDuracaoMs('Deixe crescer por 1h30.'), 90 * 60000);
  assert.equal(detectarDuracaoMs('Deixe na geladeira por 1 hora e 30 minutos.'), 90 * 60000);
});

test('detectarDuracaoMs: no time mentioned, or only a clock-like value, is null', () => {
  assert.equal(detectarDuracaoMs('Misture tudo numa tigela.'), null);
  assert.equal(detectarDuracaoMs('Retire do forno às 10:30.'), null);
  assert.equal(detectarDuracaoMs(''), null);
  assert.equal(detectarDuracaoMs(undefined), null);
});

test('detectarDuracaoMs: a quantity that happens to have a digit is not mistaken for time', () => {
  assert.equal(detectarDuracaoMs('2 xícaras de farinha na tigela.'), null);
  assert.equal(detectarDuracaoMs('Asse a 180°C até dourar.'), null);
});

test('formatarDuracao: mm:ss, floor at zero', () => {
  assert.equal(formatarDuracao(40 * 60000), '40:00');
  assert.equal(formatarDuracao(90 * 1000), '01:30');
  assert.equal(formatarDuracao(5000), '00:05');
  assert.equal(formatarDuracao(-2000), '00:00');
});
