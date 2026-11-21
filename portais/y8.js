// Adaptador da Y8 (docs.y8.com, SDK 2-0) com a mesma cara de src/core/poki.js, sobre o fila-sdk.js.
// Porte do adaptador do kit multiportal (jogos/distribuicao/kit/src/core/portais/y8.js, que veio de
// hexadrop/src/portais/y8.js e slime-merge/src/core/portais/y8.js).
// So existe na build da Y8: `node tools/empacotar.mjs --alvo=y8` copia este arquivo para
// src/core/plataforma.js e o fila-sdk.js para src/core/fila-sdk.js, apaga o poki.js, troca o import do
// src/main.js e grava em IDS os ids de package.json ("portais.y8": appId e gameId da aba "SDK
// Initialization" do Developer Portal). A build da Poki nao muda. Fica fora de src/ de proposito.
//
// Regras (docs.y8.com: Game Requirements e Ad Placement Guidelines):
// - o index.html leva <script src="https://cdn.y8.com/minimal-sdk/2-0/y8.min.js" async onerror=...>. O
//   SDK avisa que esta pronto pelo evento y8sdk.ready, e emitReadyEvent cobre o caso de ele ja ter chegado.
//   Se o script falhar (bloqueador de anuncio, rede), o onerror da tag marca window.__sdkFalhou e dispara
//   y8sdk.falhou com window.dispatchEvent (dentro do onerror inline, dispatchEvent sozinho seria o do
//   proprio <script>); o adaptador ouve na fase de captura. O jogo segue na hora, sem anuncios e sem
//   botoes de video;
// - pre-roll: a propria Y8 mostra, antes do jogo;
// - intersticial (showAd type 'next') SO DEPOIS DE UM CLIQUE num botao (intervaloSoNoClique): o main.js
//   mostra o botao de seguir na troca de nivel quando o anuncio pode sair e so pede depois do clique,
//   no maximo um a cada 3 min (a Y8 tambem limita a frequencia);
// - calar e pausar DENTRO do beforeAd, nunca antes (calarNoInicio falso e pausaNoAnuncio): break pulado
//   (limite de frequencia, sem anuncio) nao chama beforeAd nem afterAd e termina so no adBreakDone. O jogo
//   volta no afterAd (intersticial) ou no adBreakDone (premiado e break pulado);
// - premiado (type 'reward') so por escolha do jogador, e o premio so com adViewed;
// - idioma pelo getPlatformLocale() (subdominio da Y8), que so chega com o init (idiomaAposInit). Ate la,
//   e sem ele, o jogo fica em ingles;
// - perder o foco (blur ou aba oculta) pausa o jogo (pausaNoBlur);
// - a Y8 nao tem gameplayStart/Stop, loading nem measure: viram no-op.
import { criarFilaSdk } from './fila-sdk.js';

/** Os ids do painel da Y8 (o tools/empacotar.mjs grava os de package.json "portais.y8"). */
export const IDS = {};

/** ms ate desistir do getPlatformLocale (o jogo fica em ingles). */
const PRAZO_IDIOMA = 1500;

/**
 * @param {{ obterSdk?: () => any, ids?: Record<string, string>, janela?: any, prazos?: any, agendar?: any, cancelar?: any }} [o]
 */
export function criarPortalY8({
  obterSdk = () => /** @type {any} */ (globalThis).y8,
  ids = IDS,
  janela = typeof window !== 'undefined' ? window : null,
  prazos,
  agendar,
  cancelar,
} = {}) {
  /** @type {any} */
  let sdk = null;
  let idioma = '';
  /** @type {any} */
  let adaptador = null;

  /**
   * Pede um break da Y8 e resolve quando ele acaba (adBreakDone vem sempre).
   * @param {'next'|'reward'} tipo @param {any} aoIniciar
   * @returns {Promise<boolean>}
   */
  function pedir(tipo, aoIniciar) {
    return new Promise((resolve) => {
      const premiado = tipo === 'reward';
      let viu = false;
      let fim = false;
      /** @param {boolean} ok */
      const sai = (ok) => {
        if (fim) return;
        fim = true;
        resolve(ok);
      };
      /** @type {any} */
      const pedido = {
        type: premiado ? 'reward' : 'next',
        name: premiado ? 'reward' : 'next-level',
        beforeAd: () => { if (typeof aoIniciar === 'function') aoIniciar(); },
        afterAd: () => { if (!premiado) sai(true); },
        adBreakDone: () => sai(premiado ? viu : true),
      };
      if (premiado) {
        pedido.beforeReward = (/** @type {any} */ mostrar) => { if (typeof mostrar === 'function') mostrar(); };
        pedido.adViewed = () => { viu = true; };
        pedido.adDismissed = () => {};
      }
      try {
        Promise.resolve(sdk.showAd(pedido)).catch(() => sai(false));
      } catch {
        sai(false);
      }
    });
  }

  function criarAdaptador() {
    return {
      init: async () => {
        const y8 = await new Promise((resolve) => {
          // script do SDK bloqueado (bloqueador de anuncio, rede): o onerror da tag avisa e o jogo segue sem
          // anuncios na hora, sem esperar o prazo do init
          if (janela.__sdkFalhou) { resolve(null); return; }
          // capture: pega o evento ate se ele for disparado num elemento (o <script>) e nao borbulhar
          janela.addEventListener('y8sdk.falhou', () => resolve(null), { once: true, capture: true });
          janela.addEventListener('y8sdk.ready', () => resolve(obterSdk()), { once: true, capture: true });
          const ja = obterSdk();
          if (ja && typeof ja.emitReadyEvent === 'function') ja.emitReadyEvent();
        });
        if (!y8 || typeof y8.sdk !== 'function') throw new Error('sem SDK');
        sdk = y8.sdk();
        sdk.init({ appId: ids.appId, autoLogin: false }, ids.gameId ? { gameId: ids.gameId, preloadAdBreaks: 'on', sound: 'on' } : undefined);
        try {
          const l = await Promise.race([Promise.resolve(sdk.getPlatformLocale()), new Promise((r) => setTimeout(() => r(''), PRAZO_IDIOMA))]);
          idioma = typeof l === 'string' ? l : '';
        } catch {
          idioma = '';
        }
      },
      gameLoadingFinished: () => {},
      gameplayStart: () => {},
      gameplayStop: () => {},
      get commercialBreak() {
        return sdk && ids.gameId ? (/** @type {any} */ aoIniciar) => pedir('next', aoIniciar) : undefined;
      },
      get rewardedBreak() {
        return sdk && ids.gameId ? (/** @type {any} */ o) => pedir('reward', typeof o === 'function' ? o : o && o.onStart) : undefined;
      },
    };
  }

  const portal = criarFilaSdk({
    nome: 'y8',
    obterSdk: () => {
      if (!ids.appId || !janela) return null;
      if (!adaptador) adaptador = criarAdaptador();
      return adaptador;
    },
    prazos,
    agendar,
    cancelar,
    calarNoInicio: false,
  });
  const prontoDaFila = /** @type {PropertyDescriptor} */ (Object.getOwnPropertyDescriptor(portal, 'sdkPronto')).get;
  Object.defineProperties(portal, {
    // Para o jogo, "pronto" e o SDK da Y8 respondendo com anuncios. Sem o script (bloqueador) o init da
    // fila rejeita e ela marca pronto assim mesmo: aqui isso conta como sem SDK (sem botoes de video).
    sdkPronto: { get: () => !!(prontoDaFila && prontoDaFila.call(portal)) && !!sdk && !!ids.gameId, configurable: true },
    temAnuncios: { get: () => portal.sdkPronto, configurable: true },
    idioma: { get: () => idioma, configurable: true },
  });
  const extras = /** @type {any} */ (portal);
  /** Nome do portal (o main.js usa para as regras que mudam por portal: tamanho no premiado). */
  extras.portal = 'y8';
  /** O idioma (getPlatformLocale) so chega com o init: o jogo comeca em ingles e troca os textos depois. */
  extras.idiomaAposInit = true;
  /** O intersticial so pode sair logo depois de um clique num botao (o main.js mostra o botao antes). */
  extras.intervaloSoNoClique = true;
  /** onAdStart e onAdEnd marcam o anuncio na tela (beforeAd ate o fim do break): o jogo pausa entre eles. */
  extras.pausaNoAnuncio = true;
  /** Perder o foco (blur ou aba oculta) pausa o jogo. */
  extras.pausaNoBlur = true;
  return portal;
}

/**
 * Instancia do jogo, com a mesma cara do src/core/poki.js. Na build da Y8 o main.js importa { portal }
 * daqui (o tools/empacotar.mjs troca o nome do objeto poki por portal no main.js).
 */
export const portal = criarPortalY8();
