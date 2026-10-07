// Ponto de entrada do Color Train: liga estado, cena, entrada, HUD, som,
// garagem e Poki. Unico modulo que importa core/poki.js.
//
// Fluxo de um nivel: os vagoes chegam pela direita -> o jogador leva blocos
// da boca de um trilho para a boca de outro (toque-toque ou arraste) -> cada
// trem de uma cor so ganha locomotiva -> com todos prontos, os trens partem
// (um toque adianta), vem o intervalo comercial (so depois dos primeiros 3
// minutos de jogo; a Poki decide a frequencia) e o proximo nivel chega sem
// tela no meio. Num beco sem saida aparece o socorro: voltar ate o ultimo
// estado com solucao (sozinho, depois de alguns segundos parado).

import { criarCena } from './render/cena.js';
import { calcularLayout, trilhoEm, trilhoProximo } from './render/layout.js';
import { TEMAS, temaPorNivel, mundoPorNivel, ORDEM_MUNDOS } from './render/tema.js';
import { PINTURAS } from './render/pecas.js';
import { bloco, pode, motivo, mover, resolvido, destinos, paraTexto, completo } from './jogo/regras.js';
import { definicaoNivel } from './jogo/catalogo.js';
import { analisar } from './jogo/solucionador.js';
import { TUTORIAL, limiarMao } from './jogo/curva.js';
import { criarAudio } from './core/audio.js';
import { criarArmazem } from './core/armazenamento.js';
import { criarTelemetria } from './core/telemetria.js';
import { escolherIdioma, textos } from './i18n/textos.js';
import { lerDepuracao } from './core/depuracao.js';
import { poki } from './core/poki.js';
import { criarGaragem, liberadas, progressoLoco, desenharPrevia } from './ui/garagem.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const canvas = /** @type {HTMLCanvasElement} */ ($('cena'));
const cena = criarCena(canvas);
const audio = criarAudio();
const armazem = criarArmazem();
const dep = lerDepuracao();
const T = textos(escolherIdioma());
const tele = criarTelemetria((c, o, a) => poki.measure(c, o, a));

/** Primeiros minutos sem intervalo comercial (contados do primeiro toque). */
const MS_SEM_INTERVALO = 180000;
/** Parado no beco por tanto tempo, o jogo volta sozinho. */
const MS_VOLTAR_SOZINHO = 5000;
/** Orcamento do solucionador por jogada (beco provado ou incerto, nunca trava o quadro). */
const ORCAMENTO_JOGADA = 4000;

const VERSAO_SAVE = 1;
const salvo = armazem.ler('save', null);
const save = salvo && salvo.v === VERSAO_SAVE ? salvo : { v: VERSAO_SAVE, nivel: 1, mudo: false, loco: 0, extras: 0, vista: 1 };

/** @typedef {import('./jogo/regras.js').Estado} Estado */
/** @typedef {import('./jogo/solucionador.js').Analise} Analise */
const J = {
  nivel: dep.nivel || save.nivel || 1,
  /** @type {Estado} */
  st: { cap: 4, trilhos: [] },
  /** @type {any[][]} */
  ini: [],
  /** @type {any[][][]} */
  hist: [],
  /** @type {number|null} */
  sel: null,
  /** 'chegando' | 'jogando' | 'partindo' | 'trocando' */
  fase: 'chegando',
  /** @type {null|{ i: number, x: number, y: number, dx: number, dy: number, arrastando: boolean, desmarcar: boolean, alvo: number, ids: number[] }} */
  toque: null,
  /** @type {null|{ a: number, b: number, t0: number, origem: string }} */
  mao: null,
  pendentes: 0,
  gen: 0,
  desf: 0,
  extraUsado: false,
  carregou: false,
  loco: Math.min(save.loco || 0, PINTURAS.length - 1),
  extras: save.extras || 0,
  /** locomotivas que o jogador ja viu liberadas (para o ponto de novidade) */
  vista: save.vista || 1,
  tema: temaPorNivel(1),
  /** @type {Analise} solubilidade do estado atual */
  analise: { estado: 'incerto', caminho: null, expandidos: 0 },
  /** jogadas guiadas que faltam (niveis de ensino) @type {number[][]} */
  guia: [],
  /** beco sem saida: quantas jogadas voltar e desde quando @type {null|{ passos: number, desde: number }} */
  beco: null,
  /** voltando passo a passo ate o estado com solucao @type {null|{ alvo: number, gen: number }} */
  voltando: null,
  /** tamanho do historico logo depois de um recomecar (para medir o desfazer dele) */
  recomeco: -1,
  ociosoDesde: 0,
  /** instante do primeiro toque de jogo (gate do primeiro intervalo) */
  inicioJogo: 0,
  /** medicao da troca de nivel: ultimo engate e input liberado no nivel seguinte */
  tempos: { engate: 0, livre: 0 },
  tema0: '',
};

function salvar() {
  armazem.gravar('save', { v: VERSAO_SAVE, nivel: J.nivel, mudo: audio.mudo, loco: J.loco, extras: J.extras, vista: J.vista });
}

/** Agenda que morre com troca de nivel e com desfazer. */
function depois(ms, fn) {
  const g = J.gen, d = J.desf;
  setTimeout(() => {
    if (g === J.gen && d === J.desf) fn();
  }, Math.max(0, ms));
}

let proxId = 1;
/** @param {{ cap: number, t: string[] }} def @returns {Estado} */
function criarEstado(def) {
  return {
    cap: def.cap,
    trilhos: def.t.map((s) => [...s].map((ch) => ({ id: proxId++, c: ch.charCodeAt(0) - 65 }))),
  };
}
const foto = () => J.st.trilhos.map((t) => t.slice());
/** @param {any[][]} f */
const textoDe = (f) => f.map((t) => t.map((v) => String.fromCharCode(65 + v.c)).join(''));
const agora = () => performance.now();

function analisarAgora() {
  J.analise = analisar(paraTexto(J.st), J.st.cap, { orcamento: ORCAMENTO_JOGADA });
}

function temaDoNivel() {
  if (dep.tema && TEMAS[dep.tema]) return TEMAS[dep.tema];
  return temaPorNivel(J.nivel);
}

// ------------------------------------------------------------------ layout
function medirLayout() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const topo = $('topo').getBoundingClientRect();
  const base = $('base').getBoundingClientRect();
  const coluna = base.height > base.width;
  return calcularLayout({
    W, H,
    topo: topo.bottom + 6,
    base: coluna ? H - 8 : base.top - 8,
    n: J.st.trilhos.length,
    cap: J.st.cap,
    direita: coluna ? W - base.left + 4 : 0,
  });
}

function redimensionar() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cena.redimensionar(window.innerWidth, window.innerHeight, dpr);
  if (J.st.trilhos.length) cena.configurar(J.st, medirLayout(), J.tema);
  posicionarVoltar();
}

// -------------------------------------------------------------------- HUD
let metaDesenhada = '';
function atualizarHud(pop = false) {
  $('placaRotulo').textContent = T.nivel;
  $('placaNum').textContent = String(J.nivel);
  if (pop) {
    const placa = $('placa');
    placa.classList.remove('pop');
    void placa.offsetWidth;
    placa.classList.add('pop');
  }
  $('bExtra').toggleAttribute('disabled', J.extraUsado);
  for (const [id, chave] of [['bDesfazer', 'desfazer'], ['bRecomecar', 'recomecar'], ['bDica', 'dica'], ['bExtra', 'extra'], ['bSom', 'som'], ['bGaragem', 'garagem'], ['bVoltar', 'voltar']]) {
    $(id).setAttribute('aria-label', T[chave]);
    $(id).title = T[chave];
  }
  const som = $('bSom');
  som.querySelectorAll('.ligado').forEach((e) => { /** @type {SVGElement} */ (e).style.display = audio.mudo ? 'none' : ''; });
  /** @type {SVGElement} */ (som.querySelector('.desligado')).style.display = audio.mudo ? '' : 'none';
  if (audio.mudo) /** @type {SVGElement} */ (som.querySelector('.ligado')).style.display = '';
  // meta: niveis ate a proxima locomotiva, com a silhueta dela
  const p = progressoLoco(J.nivel, J.extras);
  const meta = $('meta');
  meta.hidden = p.proxima === null;
  meta.title = T.proxima;
  if (p.proxima !== null) {
    const segs = /** @type {HTMLElement} */ (meta.querySelector('.segs'));
    segs.innerHTML = '';
    for (let i = 0; i < p.total; i++) {
      const s = document.createElement('i');
      if (i < p.atual) s.className = 'cheio';
      segs.appendChild(s);
    }
    const chave = `${p.proxima}|${J.tema.nome}`;
    if (chave !== metaDesenhada) {
      metaDesenhada = chave;
      const cv = /** @type {HTMLCanvasElement} */ (meta.querySelector('canvas'));
      requestAnimationFrame(() => desenharPrevia(cv, /** @type {number} */ (p.proxima), false, J.tema));
    }
  }
  $('bGaragem').classList.toggle('novidade', liberadas(J.nivel, J.extras) > J.vista);
}

/** Vibracao curta (celulares que suportam). @param {number|number[]} ms */
function vibrar(ms) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch { /* ignora */ }
}

function avisarLocoNova(i) {
  const aviso = $('aviso');
  /** @type {HTMLElement} */ (aviso.querySelector('span')).textContent = T.nova;
  aviso.hidden = false;
  desenharPrevia(/** @type {HTMLCanvasElement} */ (aviso.querySelector('canvas')), i, false, J.tema);
  setTimeout(() => { aviso.hidden = true; }, 2600);
}

function mostrarMundo() {
  const c = $('mundo');
  const i = mundoPorNivel(J.nivel);
  /** @type {HTMLElement} */ (c.querySelector('small')).textContent = `${T.mundo} ${i + 1}`;
  /** @type {HTMLElement} */ (c.querySelector('b')).textContent = T[ORDEM_MUNDOS[i]] || ORDEM_MUNDOS[i];
  c.hidden = false;
  setTimeout(() => { c.hidden = true; }, 1700);
}

// ----------------------------------------------------------- socorro (beco)
/** Botao de voltar: abaixo do patio no retrato; na faixa da estacao na paisagem. */
function posicionarVoltar() {
  const b = $('bVoltar');
  const lay = cena.layout;
  if (b.hidden || !lay) return;
  const w = b.offsetWidth || 120;
  const h = b.offsetHeight || 60;
  let y;
  const base = $('base').getBoundingClientRect();
  if (lay.retrato && base.top - lay.yFimTabuleiro > h + 16) y = lay.yFimTabuleiro + (base.top - lay.yFimTabuleiro - h) / 2;
  else if (lay.fachada.alt >= h + 8) y = lay.fachada.y0 + (lay.fachada.alt - h) / 2;
  else y = (lay.yTabuleiro + lay.yFimTabuleiro - h) / 2;
  b.style.left = `${Math.round(lay.Wu / 2 - w / 2)}px`;
  b.style.top = `${Math.round(y)}px`;
}

/** Quantas jogadas voltar ate o ultimo estado com solucao (varre o historico de tras para frente). */
function passosAteSolucao() {
  for (let k = J.hist.length - 1; k >= 0; k--) {
    const a = analisar(textoDe(J.hist[k]), J.st.cap, { orcamento: ORCAMENTO_JOGADA });
    if (a.estado !== 'morto') return J.hist.length - k;
  }
  return J.hist.length;
}

function entrarNoBeco() {
  if (J.beco || J.voltando) return;
  const passos = passosAteSolucao();
  if (!passos) return;
  J.beco = { passos, desde: agora() };
  tele.evento('stuck', 'dead');
  $('voltarN').textContent = String(passos);
  $('bVoltar').hidden = false;
  posicionarVoltar();
  // o trilho extra so pisca se ele resolver mesmo
  const extraResolve = !J.extraUsado && analisar([...paraTexto(J.st), ''], J.st.cap, { orcamento: ORCAMENTO_JOGADA }).estado === 'resolve';
  $('bExtra').classList.toggle('pulsar', extraResolve);
}

function sairDoBeco() {
  J.beco = null;
  $('bVoltar').hidden = true;
  $('bExtra').classList.remove('pulsar');
}

/** Volta passo a passo (300 ms cada) ate o ultimo estado com solucao e mostra a mao. @param {boolean} sozinho */
function voltarAteSolucao(sozinho) {
  if (!J.beco || J.voltando) return;
  tele.evento('stuck', sozinho ? 'auto' : 'button');
  const alvo = J.hist.length - J.beco.passos;
  sairDoBeco();
  J.voltando = { alvo, gen: J.gen };
  J.sel = null;
  cena.selecionar(null);
  const passo = () => {
    const v = J.voltando;
    if (!v || v.gen !== J.gen) return;
    if (J.hist.length > v.alvo) {
      restaurar(/** @type {any[][]} */ (J.hist.pop()));
      setTimeout(passo, 300);
      return;
    }
    J.voltando = null;
    J.ociosoDesde = agora();
    mostrarMao('socorro');
  };
  passo();
}

// ------------------------------------------------------------------- nivel
function iniciarNivel(chegar = true) {
  J.gen++;
  J.desf = 0;
  const def = dep.tabuleiro || definicaoNivel(J.nivel);
  J.st = criarEstado(def);
  J.ini = foto();
  J.hist = [];
  J.sel = null;
  J.mao = null;
  J.toque = null;
  J.pendentes = 0;
  J.extraUsado = false;
  J.voltando = null;
  J.recomeco = -1;
  sairDoBeco();
  const tut = !dep.tabuleiro && J.nivel <= TUTORIAL.length ? TUTORIAL[J.nivel - 1] : null;
  J.guia = tut ? tut.guia.map((g) => g.slice()) : [];
  document.body.classList.toggle('tutorial', !!tut);
  analisarAgora();
  tele.nivel(J.nivel);
  J.tema = temaDoNivel();
  // o HUD segue o mundo: fundo da pagina, cor de acento e placa
  document.body.style.background = J.tema.placa;
  document.documentElement.style.setProperty('--acento', J.tema.acento);
  document.documentElement.style.setProperty('--placa', J.tema.placa);
  audio.definirMundo(ORDEM_MUNDOS.indexOf(J.tema.nome));
  if (J.tema0 && J.tema0 !== J.tema.nome) mostrarMundo();
  J.tema0 = J.tema.nome;
  atualizarHud(true);
  cena.definirPintura(PINTURAS[J.loco]);
  cena.configurar(J.st, medirLayout(), J.tema, { novo: true });
  J.fase = 'chegando';
  const ms = chegar ? cena.chegada() : 0;
  if (chegar) audio.chuchu(4);
  if (!J.carregou) {
    J.carregou = true;
    poki.gameLoadingFinished();
  }
  poki.measure('level', String(J.nivel), 'start');
  // o input liga logo no comeco da chegada: o estado ja esta pronto e o
  // visual alcanca depois
  depois(Math.min(ms, 150), () => {
    J.fase = 'jogando';
    J.tempos.livre = agora();
    J.ociosoDesde = agora();
    if (J.guia.length) mostrarMao('guia');
    if (dep.auto) depois(dep.auto, passoAuto);
  });
}

/** Mao mostrando a proxima jogada (da guia ou da solucao em cache). @param {string} origem */
function mostrarMao(origem) {
  let jog = J.guia.length ? J.guia[0] : null;
  if (!jog) {
    if (J.analise.estado === 'incerto') J.analise = analisar(paraTexto(J.st), J.st.cap, { orcamento: 40000 });
    const cam = J.analise.caminho;
    if (cam && cam.length) jog = cam[0];
  }
  if (!jog) return false;
  J.mao = { a: jog[0], b: jog[1], t0: agora(), origem };
  if (origem === 'guia') tele.evento('tutorial', 'hand');
  return true;
}

function executar(a, b) {
  J.hist.push(foto());
  const ev = mover(J.st, a, b);
  if (J.guia.length) {
    if (J.guia[0][0] === a && J.guia[0][1] === b) J.guia.shift();
    else J.guia = [];
  }
  analisarAgora();
  J.sel = null;
  J.mao = null;
  J.toque = null;
  J.ociosoDesde = agora();
  cena.arrastar(null);
  cena.selecionar(null);
  const ms = cena.sincronizar();
  audio.voar();
  depois(ms, () => {
    audio.engate();
    vibrar(12);
    J.tempos.engate = agora();
    J.ociosoDesde = agora();
    cena.engatou(b, ev.n);
    if (ev.completou) completar(b);
    else checarFim();
    if (J.guia.length && J.fase === 'jogando') mostrarMao('guia');
  });
}

function completar(tr) {
  J.pendentes++;
  const ms = cena.chegarLoco(tr);
  audio.chuchu(3);
  depois(ms, () => {
    J.pendentes--;
    audio.engate();
    audio.apito();
    vibrar([18, 60, 28]);
    cena.comemorar(tr);
    checarFim();
  });
}

function checarFim() {
  if (J.fase !== 'jogando') return;
  if (resolvido(J.st)) {
    if (J.pendentes === 0) partir();
    return;
  }
  if (J.analise.estado === 'morto') entrarNoBeco();
}

function partir() {
  J.fase = 'partindo';
  J.sel = null;
  J.mao = null;
  cena.selecionar(null);
  if (J.nivel <= TUTORIAL.length) tele.evento('tutorial', 'done');
  poki.measure('level', String(J.nivel), 'complete');
  poki.gameplayStop();
  audio.vitoria();
  audio.apito(0.2);
  audio.chuchu(10, 0.3);
  const ms = cena.partir();
  depois(ms + 60, () => {
    if (J.fase === 'partindo') proximoNivel();
  });
}

async function proximoNivel() {
  if (J.fase !== 'partindo') return;
  J.fase = 'trocando';
  const antes = liberadas(J.nivel, J.extras);
  J.nivel++;
  const depoisN = liberadas(J.nivel, J.extras);
  salvar();
  // intervalo comercial na pausa natural entre niveis, so depois dos
  // primeiros minutos de jogo (a Poki decide se mostra)
  const limite = dep.intervaloMs || MS_SEM_INTERVALO;
  if (J.inicioJogo && agora() - J.inicioJogo >= limite && !dep.semAnuncio) {
    const g = J.gen;
    await poki.commercialBreak();
    if (g !== J.gen) return;
  }
  if (depoisN > antes) {
    // locomotiva nova: a recompensa vem depois do anuncio, nunca junto
    J.loco = depoisN - 1;
    J.vista = depoisN;
    salvar();
    avisarLocoNova(J.loco);
  }
  iniciarNivel(true);
}

/** @param {any[][]} f */
function restaurar(f) {
  J.desf++;
  J.st.trilhos = f.map((t) => t.slice());
  J.sel = null;
  J.mao = null;
  J.toque = null;
  J.pendentes = 0;
  J.ociosoDesde = agora();
  if (J.guia.length) J.guia = [];
  sairDoBeco();
  analisarAgora();
  cena.arrastar(null);
  cena.selecionar(null);
  cena.sincronizar();
  // trem pronto que voltou (desfazer um recomecar): a locomotiva vem de novo
  J.st.trilhos.forEach((t, i) => {
    if (completo(t, J.st.cap) && !cena.temLoco(i)) completar(i);
  });
  if (!J.voltando) checarFim();
}

// ------------------------------------------------------------- recompensa
/**
 * Video recompensado, so por escolha do jogador. Premio so com true. Em
 * desenvolvimento local sem SDK, libera direto para dar para testar.
 * @returns {Promise<boolean>}
 */
async function recompensa() {
  if (poki.sdkPronto) return poki.rewardedBreak();
  return dep.local;
}

// ------------------------------------------------------------------ acoes
function desfazer() {
  if (J.fase !== 'jogando' || J.voltando || !J.hist.length) return;
  if (J.hist.length === J.recomeco) {
    tele.evento('restart', 'undone');
    J.recomeco = -1;
  } else tele.evento('undo', 'manual');
  restaurar(/** @type {any[][]} */ (J.hist.pop()));
}
function recomecar() {
  if (J.fase !== 'jogando' || J.voltando || !J.hist.length) return;
  tele.evento('restart', 'manual');
  // recomecar entra no historico: o desfazer traz o progresso de volta
  J.hist.push(foto());
  J.recomeco = J.hist.length;
  restaurar(J.ini);
}
async function dica() {
  if (J.fase !== 'jogando' || J.voltando) return;
  // o plano vem antes do video: sem jogada a mostrar, nao cobra
  if (!J.beco) {
    if (J.analise.estado === 'incerto') J.analise = analisar(paraTexto(J.st), J.st.cap, { orcamento: 40000 });
    if (!J.analise.caminho || !J.analise.caminho.length) return;
  }
  const g = J.gen;
  if (!(await recompensa()) || g !== J.gen || J.fase !== 'jogando') return;
  tele.evento('hint', 'ad');
  if (J.beco) {
    // no beco: volta na hora ate o estado com solucao e mostra a jogada dali
    const alvo = J.hist.length - J.beco.passos;
    while (J.hist.length > alvo + 1) J.hist.pop();
    restaurar(/** @type {any[][]} */ (J.hist.pop()));
  }
  mostrarMao('dica');
}
async function trilhoExtra() {
  if (J.fase !== 'jogando' || J.extraUsado || J.voltando) return;
  const g = J.gen;
  if (!(await recompensa()) || g !== J.gen || J.fase !== 'jogando') return;
  tele.evento('extra', 'ad');
  J.extraUsado = true;
  J.st.trilhos.push([]);
  J.ini.push([]);
  for (const h of J.hist) h.push([]);
  sairDoBeco();
  analisarAgora();
  atualizarHud();
  cena.configurar(J.st, medirLayout(), J.tema);
  cena.tremer(J.st.trilhos.length - 1);
  checarFim();
}

const garagem = criarGaragem({
  textos: T,
  tema: () => J.tema,
  aoEscolher(i) {
    J.loco = i;
    cena.definirPintura(PINTURAS[i]);
    salvar();
    audio.pegar();
  },
  async aoLiberar() {
    if (liberadas(J.nivel, J.extras) >= PINTURAS.length) return false;
    if (!(await recompensa())) return false;
    J.extras++;
    J.loco = liberadas(J.nivel, J.extras) - 1;
    J.vista = Math.max(J.vista, liberadas(J.nivel, J.extras));
    cena.definirPintura(PINTURAS[J.loco]);
    salvar();
    garagem.atualizar({ nivel: J.nivel, extras: J.extras, ativa: J.loco });
    atualizarHud();
    audio.apito();
    return true;
  },
  aoAbrir() {
    poki.gameplayStop();
    J.vista = Math.max(J.vista, liberadas(J.nivel, J.extras));
    salvar();
    atualizarHud();
  },
  aoFechar() {},
});

// ----------------------------------------------------------------- entrada
/** @param {PointerEvent} e */
function ponto(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function idsDoBloco(i) {
  const t = J.st.trilhos[i];
  return t.slice(0, bloco(t)).map((v) => v.id);
}

/** @param {number} i */
function podePegar(i) {
  const t = J.st.trilhos[i];
  return !!t && t.length > 0 && !completo(t, J.st.cap);
}

function desmarcar() {
  J.sel = null;
  cena.selecionar(null);
}

/**
 * Jogada recusada: mostra o motivo (cor da boca ou falta de vaga). Trem
 * pronto so treme, sem som de erro.
 * @param {number} a @param {number} b
 */
function recusar(a, b) {
  const m = motivo(J.st, a, b);
  if (m === 'cap') {
    cena.marcarErro({ tipo: 'cap', tr: b, ids: idsDoBloco(a) });
    audio.erro();
    tele.evento('invalid', 'capacity');
  } else if (m === 'cor') {
    cena.marcarErro({ tipo: 'cor', tr: b });
    audio.erro();
    tele.evento('invalid', 'color');
  } else if (m === 'travado') cena.tremer(b);
}

/** @param {number} i @param {{x:number,y:number}} p */
function pegar(i, p, desmarcarAoSoltar) {
  if (!desmarcarAoSoltar) {
    J.sel = i;
    cena.selecionar(i);
    audio.pegar();
  }
  J.toque = { i, x: p.x, y: p.y, dx: 0, dy: 0, arrastando: false, desmarcar: desmarcarAoSoltar, alvo: -1, ids: idsDoBloco(i) };
  const frente = cena.posVagao(J.toque.ids[0]);
  if (frente) {
    J.toque.dx = frente.x - p.x;
    J.toque.dy = frente.y - p.y;
  }
}

canvas.addEventListener('pointerdown', (e) => {
  audio.iniciar();
  // trens partindo: um toque adianta a troca de nivel
  if (J.fase === 'partindo') {
    proximoNivel();
    return;
  }
  if (J.fase !== 'jogando' || J.voltando) return;
  // so com input real do jogador (regra do Inspector da Poki)
  poki.gameplayStart();
  if (!J.inicioJogo) J.inicioJogo = agora();
  J.ociosoDesde = agora();
  const lay = cena.layout;
  if (!lay) return;
  const p = ponto(e);
  const i = trilhoEm(lay, p.x, p.y);
  // jogada guiada: so os trilhos do passo aceitam toque (fora, nada acontece)
  if (J.guia.length && i >= 0 && !J.guia[0].includes(i)) {
    tele.evento('tutorial', 'wrong');
    if (!J.mao) mostrarMao('guia');
    return;
  }
  // segundo toque: tenta engatar o bloco selecionado aqui
  if (J.sel !== null && i >= 0 && i !== J.sel) {
    if (pode(J.st, J.sel, i)) {
      executar(J.sel, i);
      return;
    }
    // cor diferente num trilho que da para pegar: troca a selecao
    if (motivo(J.st, J.sel, i) === 'cor' && podePegar(i)) {
      pegar(i, p, false);
    } else {
      recusar(J.sel, i);
      desmarcar();
      return;
    }
  } else if (i < 0) {
    desmarcar();
    return;
  } else if (J.sel === i) {
    pegar(i, p, true);
  } else if (podePegar(i)) {
    pegar(i, p, false);
  } else {
    // trilho vazio: nada; trem pronto: treme de leve
    if (J.st.trilhos[i].length) cena.tremer(i);
    return;
  }
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch { /* ignora */ }
});

/** Alvo do arraste com ima: o trilho sob o dedo se valer, senao o valido mais perto. */
function alvoArraste(lay, x, y, origem) {
  const sob = trilhoEm(lay, x, y);
  if (sob >= 0 && sob !== origem && pode(J.st, origem, sob)) return sob;
  const perto = trilhoProximo(lay, x, y, destinos(J.st, origem));
  if (perto >= 0) return perto;
  return sob === origem ? -1 : sob;
}

canvas.addEventListener('pointermove', (e) => {
  const tq = J.toque;
  if (!tq || J.fase !== 'jogando') return;
  const p = ponto(e);
  if (!tq.arrastando && Math.hypot(p.x - tq.x, p.y - tq.y) > 10) {
    tq.arrastando = true;
    tq.desmarcar = false;
    if (!J.guia.length) J.mao = null;
  }
  if (!tq.arrastando) return;
  const lay = cena.layout;
  if (!lay) return;
  cena.arrastar({ ids: tq.ids, x: p.x + tq.dx, y: p.y + tq.dy - lay.L * 0.15 });
  tq.alvo = alvoArraste(lay, p.x, p.y, tq.i);
});

function soltar() {
  const tq = J.toque;
  if (!tq) return;
  J.toque = null;
  if (tq.arrastando) {
    if (tq.alvo >= 0 && J.sel !== null && pode(J.st, J.sel, tq.alvo)) {
      executar(J.sel, tq.alvo);
      return;
    }
    cena.arrastar(null);
    if (tq.alvo >= 0 && J.sel !== null) recusar(J.sel, tq.alvo);
    desmarcar();
    cena.sincronizar();
    return;
  }
  if (tq.desmarcar) desmarcar();
}
canvas.addEventListener('pointerup', soltar);
canvas.addEventListener('pointercancel', soltar);

/** Botoes do HUD tambem contam como input real para o gameplayStart. */
function botao(id, fn) {
  $(id).addEventListener('click', () => {
    audio.iniciar();
    if (J.fase === 'jogando' && !garagem.aberta) {
      poki.gameplayStart();
      if (!J.inicioJogo) J.inicioJogo = agora();
    }
    J.ociosoDesde = agora();
    fn();
  });
}
botao('bDesfazer', desfazer);
botao('bRecomecar', recomecar);
botao('bDica', dica);
botao('bExtra', trilhoExtra);
botao('bVoltar', () => voltarAteSolucao(false));
botao('bSom', () => {
  audio.definirMudo(!audio.mudo);
  salvar();
  atualizarHud();
});
$('bGaragem').addEventListener('click', () => {
  audio.iniciar();
  garagem.atualizar({ nivel: J.nivel, extras: J.extras, ativa: J.loco, comAnuncio: poki.sdkPronto || dep.local });
  garagem.abrir();
});
$('aviso').addEventListener('click', () => $('bGaragem').click());

// som para quando a aba some (a Poki cobra isso)
document.addEventListener('visibilitychange', () => audio.pausarAba(document.hidden));

// ------------------------------------------------------------ ociosidade
// Parado demais: a mao mostra a proxima jogada de graca (niveis iniciais) e,
// no beco, o jogo volta sozinho ate o estado com solucao.
setInterval(() => {
  if (J.fase !== 'jogando' || J.voltando || J.toque || dep.auto || garagem.aberta) return;
  const parado = agora() - J.ociosoDesde;
  if (J.beco) {
    if (agora() - Math.max(J.beco.desde, J.ociosoDesde) >= MS_VOLTAR_SOZINHO) voltarAteSolucao(true);
    return;
  }
  if (J.mao || J.sel !== null || J.pendentes) return;
  const lim = limiarMao(J.nivel);
  if (lim && parado >= lim && mostrarMao('ocioso')) tele.evento('hint', 'free');
}, 250);

// --------------------------------------------------------------- quadro
function quadro(t) {
  const tq = J.toque;
  /** @type {any} */
  const extras = { sel: J.sel };
  if (J.sel !== null && J.fase === 'jogando') extras.destinos = destinos(J.st, J.sel);
  if (tq && tq.arrastando) {
    extras.alvo = tq.alvo;
    extras.alvoValido = tq.alvo >= 0 && J.sel !== null && pode(J.st, J.sel, tq.alvo);
    if (extras.alvoValido) extras.fantasma = { tr: tq.alvo, ids: tq.ids };
  }
  if (J.guia.length && J.fase === 'jogando') extras.foco = J.guia[0];
  if (J.mao && J.fase === 'jogando') {
    const A = J.st.trilhos[J.mao.a];
    const B = J.st.trilhos[J.mao.b];
    const de = A && A.length ? cena.posVagao(A[0].id) : null;
    // a mao leva o bloco ate a boca do destino, encostando nos que estao la
    const para = B ? cena.alvoVaga(J.mao.b, J.st.cap - B.length - 1) : null;
    if (de && para) extras.mao = { de, para, t0: J.mao.t0 };
  }
  cena.desenhar(t, extras);
  requestAnimationFrame(quadro);
}

// --------------------------------------------------------------- teste
function passoAuto() {
  if (J.fase !== 'jogando' || resolvido(J.st)) return;
  const sol = analisar(paraTexto(J.st), J.st.cap, { orcamento: 60000 }).caminho;
  if (!sol || !sol.length) return;
  executar(sol[0][0], sol[0][1]);
  depois(dep.auto, passoAuto);
}

// ---------------------------------------------------------------- inicio
poki.onAdStart = () => audio.mudoParaAnuncio();
poki.onAdEnd = () => audio.voltarDoAnuncio();
poki.init().then(() => {
  // sem SDK (bloqueador) nao ha video, entao os botoes de video somem
  if (!poki.sdkPronto && !dep.local) document.body.classList.add('sem-anuncio');
});
audio.definirMudo(!!save.mudo);
window.addEventListener('resize', redimensionar);
redimensionar();
iniciarNivel(!dep.fixo);
requestAnimationFrame(quadro);
if (dep.ganchos) {
  /** @type {any} */ (window).__ct = {
    J, cena, executar, poki, audio,
    /** joga a solucao sozinho, uma jogada a cada ms */
    auto(ms = 200) {
      dep.auto = ms;
      if (J.fase === 'jogando') passoAuto();
    },
    /** ms do ultimo engate de um nivel ate o input liberado no seguinte */
    get troca() {
      return J.tempos.livre - J.tempos.engate;
    },
  };
}
if (dep.garagem) $('bGaragem').click();
