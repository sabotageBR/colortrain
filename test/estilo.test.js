// Fronteiras do codigo que a Poki e o projeto cobram (ver CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
/** @param {string} dir @returns {string[]} */
const arquivos = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? arquivos(p) : [p];
});
const src = arquivos(join(raiz, 'src')).filter((p) => /\.(js|css)$/.test(p));
const ler = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(raiz, p);

test('sem console.log/info/debug no jogo', () => {
  for (const p of src) assert.ok(!/console\.(log|info|debug)\s*\(/.test(ler(p)), rel(p));
});

test('so src/main.js importa o SDK da Poki', () => {
  for (const p of src) {
    if (rel(p) === 'src/main.js' || rel(p) === 'src/core/poki.js') continue;
    assert.ok(!/core\/poki\.js|\.\/poki\.js/.test(ler(p)), rel(p));
  }
});

test('so o armazenamento toca o localStorage', () => {
  for (const p of src) {
    if (rel(p) === 'src/core/armazenamento.js') continue;
    assert.ok(!/localStorage/.test(ler(p)), rel(p));
  }
});

test('so a depuracao le a URL', () => {
  for (const p of src) {
    if (rel(p) === 'src/core/depuracao.js') continue;
    assert.ok(!/location\.(search|hash)|URLSearchParams/.test(ler(p)), rel(p));
  }
});

test('logica pura nao usa Math.random, DOM nem relogio', () => {
  for (const p of src.filter((x) => /src\/jogo\//.test(x))) {
    const t = ler(p);
    assert.ok(!/Math\.random|document\.|window\.|Date\.now|performance\.now|setTimeout/.test(t), rel(p));
  }
});

test('unica URL externa e a do SDK da Poki', () => {
  const permitida = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
  for (const p of [...src, join(raiz, 'index.html')]) {
    const urls = ler(p).match(/https?:\/\/[^\s"'`)<>]+/g) || [];
    for (const u of urls) assert.equal(u, permitida, `${rel(p)}: ${u}`);
  }
  assert.ok(ler(join(raiz, 'index.html')).includes(permitida));
});

test('index.html pede viewport-fit=cover', () => {
  assert.ok(/viewport-fit=cover/.test(ler(join(raiz, 'index.html'))));
});

test('adaptador do californiagames (portais/): sem URL externa, console.log, storage nem import', () => {
  const t = ler(join(raiz, 'portais/californiagames.js'));
  assert.ok(!/https?:\/\//.test(t), 'URL externa');
  assert.ok(!/console\.(log|info|debug)\s*\(/.test(t), 'console.log');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(t), 'storage');
  assert.ok(!/^\s*import\s/m.test(t), 'import');
  assert.ok(!/rewardedBreak\(\s*aoIniciar|rewardedBreak\(\s*\(\)/.test(t), 'rewardedBreak na forma de funcao');
  assert.ok(!/movePill|openExternalLink/.test(t), 'recurso da Poki');
});

test('adaptador da Y8 (portais/): sem URL externa, console.log nem storage; so importa o fila-sdk.js', () => {
  for (const nome of ['y8.js', 'fila-sdk.js']) {
    const t = ler(join(raiz, 'portais', nome));
    assert.ok(!/https?:\/\//.test(t.replace(/^\s*\/\/.*$/gm, '')), `${nome}: URL externa`);
    assert.ok(!/console\.(log|info|debug)\s*\(/.test(t), `${nome}: console.log`);
    assert.ok(!/localStorage|sessionStorage|indexedDB/.test(t), `${nome}: storage`);
    for (const m of t.matchAll(/^\s*import\s[^;]*from\s+'([^']+)'/gm)) assert.equal(m[1], './fila-sdk.js', `${nome}: import ${m[1]}`);
  }
});
