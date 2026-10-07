// Garagem: a primeira locomotiva nova ao completar o nivel 3, depois a cada 4;
// a meta do HUD e um save antigo nunca perde locomotiva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liberadas, nivelDaPintura, progressoLoco } from '../src/ui/garagem.js';
import { PINTURAS } from '../src/render/pecas.js';

test('libera ao completar o 3 e depois a cada 4 niveis', () => {
  assert.equal(liberadas(1, 0), 1);
  assert.equal(liberadas(3, 0), 1);
  assert.equal(liberadas(4, 0), 2, 'completou o 3');
  assert.equal(liberadas(7, 0), 2);
  assert.equal(liberadas(8, 0), 3);
  assert.equal(liberadas(28, 0), PINTURAS.length);
  assert.equal(liberadas(4, 1), 3, 'video libera uma a mais');
  for (let i = 1; i < PINTURAS.length; i++) {
    const n = nivelDaPintura(i, 0);
    assert.equal(liberadas(n, 0), i + 1, `pintura ${i}`);
    assert.equal(liberadas(n - 1, 0), i, `pintura ${i} antes`);
  }
});

test('progresso: segmentos ate a proxima e a proxima pintura', () => {
  assert.deepEqual(progressoLoco(1, 0), { atual: 0, total: 3, proxima: 1 });
  assert.deepEqual(progressoLoco(3, 0), { atual: 2, total: 3, proxima: 1 });
  assert.deepEqual(progressoLoco(4, 0), { atual: 0, total: 4, proxima: 2 });
  assert.deepEqual(progressoLoco(7, 0), { atual: 3, total: 4, proxima: 2 });
  assert.equal(progressoLoco(40, 0).proxima, null);
});

test('save antigo (uma a cada 5 niveis) nunca perde locomotiva', () => {
  const antiga = (nivel, extras) => Math.min(PINTURAS.length, 1 + Math.floor((nivel - 1) / 5) + extras);
  for (let n = 1; n <= 200; n++) for (let e = 0; e < 3; e++) assert.ok(liberadas(n, e) >= antiga(n, e), `nivel ${n}`);
});
