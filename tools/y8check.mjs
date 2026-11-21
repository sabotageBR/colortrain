// Prova da build da Y8 no Chrome headless em tempo real (CDP, tools/cdp.mjs), nos dois cenarios do SDK:
//  a) bloqueado (--host-resolver-rules=MAP cdn.y8.com 127.0.0.1:9: o script falha e o onerror avisa a janela):
//     o jogo carrega em menos de 3 s, sem botoes de video, um clique comeca a jogar, nenhum erro de JS
//     no console e nenhum pedido fora da origem do jogo alem do SDK;
//  a2) o script fica preso 1 s e falha (Fetch.failRequest), com o init ja esperando: o y8sdk.falhou do
//     onerror (window.dispatchEvent) tem que chegar a janela e tirar os botoes de video na hora;
//  b) SDK falso: o Chrome entrega um y8.min.js falso no lugar do CDN (Fetch.fulfillRequest), com
//     window.y8.sdk() -> init, getPlatformLocale ('es') e showAd, que emite y8sdk.ready. Confere: init
//     com os ids de package.json ("portais.y8"); idioma do portal; premiado so com adViewed; perder o foco
//     abre a pausa (relogio parado) e o toque retoma; intersticial so depois do clique no botao de seguir,
//     nunca sozinho, e um so dentro de 3 min; jogo pausado e mudo so no beforeAd e de volta no fim.
// Testa o zip que vai para a Y8: descompacta em .tmp/y8check/ e serve pela origem
// http://colortrain.test:<porta>/ (fora do localhost o jogo se comporta como no portal: sem premio local
// nem parametros de URL). Os ganchos de teste (window.__ct) ligam pelo window.__colortrainTeste, como
// no tools/sdkcheck.html. Prints em .tmp/y8check-prints/.
// Uso: node tools/y8check.mjs [caminho do zip]   (padrao: o zip da versao atual na distribuicao)
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { abrirChrome, espera } from './cdp.mjs';
import { RAIZ, servir } from './servir.mjs';

const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const IDS = pacote.portais.y8;
const zip = process.argv[2] || join(RAIZ, '..', 'distribuicao', 'colortrain', 'y8', 'build', `colortrain-y8-${pacote.version}.zip`);
const SDK_Y8 = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
const HOST = 'colortrain.test';

if (!existsSync(zip)) {
  process.stdout.write(`zip nao encontrado: ${zip} (rode node tools/empacotar.mjs --alvo=y8)\n`);
  process.exit(1);
}
const pasta = join(RAIZ, '.tmp', 'y8check');
const prints = join(RAIZ, '.tmp', 'y8check-prints');
rmSync(pasta, { recursive: true, force: true });
mkdirSync(pasta, { recursive: true });
mkdirSync(prints, { recursive: true });
const u = spawnSync('unzip', ['-q', zip, '-d', pasta], { encoding: 'utf8' });
if (u.status !== 0) {
  process.stdout.write(`unzip falhou: ${u.stderr}\n`);
  process.exit(1);
}

/** Porta livre no 127.0.0.1. @returns {Promise<number>} */
function portaLivre() {
  return new Promise((ok, falha) => {
    const s = createServer();
    s.once('error', falha);
    s.listen(0, '127.0.0.1', () => {
      const p = /** @type {any} */ (s.address()).port;
      s.close(() => ok(p));
    });
  });
}

/** @type {string[]} */
const falhas = [];
/** @param {boolean} ok @param {string} msg */
const conferir = (ok, msg) => { if (!ok) falhas.push(msg); return ok; };
/** @type {string[]} */
const relato = [];

// a tag do SDK no zip: async, e o onerror avisa a JANELA (no onerror inline, dispatchEvent sozinho e o do <script>)
const TAG_ESPERADA = `<script src="${SDK_Y8}" async onerror="window.__sdkFalhou=1;window.dispatchEvent(new Event('y8sdk.falhou'))"></script>`;
conferir(readFileSync(join(pasta, 'index.html'), 'utf8').split('</head>')[0].includes(TAG_ESPERADA), 'a tag do SDK no <head> do zip nao e a esperada (async, onerror com window.dispatchEvent)');

const porta = await portaLivre();
const fechar = await servir(porta);
const ORIGEM = `http://${HOST}:${porta}`;
const URL_JOGO = `${ORIGEM}/.tmp/y8check/index.html`;

/** Antes de qualquer script da pagina: ganchos de teste e registro do ultimo clique (fase de captura). */
const ganchos = (teste) => `
window.__colortrainTeste = ${JSON.stringify(teste)};
window.__ultimoClique = null;
window.__cliques = [];
addEventListener('click', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('button') : null;
  window.__ultimoClique = { t: Math.round(performance.now()), id: b ? b.id : (e.target && (e.target.id || e.target.tagName)) || '' };
  window.__cliques.push(window.__ultimoClique);
}, true);`;

/** SDK da Y8 falso, entregue no lugar do y8.min.js: registra cada chamada com o estado do jogo. */
const SDK_FALSO = `(() => {
  const log = (window.__y8log = []);
  const L = (...x) => log.push([Math.round(performance.now()), ...x]);
  const estado = () => {
    const ct = window.__ct;
    return { pausado: !!(ct && ct.pausado), calado: !!(ct && ct.audio.calado), clique: window.__ultimoClique, nivel: ct ? ct.J.nivel : 0 };
  };
  const sdk = {
    init(a, b) { L('init', a, b); },
    getPlatformLocale() { L('getPlatformLocale'); return Promise.resolve('es'); },
    showAd(p) {
      L('showAd', p.type, estado());
      setTimeout(() => {
        if (p.beforeAd) p.beforeAd();
        L('beforeAd', p.type, estado());
        const viu = window.__y8viu !== false;
        if (p.type === 'reward' && p.beforeReward) {
          p.beforeReward(() => {
            if (viu) { if (p.adViewed) p.adViewed(); } else if (p.adDismissed) p.adDismissed();
          });
        }
        setTimeout(() => {
          if (p.afterAd) p.afterAd();
          L('afterAd', p.type, estado());
          if (p.adBreakDone) p.adBreakDone({ breakType: p.type, breakStatus: viu ? 'viewed' : 'dismissed' });
          setTimeout(() => L('fim', p.type, estado()), 0);
        }, 700);
      }, 60);
    },
  };
  window.y8 = { sdk: () => sdk, emitReadyEvent: () => dispatchEvent(new Event('y8sdk.ready')) };
  dispatchEvent(new Event('y8sdk.ready'));
})();`;

/**
 * Espera a condicao (expressao no jogo) ficar verdadeira.
 * @param {any} c @param {string} expr @param {number} ms
 * @returns {Promise<boolean>}
 */
async function ate(c, expr, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      if (await c.avaliar(`!!(${expr})`)) return true;
    } catch { /* ainda carregando */ }
    await espera(50);
  }
  return false;
}

/** Centro do trilho i na tela (o mesmo ponto do tools/sdkcheck.html). */
const pontoTrilho = (c, i) => c.avaliar(`(() => { const l = __ct.cena.layout; return [l.xVaga(${i}, 1), l.trilhos[${i}].yb - l.L * 0.3]; })()`);
/** Centro de um elemento visivel. */
const centro = (c, id) => c.avaliar(`(() => { const r = document.getElementById('${id}').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
/**
 * Erros do console (rede e outros). O /favicon.ico da raiz do servidor de teste fica de fora: e o
 * navegador pedindo o icone da aba, nao o jogo (no iframe da Y8 isso nem acontece).
 */
const errosDoConsole = (c) => c.console.filter((e) => e.nivel === 'error' && !/^http:\/\/[^/]+\/favicon\.ico$/.test(e.url));
/** Pedidos de rede fora da origem do jogo e do SDK. */
const foraDaOrigem = (c) => c.rede.filter((x) => !x.startsWith(ORIGEM + '/') && x !== SDK_Y8 && !x.startsWith('data:'));

async function salvarPrint(c, nome) {
  writeFileSync(join(prints, `${nome}.png`), await c.print());
}

// ------------------------------------------------------------------ a) SDK bloqueado
{
  const c = await abrirChrome({
    largura: 390, altura: 844,
    args: [`--host-resolver-rules=MAP cdn.y8.com 127.0.0.1:9, MAP ${HOST} 127.0.0.1`],
    antes: ganchos({ nivel: 0 }),
  });
  try {
    await c.ir(URL_JOGO, 0);
    const carregou = await ate(c, "window.__ct && __ct.J.fase === 'jogando'", 10000);
    const ms = carregou ? await c.avaliar('Math.round(performance.now())') : -1;
    conferir(carregou && ms < 3000, `a) o jogo nao ficou jogavel em 3 s (${ms} ms)`);
    const semVideo = await ate(c, "document.body.classList.contains('sem-anuncio')", 3000);
    conferir(semVideo, 'a) sem SDK os botoes de video deviam sumir');
    const msSemVideo = await c.avaliar('Math.round(performance.now())');
    conferir(await c.avaliar('window.__sdkFalhou === 1'), 'a) o onerror da tag do SDK nao marcou __sdkFalhou');
    // um clique comeca a jogar: a jogada guiada do nivel 1 (toque no trilho de origem e no de destino)
    const [a, b] = await c.avaliar('__ct.J.guia[0]');
    const [xa, ya] = await pontoTrilho(c, a);
    await c.clicar(xa, ya);
    await espera(250);
    const [xb, yb] = await pontoTrilho(c, b);
    await c.clicar(xb, yb);
    const jogou = await ate(c, '__ct.J.hist.length === 1', 3000);
    conferir(jogou, 'a) o clique nao fez a jogada');
    await espera(800);
    await salvarPrint(c, 'a-bloqueado');
    conferir(c.erros.length === 0, `a) erro de JS no console: ${c.erros.join(' | ')}`);
    const erros = errosDoConsole(c);
    const outrosConsole = erros.filter((e) => !String(e.url).startsWith('https://cdn.y8.com/'));
    conferir(outrosConsole.length === 0, `a) erro no console: ${outrosConsole.map((e) => `${e.texto} (${e.url})`).join(' | ')}`);
    const fora = foraDaOrigem(c);
    conferir(fora.length === 0, `a) pedido externo: ${fora.join(', ')}`);
    const doSdk = erros.map((e) => `${e.texto} (${e.url})`);
    relato.push(`a) bloqueado: jogavel em ${ms} ms; botoes de video somem em ${msSemVideo} ms; clique jogou: ${jogou}; erros de JS: ${c.erros.length}; console: ${doSdk.length ? doSdk.join(' | ') : 'nada'}; pedidos externos alem do SDK: ${fora.length}`);
  } finally {
    await c.fechar();
  }
}

// ------------------------------------------------------------------ a2) SDK que falha depois do init
// O script fica preso 1 s e entao falha (Fetch.failRequest): o init ja esta esperando, e so o evento
// y8sdk.falhou (onerror -> window.dispatchEvent) solta o jogo. Se ele nao chegasse a janela, os botoes de
// video so sumiriam no prazo do init (4 s).
{
  const c = await abrirChrome({
    largura: 390, altura: 844,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
    antes: ganchos({ nivel: 0 }),
  });
  /** @type {{ ms: number, semVideoAntes: boolean }|null} */
  let falha = null;
  c.ouvir('Fetch.requestPaused', (p) => {
    setTimeout(async () => {
      const ms = await c.avaliar('Math.round(performance.now())');
      const semVideoAntes = await c.avaliar("document.body.classList.contains('sem-anuncio')");
      falha = { ms, semVideoAntes };
      c.cmd('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' });
    }, 1000);
  });
  await c.cmd('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.y8.com/*', requestStage: 'Request' }] });
  try {
    await c.ir(URL_JOGO, 0);
    const carregou = await ate(c, "window.__ct && __ct.J.fase === 'jogando'", 10000);
    const ms = carregou ? await c.avaliar('Math.round(performance.now())') : -1;
    conferir(carregou && ms < 3000, `a2) o jogo nao ficou jogavel em 3 s (${ms} ms)`);
    const semVideo = await ate(c, "document.body.classList.contains('sem-anuncio')", 6000);
    const msSemVideo = await c.avaliar('Math.round(performance.now())');
    const f = /** @type {any} */ (falha);
    conferir(!!f && !f.semVideoAntes, 'a2) o init nao estava esperando quando o script falhou');
    conferir(semVideo && !!f && msSemVideo - f.ms < 1000, `a2) o y8sdk.falhou nao chegou a janela: botoes sumiram ${f ? msSemVideo - f.ms : '?'} ms depois da falha`);
    conferir(await c.avaliar('window.__sdkFalhou === 1'), 'a2) o onerror da tag do SDK nao marcou __sdkFalhou');
    conferir(c.erros.length === 0, `a2) erro de JS no console: ${c.erros.join(' | ')}`);
    const outros = errosDoConsole(c).filter((e) => !String(e.url).startsWith('https://cdn.y8.com/'));
    conferir(outros.length === 0, `a2) erro no console: ${outros.map((e) => `${e.texto} (${e.url})`).join(' | ')}`);
    relato.push(`a2) falha depois do init: jogavel em ${ms} ms; script falhou em ${f ? f.ms : '?'} ms (botoes ainda na tela: ${f ? !f.semVideoAntes : '?'}); botoes de video somem ${f ? msSemVideo - f.ms : '?'} ms depois da falha (sem o evento seria no prazo de 4 s); erros de JS: ${c.erros.length}`);
  } finally {
    await c.fechar();
  }
}

// ------------------------------------------------------------------ b) SDK falso
{
  const c = await abrirChrome({
    largura: 390, altura: 844,
    args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
    antes: ganchos({ nivel: 4, fixo: true, intervaloMs: 5000 }),
  });
  c.ouvir('Fetch.requestPaused', (p) => {
    c.cmd('Fetch.fulfillRequest', {
      requestId: p.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'text/javascript; charset=utf-8' }],
      body: Buffer.from(SDK_FALSO).toString('base64'),
    });
  });
  await c.cmd('Fetch.enable', { patterns: [{ urlPattern: 'https://cdn.y8.com/*', requestStage: 'Request' }] });
  try {
    await c.ir(URL_JOGO, 0);
    conferir(await ate(c, "window.__ct && __ct.J.fase === 'jogando'", 10000), 'b) o jogo nao subiu');
    conferir(await ate(c, "window.__y8log && __y8log.some((l) => l[1] === 'init')", 5000), 'b) init nao chamado');
    const log = () => c.avaliar('__y8log');
    const init = (await log()).find((l) => l[1] === 'init');
    conferir(init && init[2].appId === IDS.appId && init[3] && init[3].gameId === IDS.gameId, `b) init sem os ids: ${JSON.stringify(init && init.slice(2))}`);
    conferir(await ate(c, "document.documentElement.lang === 'es' && document.getElementById('placaRotulo').textContent === 'Nivel'", 3000), 'b) o idioma do portal (es) nao chegou na placa');
    conferir(await c.avaliar("!document.body.classList.contains('sem-anuncio')"), 'b) com SDK os botoes de video deviam aparecer');
    conferir(!(await log()).some((l) => l[1] === 'showAd'), 'b) anuncio pedido antes de qualquer clique');
    await salvarPrint(c, 'b-carregou-es');

    // primeiro toque no patio (comeca a contar o tempo do primeiro intervalo)
    const [x0, y0] = await pontoTrilho(c, 0);
    await c.clicar(x0, y0);
    await espera(200);
    await c.clicar(x0, y0);
    await espera(200);

    // premiado: fechado sem ver nao premia; visto premia; pausa e mudo so no beforeAd
    await c.avaliar('window.__y8viu = false');
    const [xd, yd] = await centro(c, 'bDica');
    await c.clicar(xd, yd);
    conferir(await ate(c, "__y8log.some((l) => l[1] === 'fim' && l[2] === 'reward')", 4000), 'b) premiado nao terminou');
    await espera(200);
    conferir(await c.avaliar("!(__ct.J.mao && __ct.J.mao.origem === 'dica')"), 'b) premio dado sem adViewed');
    await c.avaliar('window.__y8viu = true');
    await c.clicar(xd, yd);
    conferir(await ate(c, "__y8log.filter((l) => l[1] === 'fim' && l[2] === 'reward').length === 2", 4000), 'b) segundo premiado nao terminou');
    await espera(200);
    conferir(await c.avaliar("!!(__ct.J.mao && __ct.J.mao.origem === 'dica')"), 'b) premio negado com adViewed');
    const rw = (await log()).filter((l) => l[2] === 'reward');
    const rwShow = rw.filter((l) => l[1] === 'showAd');
    const rwBefore = rw.filter((l) => l[1] === 'beforeAd');
    const rwFim = rw.filter((l) => l[1] === 'fim');
    conferir(rwShow.every((l) => !l[3].pausado && !l[3].calado), 'b) premiado: o jogo pausou ou calou antes do beforeAd');
    conferir(rwShow.every((l) => l[3].clique && l[3].clique.id === 'bDica'), 'b) premiado sem clique no botao de dica');
    conferir(rwBefore.every((l) => l[3].pausado && l[3].calado), 'b) premiado: o jogo nao pausou e calou no beforeAd');
    conferir(rwFim.every((l) => !l[3].pausado && !l[3].calado), 'b) premiado: o jogo nao voltou no fim do break');
    relato.push(`b) premiado: 2 pedidos (clique em bDica); fechado sem ver -> sem premio; visto -> dica; no showAd pausado/calado = ${rwShow.map((l) => `${l[3].pausado}/${l[3].calado}`).join(', ')}; no beforeAd = ${rwBefore.map((l) => `${l[3].pausado}/${l[3].calado}`).join(', ')}; no fim = ${rwFim.map((l) => `${l[3].pausado}/${l[3].calado}`).join(', ')}`);

    // foco: blur abre a pausa, o relogio para, o som cala; o toque na tela de pausa retoma
    await c.avaliar("window.dispatchEvent(new Event('blur'))");
    await espera(100);
    const naPausa = await c.avaliar("({ tela: !document.getElementById('pausa').hidden, pausado: __ct.pausado, calado: __ct.audio.calado, t: __ct.agora() })");
    await espera(600);
    const tDepois = await c.avaliar('__ct.agora()');
    conferir(naPausa.tela && naPausa.pausado && naPausa.calado, `b) blur nao abriu a pausa: ${JSON.stringify(naPausa)}`);
    conferir(Math.abs(tDepois - naPausa.t) < 1, 'b) o relogio do jogo andou na pausa');
    await salvarPrint(c, 'b-pausa-foco');
    const [xp, yp] = await centro(c, 'bRetomar');
    await c.clicar(xp, yp);
    await espera(150);
    const voltou = await c.avaliar("({ tela: !document.getElementById('pausa').hidden, pausado: __ct.pausado, calado: __ct.audio.calado })");
    conferir(!voltou.tela && !voltou.pausado && !voltou.calado, `b) o toque nao retomou: ${JSON.stringify(voltou)}`);
    relato.push(`b) foco: blur -> tela de pausa ${naPausa.tela}, pausado ${naPausa.pausado}, mudo ${naPausa.calado}, relogio parado ${Math.abs(tDepois - naPausa.t) < 1}; toque -> retomou ${!voltou.pausado}`);

    // intersticial: o jogo resolve sozinho; na troca de nivel o botao de seguir aparece e o anuncio espera o clique
    const nivel0 = await c.avaliar('__ct.J.nivel');
    await c.avaliar('__ct.auto(150)');
    const apareceu = await ate(c, "!document.getElementById('bSeguir').hidden", 45000);
    conferir(apareceu, 'b) o botao de seguir nao apareceu na troca de nivel');
    const nextAntes = (await log()).filter((l) => l[1] === 'showAd' && l[2] === 'next').length;
    conferir(nextAntes === 0, 'b) intersticial pedido antes do clique no botao');
    await espera(2500);
    const aindaSemNext = (await log()).filter((l) => l[1] === 'showAd' && l[2] === 'next').length === 0;
    conferir(aindaSemNext, 'b) intersticial pedido sozinho, sem clique');
    const nivelBotao = await c.avaliar("({ nivel: __ct.J.nivel, fase: __ct.J.fase, rotulo: document.getElementById('seguirN').textContent })");
    await salvarPrint(c, 'b-botao-seguir');
    const [xs, ys] = await centro(c, 'bSeguir');
    await c.clicar(xs, ys);
    conferir(await ate(c, "__y8log.some((l) => l[1] === 'fim' && l[2] === 'next')", 4000), 'b) intersticial nao terminou');
    const nx = (await log()).filter((l) => l[2] === 'next');
    const nxShow = nx.find((l) => l[1] === 'showAd');
    const nxBefore = nx.find((l) => l[1] === 'beforeAd');
    const nxFim = nx.find((l) => l[1] === 'fim');
    const dtClique = nxShow && nxShow[3].clique ? nxShow[0] - nxShow[3].clique.t : -1;
    conferir(nxShow && nxShow[3].clique && nxShow[3].clique.id === 'bSeguir' && dtClique >= 0 && dtClique < 500, `b) intersticial sem clique no botao logo antes: ${JSON.stringify(nxShow)}`);
    conferir(nxShow && !nxShow[3].pausado && !nxShow[3].calado, 'b) intersticial: o jogo pausou ou calou antes do beforeAd');
    conferir(nxBefore && nxBefore[3].pausado && nxBefore[3].calado, 'b) intersticial: o jogo nao pausou e calou no beforeAd');
    conferir(nxFim && !nxFim[3].pausado && !nxFim[3].calado, 'b) intersticial: o jogo nao voltou depois do afterAd');
    conferir(await ate(c, `__ct.J.nivel === ${nivelBotao.nivel} && __ct.J.fase === 'jogando'`, 5000), 'b) o nivel seguinte nao comecou depois do intersticial');
    relato.push(`b) intersticial: botao de seguir apareceu na troca do nivel ${nivelBotao.nivel - 1} para o ${nivelBotao.nivel} (rotulo "${nivelBotao.rotulo}", fase ${nivelBotao.fase}); 2,5 s parado sem pedido; showAd('next') ${dtClique} ms depois do clique em ${nxShow && nxShow[3].clique.id}; pausado/mudo no showAd ${nxShow && nxShow[3].pausado}/${nxShow && nxShow[3].calado}, no beforeAd ${nxBefore && nxBefore[3].pausado}/${nxBefore && nxBefore[3].calado}, no fim ${nxFim && nxFim[3].pausado}/${nxFim && nxFim[3].calado}`);

    // mais niveis dentro de 3 min: nenhum outro botao nem intersticial
    const nivel1 = await c.avaliar('__ct.J.nivel');
    let botaoDeNovo = false;
    const fimJanela = Date.now() + 25000;
    while (Date.now() < fimJanela) {
      if (await c.avaliar("!document.getElementById('bSeguir').hidden")) botaoDeNovo = true;
      await espera(200);
    }
    const nivel2 = await c.avaliar('__ct.J.nivel');
    const nexts = (await log()).filter((l) => l[1] === 'showAd' && l[2] === 'next').length;
    conferir(nivel2 >= nivel1 + 2, `b) o jogo nao avancou depois do anuncio (nivel ${nivel1} -> ${nivel2})`);
    conferir(!botaoDeNovo && nexts === 1, `b) outro intersticial antes de 3 min (${nexts} pedidos)`);
    relato.push(`b) cooldown: do nivel ${nivel0} ao ${nivel2}, ${nexts} intersticial; sem botao de seguir nos niveis ${nivel1} a ${nivel2} (menos de 3 min)`);

    conferir(c.erros.length === 0, `b) erro de JS no console: ${c.erros.join(' | ')}`);
    const errosConsole = errosDoConsole(c);
    conferir(errosConsole.length === 0, `b) erro no console: ${errosConsole.map((e) => `${e.texto} (${e.url})`).join(' | ')}`);
    const fora = foraDaOrigem(c);
    conferir(fora.length === 0, `b) pedido externo: ${fora.join(', ')}`);
    relato.push(`b) init ${JSON.stringify(init.slice(2))}; idioma es ("Nivel"); erros no console: ${c.erros.length + errosConsole.length}; pedidos externos alem do SDK: ${fora.length}`);
  } finally {
    await c.fechar();
  }
}

await fechar();
rmSync(pasta, { recursive: true, force: true });
for (const r of relato) process.stdout.write(r + '\n');
process.stdout.write(falhas.length ? `FALHOU:\n  ${falhas.join('\n  ')}\n` : `y8check passou (${zip})\n`);
process.exit(falhas.length ? 1 : 0);
