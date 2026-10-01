// Os niveis prontos (src/jogo/niveis.js) e os gerados depois do 150 tem
// solucao, comecam sem trem pronto e trazem cada cor com um trem inteiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIVEIS } from '../src/jogo/niveis.js';
import { definicaoNivel } from '../src/jogo/catalogo.js';
import { gerarNivel } from '../src/jogo/gerador.js';
import { resolver } from '../src/jogo/solucionador.js';

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

test('nivel 1 ensina em 2 jogadas e os 5 primeiros sao curtos', () => {
  assert.equal(definicaoNivel(1).jogadas, 2);
  for (let n = 1; n <= 5; n++) assert.ok(definicaoNivel(n).jogadas <= 6, `nivel ${n}`);
});

test('niveis prontos batem com o gerador (determinismo)', () => {
  for (const n of [2, 17, 63, 150]) assert.deepEqual(gerarNivel(n).t, definicaoNivel(n).t);
});

test('depois do 150 o gerador continua', () => {
  for (const n of [151, 175, 240]) conferir(definicaoNivel(n), n);
});
