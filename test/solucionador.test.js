// Solucionador: analise (resolve / morto / incerto), grafo de estados e risco
// de beco, sob a regra da boca do trilho.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, resolver, explorar, riscoBeco, resolvidoTexto } from '../src/jogo/solucionador.js';
import { definicaoNivel } from '../src/jogo/catalogo.js';
import { criarRng } from '../src/core/rng.js';

/** Aplica o caminho sobre os textos com a regra da boca. @param {string[]} ts @param {number} cap @param {number[][]} cam */
function aplicarCaminho(ts, cap, cam) {
  let t = ts.slice();
  for (const [a, b] of cam) {
    const A = t[a];
    let n = 1;
    while (n < A.length && A[n] === A[0]) n++;
    assert.ok(A.length > 0, 'origem vazia');
    assert.ok(!t[b].length || t[b][0] === A[0], 'cor da boca');
    assert.ok(cap - t[b].length >= n, 'cabe inteiro');
    t = t.slice();
    t[b] = A.slice(0, n) + t[b];
    t[a] = A.slice(n);
  }
  return t;
}

test('analisar: resolve com caminho valido, prova o beco e admite incerto', () => {
  const ok = analisar(['AF', 'AA', 'FF'], 3, { exato: true });
  assert.equal(ok.estado, 'resolve');
  assert.deepEqual(ok.caminho, [[0, 1], [0, 2]]);
  assert.ok(resolvidoTexto(aplicarCaminho(['AF', 'AA', 'FF'], 3, ok.caminho), 3));
  // A e F trocados nas bocas, sem vaga livre: nenhuma jogada e sem solucao
  const morto = analisar(['AF', 'FA'], 2);
  assert.equal(morto.estado, 'morto');
  assert.equal(morto.caminho, null);
  const incerto = analisar(['CDGD', '', 'DGCF', 'GFGD', '', 'CCFF'], 4, { orcamento: 1 });
  assert.equal(incerto.estado, 'incerto');
  assert.equal(resolver(['AF', 'FA'], 2), null);
});

test('explorar conta os estados mortos e o risco e deterministico', () => {
  const g = /** @type {any} */ (explorar(['AF', 'AA', 'FF'], 3));
  assert.equal(g.mortos, 0);
  assert.equal(riscoBeco(g, criarRng(1)), 0);
  // um vazio so: mandar o bloco errado para ele leva a um estado sem saida
  const g2 = /** @type {any} */ (explorar(['', 'AAB', 'CBA', 'CCB'], 3));
  assert.ok(g2.mortos > 0);
  const r1 = riscoBeco(g2, criarRng(7));
  assert.equal(r1, riscoBeco(g2, criarRng(7)));
  assert.ok(r1 > 0 && r1 < 1);
  assert.equal(explorar(['CDGD', '', 'DGCF', 'GFGD', '', 'CCFF'], 4, { limite: 10 }), null);
});

test('analise por jogada fica abaixo de 4000 expansoes nos niveis 1 a 150', () => {
  const r = criarRng(2026);
  let pior = 0;
  let consultas = 0;
  for (let nivel = 1; nivel <= 150; nivel += 1) {
    const def = definicaoNivel(nivel);
    let ts = def.t.slice();
    // passeio aleatorio com jogadas legais; analisa cada estado do caminho
    for (let passo = 0; passo < 14; passo++) {
      const a0 = analisar(ts, def.cap, { orcamento: 4000 });
      assert.notEqual(a0.estado, 'incerto', `nivel ${nivel}, passo ${passo}`);
      pior = Math.max(pior, a0.expandidos);
      consultas++;
      const movs = [];
      for (let a = 0; a < ts.length; a++) {
        const A = ts[a];
        if (!A.length) continue;
        let n = 1;
        while (n < A.length && A[n] === A[0]) n++;
        if (n === def.cap) continue;
        for (let b = 0; b < ts.length; b++) {
          const B = ts[b];
          if (a === b || def.cap - B.length < n || (B.length === def.cap && [...B].every((c) => c === B[0]))) continue;
          if (B.length && B[0] !== A[0]) continue;
          movs.push([a, b, n]);
        }
      }
      if (!movs.length) break;
      const [a, b, n] = movs[Math.floor(r() * movs.length)];
      ts = ts.slice();
      ts[b] = ts[a].slice(0, n) + ts[b];
      ts[a] = ts[a].slice(n);
    }
  }
  assert.ok(consultas > 1500, `consultas ${consultas}`);
  assert.ok(pior < 4000, `pior ${pior}`);
});
