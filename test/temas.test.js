// Os dez mundos: ordem da campanha, campos iguais e contraste das pecas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMAS, ORDEM_MUNDOS, INICIO_MUNDOS, mundoPorNivel, temaPorNivel, CORES, distanciaCor } from '../src/render/tema.js';

test('a campanha percorre os dez mundos, curtos no comeco e crescendo depois', () => {
  assert.deepEqual(ORDEM_MUNDOS, ['campina', 'porto', 'deserto', 'serra', 'metropole', 'festa', 'inverno', 'tropico', 'outono', 'aurora']);
  assert.equal(INICIO_MUNDOS.length, ORDEM_MUNDOS.length);
  const tamanhos = INICIO_MUNDOS.map((ini, i) => (INICIO_MUNDOS[i + 1] || 151) - ini);
  assert.equal(tamanhos.reduce((a, b) => a + b, 0), 150);
  for (let i = 1; i < tamanhos.length; i++) assert.ok(tamanhos[i] > tamanhos[i - 1], `mundo ${i}`);
  for (const n of ORDEM_MUNDOS) assert.equal(TEMAS[n].nome, n);
  const esperado = { 1: 'campina', 5: 'campina', 6: 'porto', 12: 'porto', 13: 'deserto', 22: 'serra', 33: 'metropole', 46: 'festa', 61: 'inverno', 78: 'tropico', 97: 'outono', 118: 'aurora', 150: 'aurora', 151: 'campina', 166: 'porto' };
  for (const [n, nome] of Object.entries(esperado)) assert.equal(temaPorNivel(Number(n)).nome, nome, `nivel ${n}`);
  assert.equal(mundoPorNivel(0), 0);
});

test('todos os mundos tem o mesmo conjunto de campos', () => {
  const base = Object.keys(TEMAS.campina).sort();
  for (const t of Object.values(TEMAS)) assert.deepEqual(Object.keys(t).sort(), base, t.nome);
});

test('as oito cores de vagao se distinguem do chao de cada mundo', () => {
  for (const t of Object.values(TEMAS)) {
    for (const c of CORES) {
      const d = distanciaCor(c.base, t.placa);
      assert.ok(d >= 25, `${t.nome} x ${c.base}: dE ${d.toFixed(1)}`);
    }
  }
});
