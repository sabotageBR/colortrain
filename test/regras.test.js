// Regras do Color Train: boca do trilho (sai e entra pelo lado do sinal) com
// engate em bloco tudo ou nada, e trem completo travado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloco, pode, motivo, mover, completo, resolvido, jogadas, destinos, paraTexto } from '../src/jogo/regras.js';

let id = 1;
const estado = (cap, ...ts) => ({ cap, trilhos: ts.map((s) => [...s].map((ch) => ({ id: id++, c: ch.charCodeAt(0) - 65 }))) });

test('bloco da boca e a sequencia da mesma cor no inicio do trilho', () => {
  const st = estado(4, 'AABA', 'B', '');
  assert.equal(bloco(st.trilhos[0]), 2);
  assert.equal(bloco(st.trilhos[1]), 1);
  assert.equal(bloco(st.trilhos[2]), 0);
});

test('entra pela boca: casa com a frente do destino, nao com o fim', () => {
  const st = estado(4, 'BA', 'AB', 'BA', '');
  assert.ok(!pode(st, 0, 1), 'frente A do destino nao casa com B');
  assert.equal(motivo(st, 0, 1), 'cor');
  assert.ok(pode(st, 0, 2), 'frente B casa com B');
  assert.ok(pode(st, 0, 3), 'trilho vazio aceita');
  const ev = mover(st, 0, 2);
  assert.deepEqual(paraTexto(st), ['A', 'AB', 'BBA', '']);
  assert.equal(ev.n, 1);
  assert.equal(ev.vagoes.length, 1);
});

test('bloco e tudo ou nada: se nao couber inteiro, nao sai', () => {
  const st = estado(4, 'AAAB', 'ABB', 'B');
  assert.ok(!pode(st, 0, 1), 'bloco de 3 nao cabe em 1 vaga');
  assert.equal(motivo(st, 0, 1), 'cap');
  const st2 = estado(4, 'AAB', 'AB', 'C');
  assert.ok(pode(st2, 0, 1), 'bloco de 2 cabe em 2 vagas');
  mover(st2, 0, 1);
  assert.deepEqual(paraTexto(st2), ['B', 'AAAB', 'C']);
});

test('motivo: mesmo trilho, origem vazia, trem travado, cor e vaga', () => {
  const st = estado(3, 'AAA', '', 'A', 'BA', 'AB');
  assert.equal(motivo(st, 2, 2), 'mesmo');
  assert.equal(motivo(st, 1, 2), 'vazio');
  assert.equal(motivo(st, 0, 1), 'travado');
  assert.equal(motivo(st, 2, 0), 'travado');
  assert.equal(motivo(st, 2, 3), 'cor');
  assert.equal(motivo(st, 2, 4), null);
  // cor e vaga falhando juntas: a cor e a licao principal
  const st2 = estado(3, 'AA', 'BAB');
  assert.equal(motivo(st2, 0, 1), 'cor');
});

test('trem completo trava: nao sai nem recebe', () => {
  const st = estado(3, 'AAA', '', 'A');
  assert.ok(completo(st.trilhos[0], 3));
  assert.ok(!pode(st, 0, 1));
  assert.deepEqual(destinos(st, 2), [1]);
});

test('completar avisa e resolvido exige todos os trens prontos', () => {
  const st = estado(3, 'AF', 'AA', 'FF');
  assert.ok(!resolvido(st));
  assert.deepEqual(jogadas(st), [[0, 1]]);
  assert.ok(mover(st, 0, 1).completou);
  assert.ok(mover(st, 0, 2).completou);
  assert.ok(resolvido(st));
});
