// Adaptador do californiagames.io (PlataformaSDK 1.1.0) com a mesma cara de src/core/poki.js.
// So existe na build do portal: `node tools/empacotar.mjs --alvo=californiagames` copia este arquivo
// para src/core/plataforma.js, apaga o poki.js e troca o import do src/main.js. A build da Poki nao
// muda. Fica fora de src/ de proposito (o jogo da Poki nao carrega nada daqui).
//
// Regras (documentacao publica da SDK, /developers/sdk, e INTEGRACAO.md da distribuicao):
// - init() o quanto antes: e chamado quando este modulo carrega, seguido do gameLoadingStart();
// - gameLoadingFinished uma vez so; gameplayStart antes dele manda o loading antes;
// - gameplayStart e gameplayStop idempotentes; nada vai a SDK durante intervalo nem com o portal
//   pausado (o estado e acertado na volta);
// - commercialBreak(onStart) e rewardedBreak({ size, onStart }), SEMPRE na forma de objeto (a forma
//   de funcao do wrapper da Poki e ignorada em silencio pela PlataformaSDK); gameplayStop antes;
//   o mudo e no onStart (anuncio exibido de verdade) e o som volta quando a promessa resolve;
// - recompensa so com === true;
// - sinais pause/resume/mute/unmute idempotentes. A pausa vai para onPausa(bool). O mudo do portal
//   soma com o do anuncio (motivos): onAdStart quando o primeiro motivo entra e onAdEnd quando o
//   ultimo sai, entao o unmute nunca devolve um som que o jogador desligou no jogo nem o de um
//   anuncio em andamento;
// - idioma por getLanguage() (pt-BR, en ou es), nunca pelo navigator;
// - captureError nos erros que o jogo trata (os outros a SDK captura sozinha);
// - o portal aplica o limite de frequencia dos intervalos: o jogo pede em todo ponto natural de
//   pausa (semRitmoProprio) e guarda so as regras de UX;
// - sem pilula, sem link externo, sem getDeviceInfo (nada disso existe aqui).
//
// O jogo funciona igual sem a SDK (arquivo nao servido): tudo vira no-op e nenhuma promessa rejeita.

/** Prazos em ms (redes de seguranca: a SDK ja responde sozinha em ate 1,5 s no init e 60 s no anuncio). */
export const PRAZOS_PADRAO = Object.freeze({ init: 4000, intervalo: 90000 });

/** @param {unknown} v */
const campo = (v) => (v === undefined || v === null ? undefined : String(v));

/**
 * @typedef {Object} OpcoesPlataforma
 * @property {() => any} [obterSdk]                             a PlataformaSDK, ou nada
 * @property {{ init?: number, intervalo?: number }} [prazos]
 * @property {(fn: () => void, ms: number) => any} [agendar]    setTimeout
 * @property {(id: any) => void} [cancelar]                     clearTimeout
 */

/**
 * @param {OpcoesPlataforma} [opcoes]
 */
export function criarPlataforma({
  obterSdk = () => /** @type {any} */ (globalThis).PlataformaSDK,
  prazos,
  agendar = (fn, ms) => globalThis.setTimeout(fn, ms),
  cancelar = (id) => globalThis.clearTimeout(id),
} = {}) {
  const limites = { ...PRAZOS_PADRAO, ...(prazos || {}) };

  let pronto = false;
  let pedidoCarregou = false;
  let enviouCarregou = false;
  let jogando = false;
  let jogandoNoSdk = false;
  let jaJogou = false;
  let emAnuncio = false;
  let pausado = false;
  /** @type {Set<string>} motivos de silencio: 'anuncio' (onStart ate a resposta) e 'portal' (mute ate o unmute) */
  const motivosMudo = new Set();
  /** @type {Promise<void>|null} */
  let promessaInit = null;

  /** @returns {any} */
  function sdk() {
    try {
      const s = obterSdk();
      return s && (typeof s === 'object' || typeof s === 'function') ? s : null;
    } catch {
      return null;
    }
  }

  /**
   * O metodo da SDK amarrado a ela, ou null.
   * @param {string} nome
   * @returns {((...args: any[]) => any)|null}
   */
  function metodo(nome) {
    const api = sdk();
    if (!api) return null;
    try {
      const fn = api[nome];
      return typeof fn === 'function' ? (...args) => fn.apply(api, args) : null;
    } catch {
      return null;
    }
  }

  /** @param {string} nome @param {...any} args */
  function chamar(nome, ...args) {
    const fn = metodo(nome);
    if (!fn) return undefined;
    try {
      return fn(...args);
    } catch {
      return undefined;
    }
  }

  /** @param {any} fn @param {...any} args */
  function avisar(fn, ...args) {
    if (typeof fn !== 'function') return;
    try {
      fn(...args);
    } catch {
      /* ignora */
    }
  }

  /**
   * Resolve com o valor da promessa ou com a reserva no prazo (ou na rejeicao). Nunca rejeita.
   * @param {any} promessa @param {number} ms @param {any} reserva
   * @returns {Promise<any>}
   */
  function comPrazo(promessa, ms, reserva) {
    return new Promise((resolve) => {
      let feito = false;
      /** @type {any} */
      let id = null;
      /** @param {any} v */
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

  /** Leva a SDK o que ficou pendente, na ordem: loading e depois o estado de jogo. */
  function sincronizar() {
    if (!sdk()) return;
    if (pedidoCarregou && !enviouCarregou) {
      enviouCarregou = true;
      chamar('gameLoadingFinished');
    }
    if (!enviouCarregou || emAnuncio || pausado) return;
    if (jogando !== jogandoNoSdk) {
      jogandoNoSdk = jogando;
      chamar(jogando ? 'gameplayStart' : 'gameplayStop');
    }
  }

  /** Para o gameplay do lado da SDK (intervalo ou pausa do portal) sem mudar o que o jogo pediu. */
  function pararNoSdk() {
    if (!jogandoNoSdk) return;
    jogandoNoSdk = false;
    chamar('gameplayStop');
  }

  /** @param {string} motivo @param {boolean} ativo */
  function mudo(motivo, ativo) {
    const antes = motivosMudo.size;
    if (ativo) motivosMudo.add(motivo);
    else motivosMudo.delete(motivo);
    if (!antes && motivosMudo.size) avisar(plataforma.onAdStart);
    else if (antes && !motivosMudo.size) avisar(plataforma.onAdEnd);
  }

  /** @param {boolean} ativo */
  function pausar(ativo) {
    if (ativo === pausado) return; // o mesmo sinal pode chegar duas vezes
    pausado = ativo;
    if (ativo) pararNoSdk();
    avisar(plataforma.onPausa, ativo);
    if (!ativo) sincronizar();
  }

  function ouvirSinais() {
    const on = metodo('on');
    if (!on) return;
    try {
      on('pause', () => pausar(true));
      on('resume', () => pausar(false));
      on('mute', () => mudo('portal', true));
      on('unmute', () => mudo('portal', false));
    } catch {
      /* ignora */
    }
  }

  function init() {
    if (promessaInit) return promessaInit;
    promessaInit = (async () => {
      const fn = metodo('init');
      if (!fn) return; // sem SDK: o jogo segue sem anuncios
      ouvirSinais();
      let pedido;
      try {
        pedido = fn();
      } catch {
        return;
      }
      chamar('gameLoadingStart');
      await comPrazo(pedido, limites.init, undefined);
      pronto = true;
      sincronizar();
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
    pedidoCarregou = true; // o loading sai antes do primeiro start
    jogando = true;
    jaJogou = true;
    sincronizar();
  }

  function gameplayStop() {
    if (!jogando) return;
    jogando = false;
    sincronizar();
  }

  /**
   * @param {(aoIniciar: () => void) => any} chamada   pede o anuncio a SDK passando o onStart
   * @param {any} reserva                             resultado no prazo, na rejeicao ou na excecao
   */
  async function rodarAnuncio(chamada, reserva) {
    gameplayStop();
    pararNoSdk();
    emAnuncio = true;
    const aoIniciar = () => { if (emAnuncio) mudo('anuncio', true); };
    let pedido;
    try {
      pedido = chamada(aoIniciar);
    } catch {
      pedido = reserva;
    }
    const resultado = await comPrazo(pedido, limites.intervalo, reserva);
    emAnuncio = false;
    mudo('anuncio', false);
    sincronizar();
    return resultado;
  }

  /**
   * Intervalo comercial num ponto natural de pausa. O portal decide se exibe (e responde na hora
   * quando nao vai exibir). true se o intervalo foi pedido a SDK.
   */
  async function commercialBreak() {
    if (!pronto || emAnuncio || !jaJogou) return false;
    const fn = metodo('commercialBreak');
    if (!fn) return false;
    await rodarAnuncio((aoIniciar) => fn(aoIniciar), undefined);
    return true;
  }

  /**
   * Video recompensado, so por escolha do jogador. Sempre { size, onStart }.
   * @param {'small'|'medium'|'large'} [tamanho]
   */
  async function rewardedBreak(tamanho = 'medium') {
    if (!pronto || emAnuncio) return false;
    const fn = metodo('rewardedBreak');
    if (!fn) return false;
    const resultado = await rodarAnuncio((aoIniciar) => fn({ size: tamanho, onStart: aoIniciar }), false);
    return resultado === true;
  }

  /**
   * Metrica propria do jogo (os mesmos nomes da Poki).
   * @param {string} categoria @param {string} [oque] @param {string} [acao]
   */
  function measure(categoria, oque, acao) {
    chamar('measure', String(categoria ?? ''), campo(oque), campo(acao));
  }

  /** Erro que o jogo tratou (os nao tratados a SDK captura sozinha). @param {unknown} erro */
  function capturarErro(erro) {
    chamar('captureError', erro);
  }

  const plataforma = {
    init,
    gameLoadingFinished,
    gameplayStart,
    gameplayStop,
    commercialBreak,
    rewardedBreak,
    measure,
    capturarErro,
    /** Nome do portal (o jogo usa para as regras que mudam por portal). */
    portal: 'californiagames',
    /** O portal limita a frequencia: o jogo pede o intervalo em todo ponto natural, sem ritmo proprio. */
    semRitmoProprio: true,
    /** Idioma do jogador ('pt-BR', 'en' ou 'es'), ou null sem SDK. Vale ja no carregamento (?lang= do iframe). */
    get idioma() {
      const v = chamar('getLanguage');
      return typeof v === 'string' && v ? v : null;
    },
    /** true com bloqueador de anuncios (lido no handshake): sem botoes de video. */
    get anunciosBloqueados() { return chamar('isAdBlocked') === true; },
    get sdkPronto() { return pronto; },
    get jaJogou() { return jaJogou; },
    get emAnuncio() { return emAnuncio; },
    get jogando() { return jogando; },
    /** true enquanto o portal mantem o jogo pausado (entre pause e resume). */
    get pausado() { return pausado; },
    /** true enquanto o portal mantem o jogo mudo (entre mute e unmute). */
    get mudoDoPortal() { return motivosMudo.has('portal'); },
    dispositivo: null,
    /** @type {(() => void)|null} mudar o audio aqui (sincrono): anuncio na tela ou mute do portal */
    onAdStart: null,
    /** @type {(() => void)|null} devolver o audio: nenhum motivo de silencio sobrou */
    onAdEnd: null,
    /** @type {((pausado: boolean) => void)|null} pause/resume do portal (aba oculta, dialogo, botao de pausa) */
    onPausa: null,
  };
  return plataforma;
}

/** Instancia do jogo: usa globalThis.PlataformaSDK e ja chama o init (o quanto antes). */
export const poki = criarPlataforma();
poki.init();
