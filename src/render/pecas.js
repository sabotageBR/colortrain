// Desenho das pecas em 2.5D (vista de 3/4: lateral + teto), tudo em codigo.
//
// Origem de cada peca: centro do vagao na linha do trilho (onde a roda toca).
// O corpo (lateral, teto, janelas, selo) vira sprite em cache por cor e
// tamanho; rodas, biela e sombra sao desenhadas por quadro porque giram.

import { CORES, misturar } from './tema.js';

/** @typedef {import('./tema.js').Tema} Tema */

/** @param {CanvasRenderingContext2D} g */
export function caminhoRet(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Simbolos das cores (ajuda daltonicos): circulo, triangulo, quadrado... */
const SIMBOLOS = [
  (g, r) => g.arc(0, 0, r, 0, Math.PI * 2),
  (g, r) => { g.moveTo(0, -r * 1.12); g.lineTo(r * 1.05, r * 0.78); g.lineTo(-r * 1.05, r * 0.78); g.closePath(); },
  (g, r) => g.rect(-r * 0.86, -r * 0.86, r * 1.72, r * 1.72),
  (g, r) => { g.moveTo(0, -r * 1.18); g.lineTo(r * 0.95, 0); g.lineTo(0, r * 1.18); g.lineTo(-r * 0.95, 0); g.closePath(); },
  (g, r) => {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const q = i % 2 ? r * 0.5 : r * 1.2;
      g.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    }
    g.closePath();
  },
  (g, r) => {
    g.moveTo(0, r * 1.05);
    g.bezierCurveTo(-r * 1.7, -r * 0.15, -r * 0.62, -r * 1.45, 0, -r * 0.45);
    g.bezierCurveTo(r * 0.62, -r * 1.45, r * 1.7, -r * 0.15, 0, r * 1.05);
  },
  (g, r) => { const w = r * 0.42; g.rect(-w, -r, w * 2, r * 2); g.rect(-r, -w, r * 2, w * 2); },
  (g, r) => {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      g.lineTo(Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08);
    }
    g.closePath();
  },
];

/** @param {CanvasRenderingContext2D} g @param {number} k @param {number} r */
export function desenharSimbolo(g, k, r) {
  g.beginPath();
  SIMBOLOS[k % SIMBOLOS.length](g, r);
}

// ------------------------------------------------------------------ sprites
/** @type {Map<string, HTMLCanvasElement>} */
const cache = new Map();

export function limparCache() {
  cache.clear();
}

/**
 * Cria (ou reaproveita) um sprite desenhado em coordenadas locais com a origem
 * em (ox, oy) do canvas.
 * @param {string} chave @param {number} w @param {number} h @param {number} ox @param {number} oy
 * @param {number} dpr @param {(g: CanvasRenderingContext2D) => void} desenho
 */
function sprite(chave, w, h, ox, oy, dpr, desenho) {
  let c = cache.get(chave);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.ceil(w * dpr);
  c.height = Math.ceil(h * dpr);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.scale(dpr, dpr);
  g.translate(ox, oy);
  desenho(g);
  cache.set(chave, c);
  return c;
}

/**
 * Medidas do vagao a partir de L (comprimento).
 * @param {number} L
 */
export function medidasVagao(L) {
  const rw = 0.085 * L;
  const Hs = 0.42 * L;
  const Hr = 0.23 * L;
  const saia = -rw * 1.5; // y da borda de baixo da lateral
  return { L, rw, Hs, Hr, saia, topoLat: saia - Hs, topoTeto: saia - Hs - Hr };
}

/** @param {CanvasRenderingContext2D} g @param {number} cor @param {number} L @param {Tema} tema */
function corpoVagao(g, cor, L, tema) {
  const C = CORES[cor];
  const m = medidasVagao(L);
  const x0 = -L / 2;
  const lw = Math.max(1.1, L * 0.022);
  // teto (visto de cima)
  let gr = g.createLinearGradient(0, m.topoTeto, 0, m.topoLat);
  gr.addColorStop(0, C.teto);
  gr.addColorStop(1, C.claro);
  g.fillStyle = gr;
  caminhoRet(g, x0 + L * 0.015, m.topoTeto, L * 0.97, m.Hr + L * 0.06, L * 0.11);
  g.fill();
  // cumeeira clara no meio do teto
  g.fillStyle = 'rgba(255,255,255,0.45)';
  caminhoRet(g, x0 + L * 0.08, m.topoTeto + m.Hr * 0.3, L * 0.84, m.Hr * 0.16, m.Hr * 0.08);
  g.fill();
  // respiros do teto
  g.fillStyle = C.escuro;
  g.globalAlpha = 0.35;
  for (const q of [-0.24, 0.24]) {
    caminhoRet(g, q * L - L * 0.08, m.topoTeto + m.Hr * 0.55, L * 0.16, m.Hr * 0.26, m.Hr * 0.12);
    g.fill();
  }
  g.globalAlpha = 1;
  // lateral
  gr = g.createLinearGradient(0, m.topoLat, 0, m.saia);
  gr.addColorStop(0, C.claro);
  gr.addColorStop(0.18, C.base);
  gr.addColorStop(0.82, C.base);
  gr.addColorStop(1, C.escuro);
  g.fillStyle = gr;
  caminhoRet(g, x0, m.topoLat, L, m.Hs, L * 0.06);
  g.fill();
  // beiral entre teto e lateral
  g.fillStyle = C.profundo;
  g.globalAlpha = 0.45;
  g.fillRect(x0 + L * 0.02, m.topoLat, L * 0.96, Math.max(1, L * 0.022));
  g.globalAlpha = 1;
  // pontas mais escuras (volume)
  g.fillStyle = 'rgba(0,0,0,0.13)';
  caminhoRet(g, x0, m.topoLat, L * 0.05, m.Hs, L * 0.03); g.fill();
  caminhoRet(g, -x0 - L * 0.05, m.topoLat, L * 0.05, m.Hs, L * 0.03); g.fill();
  // saia inferior
  g.fillStyle = C.profundo;
  g.globalAlpha = 0.55;
  caminhoRet(g, x0 + L * 0.03, m.saia - m.Hs * 0.16, L * 0.94, m.Hs * 0.16, L * 0.03);
  g.fill();
  g.globalAlpha = 1;
  // janelas
  const jy = m.topoLat + m.Hs * 0.13;
  const jh = m.Hs * 0.36;
  const jw = L * 0.2;
  for (const q of [-0.3, 0, 0.3]) {
    const jx = q * L - jw / 2;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    caminhoRet(g, jx - L * 0.012, jy - L * 0.012, jw + L * 0.024, jh + L * 0.024, L * 0.04);
    g.fill();
    gr = g.createLinearGradient(0, jy, 0, jy + jh);
    gr.addColorStop(0, tema.vidroVagao);
    gr.addColorStop(1, tema.vidroVagao2);
    g.fillStyle = gr;
    caminhoRet(g, jx, jy, jw, jh, L * 0.03);
    g.fill();
    if (!tema.noite) {
      // reflexo diagonal
      g.save();
      caminhoRet(g, jx, jy, jw, jh, L * 0.03);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(jx + jw * 0.15, jy + jh);
      g.lineTo(jx + jw * 0.45, jy);
      g.lineTo(jx + jw * 0.65, jy);
      g.lineTo(jx + jw * 0.35, jy + jh);
      g.closePath();
      g.fill();
      g.restore();
    }
  }
  // selo com o simbolo da cor
  const sy = m.topoLat + m.Hs * 0.7;
  const sr = Math.min(m.Hs * 0.2, L * 0.1);
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.arc(0, sy, sr, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = C.escuro;
  g.lineWidth = Math.max(1, L * 0.016);
  g.stroke();
  g.save();
  g.translate(0, sy);
  g.fillStyle = C.escuro;
  desenharSimbolo(g, cor, sr * 0.52);
  g.fill();
  g.restore();
  // faixas laterais finas ao lado do selo
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(x0 + L * 0.08, sy - L * 0.012, L * 0.26, Math.max(1, L * 0.024));
  g.fillRect(-x0 - L * 0.34, sy - L * 0.012, L * 0.26, Math.max(1, L * 0.024));
  // contorno da silhueta
  g.strokeStyle = tema.contorno;
  g.lineWidth = lw;
  caminhoRet(g, x0, m.topoTeto, L, m.saia - m.topoTeto, L * 0.09);
  g.stroke();
}

/**
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y linha do trilho
 * @param {number} cor @param {number} L @param {Tema} tema @param {number} dpr
 * @param {{ roda?: number, escalaY?: number, alfa?: number, brilho?: number }} [o]
 */
export function desenharVagao(ctx, x, y, cor, L, tema, dpr, o = {}) {
  const m = medidasVagao(L);
  const pad = L * 0.08;
  const w = L + pad * 2;
  const h = -m.topoTeto + pad * 2;
  const spr = sprite(`v${cor}|${L.toFixed(2)}|${tema.nome}|${dpr}`, w, h, w / 2, h - pad, dpr, (g) => corpoVagao(g, cor, L, tema));
  rodas(ctx, x, y, L, [-0.33, -0.17, 0.17, 0.33], m.rw, o.roda || 0, tema);
  const ey = o.escalaY || 1;
  ctx.save();
  if (o.alfa != null) ctx.globalAlpha = o.alfa;
  ctx.translate(x, y + m.saia);
  ctx.scale(1, ey);
  ctx.translate(0, -m.saia);
  if (o.brilho) {
    ctx.shadowColor = 'rgba(255,255,255,0.95)';
    ctx.shadowBlur = 18 * o.brilho;
  }
  ctx.drawImage(spr, -w / 2, -(h - pad), w, h);
  ctx.restore();
}

/** Truques com rodas que giram. */
function rodas(ctx, x, y, L, xs, r, ang, tema) {
  ctx.fillStyle = tema.noite ? '#11122a' : '#2a2433';
  // longarina dos truques
  for (const lado of [-1, 1]) {
    caminhoRet(ctx, x + lado * L * 0.27 - L * 0.15, y - r * 1.55, L * 0.3, r * 0.75, r * 0.3);
    ctx.fill();
  }
  for (const q of xs) {
    const cx = x + q * L;
    const cy = y - r;
    ctx.fillStyle = '#25213a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9b98b4';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#25213a';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * r * 0.22, cy + Math.sin(ang) * r * 0.22, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Sombra macia no chao. */
export function desenharSombra(ctx, x, y, w, alfa, tema) {
  ctx.save();
  ctx.translate(x, y + w * 0.02);
  ctx.scale(1, 0.18);
  const r = w * 0.62;
  const gr = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
  gr.addColorStop(0, tema.sombra);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alfa;
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Sanfona entre dois vagoes do mesmo bloco: mostra que estao engatados.
 * @param {number} xa borda direita do vagao da frente @param {number} xb borda esquerda do de tras
 */
export function desenharSanfona(ctx, xa, xb, y, L, cor, tema) {
  const m = medidasVagao(L);
  const w = xb - xa;
  if (w <= 0.5) return;
  const y0 = m.topoLat + m.Hs * 0.08;
  const h = m.Hs * 0.78;
  ctx.fillStyle = CORES[cor].profundo;
  caminhoRet(ctx, xa - 1, y + y0, w + 2, h, Math.min(w / 2, 3));
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(0.8, L * 0.012);
  const dobras = Math.max(2, Math.round(w / (L * 0.035)));
  ctx.beginPath();
  for (let i = 1; i < dobras; i++) {
    const xx = xa + (w * i) / dobras;
    ctx.moveTo(xx, y + y0 + 1);
    ctx.lineTo(xx, y + y0 + h - 1);
  }
  ctx.stroke();
  // engate dourado por baixo: reforca que o bloco anda junto
  ctx.fillStyle = '#F4C430';
  caminhoRet(ctx, xa - L * 0.04, y + m.saia - m.Hs * 0.3, w + L * 0.08, m.Hs * 0.13, m.Hs * 0.06);
  ctx.fill();
  ctx.strokeStyle = tema.contorno;
  ctx.lineWidth = Math.max(0.8, L * 0.012);
  ctx.stroke();
}

/** Engate simples entre vagoes de cores diferentes (soltam-se na proxima jogada). */
export function desenharEngate(ctx, xa, xb, y, L) {
  const m = medidasVagao(L);
  const w = xb - xa;
  if (w <= 0) return;
  ctx.fillStyle = '#3b3550';
  caminhoRet(ctx, xa - 1, y + m.saia - m.Hs * 0.3, w + 2, m.Hs * 0.09, m.Hs * 0.04);
  ctx.fill();
}

// ------------------------------------------------------------ locomotiva
/**
 * @typedef {{ caldeira: string, caldeiraClaro: string, cabine: string, cabineClaro: string,
 *   teto: string, friso: string, roda: string }} Pintura
 */
/**
 * Colecao de pinturas da locomotiva (a garagem): uma nova a cada 5 niveis.
 * @type {(Pintura & { id: string })[]}
 */
export const PINTURAS = [
  { id: 'classica', caldeira: '#2E3150', caldeiraClaro: '#4C5180', cabine: '#D63A3A', cabineClaro: '#F06A5E', teto: '#262840', friso: '#F4C430', roda: '#D63A3A' },
  { id: 'esmeralda', caldeira: '#1F6B4A', caldeiraClaro: '#35A271', cabine: '#F3E7D3', cabineClaro: '#FFFFFF', teto: '#16452F', friso: '#F4C430', roda: '#C9533B' },
  { id: 'real', caldeira: '#22408F', caldeiraClaro: '#3F6AD4', cabine: '#1B2C63', cabineClaro: '#33509E', teto: '#121D42', friso: '#FFD45A', roda: '#FFD45A' },
  { id: 'cereja', caldeira: '#B3202E', caldeiraClaro: '#E64B58', cabine: '#2A2233', cabineClaro: '#4A3C56', teto: '#1A1420', friso: '#F7E3B5', roda: '#2A2233' },
  { id: 'girassol', caldeira: '#E58A1F', caldeiraClaro: '#FFB54D', cabine: '#F5C933', cabineClaro: '#FFE27A', teto: '#8C4A12', friso: '#FFFFFF', roda: '#3A86F2' },
  { id: 'lavanda', caldeira: '#6E4BB8', caldeiraClaro: '#9877E6', cabine: '#EF58AF', cabineClaro: '#FF8FCD', teto: '#3E2873', friso: '#FFE173', roda: '#EF58AF' },
  { id: 'neve', caldeira: '#DCE6F2', caldeiraClaro: '#FFFFFF', cabine: '#5FB3EA', cabineClaro: '#A6DCFF', teto: '#3E6E99', friso: '#3E6E99', roda: '#3E6E99' },
  { id: 'ouro', caldeira: '#1A1A22', caldeiraClaro: '#3D3D4D', cabine: '#D4A017', cabineClaro: '#F7CF5C', teto: '#0E0E14', friso: '#F7CF5C', roda: '#D4A017' },
];

/** @type {Pintura} */
export const PINTURA_CLASSICA = PINTURAS[0];

/** @param {CanvasRenderingContext2D} g @param {number} L @param {Tema} tema @param {Pintura} p */
function corpoLoco(g, L, tema, p) {
  const lw = Math.max(1.1, L * 0.022);
  g.lineJoin = 'round';
  g.strokeStyle = tema.contorno;
  g.lineWidth = lw;
  // estrado
  g.fillStyle = '#26243a';
  caminhoRet(g, -0.62 * L, -0.24 * L, 1.25 * L, 0.09 * L, 0.03 * L);
  g.fill();
  g.stroke();
  // limpa-trilhos
  g.fillStyle = p.friso;
  g.beginPath();
  g.moveTo(-0.62 * L, -0.2 * L);
  g.lineTo(-0.74 * L, -0.03 * L);
  g.lineTo(-0.5 * L, -0.03 * L);
  g.lineTo(-0.5 * L, -0.2 * L);
  g.closePath();
  g.fill();
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = Math.max(0.8, L * 0.012);
  g.beginPath();
  for (const t of [0.33, 0.66]) {
    g.moveTo(-0.62 * L + (-0.12 * L) * t, -0.2 * L + 0.17 * L * t);
    g.lineTo(-0.5 * L, -0.2 * L + 0.17 * L * t);
  }
  g.stroke();
  g.strokeStyle = tema.contorno;
  g.lineWidth = lw;
  // caldeira
  let gr = g.createLinearGradient(0, -0.58 * L, 0, -0.22 * L);
  gr.addColorStop(0, p.caldeiraClaro);
  gr.addColorStop(0.35, p.caldeira);
  gr.addColorStop(1, misturar(p.caldeira, '#000000', 0.5));
  g.fillStyle = gr;
  caminhoRet(g, -0.56 * L, -0.56 * L, 0.8 * L, 0.34 * L, 0.15 * L);
  g.fill();
  g.stroke();
  // frisos dourados
  g.fillStyle = p.friso;
  for (const q of [-0.3, -0.06, 0.16]) g.fillRect(q * L, -0.555 * L, 0.035 * L, 0.33 * L);
  // caixa de fumaca (frente)
  g.fillStyle = '#1b1c2e';
  caminhoRet(g, -0.6 * L, -0.54 * L, 0.16 * L, 0.32 * L, 0.08 * L);
  g.fill();
  g.stroke();
  // chamine
  g.fillStyle = '#1b1c2e';
  g.beginPath();
  g.moveTo(-0.44 * L, -0.55 * L);
  g.lineTo(-0.47 * L, -0.78 * L);
  g.lineTo(-0.3 * L, -0.78 * L);
  g.lineTo(-0.33 * L, -0.55 * L);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = p.friso;
  caminhoRet(g, -0.49 * L, -0.83 * L, 0.21 * L, 0.06 * L, 0.02 * L);
  g.fill();
  g.stroke();
  // domo
  g.fillStyle = p.friso;
  g.beginPath();
  g.ellipse(-0.08 * L, -0.56 * L, 0.08 * L, 0.07 * L, 0, Math.PI, 0);
  g.closePath();
  g.fill();
  g.stroke();
  // farol (base)
  g.fillStyle = '#2b2d45';
  caminhoRet(g, -0.62 * L, -0.66 * L, 0.11 * L, 0.11 * L, 0.03 * L);
  g.fill();
  g.stroke();
  // cabine
  gr = g.createLinearGradient(0, -0.86 * L, 0, -0.18 * L);
  gr.addColorStop(0, p.cabineClaro);
  gr.addColorStop(0.25, p.cabine);
  gr.addColorStop(1, misturar(p.cabine, '#000000', 0.35));
  g.fillStyle = gr;
  caminhoRet(g, 0.2 * L, -0.84 * L, 0.44 * L, 0.66 * L, 0.05 * L);
  g.fill();
  g.stroke();
  // janela da cabine
  g.fillStyle = '#FFF4DE';
  caminhoRet(g, 0.27 * L, -0.76 * L, 0.3 * L, 0.24 * L, 0.05 * L);
  g.fill();
  gr = g.createLinearGradient(0, -0.74 * L, 0, -0.54 * L);
  gr.addColorStop(0, tema.vidroVagao);
  gr.addColorStop(1, tema.vidroVagao2);
  g.fillStyle = gr;
  caminhoRet(g, 0.295 * L, -0.735 * L, 0.25 * L, 0.19 * L, 0.035 * L);
  g.fill();
  // teto da cabine
  g.fillStyle = p.teto;
  caminhoRet(g, 0.15 * L, -0.92 * L, 0.54 * L, 0.1 * L, 0.04 * L);
  g.fill();
  g.stroke();
  // friso da cabine
  g.fillStyle = p.friso;
  g.fillRect(0.2 * L, -0.38 * L, 0.44 * L, 0.03 * L);
}

/**
 * Locomotiva olhando para a esquerda (saida).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ roda?: number, aceso?: boolean, escalaY?: number, pintura?: Pintura }} o
 */
export function desenharLoco(ctx, x, y, L, tema, dpr, o = {}) {
  const p = o.pintura || PINTURA_CLASSICA;
  const ang = o.roda || 0;
  // farol: facho de luz para a frente
  if (o.aceso) {
    const gr = ctx.createLinearGradient(x - 0.6 * L, 0, x - 2.2 * L, 0);
    gr.addColorStop(0, 'rgba(255,240,170,0.55)');
    gr.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - 0.62 * L, y - 0.64 * L);
    ctx.lineTo(x - 2.2 * L, y - 0.98 * L);
    ctx.lineTo(x - 2.2 * L, y - 0.18 * L);
    ctx.lineTo(x - 0.62 * L, y - 0.56 * L);
    ctx.closePath();
    ctx.fill();
  }
  // rodas: duas motrizes grandes, uma guia pequena
  const motrizes = [0.0, 0.36];
  const R = 0.15 * L;
  for (const q of motrizes) {
    const cx = x + q * L;
    const cy = y - R;
    ctx.fillStyle = p.roda;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tema.contorno;
    ctx.lineWidth = Math.max(1, L * 0.02);
    ctx.stroke();
    ctx.strokeStyle = '#F7E6C4';
    ctx.lineWidth = Math.max(0.8, L * 0.015);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = ang + (k * Math.PI) / 4;
      ctx.moveTo(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82);
      ctx.lineTo(cx - Math.cos(a) * R * 0.82, cy - Math.sin(a) * R * 0.82);
    }
    ctx.stroke();
    ctx.fillStyle = '#2b2533';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  const rg = 0.075 * L;
  ctx.fillStyle = p.roda;
  ctx.beginPath();
  ctx.arc(x - 0.45 * L, y - rg, rg, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = tema.contorno;
  ctx.stroke();
  // corpo (sprite)
  const pad = L * 0.1;
  const w = 1.5 * L + pad * 2;
  const h = 0.95 * L + pad * 2;
  const chave = `loco|${L.toFixed(2)}|${tema.nome}|${dpr}|${p.cabine}|${p.caldeira}`;
  const spr = sprite(chave, w, h, w / 2, h - pad, dpr, (g) => corpoLoco(g, L, tema, p));
  const ey = o.escalaY || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ey);
  ctx.drawImage(spr, -w / 2, -(h - pad), w, h);
  ctx.restore();
  // biela ligando as motrizes
  const bx = Math.cos(ang) * R * 0.55;
  const by = Math.sin(ang) * R * 0.55;
  ctx.strokeStyle = '#D9DCE8';
  ctx.lineWidth = Math.max(1.5, L * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + motrizes[0] * L + bx, y - R + by);
  ctx.lineTo(x + motrizes[1] * L + bx, y - R + by);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // lampada do farol
  ctx.fillStyle = o.aceso ? '#FFF6B8' : '#8a8799';
  if (o.aceso) {
    ctx.shadowColor = '#FFF0A0';
    ctx.shadowBlur = L * 0.3;
  }
  ctx.beginPath();
  ctx.arc(x - 0.6 * L, y - 0.605 * L, 0.04 * L, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

/** Ponta da chamine (para a fumaca). */
export const pontaChamine = (x, y, L) => ({ x: x - 0.385 * L, y: y - 0.84 * L });

// ------------------------------------------------------------------ sinal
/** Cabeca do sinal: vermelho (esperando) ou verde (trem pronto). */
export function desenharLuzSinal(ctx, x, y, L, verde, tema) {
  const topo = y - 0.74 * L;
  const w = 0.17 * L, h = 0.3 * L;
  ctx.fillStyle = '#1f1d2e';
  caminhoRet(ctx, x - w / 2, topo, w, h, w * 0.45);
  ctx.fill();
  ctx.strokeStyle = tema.contorno;
  ctx.lineWidth = Math.max(1, L * 0.016);
  ctx.stroke();
  const luzes = [
    { cy: topo + h * 0.28, cor: '#FF4A4A', on: !verde },
    { cy: topo + h * 0.72, cor: '#4CE36B', on: verde },
  ];
  for (const l of luzes) {
    ctx.fillStyle = l.on ? l.cor : '#3a3548';
    if (l.on) {
      ctx.shadowColor = l.cor;
      ctx.shadowBlur = L * 0.25;
    }
    ctx.beginPath();
    ctx.arc(x, l.cy, 0.05 * L, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ------------------------------------------------------------------- mao
/** Mao do tutorial (ponta do dedo em x, y). */
export function desenharMao(ctx, x, y, s, apertando) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (apertando ? 0.92 : 1), s * (apertando ? 0.92 : 1));
  ctx.rotate(-0.25);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#2A2140';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.moveTo(-5, 4);
  ctx.lineTo(-5, 26);
  ctx.lineTo(-13, 21);
  ctx.quadraticCurveTo(-20, 20, -17, 28);
  ctx.lineTo(-6, 44);
  ctx.quadraticCurveTo(4, 50, 17, 44);
  ctx.quadraticCurveTo(24, 34, 22, 22);
  ctx.lineTo(22, 18);
  ctx.quadraticCurveTo(19, 13, 15, 17);
  ctx.quadraticCurveTo(13, 11, 8, 15);
  ctx.quadraticCurveTo(6, 10, 3, 14);
  ctx.lineTo(3, 4);
  ctx.quadraticCurveTo(-1, -3, -5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.stroke();
  ctx.restore();
}
