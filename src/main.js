// Ponto de entrada do Color Train: liga estado, cena, entrada, HUD e som.
//
// Fluxo de um nivel: os vagoes chegam pela direita -> o jogador leva blocos
// da frente de um trilho para o fim de outro (toque-toque ou arraste) ->
// cada trem de uma cor so ganha locomotiva -> com todos prontos, os trens
// partem e o proximo nivel chega sem tela no meio.

import { criarCena } from './render/cena.js';
import { calcularLayout, trilhoEm } from './render/layout.js';
import { TEMAS } from './render/tema.js';
import { bloco, pode, mover, resolvido, jogadas, destinos, paraTexto, completo } from './jogo/regras.js';
import { definicaoNivel } from './jogo/catalogo.js';
import { resolver } from './jogo/solucionador.js';
import { criarAudio } from './core/audio.js';
import { criarArmazem } from './core/armazenamento.js';
import { escolherIdioma, textos } from './i18n/textos.js';
import { lerDepuracao } from './core/depuracao.js';

const $ = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));
const canvas = /** @type {HTMLCanvasElement} */ ($('cena'));
const cena = criarCena(canvas);
const audio = criarAudio();
const armazem = criarArmazem();
const dep = lerDepuracao();
const T = textos(escolherIdioma());

const VERSAO_SAVE = 1;
const salvo = armazem.ler('save', null);
const save = salvo && salvo.v === VERSAO_SAVE ? salvo : { v: VERSAO_SAVE, nivel: 1, mudo: false };

/** @typedef {import('./jogo/regras.js').Estado} Estado */
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
  /** 'chegando' | 'jogando' | 'partindo' */
  fase: 'chegando',
  /** @type {null|{ i: number, x: number, y: number, dx: number, dy: number, arrastando: boolean, desmarcar: boolean, alvo: number, ids: number[] }} */
  toque: null,
  /** @type {null|{ a: number, b: number, t0: number }} */
  mao: null,
  pendentes: 0,
  gen: 0,
  desf: 0,
  extraUsado: false,
  tema: TEMAS[dep.tema] || TEMAS.dia,
};

function salvar() {
  armazem.gravar('save', { v: VERSAO_SAVE, nivel: J.nivel, mudo: audio.mudo });
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
}

// -------------------------------------------------------------------- HUD
function atualizarHud() {
  $('placaRotulo').textContent = T.nivel;
  $('placaNum').textContent = String(J.nivel);
  const placa = $('placa');
  placa.classList.remove('pop');
  void placa.offsetWidth;
  placa.classList.add('pop');
  $('bExtra').toggleAttribute('disabled', J.extraUsado);
  for (const [id, chave] of [['bDesfazer', 'desfazer'], ['bRecomecar', 'recomecar'], ['bDica', 'dica'], ['bExtra', 'extra'], ['bSom', 'som']]) {
    $(id).setAttribute('aria-label', T[chave]);
    $(id).title = T[chave];
  }
  const svg = $('bSom');
  svg.querySelectorAll('.ligado').forEach((e) => /** @type {SVGElement} */ (e).style.display = audio.mudo ? 'none' : '');
  /** @type {SVGElement} */ (svg.querySelector('.desligado')).style.display = audio.mudo ? '' : 'none';
  if (audio.mudo) /** @type {SVGElement} */ (svg.querySelector('.ligado')).style.display = '';
}

/** @param {boolean} sim */
function pulsarAjuda(sim) {
  for (const id of ['bDesfazer', 'bRecomecar', 'bExtra']) $(id).classList.toggle('pulsar', sim && !(id === 'bExtra' && J.extraUsado));
}

// ------------------------------------------------------------------- nivel
function iniciarNivel(chegar = true) {
  J.gen++;
  J.desf = 0;
  const def = definicaoNivel(J.nivel);
  J.st = criarEstado(def);
  J.ini = foto();
  J.hist = [];
  J.sel = null;
  J.mao = null;
  J.toque = null;
  J.pendentes = 0;
  J.extraUsado = false;
  pulsarAjuda(false);
  atualizarHud();
  cena.configurar(J.st, medirLayout(), J.tema, { novo: true });
  J.fase = 'chegando';
  const ms = chegar ? cena.chegada() : 0;
  if (chegar) audio.chuchu(6);
  depois(ms + 40, () => {
    J.fase = 'jogando';
    if (J.nivel <= 2) mostrarMao();
    if (dep.auto) depois(dep.auto, passoAuto);
  });
}

function mostrarMao() {
  const sol = resolver(paraTexto(J.st), J.st.cap, { orcamento: 40000 });
  if (sol && sol.length) J.mao = { a: sol[0][0], b: sol[0][1], t0: performance.now() };
  return !!(sol && sol.length);
}

function executar(a, b) {
  J.hist.push(foto());
  const ev = mover(J.st, a, b);
  J.sel = null;
  J.mao = null;
  J.toque = null;
  cena.arrastar(null);
  cena.selecionar(null);
  pulsarAjuda(false);
  const ms = cena.sincronizar();
  audio.voar();
  depois(ms, () => {
    audio.engate();
    cena.engatou(b);
    if (ev.completou) completar(b);
    else checarFim();
  });
}

function completar(tr) {
  J.pendentes++;
  const ms = cena.chegarLoco(tr);
  audio.chuchu(4);
  depois(ms, () => {
    J.pendentes--;
    audio.engate();
    audio.apito();
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
  if (!jogadas(J.st).length) pulsarAjuda(true);
}

function partir() {
  J.fase = 'partindo';
  J.sel = null;
  cena.selecionar(null);
  audio.vitoria();
  audio.apito(0.35);
  audio.chuchu(14, 0.5);
  const ms = cena.partir();
  depois(ms + 120, proximoNivel);
}

function proximoNivel() {
  J.nivel++;
  salvar();
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
  cena.arrastar(null);
  cena.selecionar(null);
  pulsarAjuda(false);
  cena.sincronizar();
}

// ------------------------------------------------------------- recompensa
/** Rewarded: ate a etapa da Poki, libera direto. @returns {Promise<boolean>} */
async function recompensa() {
  return true;
}

// ------------------------------------------------------------------ acoes
function desfazer() {
  if (J.fase !== 'jogando' || !J.hist.length) return;
  restaurar(/** @type {any[][]} */ (J.hist.pop()));
}
function recomecar() {
  if (J.fase !== 'jogando') return;
  restaurar(J.ini);
  J.hist = [];
}
async function dica() {
  if (J.fase !== 'jogando') return;
  if (!(await recompensa())) return;
  if (!mostrarMao()) pulsarAjuda(true);
}
async function trilhoExtra() {
  if (J.fase !== 'jogando' || J.extraUsado) return;
  if (!(await recompensa())) return;
  J.extraUsado = true;
  J.st.trilhos.push([]);
  J.ini.push([]);
  for (const h of J.hist) h.push([]);
  atualizarHud();
  pulsarAjuda(false);
  cena.configurar(J.st, medirLayout(), J.tema);
  cena.tremer(J.st.trilhos.length - 1);
}

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

canvas.addEventListener('pointerdown', (e) => {
  audio.iniciar();
  if (J.fase !== 'jogando') return;
  const lay = cena.layout;
  if (!lay) return;
  const p = ponto(e);
  const i = trilhoEm(lay, p.x, p.y);
  // segundo toque: tenta engatar o bloco selecionado aqui
  if (J.sel !== null && i >= 0 && i !== J.sel) {
    if (pode(J.st, J.sel, i)) executar(J.sel, i);
    else {
      cena.tremer(i);
      audio.erro();
      J.sel = null;
      cena.selecionar(null);
    }
    return;
  }
  if (i < 0) {
    J.sel = null;
    cena.selecionar(null);
    return;
  }
  if (J.sel === i) {
    J.toque = { i, x: p.x, y: p.y, dx: 0, dy: 0, arrastando: false, desmarcar: true, alvo: -1, ids: idsDoBloco(i) };
  } else if (podePegar(i)) {
    J.sel = i;
    cena.selecionar(i);
    audio.pegar();
    J.toque = { i, x: p.x, y: p.y, dx: 0, dy: 0, arrastando: false, desmarcar: false, alvo: -1, ids: idsDoBloco(i) };
  } else {
    cena.tremer(i);
    audio.erro();
    return;
  }
  const frente = cena.posVagao(J.toque.ids[0]);
  if (frente) {
    J.toque.dx = frente.x - p.x;
    J.toque.dy = frente.y - p.y;
  }
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch { /* ignora */ }
});

canvas.addEventListener('pointermove', (e) => {
  const tq = J.toque;
  if (!tq || J.fase !== 'jogando') return;
  const p = ponto(e);
  if (!tq.arrastando && Math.hypot(p.x - tq.x, p.y - tq.y) > 10) {
    tq.arrastando = true;
    tq.desmarcar = false;
    J.mao = null;
  }
  if (!tq.arrastando) return;
  const lay = cena.layout;
  if (!lay) return;
  cena.arrastar({ ids: tq.ids, x: p.x + tq.dx, y: p.y + tq.dy - lay.L * 0.15 });
  const alvo = trilhoEm(lay, p.x, p.y);
  tq.alvo = alvo === tq.i ? -1 : alvo;
});

function soltar(/** @type {PointerEvent} */ e) {
  const tq = J.toque;
  if (!tq) return;
  J.toque = null;
  if (tq.arrastando) {
    if (tq.alvo >= 0 && J.sel !== null && pode(J.st, J.sel, tq.alvo)) {
      executar(J.sel, tq.alvo);
      return;
    }
    cena.arrastar(null);
    if (tq.alvo >= 0) {
      cena.tremer(tq.alvo);
      audio.erro();
    }
    J.sel = null;
    cena.selecionar(null);
    cena.sincronizar();
    return;
  }
  if (tq.desmarcar) {
    J.sel = null;
    cena.selecionar(null);
  }
  void e;
}
canvas.addEventListener('pointerup', soltar);
canvas.addEventListener('pointercancel', soltar);

$('bDesfazer').addEventListener('click', () => { audio.iniciar(); desfazer(); });
$('bRecomecar').addEventListener('click', () => { audio.iniciar(); recomecar(); });
$('bDica').addEventListener('click', () => { audio.iniciar(); dica(); });
$('bExtra').addEventListener('click', () => { audio.iniciar(); trilhoExtra(); });
$('bSom').addEventListener('click', () => {
  audio.iniciar();
  audio.definirMudo(!audio.mudo);
  salvar();
  atualizarHud();
});

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
  if (J.mao && J.fase === 'jogando') {
    const A = J.st.trilhos[J.mao.a];
    const de = A && A.length ? cena.posVagao(A[0].id) : null;
    const para = cena.alvoVaga(J.mao.b, J.st.trilhos[J.mao.b].length);
    if (de) extras.mao = { de, para, t0: J.mao.t0 };
  }
  cena.desenhar(t, extras);
  requestAnimationFrame(quadro);
}

// --------------------------------------------------------------- teste
function passoAuto() {
  if (J.fase !== 'jogando' || resolvido(J.st)) return;
  const sol = resolver(paraTexto(J.st), J.st.cap, { orcamento: 60000 });
  if (!sol || !sol.length) return;
  executar(sol[0][0], sol[0][1]);
  depois(dep.auto, passoAuto);
}

// ---------------------------------------------------------------- inicio
audio.definirMudo(!!save.mudo);
window.addEventListener('resize', redimensionar);
redimensionar();
iniciarNivel(!dep.fixo);
requestAnimationFrame(quadro);
if (dep.local) /** @type {any} */ (window).__ct = { J, cena, executar };
