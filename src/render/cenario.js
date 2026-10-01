// Camada estatica: ceu, morros, estacao, patio, vegetacao e os trilhos
// (lastro, dormentes, trilhos de aco, para-choque, poste do sinal). Desenhada
// uma vez por layout num canvas fora da tela; a cena so copia por quadro.

import { caminhoRet } from './pecas.js';
import { criarRng } from '../core/rng.js';

/** @typedef {import('./tema.js').Tema} Tema */
/** @typedef {ReturnType<typeof import('./layout.js').calcularLayout>} Layout */

/**
 * @param {Layout} lay @param {Tema} tema @param {number} dpr
 * @returns {HTMLCanvasElement}
 */
export function desenharCenario(lay, tema, dpr) {
  const { W, H, L } = lay;
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.scale(dpr, dpr);
  const r = criarRng(1234);

  const fach = lay.fachada;
  const yChao = fach ? fach.y1 - Math.min(fach.alt * 0.18, L * 0.45) : lay.yTabuleiro - L * 0.55;

  ceu(g, W, yChao, tema, r);
  morros(g, W, yChao, tema, L);
  // chao (grama)
  g.fillStyle = tema.grama;
  g.fillRect(0, yChao, W, H - yChao);
  tufos(g, W, yChao, H, tema, r, L);

  // patio de manobras: piso por baixo de todos os trilhos
  const px0 = Math.max(0, lay.xIni - L * 0.7);
  const px1 = Math.min(W, lay.xFim + L * 0.7);
  const py0 = fach ? fach.y1 : lay.yTabuleiro - L * 0.2;
  const py1 = Math.min(H + 20, lay.yFimTabuleiro + L * 0.55);
  patio(g, 0, py0, W, py1 - py0, tema, L, px0, px1);

  if (fach) estacao(g, lay, tema, r);
  arvoresLaterais(g, lay, tema, r, py0, py1);

  lay.trilhos.forEach((t) => trilho(g, lay, t, tema, r));

  if (tema.noite) postesNoite(g, lay, tema, py0, py1);
  return c;
}

// ------------------------------------------------------------------- ceu
function ceu(g, W, yChao, tema, r) {
  const gr = g.createLinearGradient(0, 0, 0, Math.max(1, yChao));
  gr.addColorStop(0, tema.ceu[0]);
  gr.addColorStop(0.6, tema.ceu[1]);
  gr.addColorStop(1, tema.ceu[2]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, yChao + 2);
  if (tema.noite) {
    for (let i = 0; i < 140; i++) {
      const x = r() * W;
      const y = r() * yChao * 0.9;
      g.globalAlpha = 0.25 + r() * 0.7;
      g.fillStyle = r() < 0.15 ? '#FFE9A8' : '#FFFFFF';
      const s = r() < 0.08 ? 2.2 : 1.2;
      g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    // lua
    const lx = W * 0.82, ly = Math.max(40, yChao * 0.28), lr = Math.min(W, yChao) * 0.07 + 10;
    const halo = g.createRadialGradient(lx, ly, lr * 0.5, lx, ly, lr * 3.2);
    halo.addColorStop(0, 'rgba(255,240,200,0.35)');
    halo.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = halo;
    g.fillRect(lx - lr * 3.2, ly - lr * 3.2, lr * 6.4, lr * 6.4);
    g.fillStyle = '#FFF4D6';
    g.beginPath();
    g.arc(lx, ly, lr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(200,190,170,0.35)';
    for (const [dx, dy, rr] of [[-0.3, -0.2, 0.22], [0.25, 0.3, 0.16], [0.1, -0.35, 0.1]]) {
      g.beginPath();
      g.arc(lx + dx * lr, ly + dy * lr, rr * lr, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // sol suave e nuvens
    const sx = W * 0.85, sy = Math.max(30, yChao * 0.25);
    const sol = g.createRadialGradient(sx, sy, 4, sx, sy, Math.min(W, 300) * 0.4);
    sol.addColorStop(0, 'rgba(255,250,220,0.95)');
    sol.addColorStop(0.15, 'rgba(255,245,200,0.6)');
    sol.addColorStop(1, 'rgba(255,245,200,0)');
    g.fillStyle = sol;
    g.fillRect(0, 0, W, yChao);
    const n = Math.max(3, Math.round(W / 220));
    for (let i = 0; i < n; i++) {
      nuvem(g, (W / n) * (i + 0.2 + r() * 0.6), yChao * (0.15 + r() * 0.45), 26 + r() * 30, tema);
    }
  }
}

function nuvem(g, x, y, s, tema) {
  g.fillStyle = 'rgba(120,170,210,0.25)';
  g.beginPath();
  g.ellipse(x, y + s * 0.42, s * 1.6, s * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = tema.nuvem;
  for (const [dx, dy, rr] of [[-0.9, 0.15, 0.55], [-0.3, -0.2, 0.75], [0.45, -0.05, 0.62], [1.0, 0.2, 0.45]]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillRect(x - s * 1.3, y + s * 0.05, s * 2.6, s * 0.38);
}

function morros(g, W, yChao, tema, L) {
  const camadas = [
    { cor: tema.morros[0], alt: L * 1.4, fase: 0.3, freq: 2.2 },
    { cor: tema.morros[1], alt: L * 0.85, fase: 1.7, freq: 3.1 },
  ];
  for (const m of camadas) {
    g.fillStyle = m.cor;
    g.beginPath();
    g.moveTo(0, yChao + 2);
    for (let x = 0; x <= W; x += 8) {
      const t = x / W;
      const y = yChao - m.alt * (0.55 + 0.3 * Math.sin(t * Math.PI * m.freq + m.fase) + 0.15 * Math.sin(t * Math.PI * m.freq * 2.7 + m.fase * 2));
      g.lineTo(x, y);
    }
    g.lineTo(W, yChao + 2);
    g.closePath();
    g.fill();
  }
}

function tufos(g, W, y0, H, tema, r, L) {
  g.strokeStyle = tema.gramaTufo;
  g.lineWidth = Math.max(1, L * 0.02);
  g.lineCap = 'round';
  const n = Math.round((W * (H - y0)) / 900);
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const y = y0 + r() * (H - y0);
    const s = L * (0.05 + r() * 0.06);
    g.moveTo(x - s, y);
    g.lineTo(x - s * 1.3, y - s * 1.4);
    g.moveTo(x, y);
    g.lineTo(x, y - s * 1.8);
    g.moveTo(x + s, y);
    g.lineTo(x + s * 1.3, y - s * 1.4);
  }
  g.stroke();
  g.lineCap = 'butt';
}

// ----------------------------------------------------------------- patio
function patio(g, x, y, w, h, tema, L, px0, px1) {
  // grama nas laterais, piso so na faixa do patio
  g.fillStyle = tema.patio;
  caminhoRet(g, px0, y, px1 - px0, h, L * 0.3);
  g.fill();
  // bordas de concreto
  g.strokeStyle = tema.patioJunta;
  g.lineWidth = Math.max(2, L * 0.06);
  g.stroke();
  // juntas do piso
  g.strokeStyle = tema.patioJunta;
  g.lineWidth = 1;
  g.globalAlpha = 0.55;
  const passo = L * 0.9;
  g.beginPath();
  for (let yy = y + passo; yy < y + h; yy += passo) {
    g.moveTo(px0 + 4, yy);
    g.lineTo(px1 - 4, yy);
  }
  for (let xx = px0 + passo * 0.5; xx < px1; xx += passo * 1.6) {
    g.moveTo(xx, y + 4);
    g.lineTo(xx, y + h - 4);
  }
  g.stroke();
  g.globalAlpha = 1;
}

// --------------------------------------------------------------- estacao
function estacao(g, lay, tema, r) {
  const { W, L } = lay;
  const f = /** @type {NonNullable<Layout['fachada']>} */ (lay.fachada);
  const largura = Math.min(W * 0.96, lay.xFim - lay.xIni + L * 2.2);
  const cx = (lay.xIni + lay.xFim) / 2;
  const x0 = cx - largura / 2;
  const base = f.y1;
  const altParede = Math.min(f.alt * 0.62, L * 1.5);
  const topoParede = base - altParede;

  // plataforma (calcada) na frente da estacao
  const platAlt = Math.max(6, L * 0.2);
  // sombra do predio
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(x0 - L * 0.1, base - platAlt * 0.2, largura + L * 0.2, platAlt * 0.8);

  // parede
  let gr = g.createLinearGradient(0, topoParede, 0, base);
  gr.addColorStop(0, tema.parede);
  gr.addColorStop(1, tema.paredeSombra);
  g.fillStyle = gr;
  g.fillRect(x0, topoParede, largura, altParede);
  // rodape
  g.fillStyle = tema.paredeSombra;
  g.fillRect(x0, base - altParede * 0.16, largura, altParede * 0.16);

  // janelas em arco
  const nj = Math.max(3, Math.floor(largura / (L * 0.9)));
  const passo = largura / nj;
  const jw = Math.min(passo * 0.46, L * 0.42);
  const jh = altParede * 0.48;
  const jy = topoParede + altParede * 0.2;
  for (let i = 0; i < nj; i++) {
    const jx = x0 + passo * (i + 0.5) - jw / 2;
    if (Math.abs(jx + jw / 2 - cx) < passo * 0.6) continue; // espaco da torre
    g.fillStyle = '#FFFFFF';
    janelaArco(g, jx - 2, jy - 2, jw + 4, jh + 4);
    g.fill();
    if (tema.noite) {
      const gj = g.createLinearGradient(0, jy, 0, jy + jh);
      gj.addColorStop(0, '#FFE7A0');
      gj.addColorStop(1, '#FFB84D');
      g.fillStyle = gj;
    } else {
      g.fillStyle = tema.janelaEstacao;
    }
    janelaArco(g, jx, jy, jw, jh);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(jx + jw / 2, jy + jw * 0.2);
    g.lineTo(jx + jw / 2, jy + jh);
    g.moveTo(jx, jy + jh * 0.55);
    g.lineTo(jx + jw, jy + jh * 0.55);
    g.stroke();
  }

  // telhado com beiral
  const beiral = L * 0.25;
  const altTelhado = Math.min(altParede * 0.42, L * 0.62);
  g.fillStyle = tema.telhado;
  g.beginPath();
  g.moveTo(x0 - beiral, topoParede + 2);
  g.lineTo(x0 + beiral * 0.8, topoParede - altTelhado);
  g.lineTo(x0 + largura - beiral * 0.8, topoParede - altTelhado);
  g.lineTo(x0 + largura + beiral, topoParede + 2);
  g.closePath();
  g.fill();
  // telhas
  g.strokeStyle = tema.telhadoEscuro;
  g.lineWidth = Math.max(1, L * 0.025);
  g.beginPath();
  for (let k = 1; k < 4; k++) {
    const yy = topoParede - altTelhado + (altTelhado * k) / 4;
    const recuo = beiral * 0.8 - ((beiral * 1.8) * k) / 4;
    g.moveTo(x0 + recuo, yy);
    g.lineTo(x0 + largura - recuo, yy);
  }
  g.stroke();
  g.fillStyle = tema.telhadoEscuro;
  g.fillRect(x0 - beiral, topoParede, largura + beiral * 2, Math.max(3, L * 0.07));

  // torre do relogio
  const tw = Math.min(L * 1.15, largura * 0.22);
  const th = altParede + altTelhado * 1.9;
  const tx = cx - tw / 2;
  const ty = base - th;
  gr = g.createLinearGradient(0, ty, 0, base);
  gr.addColorStop(0, tema.parede);
  gr.addColorStop(1, tema.paredeSombra);
  g.fillStyle = gr;
  g.fillRect(tx, ty, tw, th);
  g.strokeStyle = 'rgba(0,0,0,0.12)';
  g.lineWidth = 1;
  g.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
  // telhado da torre
  g.fillStyle = tema.telhado;
  g.beginPath();
  g.moveTo(tx - L * 0.1, ty + 1);
  g.lineTo(cx, ty - tw * 0.55);
  g.lineTo(tx + tw + L * 0.1, ty + 1);
  g.closePath();
  g.fill();
  g.fillStyle = tema.telhadoEscuro;
  g.fillRect(tx - L * 0.1, ty, tw + L * 0.2, Math.max(2, L * 0.05));
  // relogio
  const rr = tw * 0.32;
  const rcy = ty + tw * 0.5;
  g.fillStyle = tema.noite ? '#FFF1C9' : '#FFFFFF';
  if (tema.noite) {
    g.shadowColor = '#FFE7A0';
    g.shadowBlur = 16;
  }
  g.beginPath();
  g.arc(cx, rcy, rr, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.strokeStyle = '#3A3550';
  g.lineWidth = Math.max(1.5, rr * 0.12);
  g.stroke();
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, rcy);
  g.lineTo(cx - rr * 0.38, rcy - rr * 0.36);
  g.moveTo(cx, rcy);
  g.lineTo(cx + rr * 0.55, rcy - rr * 0.32);
  g.stroke();
  g.lineCap = 'butt';
  // porta em arco da torre
  g.fillStyle = tema.noite ? '#FFC85C' : '#6B4A37';
  janelaArco(g, cx - tw * 0.22, base - altParede * 0.62, tw * 0.44, altParede * 0.62);
  g.fill();

  // plataforma com faixa de seguranca
  g.fillStyle = tema.plataforma;
  g.fillRect(x0 - beiral, base - platAlt * 0.3, largura + beiral * 2, platAlt);
  g.fillStyle = tema.faixaSeguranca;
  g.fillRect(x0 - beiral, base + platAlt * 0.45, largura + beiral * 2, Math.max(2, platAlt * 0.22));
  // postes de luz na plataforma
  const np = Math.max(2, Math.floor(largura / (L * 2.6)));
  for (let i = 0; i < np; i++) {
    const lx = x0 + (largura * (i + 0.5)) / np;
    if (Math.abs(lx - cx) < tw * 0.8) continue;
    poste(g, lx, base + platAlt * 0.2, L * 0.85, tema);
  }
}

function janelaArco(g, x, y, w, h) {
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + w / 2);
  g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  g.lineTo(x + w, y + h);
  g.closePath();
}

function poste(g, x, y, h, tema) {
  g.fillStyle = '#3A3550';
  g.fillRect(x - h * 0.03, y - h, h * 0.06, h);
  g.fillRect(x - h * 0.08, y - h * 0.04, h * 0.16, h * 0.06);
  if (tema.noite) {
    const halo = g.createRadialGradient(x, y - h, 2, x, y - h, h * 0.7);
    halo.addColorStop(0, 'rgba(255,220,140,0.55)');
    halo.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = halo;
    g.fillRect(x - h * 0.7, y - h * 1.7, h * 1.4, h * 1.4);
  }
  g.fillStyle = tema.noite ? '#FFE7A0' : '#FFF8E0';
  g.beginPath();
  g.arc(x, y - h, h * 0.09, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#3A3550';
  g.lineWidth = 1.5;
  g.stroke();
}

// ------------------------------------------------------------- vegetacao
function arvoresLaterais(g, lay, tema, r, py0, py1) {
  const { W, L } = lay;
  const esq = lay.xIni - L * 0.7;
  const dir = W - (lay.xFim + L * 0.7);
  const linhas = [];
  for (let y = py0 + L * 0.6; y < py1 + L; y += L * 1.25) linhas.push(y);
  // do lado esquerdo passam os trilhos de saida: arvore so fora dessas faixas
  const yTopoTrilhos = lay.trilhos.length ? lay.trilhos[0].yb - L * 0.45 : 0;
  const yBaseTrilhos = lay.trilhos.length ? lay.trilhos[lay.trilhos.length - 1].yb + L * 1.05 : 0;
  const lado = (x0, x1, semente) => {
    const largura = x1 - x0;
    if (largura < L * 0.9) return;
    const cols = Math.max(1, Math.floor(largura / (L * 1.3)));
    for (const y of linhas) {
      if (semente === 1 && y > yTopoTrilhos && y < yBaseTrilhos) continue;
      for (let k = 0; k < cols; k++) {
        if (r() < 0.35) continue;
        const x = x0 + (largura * (k + 0.5)) / cols + (r() - 0.5) * L * 0.4;
        if (r() < 0.6) arvore(g, x, y + (r() - 0.5) * L * 0.3, L * (0.75 + r() * 0.35), tema);
        else arbusto(g, x, y, L * (0.5 + r() * 0.2), tema);
      }
    }
    void semente;
  };
  lado(0, esq, 1);
  lado(W - dir, W, 2);
  // caixa d'agua: marco ferroviario no lado direito, se couber
  if (dir > L * 2.4) caixaDagua(g, W - dir * 0.5, py0 + L * 2.2, L, tema);
}

function arvore(g, x, y, s, tema) {
  g.fillStyle = 'rgba(0,0,0,0.16)';
  g.beginPath();
  g.ellipse(x, y, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = tema.noite ? '#2a2236' : '#7A5236';
  g.fillRect(x - s * 0.06, y - s * 0.45, s * 0.12, s * 0.45);
  g.fillStyle = tema.copa;
  for (const [dx, dy, rr] of [[-0.2, -0.62, 0.3], [0.2, -0.62, 0.3], [0, -0.85, 0.34]]) {
    g.beginPath();
    g.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = tema.copaClara;
  g.beginPath();
  g.arc(x - s * 0.08, y - s * 0.92, s * 0.16, 0, Math.PI * 2);
  g.fill();
}

function arbusto(g, x, y, s, tema) {
  g.fillStyle = 'rgba(0,0,0,0.14)';
  g.beginPath();
  g.ellipse(x, y, s * 0.5, s * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = tema.copa;
  for (const [dx, rr] of [[-0.25, 0.28], [0.22, 0.3], [0, 0.36]]) {
    g.beginPath();
    g.arc(x + dx * s, y - s * 0.22, rr * s, Math.PI, 0);
    g.fill();
  }
  if (!tema.noite) {
    g.fillStyle = '#FF7AA8';
    for (const [dx, dy] of [[-0.2, -0.35], [0.15, -0.42], [0.3, -0.22]]) {
      g.beginPath();
      g.arc(x + dx * s, y + dy * s, s * 0.05, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function caixaDagua(g, x, y, L, tema) {
  const s = L;
  g.fillStyle = 'rgba(0,0,0,0.15)';
  g.beginPath();
  g.ellipse(x, y, s * 0.6, s * 0.14, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = tema.noite ? '#4a4566' : '#6B4A37';
  g.lineWidth = Math.max(2, s * 0.06);
  g.beginPath();
  g.moveTo(x - s * 0.4, y);
  g.lineTo(x - s * 0.25, y - s * 1.1);
  g.moveTo(x + s * 0.4, y);
  g.lineTo(x + s * 0.25, y - s * 1.1);
  g.moveTo(x - s * 0.36, y - s * 0.4);
  g.lineTo(x + s * 0.36, y - s * 0.4);
  g.stroke();
  g.fillStyle = tema.noite ? '#5B4E7A' : '#B5643C';
  caminhoRet(g, x - s * 0.45, y - s * 1.75, s * 0.9, s * 0.7, s * 0.08);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let k = 1; k < 4; k++) g.fillRect(x - s * 0.45, y - s * 1.75 + (s * 0.7 * k) / 4, s * 0.9, 1.5);
  g.fillStyle = tema.noite ? '#4a3f68' : '#8E4A2B';
  g.beginPath();
  g.moveTo(x - s * 0.52, y - s * 1.74);
  g.lineTo(x, y - s * 2.05);
  g.lineTo(x + s * 0.52, y - s * 1.74);
  g.closePath();
  g.fill();
}

function postesNoite(g, lay, tema, py0, py1) {
  const { L } = lay;
  for (const x of [lay.xIni - L * 0.35, lay.xFim + L * 0.35]) {
    for (let y = py0 + L * 1.6; y < py1; y += L * 2.6) poste(g, x, y, L * 0.8, tema);
  }
}

// ---------------------------------------------------------------- trilho
/**
 * Um trilho: o lastro vai do sinal ao para-choque; os trilhos de aco seguem
 * ate a borda esquerda da tela (caminho da partida).
 */
function trilho(g, lay, t, tema, r) {
  const { L, P, cap } = lay;
  const y = t.yb;
  const leitoTopo = y - L * 0.27;
  const leitoBase = y + L * 0.14;
  const x0 = t.xIni;
  const x1 = t.xFim;

  // caminho de saida: lastro estreito ate a borda esquerda
  g.fillStyle = tema.lastroEscuro;
  g.globalAlpha = 0.55;
  g.fillRect(0, leitoTopo + L * 0.05, x0 + 4, leitoBase - leitoTopo - L * 0.08);
  g.globalAlpha = 1;

  // lastro
  let gr = g.createLinearGradient(0, leitoTopo, 0, leitoBase);
  gr.addColorStop(0, tema.lastroClaro);
  gr.addColorStop(0.5, tema.lastro);
  gr.addColorStop(1, tema.lastroEscuro);
  g.fillStyle = gr;
  caminhoRet(g, x0, leitoTopo, x1 - x0, leitoBase - leitoTopo, L * 0.12);
  g.fill();
  // britas
  const n = Math.round(((x1 - x0) * (leitoBase - leitoTopo)) / 22);
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.5 ? tema.lastroClaro : tema.lastroEscuro;
    g.globalAlpha = 0.5;
    const s = 0.8 + r() * 1.6;
    g.fillRect(x0 + r() * (x1 - x0), leitoTopo + r() * (leitoBase - leitoTopo), s, s);
  }
  g.globalAlpha = 1;
  // borda de baixo do lastro (volume)
  g.fillStyle = 'rgba(0,0,0,0.16)';
  caminhoRet(g, x0, leitoBase - L * 0.04, x1 - x0, L * 0.06, L * 0.03);
  g.fill();

  // dormentes
  const dw = L * 0.1;
  const passoD = L * 0.33;
  for (let x = 0; x < x1 - L * 0.1; x += passoD) {
    const dentro = x > x0 + L * 0.05;
    g.globalAlpha = dentro ? 1 : 0.65;
    g.fillStyle = tema.dormente;
    g.fillRect(x, y - L * 0.21, dw, L * 0.28);
    g.fillStyle = tema.dormenteTopo;
    g.fillRect(x, y - L * 0.21, dw, L * 0.06);
  }
  g.globalAlpha = 1;

  // trilhos de aco (o de tras aparece pouco; o da frente recebe as rodas)
  for (const [yy, larg] of [[y - L * 0.17, 0.035], [y, 0.045]]) {
    g.fillStyle = tema.trilho;
    g.fillRect(0, yy - L * larg * 0.5, x1 - L * 0.25, L * larg);
    g.fillStyle = tema.trilhoBrilho;
    g.globalAlpha = tema.noite ? 0.9 : 0.8;
    g.fillRect(0, yy - L * larg * 0.5, x1 - L * 0.25, Math.max(1, L * 0.012));
    g.globalAlpha = 1;
  }

  // marcas das vagas (mostra quantos vagoes cabem)
  g.fillStyle = tema.noite ? 'rgba(160,240,255,0.5)' : 'rgba(255,255,255,0.75)';
  for (let s = 0; s <= cap; s++) {
    const xm = t.xFrente - P / 2 + s * P;
    caminhoRet(g, xm - L * 0.018, y + L * 0.045, L * 0.036, L * 0.07, L * 0.015);
    g.fill();
  }

  // para-choque no fim
  const pcx = x1 - L * 0.22;
  g.fillStyle = '#3A3550';
  g.fillRect(pcx - L * 0.02, y - L * 0.36, L * 0.14, L * 0.36);
  g.fillStyle = '#E9434F';
  caminhoRet(g, pcx - L * 0.08, y - L * 0.42, L * 0.2, L * 0.16, L * 0.04);
  g.fill();
  g.fillStyle = '#FFFFFF';
  g.fillRect(pcx - L * 0.04, y - L * 0.36, L * 0.12, L * 0.04);
  g.fillStyle = '#F4C430';
  for (const yy of [y - L * 0.36, y - L * 0.24]) {
    g.beginPath();
    g.arc(pcx - L * 0.1, yy, L * 0.04, 0, Math.PI * 2);
    g.fill();
  }

  // poste do sinal (a cabeca com as luzes e dinamica)
  g.fillStyle = '#3A3550';
  g.fillRect(t.xSinal - L * 0.022, y - L * 0.46, L * 0.044, L * 0.46);
  g.fillRect(t.xSinal - L * 0.09, y - L * 0.03, L * 0.18, L * 0.05);

  // linha de parada da locomotiva
  g.fillStyle = tema.faixaSeguranca;
  g.globalAlpha = 0.85;
  g.fillRect(t.xLoco - lay.Lg / 2 - L * 0.04, y + L * 0.03, L * 0.04, L * 0.09);
  g.globalAlpha = 1;
  void gr;
}
