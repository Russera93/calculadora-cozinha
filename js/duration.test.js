import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, formatDuration } from './duration.js';

test('parseDuration: horas e minutos nos jeitos comuns de escrever', () => {
  assert.equal(parseDuration('1h30'), 90);
  assert.equal(parseDuration('1h 30min'), 90);
  assert.equal(parseDuration('1:30'), 90);
  assert.equal(parseDuration('2h'), 120);
  assert.equal(parseDuration('2 horas'), 120);
  assert.equal(parseDuration('1,5h'), 90);
  assert.equal(parseDuration('1.5 h'), 90);
  assert.equal(parseDuration('45 min'), 45);
  assert.equal(parseDuration('45min'), 45);
  assert.equal(parseDuration('40 minutos'), 40);
  assert.equal(parseDuration('90'), 90); // número sozinho = minutos
  assert.equal(parseDuration(' 1H30M '), 90);
});

test('parseDuration: vazio ou sem sentido é null', () => {
  for (const t of ['', '   ', 'abc', 'h', '1:75', '-30', null, undefined]) assert.equal(parseDuration(t), null, String(t));
});

test('formatDuration', () => {
  assert.equal(formatDuration(90), '1h30');
  assert.equal(formatDuration(120), '2h');
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(65), '1h05');
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration(0), '');
});
