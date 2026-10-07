// Telemetria: lista fixa de nomes, um envio por nivel para cada par.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarTelemetria, EVENTOS } from '../src/core/telemetria.js';

test('so passa o que esta na lista, uma vez por nivel', () => {
  const log = [];
  const t = criarTelemetria((...a) => log.push(a));
  t.nivel(2);
  assert.ok(t.evento('stuck', 'dead'));
  assert.ok(!t.evento('stuck', 'dead'), 'repetido no mesmo nivel');
  assert.ok(!t.evento('level', 'start'), 'level vai direto pelo poki.measure');
  assert.ok(!t.evento('stuck', 'qualquer'));
  assert.ok(t.evento('invalid', 'color'));
  t.nivel(3);
  assert.ok(t.evento('stuck', 'dead'), 'nivel novo zera');
  assert.deepEqual(log, [['stuck', '2', 'dead'], ['invalid', '2', 'color'], ['stuck', '3', 'dead']]);
  for (const acoes of Object.values(EVENTOS)) assert.ok(acoes.length > 0);
});
