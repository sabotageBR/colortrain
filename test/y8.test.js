// Adaptador da Y8 (portais/y8.js, sobre portais/fila-sdk.js) com um SDK falso, e o alvo y8 do
// empacotador (a build sai so com o SDK da Y8, os ids do painel gravados e nada da Poki).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { criarPortalY8 } from '../portais/y8.js';
import { criarRelogioFalso, esvaziar } from './apoio/relogio-falso.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const IDS = { appId: 'app-1', gameId: 'jogo-1' };

/** Janela falsa: guarda os ouvintes e deixa o teste disparar eventos. */
function criarJanela(extra = {}) {
  /** @type {Record<string, ((...a: any[]) => void)[]>} */
  const ouvintes = {};
  /** @type {Record<string, any>} as opcoes de cada addEventListener */
  const opcoes = {};
  return {
    ...extra,
    opcoes,
    addEventListener: (/** @type {string} */ ev, /** @type {any} */ fn, /** @type {any} */ o) => { (ouvintes[ev] ||= []).push(fn); opcoes[ev] = o; },
    /** @param {string} ev */
    disparar(ev) {
      const lista = ouvintes[ev] || [];
      ouvintes[ev] = [];
      for (const fn of lista) fn();
    },
  };
}

/**
 * SDK da Y8 falso. showAd guarda o pedido; o teste conduz os callbacks (beforeAd, afterAd...).
 * @param {{ idioma?: string }} [o]
 */
function criarY8Falso({ idioma = 'es' } = {}) {
  /** @type {any[][]} */
  const log = [];
  /** @type {any[]} */
  const pedidos = [];
  const janela = criarJanela();
  const sdkObj = {
    init: (/** @type {any} */ a, /** @type {any} */ b) => log.push(['init', a, b]),
    getPlatformLocale: () => Promise.resolve(idioma),
    showAd: (/** @type {any} */ p) => { log.push(['showAd', p.type]); pedidos.push(p); },
  };
  const y8 = { sdk: () => sdkObj, emitReadyEvent: () => janela.disparar('y8sdk.ready') };
  return {
    log, pedidos, janela, y8,
    /** O anuncio do pedido mais antigo entra, passa e termina (premiado: visto ou fechado). */
    exibir(viu = true) {
      const p = pedidos.shift();
      p.beforeAd();
      if (p.type === 'reward') p.beforeReward(() => (viu ? p.adViewed() : p.adDismissed()));
      p.afterAd();
      p.adBreakDone({ breakStatus: viu ? 'viewed' : 'dismissed' });
    },
    /** Break pulado (limite de frequencia): so o adBreakDone, sem beforeAd nem afterAd. */
    pular() {
      pedidos.shift().adBreakDone({ breakStatus: 'frequencyCapped' });
    },
  };
}

function montar(opcoes) {
  const relogio = criarRelogioFalso();
  const f = criarY8Falso(opcoes);
  const p = criarPortalY8({ obterSdk: () => f.y8, ids: IDS, janela: f.janela, agendar: relogio.agendar, cancelar: relogio.cancelar });
  /** @type {string[]} */
  const jogo = [];
  p.onAdStart = () => jogo.push('cala+pausa');
  p.onAdEnd = () => jogo.push('volta');
  return { p, f, relogio, jogo };
}

test('y8: sem appId o SDK nem inicia e nao ha video', async () => {
  const f = criarY8Falso();
  const p = criarPortalY8({ obterSdk: () => f.y8, ids: {}, janela: f.janela });
  await p.init();
  assert.equal(p.sdkPronto, false);
  assert.equal(p.temVideo, false);
  assert.equal(f.log.length, 0);
});

test('y8: script do SDK bloqueado (onerror da tag) segue na hora, sem video e sem intervalo', async () => {
  const ja = criarPortalY8({ obterSdk: () => undefined, ids: IDS, janela: criarJanela({ __sdkFalhou: 1 }) });
  const t0 = Date.now();
  await ja.init();
  assert.ok(Date.now() - t0 < 500, 'o init nao esperou o prazo');
  assert.equal(ja.sdkPronto, false, 'sem SDK nao ha botoes de video');
  ja.gameplayStart();
  assert.equal(await ja.commercialBreak(), false);
  assert.equal(await ja.rewardedBreak('small'), false);
  // o onerror chega depois do init: o evento y8sdk.falhou solta o init na hora
  const janela = criarJanela();
  const depois = criarPortalY8({ obterSdk: () => undefined, ids: IDS, janela });
  const t1 = Date.now();
  const pronto = depois.init();
  setTimeout(() => janela.disparar('y8sdk.falhou'), 20);
  await pronto;
  assert.ok(Date.now() - t1 < 500);
  // na fase de captura: o evento chega mesmo se for disparado no <script> e nao borbulhar
  assert.deepEqual(janela.opcoes['y8sdk.falhou'], { once: true, capture: true });
  assert.deepEqual(janela.opcoes['y8sdk.ready'], { once: true, capture: true });
  assert.equal(depois.sdkPronto, false);
  assert.equal(depois.idioma, '');
});

test('y8: init com appId e gameId, idioma do subdominio e as regras do portal ligadas', async () => {
  const { p, f } = montar({ idioma: 'pt-BR' });
  assert.equal(p.idioma, '', 'o idioma so chega com o init');
  await p.init();
  assert.equal(p.sdkPronto, true);
  assert.equal(p.temVideo, true);
  assert.deepEqual(f.log, [['init', { appId: 'app-1', autoLogin: false }, { gameId: 'jogo-1', preloadAdBreaks: 'on', sound: 'on' }]]);
  assert.equal(p.idioma, 'pt-BR');
  assert.equal(p.portal, 'y8');
  assert.equal(p.idiomaAposInit, true);
  assert.equal(p.intervaloSoNoClique, true);
  assert.equal(p.pausaNoAnuncio, true);
  assert.equal(p.pausaNoBlur, true);
});

test('y8: o SDK que chega depois do init avisa pelo y8sdk.ready', async () => {
  const relogio = criarRelogioFalso();
  const f = criarY8Falso();
  let carregou = false;
  const p = criarPortalY8({ obterSdk: () => (carregou ? f.y8 : undefined), ids: IDS, janela: f.janela, agendar: relogio.agendar, cancelar: relogio.cancelar });
  const pronto = p.init();
  await esvaziar();
  assert.equal(p.sdkPronto, false);
  carregou = true;
  f.janela.disparar('y8sdk.ready');
  await pronto;
  assert.equal(p.sdkPronto, true);
  assert.equal(f.log[0][0], 'init');
});

test('y8: intersticial "next" cala e pausa so no beforeAd e volta no afterAd; nada antes do primeiro gameplay', async () => {
  const { p, f, jogo } = montar();
  await p.init();
  assert.equal(await p.commercialBreak(), false, 'antes do primeiro gameplayStart nao pede');
  p.gameplayStart();
  const pedido = p.commercialBreak();
  await esvaziar();
  assert.deepEqual(f.log.at(-1), ['showAd', 'next']);
  assert.equal(p.emAnuncio, true);
  assert.deepEqual(jogo, [], 'pedir o anuncio nao cala nem pausa');
  const ad = f.pedidos[0];
  ad.beforeAd();
  assert.deepEqual(jogo, ['cala+pausa']);
  ad.afterAd();
  assert.equal(await pedido, true);
  assert.deepEqual(jogo, ['cala+pausa', 'volta']);
  assert.equal(p.emAnuncio, false);
  ad.adBreakDone({ breakStatus: 'viewed' });
  await esvaziar();
  assert.deepEqual(jogo, ['cala+pausa', 'volta'], 'o adBreakDone depois do afterAd nao repete');
});

test('y8: break pulado (sem beforeAd) nao cala nem pausa', async () => {
  const { p, f, jogo } = montar();
  await p.init();
  p.gameplayStart();
  const pedido = p.commercialBreak();
  await esvaziar();
  f.pular();
  assert.equal(await pedido, true);
  assert.deepEqual(jogo, []);
  assert.equal(p.emAnuncio, false);
});

test('y8: premiado so com adViewed (fechou o video: sem premio)', async () => {
  const { p, f, jogo } = montar();
  await p.init();
  const visto = p.rewardedBreak('small');
  await esvaziar();
  assert.deepEqual(f.log.at(-1), ['showAd', 'reward']);
  f.exibir(true);
  assert.equal(await visto, true);
  const fechado = p.rewardedBreak('medium');
  await esvaziar();
  f.exibir(false);
  assert.equal(await fechado, false);
  const pulado = p.rewardedBreak();
  await esvaziar();
  f.pular();
  assert.equal(await pulado, false, 'sem video nao ha premio');
  assert.deepEqual(jogo, ['cala+pausa', 'volta', 'cala+pausa', 'volta']);
});

test('y8: break que nunca termina: o prazo devolve o jogo (som e pausa)', async () => {
  const relogio = criarRelogioFalso();
  const f = criarY8Falso();
  const p = criarPortalY8({ obterSdk: () => f.y8, ids: IDS, janela: f.janela, agendar: relogio.agendar, cancelar: relogio.cancelar, prazos: { intervalo: 1000, aposInicio: 5000 } });
  const jogo = [];
  p.onAdStart = () => jogo.push('cala+pausa');
  p.onAdEnd = () => jogo.push('volta');
  await p.init();
  const r = p.rewardedBreak('small');
  await esvaziar();
  f.pedidos[0].beforeAd();
  relogio.avancar(5000);
  assert.equal(await r, false);
  assert.deepEqual(jogo, ['cala+pausa', 'volta']);
  assert.equal(p.emAnuncio, false);
});

// ------------------------------------------------------------------ empacotador

/** @param {string} d @returns {string[]} */
const listar = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});

test('empacotar --alvo=y8: SDK da Y8 no head, ids gravados, adaptador no lugar do wrapper, nenhum outro portal', () => {
  const saida = mkdtempSync(join(tmpdir(), 'y8-colortrain-'));
  try {
    execFileSync('node', ['tools/empacotar.mjs', '--alvo=y8', `--saida=${saida}`], { cwd: raiz, encoding: 'utf8' });
    const pacote = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
    const zip = join(saida, `colortrain-y8-${pacote.version}.zip`);
    assert.ok(existsSync(zip));
    assert.ok(existsSync(join(saida, `colortrain-y8-${pacote.version}.sha256`)));
    const lista = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(lista.includes('index.html'));
    assert.ok(lista.includes('src/core/plataforma.js'));
    assert.ok(lista.includes('src/core/fila-sdk.js'));
    assert.ok(!lista.includes('src/core/poki.js'));
    assert.ok(!lista.some((n) => /\.map$|\.DS_Store|__MACOSX/.test(n)));
    const dist = join(raiz, 'dist-y8');
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    const head = html.split('</head>')[0];
    assert.ok(head.includes(`<script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async onerror="window.__sdkFalhou=1;window.dispatchEvent(new Event('y8sdk.falhou'))"></script>`));
    assert.doesNotMatch(html, /poki/i);
    assert.match(readFileSync(join(dist, 'src/main.js'), 'utf8'), /import \{ portal \} from '\.\/core\/plataforma\.js';/);
    const { appId, gameId } = pacote.portais.y8;
    assert.ok(readFileSync(join(dist, 'src/core/plataforma.js'), 'utf8').includes(`export const IDS = ${JSON.stringify({ appId, gameId })};`));
    for (const p of listar(dist).filter((x) => /\.(html|js|css|txt)$/.test(x))) {
      const t = readFileSync(p, 'utf8');
      // LICENCAS.txt cita as fontes das licencas (texto, nao e pedido nem link na tela)
      if (!p.endsWith('.txt')) for (const u of t.match(/https?:\/\/[^\s"'`)<>]+/g) || []) assert.equal(u, 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js', `URL externa em ${relative(dist, p)}`);
      // nada de outro portal no zip, nem em comentario nem em nome de variavel
      assert.doesNotMatch(t, /poki|crazygames|californiagames|PlataformaSDK|plataforma-sdk/i, relative(dist, p));
    }
  } finally {
    rmSync(saida, { recursive: true, force: true });
  }
});
