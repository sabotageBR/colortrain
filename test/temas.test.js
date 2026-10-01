// Os dez mundos: ordem da campanha, campos iguais e contraste das pecas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMAS, ORDEM_MUNDOS, NIVEIS_POR_MUNDO, temaPorNivel, CORES, contraste } from '../src/render/tema.js';

test('a campanha percorre os dez mundos, quinze niveis cada', () => {
  assert.deepEqual(ORDEM_MUNDOS, ['campina', 'porto', 'deserto', 'serra', 'metropole', 'festa', 'inverno', 'tropico', 'outono', 'aurora']);
  assert.equal(NIVEIS_POR_MUNDO, 15);
  assert.equal(ORDEM_MUNDOS.length * NIVEIS_POR_MUNDO, 150);
  for (const n of ORDEM_MUNDOS) assert.equal(TEMAS[n].nome, n);
  const esperado = { 1: 'campina', 15: 'campina', 16: 'porto', 31: 'deserto', 46: 'serra', 61: 'metropole', 76: 'festa', 91: 'inverno', 106: 'tropico', 121: 'outono', 136: 'aurora', 150: 'aurora', 151: 'campina' };
  for (const [n, nome] of Object.entries(esperado)) assert.equal(temaPorNivel(Number(n)).nome, nome, `nivel ${n}`);
});

test('todos os mundos tem o mesmo conjunto de campos', () => {
  const base = Object.keys(TEMAS.campina).sort();
  for (const t of Object.values(TEMAS)) assert.deepEqual(Object.keys(t).sort(), base, t.nome);
});

test('as oito cores de vagao contrastam com a placa de cada mundo', () => {
  for (const t of Object.values(TEMAS)) {
    for (const c of CORES) {
      const k = contraste(c.base, t.placa);
      assert.ok(k >= 2, `${t.nome} x ${c.base}: ${k.toFixed(2)}`);
    }
  }
});
