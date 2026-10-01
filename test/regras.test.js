// Regras do Color Train: fila (sai a frente, engata atras) com engate em
// bloco tudo ou nada, e trem completo travado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bloco, pode, mover, completo, resolvido, jogadas, destinos, paraTexto } from '../src/jogo/regras.js';

let id = 1;
const estado = (cap, ...ts) => ({ cap, trilhos: ts.map((s) => [...s].map((ch) => ({ id: id++, c: ch.charCodeAt(0) - 65 }))) });

test('bloco da frente e a sequencia da mesma cor no inicio do trilho', () => {
  const st = estado(4, 'AABA', 'B', '');
  assert.equal(bloco(st.trilhos[0]), 2);
  assert.equal(bloco(st.trilhos[1]), 1);
  assert.equal(bloco(st.trilhos[2]), 0);
});

test('sai pela frente e engata no fim, so na mesma cor ou trilho vazio', () => {
  const st = estado(4, 'BA', 'AB', 'A', '');
  assert.ok(!pode(st, 0, 2), 'frente B nao casa com fim A');
  assert.ok(pode(st, 0, 1), 'frente B casa com fim B');
  assert.ok(pode(st, 0, 3), 'trilho vazio aceita');
  const ev = mover(st, 0, 1);
  assert.deepEqual(paraTexto(st), ['A', 'ABB', 'A', '']);
  assert.equal(ev.vagoes.length, 1);
});

test('bloco e tudo ou nada: se nao couber inteiro, nao sai', () => {
  const st = estado(4, 'AAAB', 'BBA', 'B');
  assert.ok(!pode(st, 0, 1), 'bloco de 3 nao cabe em 1 vaga');
  const st2 = estado(4, 'AAB', 'BA', 'C');
  assert.ok(pode(st2, 0, 1), 'bloco de 2 cabe em 2 vagas');
  mover(st2, 0, 1);
  assert.deepEqual(paraTexto(st2), ['B', 'BAAA', 'C']);
});

test('trem completo trava: nao sai nem recebe', () => {
  const st = estado(3, 'AAA', '', 'A');
  assert.ok(completo(st.trilhos[0], 3));
  assert.ok(!pode(st, 0, 1));
  assert.deepEqual(destinos(st, 2), [1]);
});

test('completar avisa e resolvido exige todos os trens prontos', () => {
  const st = estado(4, 'AA', 'BB', 'BBAA');
  assert.ok(!resolvido(st));
  assert.deepEqual(jogadas(st), [[2, 1]]);
  assert.ok(mover(st, 2, 1).completou);
  assert.ok(mover(st, 2, 0).completou);
  assert.ok(resolvido(st));
});
