// Geometria: vagoes encostados no para-choque, retrato que usa a altura,
// faixas de toque e o ima do arraste.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularLayout, trilhoEm, trilhoProximo, vaga, LINHA, LINHA_MAX } from '../src/render/layout.js';

test('vaga: o vagao j de um trilho com k vagoes fica encostado no para-choque', () => {
  assert.equal(vaga(4, 4, 0), 0);
  assert.equal(vaga(4, 1, 0), 3);
  assert.equal(vaga(4, 2, 1), 3);
  assert.equal(vaga(3, 2, 0), 1);
});

test('retrato: os trilhos se espalham e o patio passa de 45% da altura util', () => {
  const lay = calcularLayout({ W: 390, H: 844, topo: 90, base: 760, n: 5, cap: 4 });
  assert.ok(lay.retrato);
  assert.ok(lay.linha > LINHA && lay.linha <= LINHA_MAX, `linha ${lay.linha}`);
  const patio = lay.yFimTabuleiro - lay.yTabuleiro;
  assert.ok(patio / (760 - 90) >= 0.45, `patio ${patio}`);
  assert.ok(lay.yFimTabuleiro <= 760);
});

test('paisagem: espacamento minimo, como antes', () => {
  const lay = calcularLayout({ W: 640, H: 360, topo: 70, base: 352, n: 6, cap: 4, direita: 66 });
  assert.ok(!lay.retrato);
  assert.equal(lay.linha, LINHA);
});

test('faixas de toque: cada trilho pega a propria faixa, as pontas um pouco mais', () => {
  const lay = calcularLayout({ W: 390, H: 844, topo: 90, base: 760, n: 5, cap: 4 });
  const x = lay.xVaga(0, 1);
  lay.trilhos.forEach((t, i) => assert.equal(trilhoEm(lay, x, t.yb - lay.L * 0.3), i));
  const ult = lay.trilhos[4].yb - lay.L * 0.3;
  assert.equal(trilhoEm(lay, x, ult + lay.linha * lay.L * 0.5 + lay.L * 0.3), 4, 'abaixo do ultimo');
  // no retrato a faixa horizontal e a tela toda
  assert.equal(trilhoEm(lay, 2, lay.trilhos[2].yb - lay.L * 0.3), 2);
  const pais = calcularLayout({ W: 844, H: 390, topo: 70, base: 382, n: 5, cap: 4, direita: 74 });
  assert.equal(trilhoEm(pais, 1, pais.trilhos[2].yb), -1, 'fora do patio na paisagem');
});

test('ima: escolhe so trilhos validos, dentro do raio', () => {
  const lay = calcularLayout({ W: 390, H: 844, topo: 90, base: 760, n: 5, cap: 4 });
  const x = lay.xVaga(0, 1);
  const entre = (lay.trilhos[1].yb + lay.trilhos[2].yb) / 2 - lay.L * 0.3;
  assert.equal(trilhoProximo(lay, x, entre, [2]), 2);
  assert.equal(trilhoProximo(lay, x, entre, [4]), -1, 'longe demais');
  assert.equal(trilhoProximo(lay, x, entre, []), -1);
});
