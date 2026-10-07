// Os niveis prontos (src/jogo/niveis.js) e os gerados depois do 150 tem
// solucao, comecam sem trem pronto e trazem cada cor com um trem inteiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIVEIS } from '../src/jogo/niveis.js';
import { definicaoNivel } from '../src/jogo/catalogo.js';
import { gerarNivel } from '../src/jogo/gerador.js';
import { resolver, explorar, riscoBeco } from '../src/jogo/solucionador.js';
import { TUTORIAL, parametros } from '../src/jogo/curva.js';
import { pode, mover } from '../src/jogo/regras.js';
import { criarRng } from '../src/core/rng.js';

const conferir = (def, n) => {
  const cont = {};
  for (const t of def.t) {
    assert.ok(t.length <= def.cap, `nivel ${n}: trilho acima da capacidade`);
    const cheio = t.length === def.cap && [...t].every((c) => c === t[0]);
    assert.ok(!cheio, `nivel ${n}: comeca com trem pronto`);
    for (const c of t) cont[c] = (cont[c] || 0) + 1;
  }
  for (const [c, q] of Object.entries(cont)) assert.equal(q, def.cap, `nivel ${n}: cor ${c} com ${q} vagoes`);
  const sol = resolver(def.t, def.cap, { orcamento: 120000 });
  assert.ok(sol && sol.length > 0, `nivel ${n}: sem solucao`);
};

test('150 niveis prontos e validos', () => {
  assert.equal(NIVEIS.length, 150);
  NIVEIS.forEach((_, i) => conferir(definicaoNivel(i + 1), i + 1));
});

test('niveis 1 a 3 sao o tutorial e a guia so tem jogadas legais', () => {
  TUTORIAL.forEach((tut, i) => {
    const def = definicaoNivel(i + 1);
    assert.deepEqual(def.t, tut.t, `nivel ${i + 1}`);
    assert.equal(def.cap, tut.cap);
    let id = 1;
    const st = { cap: tut.cap, trilhos: tut.t.map((s) => [...s].map((ch) => ({ id: id++, c: ch.charCodeAt(0) - 65 }))) };
    for (const [a, b] of tut.guia) {
      assert.ok(pode(st, a, b), `nivel ${i + 1}: guia ${a}->${b}`);
      mover(st, a, b);
    }
  });
  // no nivel 1 a guia e a unica jogada da abertura
  assert.deepEqual(resolver(TUTORIAL[0].t, 3, { exato: true }), TUTORIAL[0].guia);
});

test('os 6 primeiros sao curtos, de trem de 3; dali em diante trem de 4', () => {
  for (let n = 1; n <= 6; n++) {
    assert.ok(definicaoNivel(n).jogadas <= 6, `nivel ${n}`);
    assert.equal(definicaoNivel(n).cap, 3, `nivel ${n}`);
  }
  for (let n = 7; n <= 150; n++) assert.equal(definicaoNivel(n).cap, 4, `nivel ${n}`);
});

test('nenhum beco alcancavel ate o 12 e risco baixo ate o 150', () => {
  for (let n = 1; n <= 150; n++) {
    const def = definicaoNivel(n);
    const g = explorar(def.t, def.cap, { limite: 60000 });
    assert.ok(g, `nivel ${n}: grafo grande demais`);
    if (n <= 12) assert.equal(g.mortos, 0, `nivel ${n}`);
    const p = /** @type {any} */ (parametros(n));
    if (p.riscoMax) assert.ok(riscoBeco(g, criarRng(n)) <= p.riscoMax + 0.08, `nivel ${n}`);
  }
});

test('niveis prontos batem com o gerador (determinismo)', () => {
  for (const n of [2, 17, 63, 150]) assert.deepEqual(gerarNivel(n).t, definicaoNivel(n).t);
});

test('depois do 150 o gerador continua', () => {
  for (const n of [151, 175, 240]) conferir(definicaoNivel(n), n);
});
