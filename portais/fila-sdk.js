// Copia de jogos/distribuicao/kit/src/core/portais/fila-sdk.js (2026-11-20), sem mudancas no codigo.
// So entra na build da Y8: `node tools/empacotar.mjs --alvo=y8` copia este arquivo para src/core/fila-sdk.js,
// ao lado do adaptador portais/y8.js (que vira src/core/plataforma.js). A build da Poki nao carrega nada daqui.
//
// [kit multiportal] Nucleo comum dos adaptadores de SDK com promessas que podem nunca responder
// (porte do criarPoki de slime-merge/src/core/poki.js, que veio do hexadrop). Os adaptadores de portal
// (portais/<portal>.js) entregam aqui um objeto com a cara de SDK simples (init, gameLoadingFinished,
// gameplayStart, gameplayStop, commercialBreak, rewardedBreak, measure) e recebem a interface Portal
// do jogo, igual em todas as builds.
//
// Por que existe: o script de alguns SDKs e so um carregador. Com bloqueador de anuncios o nucleo nunca
// chega e as promessas ficam pendentes para sempre. Por isso toda promessa tem prazo (init 4 s, anuncio
// 45 s ate COMECAR; depois do onStart, teto de 180 s) e toda chamada tem guarda de existencia. O jogo
// se comporta igual com e sem SDK.
//
// Regras:
// - sdkPronto so liga quando o init RESPONDE (rejeitar tambem e resposta). No prazo o init() resolve
//   assim mesmo, com sdkPronto falso; se a resposta vier depois, o SDK liga dali em diante;
// - antes do sdkPronto o estado fica guardado (loading, jogando, measures) e vai na ordem certa:
//   loading, gameplay, measures. O input do jogo nunca espera nada daqui;
// - gameLoadingFinished uma vez; gameplayStart antes dele emite o loading antes;
// - gameplayStart e gameplayStop idempotentes, e nada durante um anuncio;
// - anuncio: gameplayStop, onAdStart (calar o jogo) e onAdEnd no fim. Com calarNoInicio o jogo cala
//   ANTES de pedir (regra de um portal); sem, so quando o anuncio comeca de verdade;
// - rewarded so premia com === true ('true', 1, {} e rejeicao nao premiam);
// - commercialBreak recusado antes do primeiro gameplayStart (jaJogou);
// - measure troca '/' e '^' por '-' e fica calado no anuncio.

/** Prazos em ms. */
export const PRAZOS_PADRAO = Object.freeze({ init: 4000, intervalo: 45000, info: 1500, aposInicio: 180000 });

const MAX_FILA_MEDIDAS = 100;

/** @param {unknown} v */
export const limparCampo = (v) => String(v ?? '').replace(/[/^]/g, '-');

/**
 * @typedef {Object} Prazos
 * @property {number} [init]
 * @property {number} [intervalo]
 * @property {number} [aposInicio]
 * @property {number} [info]
 */

/**
 * Interface que o jogo (src/main.js) usa, igual em todos os portais.
 * @typedef {Object} Portal
 * @property {string} nome          'poki' | 'crazygames' | 'californiagames'
 * @property {() => Promise<void>} init   resolve na resposta do SDK ou no prazo; nunca rejeita
 * @property {(fracao: number) => void} gameLoadingProgress   0..1 (so onde o SDK tem)
 * @property {() => void} gameLoadingFinished
 * @property {() => void} gameplayStart
 * @property {() => void} gameplayStop
 * @property {() => Promise<boolean>} commercialBreak   true se o intervalo foi pedido ao SDK
 * @property {(tamanho?: 'small'|'medium'|'large') => Promise<boolean>} rewardedBreak   true so com premio
 * @property {(categoria: string, oque: string, acao: string) => void} measure
 * @property {() => void} festa     marco do jogador (recorde, chefe vencido)
 * @property {() => Promise<any>} fonteDados   armazenamento na nuvem do portal, ou null
 * @property {boolean} sdkPronto    so leitura
 * @property {boolean} temAnuncios  so leitura: da para pedir intervalo
 * @property {boolean} temVideo     so leitura: da para oferecer video premiado (sem ele, esconder o botao)
 * @property {boolean} jaJogou      so leitura
 * @property {boolean} emAnuncio    so leitura
 * @property {boolean} jogando      so leitura
 * @property {boolean} bloqueador   so leitura
 * @property {string} idioma        idioma do portal ('' quando o portal nao informa: vale o navegador)
 * @property {(() => void)|null} onAdStart   calar o jogo aqui (sincrono)
 * @property {(() => void)|null} onAdEnd
 * @property {((mudo: boolean) => void)|null} onMudoPlataforma
 * @property {((pausa: boolean) => void)|null} onPausaPlataforma
 * @property {(() => void)|null} onSemAnuncios   os videos acabaram de sumir (esconder os botoes)
 * @property {boolean} lacoAposInit  o laco so comeca depois do init (handshake curto do portal)
 * @property {boolean} intervaloSoNoClique  o intervalo comercial so pode sair logo depois de um clique em
 *                                  botao (Continuar, Proxima, Tentar de novo): Y8. O main.js mostra o botao antes
 * @property {boolean} pausaNoBlur  pausar quando a janela perde o foco (Y8)
 */

/**
 * @typedef {Object} OpcoesFila
 * @property {string} nome
 * @property {() => any} obterSdk        o SDK com a cara simples, ou nada
 * @property {Prazos} [prazos]
 * @property {(fn: () => void, ms: number) => any} [agendar]
 * @property {(id: any) => void} [cancelar]
 * @property {boolean} [calarNoInicio]
 */

/**
 * @param {OpcoesFila} opcoes
 * @returns {Portal}
 */
export function criarFilaSdk({
  nome,
  obterSdk,
  prazos,
  agendar = (fn, ms) => globalThis.setTimeout(fn, ms),
  cancelar = (id) => globalThis.clearTimeout(id),
  calarNoInicio = true,
}) {
  const limites = { ...PRAZOS_PADRAO, ...(prazos || {}) };

  let pronto = false;
  let pedidoCarregou = false;
  let enviouCarregou = false;
  let jogando = false;
  let jogandoNoSdk = false;
  let jaJogou = false;
  let emAnuncio = false;
  /** @type {Promise<void>|null} */
  let promessaInit = null;
  /** @type {string[][]} */
  let filaMedidas = [];

  /** @returns {any} */
  function sdk() {
    try {
      const s = obterSdk();
      return s && (typeof s === 'object' || typeof s === 'function') ? s : null;
    } catch {
      return null;
    }
  }

  /** @param {any} api @param {string} m @returns {((...a: any[]) => any)|null} */
  function metodo(api, m) {
    if (!api) return null;
    try {
      const fn = api[m];
      return typeof fn === 'function' ? (...args) => fn.apply(api, args) : null;
    } catch {
      return null;
    }
  }

  /** @param {string} m @param {...any} args */
  function chamar(m, ...args) {
    const fn = metodo(sdk(), m);
    if (!fn) return;
    try {
      fn(...args);
    } catch {
      /* ignora */
    }
  }

  /** Resolve com o valor ou com a reserva no prazo (ou na rejeicao). Nunca rejeita. */
  function comPrazo(promessa, ms, reserva) {
    return new Promise((resolve) => {
      let feito = false;
      /** @type {any} */
      let id = null;
      const fim = (v) => {
        if (feito) return;
        feito = true;
        if (id !== null) {
          try { cancelar(id); } catch { /* ignora */ }
        }
        resolve(v);
      };
      try {
        id = agendar(() => fim(reserva), ms);
      } catch {
        id = null;
      }
      Promise.resolve(promessa).then(fim, () => fim(reserva));
    });
  }

  /** @param {Function|null} fn @param {...any} args */
  function avisar(fn, ...args) {
    if (typeof fn !== 'function') return;
    try {
      fn(...args);
    } catch {
      /* ignora */
    }
  }

  /** Leva ao SDK o que ficou pendente, na ordem: loading, gameplay, measures. */
  function sincronizar() {
    if (!pronto || emAnuncio) return;
    if (pedidoCarregou && !enviouCarregou) {
      enviouCarregou = true;
      chamar('gameLoadingFinished');
    }
    if (!enviouCarregou) return;
    if (jogando !== jogandoNoSdk) {
      jogandoNoSdk = jogando;
      chamar(jogando ? 'gameplayStart' : 'gameplayStop');
    }
    if (filaMedidas.length) {
      const fila = filaMedidas;
      filaMedidas = [];
      for (const m of fila) chamar('measure', m[0], m[1], m[2]);
    }
  }

  function marcarPronto() {
    if (pronto) return;
    pronto = true;
    sincronizar();
  }

  function init() {
    if (promessaInit) return promessaInit;
    promessaInit = (async () => {
      try {
        const fn = metodo(sdk(), 'init');
        if (!fn) return;
        let pedido;
        try {
          pedido = fn();
        } catch {
          return;
        }
        const resposta = Promise.resolve(pedido).then(marcarPronto, marcarPronto);
        await comPrazo(resposta, limites.init, undefined);
      } catch {
        /* ignora */
      }
    })();
    return promessaInit;
  }

  function gameLoadingFinished() {
    if (pedidoCarregou) return;
    pedidoCarregou = true;
    sincronizar();
  }

  function gameplayStart() {
    if (jogando || emAnuncio) return;
    pedidoCarregou = true;
    jogando = true;
    jaJogou = true;
    sincronizar();
  }

  function gameplayStop() {
    if (!jogando) return;
    jogando = false;
    sincronizar();
  }

  /** Espera o anuncio (prazo sem onStart; teto depois do onStart). Nunca rejeita. */
  function esperarAnuncio(chamada, reserva) {
    return new Promise((resolve) => {
      let feito = false;
      let iniciou = false;
      /** @type {any} */
      let id = null;
      const desarmar = () => {
        if (id === null) return;
        try { cancelar(id); } catch { /* ignora */ }
        id = null;
      };
      const fim = (v) => {
        if (feito) return;
        feito = true;
        desarmar();
        resolve(v);
      };
      const armar = (ms) => {
        desarmar();
        try {
          id = agendar(() => { id = null; fim(reserva); }, ms);
        } catch {
          id = null;
        }
      };
      const aoIniciar = () => {
        if (feito || iniciou) return;
        iniciou = true;
        armar(limites.aposInicio);
      };
      armar(limites.intervalo);
      let pedido;
      try {
        pedido = chamada(aoIniciar);
      } catch {
        pedido = reserva;
      }
      Promise.resolve(pedido).then(fim, () => fim(reserva));
    });
  }

  async function rodarAnuncio(chamada, reserva) {
    gameplayStop();
    emAnuncio = true;
    let calou = false;
    const calar = () => {
      if (calou) return;
      calou = true;
      avisar(portal.onAdStart);
    };
    if (calarNoInicio) calar();
    const resultado = await esperarAnuncio((aoIniciar) => chamada(() => { calar(); aoIniciar(); }), reserva);
    emAnuncio = false;
    if (calou) avisar(portal.onAdEnd);
    sincronizar();
    return resultado;
  }

  /** Intervalo num ponto natural (quem decide QUANDO e o main.js; o portal decide a frequencia). */
  async function commercialBreak() {
    if (!pronto || emAnuncio || !jaJogou) return false;
    const fn = metodo(sdk(), 'commercialBreak');
    if (!fn) return false;
    await rodarAnuncio((aoIniciar) => fn(aoIniciar), undefined);
    return true;
  }

  /** Video premiado, so por escolha do jogador. Sem SDK pronto nao ha video, e sem video nao ha premio. */
  async function rewardedBreak(tamanho = 'medium') {
    if (!pronto || emAnuncio) return false;
    const fn = metodo(sdk(), 'rewardedBreak');
    if (!fn) return false;
    const resultado = await rodarAnuncio((aoIniciar) => fn({ size: tamanho, onStart: aoIniciar }), false);
    return resultado === true;
  }

  function measure(categoria, oque, acao) {
    if (emAnuncio) return;
    const m = [limparCampo(categoria), limparCampo(oque), limparCampo(acao)];
    if (pronto && enviouCarregou) {
      chamar('measure', m[0], m[1], m[2]);
      return;
    }
    if (filaMedidas.length < MAX_FILA_MEDIDAS) filaMedidas.push(m);
  }

  /** @type {Portal} */
  const portal = {
    nome,
    init,
    gameLoadingProgress() {},
    gameLoadingFinished,
    gameplayStart,
    gameplayStop,
    commercialBreak,
    rewardedBreak,
    measure,
    festa() {},
    fonteDados: () => Promise.resolve(null),
    get sdkPronto() { return pronto; },
    get temAnuncios() { return pronto; },
    get temVideo() { return portal.temAnuncios; },
    get jaJogou() { return jaJogou; },
    get emAnuncio() { return emAnuncio; },
    get jogando() { return jogando; },
    bloqueador: false,
    idioma: '',
    onAdStart: null,
    onAdEnd: null,
    onMudoPlataforma: null,
    onPausaPlataforma: null,
    onSemAnuncios: null,
    lacoAposInit: false,
    intervaloSoNoClique: false,
    pausaNoBlur: false,
  };
  return portal;
}
