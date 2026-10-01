// Testes do motor dos 5 modelos (modelos/motor.js): cada nivel gerado tem
// solucao, a solucao gravada resolve de fato e as regras de cada modelo valem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../modelos/motor.js';

const M = globalThis.Motor;

function jogar(st, sol) {
  for (const [a, b] of sol) {
    assert.ok(M.pode(st, a, b), `jogada ilegal ${a}->${b}`);
    M.mover(st, a, b);
  }
  return M.resolvido(st);
}

test('niveis 1 a 12 de todos os modelos tem solucao que resolve', () => {
  M.MODELOS.forEach((m, mi) => {
    for (let n = 1; n <= 12; n++) {
      const { st, sol } = M.novoNivel(mi, n);
      assert.ok(!M.resolvido(st), `${m.id} ${n} ja comeca resolvido`);
      assert.ok(sol && sol.length, `${m.id} ${n} sem solucao`);
      assert.ok(jogar(M.clonar(st), sol), `${m.id} ${n}: solucao nao resolve`);
    }
  });
});

test('nivel 1 de todo modelo e tutorial de 2 jogadas', () => {
  M.MODELOS.forEach((m, mi) => {
    const { sol } = M.novoNivel(mi, 1);
    assert.equal(sol.length, 2, m.id);
  });
});

test('niveis sao deterministicos', () => {
  const a = M.novoNivel(0, 7).st, b = M.novoNivel(0, 7).st;
  const forma = (st) => st.t.map((t) => t.map((u) => `${u.c}.${u.n}`).join(',')).join('|');
  assert.equal(forma(a), forma(b));
});

test('fila: sai a frente e entra atras; ponta: entra e sai pela mesma ponta', () => {
  const fila = { m: M.MODELOS[0], cap: 3, t: [M.parse('BR'), M.parse('B'), []], chegada: null, pos: 0, plat: null };
  assert.equal(M.saida(fila, 0)[0].c, M.LETRAS.indexOf('B'));
  assert.ok(M.pode(fila, 0, 1));
  const ponta = { ...fila, m: M.MODELOS[1], t: [M.parse('BR'), M.parse('B'), []] };
  assert.equal(M.saida(ponta, 0)[0].c, M.LETRAS.indexOf('R'));
  assert.ok(!M.pode(ponta, 0, 1));
});

test('grudados andam juntos e precisam de espaco para os dois', () => {
  const st = { m: M.MODELOS[0], cap: 4, t: [M.parse('G2R'), M.parse('GGR'), M.parse('GG')], chegada: null, pos: 0, plat: null };
  assert.ok(!M.pode(st, 0, 1), 'nao cabe o par');
  assert.ok(M.pode(st, 0, 2));
  M.mover(st, 0, 2);
  assert.equal(M.ocup(st.t[2]), 4);
  assert.ok(M.completo(st, st.t[2]));
  assert.ok(M.travado(st, 2), 'trem completo trava');
});

test('giradouro so move para trilho vizinho', () => {
  const st = { m: M.MODELOS[2], cap: 3, t: [M.parse('R'), [], [], []], chegada: null, pos: 0, plat: null };
  assert.ok(M.pode(st, 0, 1));
  assert.ok(M.pode(st, 0, 3), 'anel: 0 e 3 sao vizinhos');
  assert.ok(!M.pode(st, 0, 2));
});

test('bloco move a sequencia da mesma cor ate onde couber', () => {
  const st = { m: M.MODELOS[4], cap: 4, t: [M.parse('BBBR'), M.parse('BB'), []], chegada: null, pos: 0, plat: null };
  const ev = M.mover(st, 0, 1);
  assert.equal(ev.mov.length, 2);
  assert.equal(M.ocup(st.t[0]), 2);
  assert.ok(M.completo(st, st.t[1]));
});

test('plataforma: trem completo libera o trilho', () => {
  const st = M.novoNivel(3, 1).st;
  const ev = M.mover(st, -1, 1);
  assert.equal(ev.plataforma, 0);
  assert.equal(st.t[1].length, 0);
  assert.equal(st.plat.length, 1);
});
