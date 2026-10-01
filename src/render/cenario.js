// Camada estatica em quase 3D, com a mesma obliqua das pecas: ceu e astro,
// horizonte em silhueta (duas camadas), marco, estacao com volume sobre a
// plataforma com espessura e marquise, placa escura do patio e trilhos com
// relevo. Desenhada uma vez por layout num canvas fora da tela; a cena so
// copia por quadro. Luz vinda de cima e da esquerda: faces de cima claras,
// frentes medias, laterais direitas escuras.

import { caminhoRet, OX, OY, caixa3d, topo3d, lado3d } from './pecas.js';
import { misturar } from './tema.js';
import { criarRng } from '../core/rng.js';

/** @typedef {import('./tema.js').Tema} Tema */
/** @typedef {ReturnType<typeof import('./layout.js').calcularLayout>} Layout */

/**
 * @param {Layout} lay @param {Tema} tema @param {number} dpr
 * @returns {HTMLCanvasElement}
 */
export function desenharCenario(lay, tema, dpr) {
  const { W, H, L } = lay;
  const Wu = lay.Wu || W;
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
  g.scale(dpr, dpr);
  const r = criarRng(1234);

  const hFace = Math.max(4, Math.min(16, 0.14 * L)); // espessura da plataforma
  const platAlt = Math.max(6, Math.min(24, 0.2 * L)); // face de cima da plataforma
  const yPlaca = lay.yTabuleiro - 0.12 * L;
  const yPlat = yPlaca - hFace - platAlt;
  const yChao = yPlat;
  const yFim = Math.min(H + 2, lay.yFimTabuleiro + 0.55 * L);
  const alt = lay.fachada ? lay.fachada.alt : 0;
  const yBasePredio = yPlat + platAlt * 0.45;

  ceu(g, W, Wu, yChao, tema, r);
  horizonte(g, W, yChao, tema, L, r);
  if (tema.marco) marco(g, Wu, yChao, tema, L);
  // chao chapado (so aparece abaixo da placa e a direita dela)
  g.fillStyle = tema.chao;
  g.fillRect(0, yChao, W, H - yChao);
  estacao(g, lay, Wu, yBasePredio, alt, tema, L);
  plataforma(g, W, yPlat, platAlt, hFace, tema, L);
  if (alt >= 60) marquise(g, lay, yBasePredio, Math.min(alt * 0.5, 1.05 * L), tema, L);
  // placa do patio: sangra pela esquerda (caminho da partida) e termina logo
  // depois dos para-choques, com o canto de baixo arredondado sobre o chao
  const xPlacaFim = Math.min(W + L, lay.xFim + 0.9 * L);
  const placa = () => {
    const rr = 0.5 * L;
    const yb = yFim < H ? yFim : H + L;
    g.beginPath();
    g.moveTo(-L, yPlaca);
    g.lineTo(xPlacaFim, yPlaca);
    g.lineTo(xPlacaFim, yb - rr);
    g.arcTo(xPlacaFim, yb, xPlacaFim - rr, yb, rr);
    g.lineTo(-L, yb);
    g.closePath();
  };
  if (alt < 60) postes(g, lay, Wu, yBasePredio, tema, L);
  // espessura da laje: face da frente escura, com sombra no chao
  const esp = yFim < H ? Math.min(0.3 * L, H - yFim) : 0;
  if (esp > 0) {
    degrade(g, 0, yFim + esp, Math.min(W, xPlacaFim + 0.2 * L), 0.16 * L, 'rgba(0,0,0,0.28)');
    g.save();
    g.translate(0, esp);
    g.fillStyle = misturar(tema.placa, '#000000', 0.45);
    placa();
    g.fill();
    g.restore();
  }
  g.fillStyle = tema.placa;
  placa();
  g.fill();
  g.save();
  placa();
  g.clip();
  // profundidade: o fundo da laje fica mais claro, a frente mais escura
  const gp = g.createLinearGradient(0, yPlaca, 0, Math.max(yPlaca + 1, yFim));
  gp.addColorStop(0, 'rgba(255,255,255,0.14)');
  gp.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = gp;
  g.fillRect(0, yPlaca, W, yFim - yPlaca);
  brita(g, W, Math.min(W, xPlacaFim), yPlaca, yFim, r, L);
  degrade(g, 0, yPlaca, W, 0.14 * L, 'rgba(0,0,0,0.32)');
  g.restore();
  if (xPlacaFim < Wu - 1.2 * L) vegetacao(g, xPlacaFim, Wu, yPlaca, Math.min(H, yFim), tema, L, r);
  lay.trilhos.forEach((t) => trilho(g, lay, t, tema, r));
  return c;
}

/** Pontinhos de brita sobre a laje, mais densos na frente. */
function brita(g, W, x1, y0, y1, r, L) {
  const n = Math.round(((x1 + L) * (y1 - y0)) / 520);
  for (let i = 0; i < n; i++) {
    const y = y0 + r() * (y1 - y0);
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.18)';
    const s = Math.max(1, L * (0.012 + r() * 0.014));
    g.fillRect(r() * (x1 + L) - L, y, s, s * 0.7);
  }
}

/** Postes de luz na plataforma (quando nao ha marquise). */
function postes(g, lay, Wu, yBase, tema, L) {
  const h = Math.min(0.8 * L, Math.max(10, yBase - 24));
  const passo = 4 * L;
  const poste = misturar(tema.plataforma, '#000000', 0.55);
  for (let x = lay.xIni + 0.5 * L; x < Math.min(lay.xFim + 0.6 * L, Wu); x += passo) {
    if (Math.abs(x - Wu / 2) < 1.3 * L) continue; // fora do eixo da placa de nivel
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(x, yBase - 2, 0.3 * L, 3);
    g.fillStyle = poste;
    g.fillRect(x - 0.015 * L, yBase - h, 0.03 * L, h);
    caixa3d(g, x - 0.09 * L, x + 0.09 * L, yBase - h - 0.07 * L, yBase - h, 0.12 * L, { frente: poste, topo: misturar(poste, '#FFFFFF', 0.35), lado: misturar(poste, '#000000', 0.3) });
    if (tema.luzes) {
      g.fillStyle = 'rgba(255,220,140,0.18)';
      g.beginPath();
      g.arc(x, yBase - h + 0.02 * L, 0.5 * L, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = tema.luzes ? '#FFE7A0' : '#FFF8E0';
    g.fillRect(x - 0.07 * L, yBase - h, 0.14 * L, Math.max(2, 0.03 * L));
  }
}

/** Faixa de sombra que some para baixo. */
function degrade(g, x, y, w, h, cor) {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, cor);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(x, y, w, h);
}

// ------------------------------------------------------------------- ceu
function ceu(g, W, Wu, yChao, tema, r) {
  const gr = g.createLinearGradient(0, 0, 0, Math.max(1, yChao));
  gr.addColorStop(0, tema.ceu[0]);
  gr.addColorStop(0.55, tema.ceu[1]);
  gr.addColorStop(1, tema.ceu[2]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, yChao + 2);
  if (tema.aurora) aurora(g, W, yChao, tema);
  if (tema.estrelas) {
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.3 + r() * 0.6;
      g.fillStyle = '#FFFFFF';
      const s = r() < 0.1 ? 2.2 : 1.3;
      g.fillRect(r() * W, r() * yChao * 0.85, s, s);
    }
    g.globalAlpha = 1;
  }
  if (tema.astro) astro(g, Wu, yChao, tema);
  for (let i = 0; i < tema.nuvens; i++) {
    const x = (Wu / tema.nuvens) * (i + 0.2 + r() * 0.6);
    nuvem(g, x, yChao * (0.18 + r() * 0.35), Math.min(W, 1000) * (0.03 + r() * 0.02), tema);
  }
}

function astro(g, Wu, yChao, tema) {
  const a = /** @type {NonNullable<Tema['astro']>} */ (tema.astro);
  const rr = Math.max(10, Math.min(Wu, yChao * 2.2) * a.r);
  const x = Wu * a.x;
  const y = Math.max(rr * 0.8, yChao * a.y);
  const halo = g.createRadialGradient(x, y, rr, x, y, rr * 2.6);
  halo.addColorStop(0, 'rgba(255,255,255,0.22)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(x - rr * 2.6, y - rr * 2.6, rr * 5.2, rr * 5.2);
  g.fillStyle = a.cor;
  g.beginPath();
  g.arc(x, y, rr, 0, Math.PI * 2);
  g.fill();
  if (a.tipo === 'lua') {
    g.fillStyle = misturar(a.cor, tema.ceu[1], 0.3);
    for (const [dx, dy, k] of [[-0.3, -0.15, 0.2], [0.28, 0.28, 0.14], [0.12, -0.38, 0.09]]) {
      g.beginPath();
      g.arc(x + dx * rr, y + dy * rr, k * rr, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/** Nuvem-pilula de dois tons. */
function nuvem(g, x, y, s, tema) {
  const clara = tema.noite ? '#3A3170' : '#FFFFFF';
  const sombra = misturar(clara, tema.ceu[1], 0.3);
  g.fillStyle = sombra;
  caminhoRet(g, x - s, y - s * 0.1, 2 * s, s * 0.5, s * 0.25);
  g.fill();
  g.fillStyle = clara;
  caminhoRet(g, x - s, y - s * 0.3, 2 * s, s * 0.55, s * 0.28);
  g.fill();
  caminhoRet(g, x - s * 0.45, y - s * 0.72, s * 1.1, s * 0.6, s * 0.3);
  g.fill();
}

/** Faixas de aurora: curvas largas e translucidas. */
function aurora(g, W, yChao, tema) {
  const cores = [tema.acento, '#5FD3F0', '#B48CFF'];
  g.save();
  g.globalCompositeOperation = 'lighter';
  cores.forEach((cor, i) => {
    g.strokeStyle = cor;
    g.globalAlpha = 0.26 - i * 0.05;
    g.lineWidth = yChao * (0.18 - i * 0.03);
    g.lineCap = 'round';
    g.beginPath();
    for (let x = -W * 0.1; x <= W * 1.1; x += 12) {
      const t = x / W;
      const y = yChao * (0.3 + i * 0.09) + Math.sin(t * Math.PI * 1.6 + i) * yChao * 0.12;
      if (x <= -W * 0.1) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
  g.restore();
}

// ------------------------------------------------------------- horizonte
function horizonte(g, W, yChao, tema, L, r) {
  const longe = misturar(tema.horizonte.longe, tema.ceu[2], 0.3);
  const perto = tema.horizonte.perto;
  switch (tema.horizonte.forma) {
    case 'skyline':
      skyline(g, W, yChao, longe, L, r, 1.9, 0.5, false, tema);
      skyline(g, W, yChao, perto, L, r, 1.0, 0.45, tema.luzes, tema);
      break;
    case 'montanhas':
      montanhas(g, W, yChao, longe, L * 2.1, r, 0.3, tema);
      montanhas(g, W, yChao, perto, L * 1.2, r, 1.7, tema);
      break;
    case 'colinas':
      morros(g, W, yChao, longe, L * 0.8, 0.3, 1.6);
      morros(g, W, yChao, perto, L * 0.45, 1.9, 2.4);
      break;
    case 'mar':
      mar(g, W, yChao, tema, L, r);
      guindastes(g, W, yChao, perto, L, r);
      break;
    case 'praia':
      mar(g, W, yChao, tema, L, r);
      coqueiros(g, W, yChao, perto, L, r);
      break;
    case 'mesas':
      mesas(g, W, yChao, longe, L * 1.6, r, 0.2);
      mesas(g, W, yChao, perto, L * 0.9, r, 1.3);
      break;
    case 'floresta':
      floresta(g, W, yChao, longe, L * 0.9, r);
      floresta(g, W, yChao, perto, L * 0.6, r);
      break;
    default:
      morros(g, W, yChao, longe, L * 1.3, 0.3, 2.0);
      morros(g, W, yChao, perto, L * 0.75, 1.9, 3.2);
      if (tema.luzes) luzinhas(g, W, yChao, tema, L, r);
  }
}

/** Uma camada de morros: soma de senos. */
function morros(g, W, yChao, cor, alt, fase, freq) {
  const gr = g.createLinearGradient(0, yChao - alt, 0, yChao);
  gr.addColorStop(0, misturar(cor, '#FFFFFF', 0.22));
  gr.addColorStop(1, cor);
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(0, yChao + 2);
  for (let x = 0; x <= W; x += 6) {
    const t = x / W;
    const y = yChao - alt * (0.55 + 0.3 * Math.sin(t * Math.PI * freq + fase) + 0.15 * Math.sin(t * Math.PI * freq * 2.7 + fase * 2));
    g.lineTo(x, y);
  }
  g.lineTo(W, yChao + 2);
  g.closePath();
  g.fill();
}

/** Pontinhos de luz espalhados pelos morros proximos (festa). */
function luzinhas(g, W, yChao, tema, L, r) {
  g.fillStyle = tema.janela;
  for (let i = 0; i < Math.round(W / 40); i++) {
    g.globalAlpha = 0.5 + r() * 0.5;
    g.fillRect(r() * W, yChao - r() * L * 0.4 - 3, 2, 2);
  }
  g.globalAlpha = 1;
}

/** Predios chapados; os de perto podem ter janelas acesas. */
function skyline(g, W, yChao, cor, L, r, hMax, wVar, luzes, tema) {
  let x = -L * 0.3;
  while (x < W) {
    const w = L * (0.35 + r() * wVar);
    const h = L * (0.4 + r() * hMax);
    caixa3d(g, x, x + w + 1, yChao - h, yChao + 2, 0.22 * L, { frente: cor, topo: misturar(cor, '#FFFFFF', 0.3), lado: misturar(cor, '#000000', 0.28) });
    if (r() < 0.25) g.fillRect(x + w / 2 - 1, yChao - h - L * 0.3, 2, L * 0.3);
    g.fillStyle = cor;
    if (luzes) {
      g.fillStyle = tema.janela;
      for (let yy = yChao - h + L * 0.1; yy < yChao - L * 0.1; yy += L * 0.16) {
        for (let xx = x + L * 0.06; xx < x + w - L * 0.08; xx += L * 0.13) {
          if (r() < 0.45) g.fillRect(xx, yy, L * 0.05, L * 0.07);
        }
      }
    }
    x += w + L * (0.04 + r() * 0.12);
  }
}

/** Picos triangulares; os de longe ganham neve. */
function montanhas(g, W, yChao, cor, alt, r, fase, tema) {
  const passo = alt * 0.9;
  const picos = [];
  for (let x = -passo; x <= W + passo; x += passo * (0.7 + r() * 0.5)) picos.push({ x, h: alt * (0.55 + r() * 0.45) });
  const sombra = misturar(cor, '#000000', 0.22);
  const luz = misturar(cor, '#FFFFFF', 0.12);
  for (const p of picos) {
    g.fillStyle = luz;
    g.beginPath();
    g.moveTo(p.x - passo * 0.62, yChao + 2);
    g.lineTo(p.x, yChao - p.h);
    g.lineTo(p.x, yChao + 2);
    g.closePath();
    g.fill();
    g.fillStyle = sombra;
    g.beginPath();
    g.moveTo(p.x, yChao + 2);
    g.lineTo(p.x, yChao - p.h);
    g.lineTo(p.x + passo * 0.62, yChao + 2);
    g.closePath();
    g.fill();
  }
  if (fase < 1 && !tema.noite) {
    g.fillStyle = misturar(cor, '#FFFFFF', 0.55);
    for (const p of picos) {
      g.beginPath();
      g.moveTo(p.x, yChao - p.h);
      g.lineTo(p.x + passo * 0.14, yChao - p.h * 0.74);
      g.lineTo(p.x - passo * 0.14, yChao - p.h * 0.74);
      g.closePath();
      g.fill();
    }
  }
}

/** Faixa de mar com linha do horizonte clara e reflexos; costa distante atras. */
function mar(g, W, yChao, tema, L, r) {
  const alt = Math.max(24, L * 1.1);
  const y0 = yChao - alt;
  const cor = tema.horizonte.longe;
  morros(g, W, y0 + 2, misturar(cor, tema.ceu[2], 0.55), L * 0.5, 0.8, 1.4);
  const gr = g.createLinearGradient(0, y0, 0, yChao);
  gr.addColorStop(0, misturar(cor, '#FFFFFF', 0.25));
  gr.addColorStop(1, cor);
  g.fillStyle = gr;
  g.fillRect(0, y0, W, alt + 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, y0, W, Math.max(1, L * 0.015));
  g.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < Math.round(W / 24); i++) {
    const w = L * (0.1 + r() * 0.3);
    g.fillRect(r() * W, y0 + alt * (0.15 + r() * 0.8), w, Math.max(1, L * 0.012));
  }
}

/** Guindastes de porto em silhueta (mastro, lanca e pernas). */
function guindastes(g, W, yChao, cor, L, r) {
  g.fillStyle = cor;
  for (const fx of [0.12, 0.3, 0.72]) {
    const x = W * fx + (r() - 0.5) * L;
    const h = L * (1.2 + r() * 0.6);
    g.fillRect(x - L * 0.03, yChao - h, L * 0.06, h);
    g.fillRect(x - L * 0.45, yChao - h, L * 0.9, L * 0.05);
    g.fillRect(x - L * 0.45, yChao - h, L * 0.04, L * 0.3);
    g.fillRect(x + L * 0.41, yChao - h, L * 0.04, L * 0.2);
    g.beginPath();
    g.moveTo(x - L * 0.25, yChao + 1);
    g.lineTo(x - L * 0.03, yChao - h * 0.5);
    g.lineTo(x + L * 0.03, yChao - h * 0.5);
    g.lineTo(x + L * 0.25, yChao + 1);
    g.closePath();
    g.fill();
  }
}

/** Coqueiros em silhueta: tronco curvo e folhas. */
function coqueiros(g, W, yChao, cor, L, r) {
  for (const fx of [0.05, 0.15, 0.62, 0.74]) {
    const x = W * fx + (r() - 0.5) * L * 0.5;
    const h = L * (0.9 + r() * 0.6);
    const inc = (r() - 0.5) * 0.5;
    g.strokeStyle = cor;
    g.lineWidth = Math.max(2, L * 0.05);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, yChao + 1);
    g.quadraticCurveTo(x + inc * h * 0.6, yChao - h * 0.6, x + inc * h, yChao - h);
    g.stroke();
    g.fillStyle = cor;
    const tx = x + inc * h, ty = yChao - h;
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI * 0.95 + (k / 5) * Math.PI * 0.9;
      g.beginPath();
      g.moveTo(tx, ty);
      g.quadraticCurveTo(tx + Math.cos(a) * h * 0.35, ty + Math.sin(a) * h * 0.35 - h * 0.1, tx + Math.cos(a) * h * 0.55, ty + Math.sin(a) * h * 0.55 + h * 0.15);
      g.quadraticCurveTo(tx + Math.cos(a) * h * 0.3, ty + Math.sin(a) * h * 0.3 + h * 0.05, tx, ty);
      g.fill();
    }
    g.lineCap = 'butt';
  }
}

/** Mesas do deserto: topos chatos. */
function mesas(g, W, yChao, cor, alt, r, fase) {
  let x = -L0(alt) + fase * alt;
  while (x < W + alt) {
    const w = alt * (0.6 + r() * 1.2);
    const h = alt * (0.45 + r() * 0.55);
    const prof = alt * 0.25;
    g.fillStyle = misturar(cor, '#000000', 0.3);
    g.beginPath();
    g.moveTo(x + w * 0.82, yChao - h);
    g.lineTo(x + w * 0.82 + OX * prof, yChao - h + OY * prof);
    g.lineTo(x + w + OX * prof, yChao + OY * prof);
    g.lineTo(x + w, yChao + 2);
    g.closePath();
    g.fill();
    g.fillStyle = misturar(cor, '#FFFFFF', 0.25);
    topo3d(g, x + w * 0.18, x + w * 0.82, yChao - h, prof);
    g.fill();
    g.fillStyle = cor;
    g.beginPath();
    g.moveTo(x, yChao + 2);
    g.lineTo(x + w * 0.18, yChao - h);
    g.lineTo(x + w * 0.82, yChao - h);
    g.lineTo(x + w, yChao + 2);
    g.closePath();
    g.fill();
    x += w + alt * (0.3 + r() * 0.8);
  }
  g.fillStyle = cor;
  g.fillRect(0, yChao, W, 3);
}
const L0 = (alt) => alt * 0.5;

/** Floresta: copas redondas em fila. */
function floresta(g, W, yChao, cor, s, r) {
  g.fillStyle = cor;
  let x = -s;
  while (x < W + s) {
    const rr = s * (0.5 + r() * 0.5);
    g.fillStyle = cor;
    g.beginPath();
    g.arc(x, yChao - rr * 0.9, rr, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - rr, yChao - rr * 0.9, rr * 2, rr * 0.95);
    g.fillStyle = misturar(cor, '#FFFFFF', 0.18);
    g.beginPath();
    g.arc(x - rr * 0.3, yChao - rr * 1.15, rr * 0.45, 0, Math.PI * 2);
    g.fill();
    x += rr * (1.2 + r() * 0.6);
  }
}

// ----------------------------------------------------------------- marcos
function marco(g, Wu, yChao, tema, L) {
  const x = Wu * 0.87;
  const s = Math.max(24, Math.min(L * 1.6, yChao * 0.62));
  const cor = tema.horizonte.perto;
  g.fillStyle = cor;
  g.strokeStyle = cor;
  g.lineCap = 'round';
  switch (tema.marco) {
    case 'moinho': {
      trapezio(g, x, yChao, s * 0.36, s * 0.2, s * 0.7);
      g.fillStyle = misturar(cor, '#000000', 0.28);
      g.beginPath();
      g.moveTo(x, yChao + 1);
      g.lineTo(x, yChao - s * 0.7);
      g.lineTo(x + s * 0.1, yChao - s * 0.7);
      g.lineTo(x + s * 0.18, yChao + 1);
      g.closePath();
      g.fill();
      g.fillStyle = cor;
      g.beginPath();
      g.arc(x, yChao - s * 0.72, s * 0.14, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = Math.max(2, s * 0.05);
      for (let k = 0; k < 4; k++) {
        const a = 0.4 + (k * Math.PI) / 2;
        g.beginPath();
        g.moveTo(x, yChao - s * 0.72);
        g.lineTo(x + Math.cos(a) * s * 0.5, yChao - s * 0.72 + Math.sin(a) * s * 0.5);
        g.stroke();
      }
      break;
    }
    case 'torre': {
      g.fillRect(x - s * 0.03, yChao - s * 1.3, s * 0.06, s * 1.3);
      g.beginPath();
      g.ellipse(x, yChao - s * 0.9, s * 0.22, s * 0.07, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x, yChao - s * 1.32, s * 0.05, 0, Math.PI * 2);
      g.fill();
      trapezio(g, x, yChao, s * 0.44, s * 0.06, s * 0.6);
      break;
    }
    case 'roda': {
      const cy = yChao - s * 0.6;
      const R = s * 0.52;
      g.lineWidth = Math.max(2, s * 0.04);
      g.beginPath();
      g.arc(x, cy, R, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        g.moveTo(x, cy);
        g.lineTo(x + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
      g.stroke();
      trapezio(g, x, yChao, s * 0.6, 0, s * 0.6);
      g.fillStyle = tema.luzes ? tema.acento : misturar(cor, '#FFFFFF', 0.3);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        g.beginPath();
        g.arc(x + Math.cos(a) * R, cy + Math.sin(a) * R, s * 0.05, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case 'farol': {
      trapezio(g, x, yChao, s * 0.34, s * 0.22, s * 1.1);
      g.fillStyle = misturar(cor, '#FFFFFF', 0.18);
      g.beginPath();
      g.moveTo(x - s * 0.17, yChao + 1);
      g.lineTo(x - s * 0.11, yChao - s * 1.1);
      g.lineTo(x - s * 0.02, yChao - s * 1.1);
      g.lineTo(x - s * 0.04, yChao + 1);
      g.closePath();
      g.fill();
      g.fillStyle = cor;
      g.fillRect(x - s * 0.17, yChao - s * 1.22, s * 0.34, s * 0.12);
      g.fillRect(x - s * 0.12, yChao - s * 1.34, s * 0.24, s * 0.12);
      g.beginPath();
      g.moveTo(x - s * 0.16, yChao - s * 1.34);
      g.lineTo(x, yChao - s * 1.5);
      g.lineTo(x + s * 0.16, yChao - s * 1.34);
      g.closePath();
      g.fill();
      g.fillStyle = tema.acento;
      g.fillRect(x - s * 0.08, yChao - s * 1.33, s * 0.16, s * 0.1);
      break;
    }
    case 'caixa': {
      g.lineWidth = Math.max(2, s * 0.04);
      for (const q of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + q * s * 0.3, yChao + 1);
        g.lineTo(x + q * s * 0.18, yChao - s * 0.75);
        g.stroke();
      }
      g.beginPath();
      g.moveTo(x - s * 0.26, yChao - s * 0.3);
      g.lineTo(x + s * 0.26, yChao - s * 0.3);
      g.stroke();
      caminhoRet(g, x - s * 0.3, yChao - s * 1.25, s * 0.6, s * 0.5, s * 0.06);
      g.fill();
      g.fillStyle = misturar(cor, '#FFFFFF', 0.18);
      caminhoRet(g, x - s * 0.3, yChao - s * 1.25, s * 0.22, s * 0.5, s * 0.06);
      g.fill();
      g.fillStyle = cor;
      g.beginPath();
      g.moveTo(x - s * 0.34, yChao - s * 1.25);
      g.lineTo(x, yChao - s * 1.48);
      g.lineTo(x + s * 0.34, yChao - s * 1.25);
      g.closePath();
      g.fill();
      break;
    }
    case 'teleferico': {
      g.lineWidth = Math.max(2, s * 0.05);
      g.beginPath();
      g.moveTo(x - s * 0.15, yChao + 1);
      g.lineTo(x, yChao - s * 1.3);
      g.lineTo(x + s * 0.15, yChao + 1);
      g.stroke();
      g.lineWidth = Math.max(1, s * 0.02);
      g.beginPath();
      g.moveTo(x - s * 2.5, yChao - s * 1.9);
      g.lineTo(x, yChao - s * 1.3);
      g.lineTo(x + s * 1.5, yChao - s * 1.0);
      g.stroke();
      caminhoRet(g, x - s * 0.95, yChao - s * 1.42, s * 0.3, s * 0.26, s * 0.05);
      g.fill();
      g.fillRect(x - s * 0.81, yChao - s * 1.55, s * 0.02, s * 0.14);
      break;
    }
    case 'abeto': {
      for (let k = 0; k < 3; k++) {
        const w = s * (0.5 - k * 0.1), y = yChao - s * (0.35 + k * 0.38);
        g.fillStyle = misturar(cor, '#FFFFFF', 0.15);
        g.beginPath();
        g.moveTo(x, y - s * 0.5);
        g.lineTo(x, y);
        g.lineTo(x - w, y);
        g.closePath();
        g.fill();
        g.fillStyle = misturar(cor, '#000000', 0.22);
        g.beginPath();
        g.moveTo(x, y - s * 0.5);
        g.lineTo(x + w, y);
        g.lineTo(x, y);
        g.closePath();
        g.fill();
      }
      g.fillStyle = cor;
      g.fillRect(x - s * 0.05, yChao - s * 0.3, s * 0.1, s * 0.31);
      break;
    }
    case 'coqueiro': {
      coqueiros(g, x / 0.62, yChao, cor, s * 0.9, () => 0.5);
      break;
    }
    case 'celeiro': {
      g.fillRect(x - s * 0.5, yChao - s * 0.6, s, s * 0.61);
      g.fillStyle = misturar(cor, '#000000', 0.3);
      lado3d(g, x + s * 0.5, yChao - s * 0.6, yChao + 1, s * 0.4);
      g.fill();
      g.fillStyle = cor;
      g.beginPath();
      g.moveTo(x - s * 0.56, yChao - s * 0.6);
      g.lineTo(x - s * 0.36, yChao - s * 0.98);
      g.lineTo(x, yChao - s * 1.12);
      g.lineTo(x + s * 0.36, yChao - s * 0.98);
      g.lineTo(x + s * 0.56, yChao - s * 0.6);
      g.closePath();
      g.fill();
      g.fillStyle = tema.janela;
      g.fillRect(x - s * 0.12, yChao - s * 0.32, s * 0.24, s * 0.32);
      break;
    }
    case 'observatorio': {
      g.fillRect(x - s * 0.4, yChao - s * 0.5, s * 0.8, s * 0.51);
      g.beginPath();
      g.arc(x, yChao - s * 0.5, s * 0.4, Math.PI, 0);
      g.closePath();
      g.fill();
      g.fillStyle = misturar(cor, '#000000', 0.28);
      g.beginPath();
      g.arc(x, yChao - s * 0.5, s * 0.4, -Math.PI * 0.45, 0);
      g.lineTo(x, yChao - s * 0.5);
      g.closePath();
      g.fill();
      g.fillRect(x + s * 0.2, yChao - s * 0.5, s * 0.2, s * 0.51);
      g.fillStyle = tema.acento;
      g.fillRect(x - s * 0.04, yChao - s * 0.9, s * 0.08, s * 0.4);
      break;
    }
    default:
      break;
  }
  g.lineCap = 'butt';
}
/** Trapezio em pe (base larga embaixo), para torres e mastros. */
function trapezio(g, x, yBase, wBase, wTopo, h) {
  g.beginPath();
  g.moveTo(x - wBase / 2, yBase + 1);
  g.lineTo(x - wTopo / 2, yBase - h);
  g.lineTo(x + wTopo / 2, yBase - h);
  g.lineTo(x + wBase / 2, yBase + 1);
  g.closePath();
  g.fill();
}

// ---------------------------------------------------------------- estacao
/**
 * Predio em quase 3D sobre a plataforma, centrado na largura util, baixo e
 * sem torre no eixo da placa de nivel.
 */
function estacao(g, lay, Wu, base, alt, tema, L) {
  if (alt < 30) return;
  const h = Math.min(alt * 0.85, 1.7 * L);
  const w = Math.min(Wu * 0.46, (lay.xFim - lay.xIni) * 0.62, 7 * L);
  const cx = Wu / 2;
  const x0 = cx - w / 2, x1 = cx + w / 2;
  const prof = Math.min(0.6 * L, w * 0.18);
  const P = tema.predio, E = tema.predioEscuro, T = tema.telhado, J = tema.janela;
  const claro = (c, k = 0.18) => misturar(c, '#FFFFFF', k);
  const escuro = (c, k = 0.3) => misturar(c, '#000000', k);
  // sombra do predio sobre a plataforma e chao
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(x0 + prof * 0.4, base - 2, w + prof * 0.6, Math.max(3, 0.08 * L));
  switch (tema.estacao) {
    case 'vidro': {
      const hp = h * 0.8;
      caixa3d(g, x0, x1, base - hp, base, prof, { frente: J, topo: claro(P), lado: escuro(J, 0.35) });
      g.fillStyle = P;
      const n = Math.max(3, Math.round(w / (L * 0.9)));
      for (let i = 0; i <= n; i++) g.fillRect(x0 + (w * i) / n - 1.5, base - hp, 3, hp);
      g.fillRect(x0, base - hp * 0.5 - 1.5, w, 3);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x0, base - hp, w, hp * 0.12);
      caixa3d(g, x0 - w * 0.05, x1 + w * 0.05, base - h, base - hp, prof + L * 0.1, { frente: T, topo: claro(T, 0.3), lado: escuro(T) });
      g.fillStyle = E;
      g.fillRect(cx - w * 0.07, base - hp * 0.42, w * 0.14, hp * 0.42);
      break;
    }
    case 'galpao': {
      const hp = h * 0.62;
      caixa3d(g, x0, x1, base - hp, base, prof, { frente: P, topo: claro(P), lado: E });
      // telhado em dente de serra
      const n = 3, dw = w / n;
      for (let i = 0; i < n; i++) {
        const sx = x0 + i * dw;
        g.fillStyle = T;
        g.beginPath();
        g.moveTo(sx, base - hp);
        g.lineTo(sx, base - h);
        g.lineTo(sx + dw, base - hp);
        g.closePath();
        g.fill();
        g.fillStyle = J;
        g.beginPath();
        g.moveTo(sx + 3, base - hp - 2);
        g.lineTo(sx + 3, base - h + 4);
        g.lineTo(sx + dw * 0.55, base - hp - 2);
        g.closePath();
        g.fill();
      }
      g.fillStyle = E;
      g.fillRect(cx - w * 0.14, base - hp * 0.75, w * 0.28, hp * 0.75);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(cx - 1, base - hp * 0.75, 2, hp * 0.75);
      g.fillStyle = J;
      for (const q of [-0.36, -0.26, 0.26, 0.36]) g.fillRect(cx + q * w - w * 0.03, base - hp * 0.6, w * 0.06, hp * 0.2);
      break;
    }
    case 'adobe': {
      const hp = h * 0.78;
      caixa3d(g, x0, x1, base - hp, base, prof, { frente: P, topo: claro(P), lado: E });
      g.fillStyle = E;
      for (let i = 0; i < 6; i++) g.fillRect(x0 + w * (0.08 + i * 0.17), base - hp + hp * 0.12, w * 0.025, w * 0.025);
      g.fillStyle = J;
      for (const q of [-0.3, 0.3]) g.fillRect(cx + q * w - w * 0.04, base - hp * 0.62, w * 0.08, hp * 0.22);
      g.fillStyle = E;
      g.beginPath();
      g.moveTo(cx - w * 0.06, base);
      g.lineTo(cx - w * 0.06, base - hp * 0.42);
      g.arc(cx, base - hp * 0.42, w * 0.06, Math.PI, 0);
      g.lineTo(cx + w * 0.06, base);
      g.closePath();
      g.fill();
      caixa3d(g, x0 + w * 0.3, x1 - w * 0.3, base - h, base - hp, prof * 0.7, { frente: P, topo: claro(P), lado: E });
      break;
    }
    case 'chale': {
      const hp = h * 0.42;
      caixa3d(g, x0 + w * 0.08, x1 - w * 0.08, base - hp, base, prof, { frente: P, topo: claro(P), lado: E });
      telhadoDuasAguas(g, x0, x1, base - hp, base - h, prof, T);
      g.fillStyle = J;
      for (const q of [-0.22, 0.22]) g.fillRect(cx + q * w - w * 0.045, base - hp * 0.75, w * 0.09, hp * 0.4);
      g.fillRect(cx - w * 0.05, base - h + (h - hp) * 0.45, w * 0.1, (h - hp) * 0.3);
      g.fillStyle = E;
      g.fillRect(cx - w * 0.04, base - hp * 0.6, w * 0.08, hp * 0.6);
      break;
    }
    case 'palhoca': {
      const hp = h * 0.45;
      g.fillStyle = E;
      for (const q of [-0.42, -0.14, 0.14, 0.42]) g.fillRect(cx + q * w - w * 0.015, base - hp, w * 0.03, hp);
      g.fillStyle = escuro(J, 0.2);
      g.fillRect(x0 + w * 0.1, base - hp, w * 0.8, hp * 0.55);
      telhadoDuasAguas(g, x0 - w * 0.08, x1 + w * 0.08, base - hp * 0.9, base - h, prof, T);
      g.strokeStyle = escuro(T, 0.25);
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < 6; i++) {
        const yy = base - h + ((h - hp * 0.9) * i) / 6;
        const k = i / 6;
        g.moveTo(cx - (w * 0.58) * k, yy);
        g.lineTo(cx + (w * 0.58) * k, yy);
      }
      g.stroke();
      break;
    }
    case 'celeiro': {
      const hp = h * 0.55;
      caixa3d(g, x0, x1, base - hp, base, prof, { frente: P, topo: claro(P), lado: E });
      // telhado em mansarda (duas inclinacoes)
      g.fillStyle = T;
      g.beginPath();
      g.moveTo(x0 - w * 0.04, base - hp);
      g.lineTo(x0 + w * 0.14, base - h + (h - hp) * 0.4);
      g.lineTo(cx, base - h);
      g.lineTo(x1 - w * 0.14, base - h + (h - hp) * 0.4);
      g.lineTo(x1 + w * 0.04, base - hp);
      g.closePath();
      g.fill();
      g.fillStyle = escuro(T);
      g.beginPath();
      g.moveTo(x1 + w * 0.04, base - hp);
      g.lineTo(x1 + w * 0.04 + OX * prof, base - hp + OY * prof);
      g.lineTo(cx + OX * prof, base - h + OY * prof);
      g.lineTo(cx, base - h);
      g.lineTo(x1 - w * 0.14, base - h + (h - hp) * 0.4);
      g.closePath();
      g.fill();
      g.fillStyle = E;
      g.fillRect(cx - w * 0.12, base - hp * 0.8, w * 0.24, hp * 0.8);
      g.strokeStyle = '#F3EBDD';
      g.lineWidth = Math.max(1.5, L * 0.025);
      g.strokeRect(cx - w * 0.12, base - hp * 0.8, w * 0.24, hp * 0.8);
      g.beginPath();
      g.moveTo(cx - w * 0.12, base - hp * 0.8);
      g.lineTo(cx + w * 0.12, base);
      g.moveTo(cx + w * 0.12, base - hp * 0.8);
      g.lineTo(cx - w * 0.12, base);
      g.stroke();
      g.fillStyle = J;
      g.fillRect(cx - w * 0.04, base - h + (h - hp) * 0.5, w * 0.08, (h - hp) * 0.3);
      break;
    }
    case 'cupula': {
      const hp = h * 0.55;
      caixa3d(g, x0, x1, base - hp, base, prof, { frente: P, topo: claro(P), lado: E });
      const R = Math.min(w * 0.22, h - hp);
      g.fillStyle = T;
      g.beginPath();
      g.arc(cx, base - hp, R, Math.PI, 0);
      g.closePath();
      g.fill();
      g.fillStyle = escuro(T, 0.25);
      g.beginPath();
      g.arc(cx, base - hp, R, -Math.PI * 0.5, 0);
      g.lineTo(cx, base - hp);
      g.closePath();
      g.fill();
      g.fillStyle = tema.acento;
      g.fillRect(cx - R * 0.08, base - hp - R, R * 0.16, R * 0.75);
      g.fillStyle = J;
      for (const q of [-0.32, -0.16, 0.16, 0.32]) g.fillRect(cx + q * w - w * 0.03, base - hp * 0.7, w * 0.06, hp * 0.3);
      break;
    }
    default: {
      // casa de estacao: parede, telhado de duas aguas baixo, porta, janelas e relogio
      const hp = h * 0.6;
      caixa3d(g, x0, x1, base - hp, base, prof, { frente: P, topo: claro(P), lado: E });
      telhadoDuasAguas(g, x0 - w * 0.05, x1 + w * 0.05, base - hp, base - h, prof, T);
      g.fillStyle = E;
      g.fillRect(x0 + w * 0.78, base - h - hp * 0.12, w * 0.05, hp * 0.3);
      g.fillRect(cx - w * 0.05, base - hp * 0.55, w * 0.1, hp * 0.55);
      g.fillStyle = J;
      const nj = Math.max(2, Math.floor(w / (L * 1.1)));
      const passo = w / (nj + 1);
      for (let i = 1; i <= nj; i++) {
        const jx = x0 + passo * i;
        if (Math.abs(jx - cx) < passo * 0.5) continue;
        caminhoRet(g, jx - w * 0.035, base - hp * 0.7, w * 0.07, hp * 0.32, w * 0.012);
        g.fill();
      }
      const rc = Math.min(hp * 0.14, L * 0.16), ry = base - h + (h - hp) * 0.55;
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.arc(cx, ry, rc, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = tema.tinta;
      g.lineWidth = Math.max(1, L * 0.018);
      g.beginPath();
      g.moveTo(cx, ry);
      g.lineTo(cx, ry - rc * 0.65);
      g.moveTo(cx, ry);
      g.lineTo(cx + rc * 0.5, ry);
      g.stroke();
      if (tema.luzes) {
        g.fillStyle = tema.acento;
        for (let x = x0; x <= x1; x += Math.max(8, L * 0.2)) {
          g.beginPath();
          g.arc(x, base - hp + h * 0.07, Math.max(1.5, L * 0.025), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  }
}

/** Telhado de duas aguas com a agua da direita em perspectiva. */
function telhadoDuasAguas(g, x0, x1, yBeiral, yCume, prof, cor) {
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  g.fillStyle = misturar(cor, '#000000', 0.3);
  g.beginPath();
  g.moveTo(x1, yBeiral);
  g.lineTo(x1 + OX * prof, yBeiral + OY * prof);
  g.lineTo(cx + OX * prof, yCume + OY * prof);
  g.lineTo(cx, yCume);
  g.closePath();
  g.fill();
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(x0, yBeiral + 1);
  g.lineTo(x0 + w * 0.12, yCume);
  g.lineTo(x1 - w * 0.12, yCume);
  g.lineTo(x1, yBeiral + 1);
  g.closePath();
  g.fill();
  g.fillStyle = misturar(cor, '#FFFFFF', 0.25);
  g.beginPath();
  g.moveTo(x0 + w * 0.12, yCume);
  g.lineTo(x1 - w * 0.12, yCume);
  g.lineTo(x1 - w * 0.12 + OX * prof * 0.5, yCume + OY * prof * 0.5);
  g.lineTo(x0 + w * 0.12 + OX * prof * 0.5, yCume + OY * prof * 0.5);
  g.closePath();
  g.fill();
}

/** Plataforma com espessura: face de cima clara, linha de seguranca e frente escura. */
function plataforma(g, W, yPlat, platAlt, hFace, tema, L) {
  g.fillStyle = tema.plataforma;
  g.fillRect(0, yPlat, W, platAlt);
  const faixa = Math.max(2, Math.min(4, 0.04 * L));
  g.fillStyle = tema.faixa;
  g.fillRect(0, yPlat + platAlt - faixa * 2.4, W, faixa);
  g.fillStyle = misturar(tema.plataforma, '#000000', 0.38);
  g.fillRect(0, yPlat + platAlt, W, hFace);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, yPlat + platAlt - 1, W, 1);
}

/** Marquise: laje fina sobre colunas, da largura do patio. */
function marquise(g, lay, yBase, h, tema, L) {
  const x0 = lay.xIni - 0.4 * L, x1 = lay.xFim + 0.4 * L;
  const esp = Math.max(3, 0.07 * L);
  const prof = 0.7 * L;
  const yTopo = yBase - h;
  const cor = misturar(tema.plataforma, '#000000', 0.15);
  // colunas com sombra na plataforma
  g.fillStyle = tema.tinta;
  const passo = 2.6 * L;
  for (let x = x0 + 0.8 * L; x < x1 - 0.4 * L; x += passo) {
    g.fillRect(x - 0.025 * L, yTopo + esp, 0.05 * L, h - esp);
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(x + 0.02 * L, yBase - 2, 0.3 * L, 3);
    g.fillStyle = tema.tinta;
  }
  caixa3d(g, x0, x1, yTopo, yTopo + esp, prof, { frente: misturar(cor, '#000000', 0.25), topo: cor, lado: misturar(cor, '#000000', 0.45) });
}

/** Arvores com volume no chao ao lado da placa (so nos mundos com vegetacao). */
function vegetacao(g, x0, x1, y0, y1, tema, L, r) {
  const forma = tema.horizonte.forma;
  const tipo = forma === 'montanhas' || forma === 'colinas' ? 'pinheiro' : forma === 'skyline' || forma === 'mar' || forma === 'mesas' ? null : 'arvore';
  if (!tipo) return;
  const cor = tema.horizonte.perto;
  const tronco = misturar(cor, '#000000', 0.35);
  const n = Math.max(2, Math.min(4, Math.floor((x1 - x0) / (1.1 * L))));
  for (let i = 0; i < n; i++) {
    const s = L * (0.55 + r() * 0.45);
    const x = x0 + 0.5 * L + ((x1 - x0 - L) * (i + 0.5)) / n + (r() - 0.5) * 0.3 * L;
    const y = y0 + 0.8 * L + r() * Math.max(0, y1 - y0 - 1.4 * L);
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.beginPath();
    g.moveTo(x - s * 0.4, y);
    g.lineTo(x + s * 0.4, y);
    g.lineTo(x + s * 0.4 + OX * s * 0.5, y + OY * s * 0.5);
    g.lineTo(x - s * 0.4 + OX * s * 0.5, y + OY * s * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = tronco;
    g.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5);
    if (tipo === 'pinheiro') {
      g.fillStyle = cor;
      g.beginPath();
      g.moveTo(x, y - s * 1.35);
      g.lineTo(x + s * 0.42, y - s * 0.4);
      g.lineTo(x - s * 0.42, y - s * 0.4);
      g.closePath();
      g.fill();
      g.fillStyle = misturar(cor, '#FFFFFF', 0.2);
      g.beginPath();
      g.moveTo(x, y - s * 1.35);
      g.lineTo(x, y - s * 0.4);
      g.lineTo(x - s * 0.42, y - s * 0.4);
      g.closePath();
      g.fill();
    } else {
      g.fillStyle = misturar(cor, '#000000', 0.22);
      g.beginPath();
      g.arc(x, y - s * 0.85, s * 0.42, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = cor;
      g.beginPath();
      g.arc(x - s * 0.06, y - s * 0.92, s * 0.36, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = misturar(cor, '#FFFFFF', 0.22);
      g.beginPath();
      g.arc(x - s * 0.16, y - s * 1.04, s * 0.17, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// ---------------------------------------------------------------- trilho
/**
 * Um trilho com relevo: faixa de dormentes um tom acima da placa, dormentes
 * com face de cima clara, trilhos com topo claro e lateral escura. Sai pela
 * esquerda em forca total (caminho da partida) e termina no para-choque.
 */
function trilho(g, lay, t, tema, r) {
  const { L } = lay;
  const y = t.yb;
  const x1 = t.xFim;
  if (tema.guia) {
    g.fillStyle = tema.lastro;
    caminhoRet(g, -L, y - 0.14 * L, x1 - 0.1 * L + L, 0.22 * L, 0.06 * L);
    g.fill();
    g.strokeStyle = tema.acento;
    g.lineWidth = Math.max(2, L * 0.04);
    g.shadowColor = tema.acento;
    g.shadowBlur = L * 0.18;
    g.beginPath();
    g.moveTo(0, y - 0.02 * L);
    g.lineTo(x1 - 0.22 * L, y - 0.02 * L);
    g.stroke();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y - 0.03 * L);
    g.lineTo(x1 - 0.22 * L, y - 0.03 * L);
    g.stroke();
  } else {
    // leito de brita com volume: borda escura embaixo, face de cima mais clara
    g.fillStyle = misturar(tema.lastro, '#000000', 0.3);
    caminhoRet(g, -L, y - 0.22 * L, x1 - 0.1 * L + L, 0.38 * L, 0.06 * L);
    g.fill();
    g.fillStyle = tema.lastro;
    caminhoRet(g, -L, y - 0.27 * L, x1 - 0.1 * L + L, 0.37 * L, 0.06 * L);
    g.fill();
    g.save();
    caminhoRet(g, -L, y - 0.27 * L, x1 - 0.1 * L + L, 0.37 * L, 0.06 * L);
    g.clip();
    for (let i = 0; i < Math.round((x1 + L) / (L * 0.06)); i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.2)';
      const sz = Math.max(1, L * (0.012 + r() * 0.012));
      g.fillRect(r() * (x1 + L) - L, y - 0.27 * L + r() * 0.37 * L, sz, sz);
    }
    g.restore();
    const dw = 0.08 * L;
    const claro = misturar(tema.dormente, '#ffffff', 0.12);
    const escuro = misturar(tema.dormente, '#000000', 0.35);
    for (let x = ((x1 - 0.3 * L) % (0.33 * L)) - 0.33 * L; x < x1 - 0.25 * L; x += 0.33 * L) {
      g.fillStyle = escuro;
      g.fillRect(x, y + 0.05 * L, dw + Math.max(1, 0.015 * L), Math.max(1, 0.03 * L));
      g.fillRect(x + dw, y - 0.22 * L, Math.max(1, 0.015 * L), 0.27 * L);
      g.fillStyle = claro;
      g.fillRect(x, y - 0.22 * L, dw, 0.27 * L);
    }
    const lw = Math.max(1.5, 0.035 * L);
    const lado = misturar(tema.trilho, '#000000', 0.5);
    for (const yy of [y - 0.16 * L - lw, y]) {
      g.fillStyle = lado;
      g.fillRect(0, yy + lw * 0.6, x1 - 0.22 * L, lw * 0.8);
      g.fillStyle = tema.trilho;
      g.fillRect(0, yy, x1 - 0.22 * L, lw);
    }
  }
  fimTrilho(g, lay, t, tema);
}

/** Marcas das vagas, para-choque, poste do sinal e linha de parada da locomotiva. */
function fimTrilho(g, lay, t, tema) {
  const { L, P, cap } = lay;
  const y = t.yb;
  const x1 = t.xFim;
  g.fillStyle = 'rgba(255,255,255,0.2)';
  for (let s = 0; s <= cap; s++) {
    const xm = t.xFrente - P / 2 + s * P;
    g.beginPath();
    g.arc(xm, y + 0.14 * L, Math.max(1, 0.022 * L), 0, Math.PI * 2);
    g.fill();
  }
  // para-choque com volume
  const pcx = x1 - 0.22 * L;
  caixa3d(g, pcx - 0.03 * L, pcx + 0.11 * L, y - 0.34 * L, y + 0.02 * L, 0.3 * L, { frente: tema.tinta, topo: '#4A5064', lado: '#0F1119' });
  g.fillStyle = '#FF5A5A';
  g.beginPath();
  g.arc(pcx + 0.04 * L, y - 0.27 * L, 0.035 * L, 0, Math.PI * 2);
  g.fill();
  // poste do sinal (a lampada e da cena)
  caixa3d(g, t.xSinal - 0.09 * L, t.xSinal + 0.09 * L, y - 0.03 * L, y + 0.02 * L, 0.14 * L, { frente: tema.tinta, topo: '#4A5064', lado: '#0F1119' });
  g.fillStyle = tema.tinta;
  g.fillRect(t.xSinal - 0.02 * L, y - 0.62 * L, 0.04 * L, 0.6 * L);
  // linha de parada da locomotiva
  g.fillStyle = tema.faixa;
  g.globalAlpha = 0.7;
  g.fillRect(t.xLoco - lay.Lg / 2 - 0.05 * L, y + 0.04 * L, 0.04 * L, 0.1 * L);
  g.globalAlpha = 1;
}
