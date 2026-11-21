// Adaptador do californiagames.io (portais/californiagames.js) com uma PlataformaSDK falsa, e o alvo
// californiagames do empacotador (a build do portal sai sem nada da Poki e a da Poki nao muda).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { criarPlataforma } from '../portais/californiagames.js';
import { criarRelogioFalso, esvaziar } from './apoio/relogio-falso.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));

/**
 * PlataformaSDK falsa: registra as chamadas, guarda os ouvintes e deixa o teste disparar sinais
 * e responder aos intervalos.
 * @param {{ idioma?: string, adblock?: boolean, exibir?: boolean, recompensa?: boolean }} [o]
 */
function criarSdkFalsa({ idioma = 'pt-BR', adblock = false, exibir = true, recompensa = true } = {}) {
  /** @type {any[][]} */
  const log = [];
  /** @type {Record<string, Set<() => void>>} */
  const ouvintes = { pause: new Set(), resume: new Set(), mute: new Set(), unmute: new Set() };
  /** @type {{ resolver: (v: any) => void, onStart?: () => void, metodo: string, comecou?: boolean }[]} */
  const intervalos = [];
  const sdk = {
    init: (...a) => { log.push(['init', ...a]); return Promise.resolve(); },
    gameLoadingStart: () => log.push(['gameLoadingStart']),
    gameLoadingFinished: () => log.push(['gameLoadingFinished']),
    gameplayStart: () => log.push(['gameplayStart']),
    gameplayStop: () => log.push(['gameplayStop']),
    commercialBreak: (/** @type {any} */ onStart) => {
      log.push(['commercialBreak', typeof onStart]);
      return new Promise((resolver) => intervalos.push({ resolver, onStart, metodo: 'commercialBreak' }));
    },
    rewardedBreak: (/** @type {any} */ op) => {
      log.push(['rewardedBreak', op && typeof op === 'object' ? op.size : typeof op, op && typeof op.onStart]);
      return new Promise((resolver) => intervalos.push({ resolver, onStart: op && op.onStart, metodo: 'rewardedBreak' }));
    },
    measure: (...a) => log.push(['measure', ...a]),
    captureError: (/** @type {any} */ e) => log.push(['captureError', e && e.message]),
    getLanguage: () => idioma,
    isAdBlocked: () => adblock,
    on: (/** @type {string} */ ev, /** @type {() => void} */ cb) => { log.push(['on', ev]); ouvintes[ev].add(cb); },
    off: (/** @type {string} */ ev, /** @type {() => void} */ cb) => ouvintes[ev].delete(cb),
  };
  return {
    sdk, log,
    nomes: () => log.map((l) => l[0]),
    /** @param {'pause'|'resume'|'mute'|'unmute'} nome */
    sinal(nome) { for (const cb of [...ouvintes[nome]]) cb(); },
    /** O anuncio do intervalo mais antigo entra na tela (onStart), como o portal no inicio-intervalo. */
    comecar() {
      const i = intervalos[0];
      if (!i) throw new Error('nenhum intervalo pendente');
      if (exibir && typeof i.onStart === 'function' && !i.comecou) { i.comecou = true; i.onStart(); }
    },
    /** Exibe (se ainda nao) e termina o intervalo mais antigo. */
    terminar() {
      this.comecar();
      const i = intervalos.shift();
      i.resolver(i.metodo === 'rewardedBreak' ? recompensa && exibir : undefined);
    },
    get pendentes() { return intervalos.length; },
  };
}

function montar(opcoes) {
  const relogio = criarRelogioFalso();
  const falsa = criarSdkFalsa(opcoes);
  const p = criarPlataforma({ obterSdk: () => falsa.sdk, agendar: relogio.agendar, cancelar: relogio.cancelar });
  /** @type {string[]} */
  const jogo = [];
  p.onAdStart = () => jogo.push('mudo');
  p.onAdEnd = () => jogo.push('som');
  p.onPausa = (v) => jogo.push(v ? 'pausa' : 'volta');
  return { p, falsa, relogio, jogo };
}

test('init: ouve os sinais, chama init e depois gameLoadingStart; sdkPronto no fim', async () => {
  const { p, falsa } = montar();
  const pr = p.init();
  assert.equal(p.init(), pr, 'init uma vez so');
  await pr;
  assert.equal(p.sdkPronto, true);
  assert.deepEqual(falsa.nomes(), ['on', 'on', 'on', 'on', 'init', 'gameLoadingStart']);
});

test('loading uma vez; gameplayStart antes do loading manda o loading antes; start/stop idempotentes', async () => {
  const { p, falsa } = montar();
  await p.init();
  p.gameplayStart();
  p.gameplayStart();
  p.gameLoadingFinished();
  p.gameplayStop();
  p.gameplayStop();
  assert.deepEqual(falsa.nomes().slice(6), ['gameLoadingFinished', 'gameplayStart', 'gameplayStop']);
});

test('commercialBreak: gameplayStop antes, onStart como funcao, mudo so no onStart, som e retomada no fim', async () => {
  const { p, falsa, jogo } = montar();
  await p.init();
  p.gameLoadingFinished();
  assert.equal(await p.commercialBreak(), false, 'antes do primeiro gameplay nao pede');
  p.gameplayStart();
  const pedido = p.commercialBreak();
  await esvaziar();
  assert.deepEqual(falsa.log.slice(-2), [['gameplayStop'], ['commercialBreak', 'function']]);
  assert.equal(p.emAnuncio, true);
  assert.deepEqual(jogo, [], 'sem onStart nao muta');
  p.gameplayStart(); // nada durante o anuncio
  falsa.terminar();
  assert.equal(await pedido, true);
  assert.deepEqual(jogo, ['mudo', 'som']);
  assert.equal(p.emAnuncio, false);
  assert.equal(falsa.nomes().filter((n) => n === 'gameplayStart').length, 1, 'o start pedido no anuncio nao foi');
  p.gameplayStart();
  assert.equal(falsa.nomes().at(-1), 'gameplayStart');
});

test('intervalo nao exibido (o portal responde na hora): sem mudo nenhum', async () => {
  const relogio = criarRelogioFalso();
  const falsa = criarSdkFalsa({ exibir: false });
  const p = criarPlataforma({ obterSdk: () => falsa.sdk, agendar: relogio.agendar, cancelar: relogio.cancelar });
  const jogo = [];
  p.onAdStart = () => jogo.push('mudo');
  p.onAdEnd = () => jogo.push('som');
  await p.init();
  p.gameplayStart();
  const pedido = p.commercialBreak();
  falsa.terminar();
  await pedido;
  assert.deepEqual(jogo, []);
});

test('rewardedBreak sempre na forma de objeto { size, onStart }; premio so com true', async () => {
  const { p, falsa } = montar();
  await p.init();
  p.gameplayStart();
  const r1 = p.rewardedBreak();
  falsa.terminar();
  assert.equal(await r1, true);
  assert.deepEqual(falsa.log.find((l) => l[0] === 'rewardedBreak'), ['rewardedBreak', 'medium', 'function']);
  const r2 = p.rewardedBreak('small');
  await esvaziar();
  assert.deepEqual(falsa.log.at(-1), ['rewardedBreak', 'small', 'function']);
  falsa.terminar();
  assert.equal(await r2, true);

  const m = montar({ recompensa: false });
  await m.p.init();
  const r3 = m.p.rewardedBreak();
  m.falsa.terminar();
  assert.equal(await r3, false);
});

test('pause/resume idempotentes: onPausa uma vez, gameplay parado do lado da SDK e acertado na volta', async () => {
  const { p, falsa, jogo } = montar();
  await p.init();
  p.gameplayStart();
  falsa.sinal('pause');
  falsa.sinal('pause');
  assert.equal(p.pausado, true);
  assert.deepEqual(jogo, ['pausa']);
  assert.equal(falsa.nomes().at(-1), 'gameplayStop');
  falsa.sinal('resume');
  falsa.sinal('resume');
  assert.deepEqual(jogo, ['pausa', 'volta']);
  assert.equal(falsa.nomes().at(-1), 'gameplayStart', 'o jogo estava jogando: volta a contar');
  // pausado no menu: o resume nao manda gameplayStart
  p.gameplayStop();
  falsa.sinal('pause');
  falsa.sinal('resume');
  assert.equal(falsa.nomes().at(-1), 'gameplayStop');
});

test('mute do portal soma com o do anuncio: o som so volta sem nenhum motivo', async () => {
  const { p, falsa, jogo } = montar();
  await p.init();
  p.gameplayStart();
  falsa.sinal('mute');
  falsa.sinal('mute');
  assert.deepEqual(jogo, ['mudo']);
  assert.equal(p.mudoDoPortal, true);
  const pedido = p.commercialBreak();
  falsa.terminar();
  await pedido;
  assert.deepEqual(jogo, ['mudo'], 'o fim do anuncio nao devolve o som que o portal calou');
  falsa.sinal('unmute');
  falsa.sinal('unmute');
  assert.deepEqual(jogo, ['mudo', 'som']);
  // a ordem do portal num intervalo: onStart, mute, (anuncio), unmute, resposta. O som volta so na resposta.
  p.gameplayStart();
  const outro = p.commercialBreak();
  await esvaziar();
  falsa.comecar();
  falsa.sinal('mute');
  assert.deepEqual(jogo.slice(2), ['mudo']);
  falsa.sinal('unmute');
  assert.deepEqual(jogo.slice(2), ['mudo'], 'o unmute no meio do anuncio nao devolve o som');
  falsa.terminar();
  await outro;
  assert.deepEqual(jogo.slice(2), ['mudo', 'som']);
});

test('idioma, bloqueador, measure e captureError passam para a SDK', async () => {
  const { p, falsa } = montar({ idioma: 'es', adblock: true });
  assert.equal(p.idioma, 'es');
  assert.equal(p.anunciosBloqueados, true);
  assert.equal(p.portal, 'californiagames');
  assert.equal(p.semRitmoProprio, true);
  assert.equal('movePill' in p, false, 'sem pilula no portal');
  await p.init();
  p.measure('level', '3', 'start');
  p.measure('tutorial', undefined, 'skip');
  p.capturarErro(new Error('quebrou'));
  assert.deepEqual(falsa.log.slice(-3), [['measure', 'level', '3', 'start'], ['measure', 'tutorial', undefined, 'skip'], ['captureError', 'quebrou']]);
});

test('sem SDK: tudo vira no-op, idioma null, nenhuma promessa rejeita', async () => {
  const relogio = criarRelogioFalso();
  const p = criarPlataforma({ obterSdk: () => undefined, agendar: relogio.agendar, cancelar: relogio.cancelar });
  await p.init();
  assert.equal(p.sdkPronto, false);
  assert.equal(p.idioma, null);
  assert.equal(p.anunciosBloqueados, false);
  p.gameLoadingFinished();
  p.gameplayStart();
  assert.equal(await p.commercialBreak(), false);
  assert.equal(await p.rewardedBreak(), false);
  p.measure('a', 'b', 'c');
  p.capturarErro(new Error('x'));
});

test('SDK que nunca responde ao intervalo: o prazo devolve o jogo', async () => {
  const relogio = criarRelogioFalso();
  const falsa = criarSdkFalsa();
  const p = criarPlataforma({ obterSdk: () => falsa.sdk, agendar: relogio.agendar, cancelar: relogio.cancelar, prazos: { intervalo: 1000 } });
  await p.init();
  p.gameplayStart();
  let fim = false;
  const r = p.rewardedBreak().then((v) => { fim = true; return v; });
  await esvaziar();
  assert.equal(fim, false);
  relogio.avancar(1000);
  assert.equal(await r, false);
  assert.equal(p.emAnuncio, false);
});

// ------------------------------------------------------------------ empacotador

/** @param {string} d @returns {string[]} */
const listar = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});

test('empacotar --alvo=californiagames: SDK do portal no head, adaptador no lugar do wrapper, nada da Poki', () => {
  const saida = mkdtempSync(join(tmpdir(), 'cg-colortrain-'));
  try {
    execFileSync('node', ['tools/empacotar.mjs', '--alvo=californiagames', `--saida=${saida}`], { cwd: raiz, encoding: 'utf8' });
    const versao = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).version;
    const zip = join(saida, `color-train-californiagames-${versao}.zip`);
    assert.ok(existsSync(zip));
    assert.ok(existsSync(join(saida, `color-train-californiagames-${versao}.sha256`)));
    const lista = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(lista.includes('index.html'));
    assert.ok(lista.includes('src/core/plataforma.js'));
    assert.ok(!lista.includes('src/core/poki.js'));
    assert.ok(!lista.some((n) => /plataforma-sdk|\.map$|\.DS_Store/.test(n)));
    const dist = join(raiz, 'dist-californiagames');
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const head = html.split('</head>')[0];
    assert.match(head, /<script src="\/sdk\/v1\/plataforma-sdk\.js"><\/script>/);
    assert.doesNotMatch(html, /poki/i);
    assert.match(readFileSync(join(dist, 'src/main.js'), 'utf8'), /from '\.\/core\/plataforma\.js';/);
    for (const p of listar(dist).filter((x) => /\.(html|js|css)$/.test(x))) {
      const t = readFileSync(p, 'utf8');
      assert.ok(!/https?:\/\//.test(t), `URL externa em ${relative(dist, p)}`);
      assert.ok(!/from\s+['"][^'"]*poki\.js['"]|import\(\s*['"][^'"]*poki\.js/.test(t), `${relative(dist, p)} importa o poki.js`);
    }
  } finally {
    rmSync(saida, { recursive: true, force: true });
  }
});
