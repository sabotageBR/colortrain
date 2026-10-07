// Pecas em quase 3D: projecao obliqua (face da frente, face de cima e face
// lateral direita), sombra projetada no chao e cargas com fisica. Cada cor e
// um tipo de carga (ver fisica.js): tanque de vidro com liquido, laranjas,
// areia, bambu, conteiner, barris e baloes.
//
// Origem de cada peca: centro do vagao na linha do trilho (onde a roda da
// frente toca). A parte fixa (estrado, casco) vira sprite em cache por cor,
// tamanho e mundo; a carga, as rodas e a sombra sao desenhadas por quadro.

import { CORES, misturar } from './tema.js';
import { tipoDaCor } from './fisica.js';

/** @typedef {import('./tema.js').Tema} Tema */
/** @typedef {import('./fisica.js').Carga} Carga */

/** Obliqua: por L de profundidade, quanto a face de tras anda em x e em y de tela. */
export const OX = 0.33;
export const OY = -0.4;
/** Profundidade do corpo do vagao, em L. */
const D = 0.42;

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
 * Medidas do vagao a partir de L (comprimento): o corpo vai de saia (estrado)
 * ate topoLat (topo da carga mais alta).
 * @param {number} L
 */
export function medidasVagao(L) {
  const rw = 0.085 * L;
  const saia = -0.2 * L;
  const Hs = 0.6 * L;
  return { L, rw, Hs, Hr: 0, saia, topoLat: saia - Hs, topoTeto: saia - Hs };
}

// --------------------------------------------------------------- 3D basico
/** Face de cima (paralelogramo) de uma caixa cujo topo esta em yTopo (y de tela). */
export function topo3d(g, x0, x1, yTopo, prof) {
  g.beginPath();
  g.moveTo(x0, yTopo);
  g.lineTo(x1, yTopo);
  g.lineTo(x1 + OX * prof, yTopo + OY * prof);
  g.lineTo(x0 + OX * prof, yTopo + OY * prof);
  g.closePath();
}
/** Face lateral direita de uma caixa. */
export function lado3d(g, x1, yTopo, yBase, prof) {
  g.beginPath();
  g.moveTo(x1, yTopo);
  g.lineTo(x1 + OX * prof, yTopo + OY * prof);
  g.lineTo(x1 + OX * prof, yBase + OY * prof);
  g.lineTo(x1, yBase);
  g.closePath();
}
/** Caixa em obliqua: lado, cima e frente. @param {{ frente: string, topo: string, lado: string }} c */
export function caixa3d(g, x0, x1, yTopo, yBase, prof, c) {
  g.fillStyle = c.lado;
  lado3d(g, x1, yTopo, yBase, prof);
  g.fill();
  g.fillStyle = c.topo;
  topo3d(g, x0, x1, yTopo, prof);
  g.fill();
  g.fillStyle = c.frente;
  g.fillRect(x0, yTopo, x1 - x0, yBase - yTopo);
}
/**
 * Ponto da borda de um circulo de raio R no plano Y-Z (tampa de um cilindro
 * deitado) visto em obliqua, para o parametro t do circulo.
 */
function pontoTampa(x, cy, R, t) {
  return { x: x + OX * R * (1 + Math.sin(t)), y: cy - R * Math.cos(t) + OY * R * (1 + Math.sin(t)) };
}
/** Caminho da tampa redonda na ponta direita de um cilindro deitado. */
function tampa(g, x1, cy, R) {
  g.beginPath();
  for (let k = 0; k <= 32; k++) {
    const p = pontoTampa(x1, cy, R, (k / 32) * Math.PI * 2);
    if (k === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.closePath();
}
/**
 * Caminho de um cilindro deitado ao longo de x (de x0 a x1), raio R, eixo em
 * cy: a elipse da tampa varrida ao longo do comprimento.
 */
const T_TOPO = Math.atan(-OY);
function cilindroX(g, x0, x1, cy, R) {
  g.beginPath();
  const n = 20;
  // metade direita da tampa da direita, do ponto mais alto ao mais baixo
  for (let k = 0; k <= n; k++) {
    const p = pontoTampa(x1, cy, R, T_TOPO + (k / n) * Math.PI);
    if (k === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  // metade esquerda da tampa da esquerda, do mais baixo ao mais alto
  for (let k = 0; k <= n; k++) {
    const p = pontoTampa(x0, cy, R, T_TOPO + Math.PI + (k / n) * Math.PI);
    g.lineTo(p.x, p.y);
  }
  g.closePath();
}

/** Estrado comum (plataforma do vagao) com a placa do simbolo. */
function estrado(g, L, tema) {
  caixa3d(g, -0.48 * L, 0.48 * L, -0.27 * L, -0.2 * L, 0.44 * L, { frente: '#2B2F3F', topo: '#4A5064', lado: '#171A26' });
}
function placaSimbolo(g, x, y, r, cor) {
  g.fillStyle = '#FFFFFF';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = CORES[cor].escuro;
  g.save();
  g.translate(x, y);
  desenharSimbolo(g, cor, r * 0.55);
  g.fill();
  g.restore();
}

// ------------------------------------------------------------------ cargas
/**
 * Cada carga tem a parte fixa (vai para o sprite) e a parte viva (desenhada
 * por quadro com o estado da fisica f). Coordenadas locais em pixels.
 * @type {Record<string, { fixa: (g: CanvasRenderingContext2D, cor: number, L: number, tema: Tema) => void,
 *   viva: (g: CanvasRenderingContext2D, cor: number, L: number, tema: Tema, f: Carga) => void }>}
 */
const CARGAS = {
  tanque: {
    fixa(g, cor, L, tema) {
      estrado(g, L, tema);
      // selas que seguram o tanque
      g.fillStyle = '#171A26';
      for (const q of [-0.27, 0.27]) {
        g.beginPath();
        g.moveTo(q * L - 0.12 * L, -0.27 * L);
        g.lineTo(q * L + 0.12 * L, -0.27 * L);
        g.lineTo(q * L + 0.08 * L, -0.36 * L);
        g.lineTo(q * L - 0.08 * L, -0.36 * L);
        g.closePath();
        g.fill();
      }
      placaSimbolo(g, 0, -0.235 * L, 0.06 * L, cor);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      const R = 0.24 * L, cy = -0.57 * L, x0 = -0.44 * L, x1 = 0.44 * L;
      const nivel = cy + R - 2 * R * 0.68;
      const incl = Math.tan(f.tilt) * 0.9;
      const onda = 0.02 * L * Math.min(1, Math.abs(f.tiltV) * 1.5);
      const ys = (x) => nivel + x * incl + onda * Math.sin((x / L) * 9 + f.t * 11);
      // liquido, cortado pelo tanque
      g.save();
      cilindroX(g, x0, x1, cy, R);
      g.clip();
      g.fillStyle = C.base;
      g.beginPath();
      g.moveTo(x0, ys(x0));
      for (let x = x0; x <= x1; x += L * 0.08) g.lineTo(x, ys(x));
      g.lineTo(x1, ys(x1));
      g.lineTo(x1, cy + R + 2);
      g.lineTo(x0, cy + R + 2);
      g.closePath();
      g.fill();
      g.strokeStyle = C.claro;
      g.lineWidth = Math.max(1, 0.022 * L);
      g.beginPath();
      g.moveTo(x0, ys(x0));
      for (let x = x0; x <= x1; x += L * 0.08) g.lineTo(x, ys(x));
      g.stroke();
      // vidro: brilho em cima, sombra embaixo
      const gr = g.createLinearGradient(0, cy - R * 1.3, 0, cy + R);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.1)');
      gr.addColorStop(1, 'rgba(0,0,0,0.1)');
      g.fillStyle = gr;
      g.fillRect(x0 - L, cy - 2 * R, x1 - x0 + 2 * L, 4 * R);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      caminhoRet(g, x0 + 0.1 * L, cy - R * 0.95, 0.56 * L, R * 0.14, R * 0.07);
      g.fill();
      g.restore();
      // tampa direita com o nivel do liquido
      g.save();
      tampa(g, x1, cy, R);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(x1 - L, cy - 2 * R, 3 * L, 4 * R);
      g.fillStyle = C.escuro;
      g.globalAlpha = 0.75;
      g.fillRect(x1 - L, ys(x1) + OY * R, 3 * L, 3 * R);
      g.globalAlpha = 1;
      g.restore();
      // aro da tampa, cintas e contorno do vidro
      g.strokeStyle = '#1E2235';
      g.lineWidth = Math.max(1.2, 0.025 * L);
      tampa(g, x1, cy, R);
      g.stroke();
      cilindroX(g, x0, x1, cy, R);
      g.stroke();
      g.save();
      cilindroX(g, x0, x1, cy, R);
      g.clip();
      g.fillStyle = '#1E2235';
      for (const q of [-0.22, 0.22]) {
        g.beginPath();
        g.moveTo(q * L - 0.016 * L, cy + R);
        g.lineTo(q * L + 0.016 * L, cy + R);
        g.lineTo(q * L + 0.016 * L + OX * 2 * R, cy + R + OY * 2 * R);
        g.lineTo(q * L - 0.016 * L + OX * 2 * R, cy + R + OY * 2 * R);
        g.closePath();
        g.fill();
        g.fillRect(q * L - 0.016 * L, cy - R, 0.032 * L, 2 * R);
      }
      g.restore();
      // escotilha em cima
      g.fillStyle = '#2B2F3F';
      g.beginPath();
      g.ellipse(0.02 * L, cy - R + 0.01 * L, 0.07 * L, 0.03 * L, 0, 0, Math.PI * 2);
      g.fill();
    },
  },
  areia: {
    fixa(g, cor, L, tema) {
      const C = CORES[cor];
      estrado(g, L, tema);
      caixa3d(g, -0.46 * L, 0.46 * L, -0.66 * L, -0.27 * L, D * L, { frente: C.base, topo: C.profundo, lado: C.escuro });
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (const q of [-0.23, 0, 0.23]) g.fillRect(q * L - 0.012 * L, -0.64 * L, 0.024 * L, 0.37 * L);
      g.fillStyle = C.claro;
      g.fillRect(-0.46 * L, -0.66 * L, 0.92 * L, 0.03 * L);
      placaSimbolo(g, 0, -0.47 * L, 0.08 * L, cor);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      const x0 = -0.46 * L, x1 = 0.46 * L, yRim = -0.66 * L;
      const salto = f.jolt * 0.035 * L * Math.abs(Math.sin(f.t * 34));
      const h = (x) => { const u = (x - x0) / (x1 - x0); return 0.2 * L * (0.35 + 0.65 * Math.sin(Math.PI * u)) * (1 + 0.22 * f.jolt * Math.sin(u * 31 + f.t * 40)) + 0.02 * L * Math.sin(u * 23); };
      // monte: face de cima coberta de areia e a crista acima da borda
      g.fillStyle = C.claro;
      topo3d(g, x0, x1, yRim, D * L);
      g.fill();
      g.fillStyle = C.base;
      g.beginPath();
      g.moveTo(x0, yRim + 1);
      for (let x = x0; x <= x1; x += L * 0.05) g.lineTo(x, yRim - h(x) - salto);
      g.lineTo(x1, yRim + 1);
      g.closePath();
      g.fill();
      g.fillStyle = C.claro;
      g.beginPath();
      g.moveTo(x0 + 0.1 * L, yRim - h(x0 + 0.1 * L) * 0.5 - salto);
      for (let x = x0 + 0.1 * L; x <= x1 - 0.1 * L; x += L * 0.05) g.lineTo(x, yRim - h(x) - salto + 1);
      g.lineTo(x1 - 0.1 * L, yRim - h(x1 - 0.1 * L) * 0.5 - salto);
      g.closePath();
      g.fill();
      // graos
      for (let k = 0; k < 14; k++) {
        const u = (k * 0.37) % 1;
        const x = x0 + u * (x1 - x0);
        const prof = ((k * 0.61) % 1) * 0.8;
        g.fillStyle = k % 2 ? C.escuro : '#FFFFFF';
        g.globalAlpha = 0.45;
        g.fillRect(x, yRim - h(x) * prof - salto, Math.max(1, 0.02 * L), Math.max(1, 0.02 * L));
      }
      g.globalAlpha = 1;
    },
  },
  laranjas: {
    fixa(g, cor, L, tema) {
      const C = CORES[cor];
      estrado(g, L, tema);
      caixa3d(g, -0.46 * L, 0.46 * L, -0.58 * L, -0.27 * L, D * L, { frente: misturar(C.base, '#7A4A1E', 0.45), topo: '#3A2A1C', lado: misturar(C.escuro, '#4A2E12', 0.5) });
      // ripas do engradado
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (const yy of [-0.52, -0.42, -0.32]) g.fillRect(-0.46 * L, yy * L, 0.92 * L, 0.02 * L);
      placaSimbolo(g, 0, -0.43 * L, 0.07 * L, cor);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      const yRim = -0.58 * L, r = 0.072 * L;
      for (let fila = 1; fila >= 0; fila--) {
        const dz = fila * 0.2 * L;
        for (let k = 0; k < 6; k++) {
          const x = -0.37 * L + k * 0.148 * L + fila * 0.07 * L + OX * dz;
          const salto = f.jolt * 0.08 * L * Math.max(0, Math.sin(f.t * 27 + k * 1.7 + fila));
          const y = yRim - r * 0.75 + OY * dz - salto;
          g.fillStyle = fila ? C.escuro : C.base;
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = 'rgba(255,255,255,0.45)';
          g.beginPath();
          g.arc(x - r * 0.3, y - r * 0.32, r * 0.3, 0, Math.PI * 2);
          g.fill();
        }
      }
    },
  },
  bambu: {
    fixa(g, cor, L, tema) {
      estrado(g, L, tema);
      // fueiros de tras
      g.fillStyle = '#171A26';
      for (const q of [-0.44, 0.44]) g.fillRect(q * L - 0.02 * L + OX * D * L, -0.7 * L + OY * D * L, 0.04 * L, 0.43 * L);
      placaSimbolo(g, 0, -0.235 * L, 0.06 * L, cor);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      const dx = Math.max(-0.05, Math.min(0.05, f.tilt * 0.12)) * L;
      const r = 0.062 * L;
      const camadas = [[-0.3, 0, 0.3], [-0.15, 0.15], [0]];
      camadas.forEach((cs, k) => {
        const cy = -0.27 * L - r - k * 2 * r * 0.92;
        for (const q of cs) {
          const dz = (q + 0.3) / 0.6 * 0.26 * L;
          const xa = -0.42 * L + dx + OX * dz * 0.3, xb = 0.42 * L + dx + OX * dz * 0.3;
          const yy = cy + OY * dz * 0.3;
          g.fillStyle = q === 0 && k === 0 ? C.escuro : C.base;
          cilindroX(g, xa, xb, yy, r);
          g.fill();
          g.fillStyle = C.claro;
          caminhoRet(g, xa + 0.05 * L, yy - r * 1.05, xb - xa - 0.1 * L, r * 0.5, r * 0.25);
          g.fill();
          g.fillStyle = C.escuro;
          for (const nx of [-0.26, -0.03, 0.2]) g.fillRect(nx * L + dx, yy - r * 1.3, 0.02 * L, 2.3 * r);
          g.fillStyle = C.profundo;
          tampa(g, xb, yy, r);
          g.fill();
        }
      });
      // fueiros da frente e corda
      g.fillStyle = '#171A26';
      for (const q of [-0.44, 0.44]) g.fillRect(q * L - 0.02 * L, -0.7 * L, 0.04 * L, 0.43 * L);
      g.strokeStyle = '#8A6A3A';
      g.lineWidth = Math.max(1, 0.018 * L);
      g.beginPath();
      g.moveTo(-0.44 * L, -0.68 * L);
      g.lineTo(-0.1 * L + dx, -0.62 * L);
      g.lineTo(0.1 * L + dx, -0.62 * L);
      g.lineTo(0.44 * L, -0.68 * L);
      g.stroke();
    },
  },
  conteiner: {
    fixa(g, cor, L, tema) {
      estrado(g, L, tema);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      g.save();
      g.translate(0, -0.27 * L);
      g.rotate(f.tilt * 0.12);
      g.translate(0, 0.27 * L);
      caixa3d(g, -0.47 * L, 0.47 * L, -0.74 * L, -0.27 * L, D * L, { frente: C.base, topo: C.claro, lado: C.escuro });
      g.fillStyle = 'rgba(0,0,0,0.18)';
      for (let x = -0.4 * L; x < 0.44 * L; x += 0.07 * L) g.fillRect(x, -0.72 * L, 0.025 * L, 0.43 * L);
      // portas na lateral
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = Math.max(1, 0.02 * L);
      g.beginPath();
      g.moveTo(0.47 * L + OX * D * L * 0.5, -0.74 * L + OY * D * L * 0.5);
      g.lineTo(0.47 * L + OX * D * L * 0.5, -0.27 * L + OY * D * L * 0.5);
      g.stroke();
      // cantoneiras
      g.fillStyle = '#1E2235';
      for (const [qx, qy] of [[-0.47, -0.74], [0.44, -0.74], [-0.47, -0.31], [0.44, -0.31]]) g.fillRect(qx * L, qy * L, 0.03 * L, 0.04 * L);
      placaSimbolo(g, 0, -0.5 * L, 0.085 * L, cor);
      g.restore();
    },
  },
  barris: {
    fixa(g, cor, L, tema) {
      estrado(g, L, tema);
      g.fillStyle = '#171A26';
      for (const q of [-0.46, 0.42]) g.fillRect(q * L, -0.33 * L, 0.04 * L, 0.06 * L);
      placaSimbolo(g, 0, -0.235 * L, 0.06 * L, cor);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      const r = 0.135 * L;
      const dx = Math.max(-0.06, Math.min(0.06, f.tilt * 0.1)) * L;
      const comp = 0.32 * L;
      for (const q of [-0.29, 0, 0.29]) {
        const x = q * L + dx, cy = -0.27 * L - r;
        // corpo para tras
        g.fillStyle = C.profundo;
        g.beginPath();
        g.arc(x + OX * comp, cy + OY * comp, r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = C.escuro;
        g.beginPath();
        g.moveTo(x - r, cy);
        g.lineTo(x + OX * comp - r, cy + OY * comp);
        g.lineTo(x + OX * comp + r, cy + OY * comp);
        g.lineTo(x + r, cy);
        g.closePath();
        g.fill();
        g.beginPath();
        g.moveTo(x, cy - r);
        g.lineTo(x + OX * comp, cy + OY * comp - r);
        g.lineTo(x + OX * comp + r, cy + OY * comp);
        g.lineTo(x + r, cy);
        g.closePath();
        g.fill();
        // tampa da frente: aduelas que giram quando o barril rola
        g.fillStyle = C.base;
        g.beginPath();
        g.arc(x, cy, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = C.escuro;
        g.lineWidth = Math.max(1, 0.02 * L);
        g.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = f.rot + (k * Math.PI) / 3;
          g.moveTo(x + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
          g.lineTo(x - Math.cos(a) * r * 0.9, cy - Math.sin(a) * r * 0.9);
        }
        g.stroke();
        g.strokeStyle = '#1E2235';
        g.lineWidth = Math.max(1.2, 0.03 * L);
        g.beginPath();
        g.arc(x, cy, r, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = C.claro;
        g.beginPath();
        g.arc(x, cy, r * 0.22, 0, Math.PI * 2);
        g.fill();
      }
    },
  },
  baloes: {
    fixa(g, cor, L, tema) {
      const C = CORES[cor];
      estrado(g, L, tema);
      caixa3d(g, -0.2 * L, 0.2 * L, -0.46 * L, -0.27 * L, 0.3 * L, { frente: C.escuro, topo: C.base, lado: C.profundo });
      placaSimbolo(g, 0, -0.365 * L, 0.06 * L, cor);
    },
    viva(g, cor, L, tema, f) {
      const C = CORES[cor];
      const ax = 0, ay = -0.46 * L;
      for (let k = 2; k >= 0; k--) {
        const ang = f.tilt * 1.1 + (k - 1) * 0.24 + 0.08 * Math.sin(f.t * 2.1 + k * 2);
        const len = (0.3 + k * 0.045) * L;
        const bx = ax + Math.sin(ang) * len, by = ay - Math.cos(ang) * len;
        g.strokeStyle = 'rgba(30,34,53,0.7)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        g.save();
        g.translate(bx, by);
        g.rotate(ang);
        g.fillStyle = k === 1 ? C.base : misturar(C.base, '#000000', 0.12);
        g.beginPath();
        g.ellipse(0, -0.1 * L, 0.095 * L, 0.115 * L, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(-0.02 * L, 0.01 * L);
        g.lineTo(0.02 * L, 0.01 * L);
        g.lineTo(0, -0.01 * L);
        g.closePath();
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.beginPath();
        g.ellipse(-0.03 * L, -0.14 * L, 0.025 * L, 0.04 * L, -0.4, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    },
  },
};

/** Estado parado, para o fantasma do arraste e as previas. */
const REPOUSO = { tipo: '', cor: 0, t: 0, tilt: 0, tiltV: 0, bob: 0, bobV: 0, jolt: 0, rot: 0, joltT0: 0, joltDir: -1 };

/**
 * @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y linha do trilho
 * @param {number} cor @param {number} L @param {Tema} tema @param {number} dpr
 * @param {{ roda?: number, escalaY?: number, alfa?: number, brilho?: number, fis?: Carga, noAr?: boolean }} [o]
 */
export function desenharVagao(ctx, x, y, cor, L, tema, dpr, o = {}) {
  const tipo = tipoDaCor(cor);
  const f = o.fis || REPOUSO;
  const m = medidasVagao(L);
  const w = 1.5 * L, h = 1.15 * L, ox = 0.6 * L, oy = h - 0.1 * L;
  const spr = sprite(`v${cor}|${L.toFixed(2)}|${tema.nome}|${dpr}`, w, h, ox, oy, dpr, (g) => CARGAS[tipo].fixa(g, cor, L, tema));
  ctx.save();
  if (o.alfa != null) ctx.globalAlpha = o.alfa;
  ctx.translate(x, y);
  if (o.noAr) ctx.rotate(f.tilt * 0.35);
  rodas(ctx, L, m.rw, o.roda || 0, tema, true);
  ctx.save();
  ctx.translate(0, f.bob * L);
  ctx.scale(1, o.escalaY || 1);
  if (o.brilho) {
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = 14 * o.brilho;
  }
  ctx.drawImage(spr, -ox, -oy, w, h);
  ctx.shadowBlur = 0;
  CARGAS[tipo].viva(ctx, cor, L, tema, f);
  ctx.restore();
  rodas(ctx, L, m.rw, o.roda || 0, tema, false);
  ctx.restore();
}

/** Rodas: as de tras ficam deslocadas pela obliqua e mais escuras. */
function rodas(ctx, L, r, ang, tema, tras) {
  const dz = tras ? D * L : 0;
  for (const q of [-0.3, 0.3]) {
    const cx = q * L + OX * dz;
    const cy = -r + OY * dz;
    ctx.fillStyle = tras ? '#0F1119' : tema.tinta;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    if (tras) continue;
    ctx.fillStyle = '#CDD2DC';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tema.tinta;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(ang) * r * 0.24, cy + Math.sin(ang) * r * 0.24, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Sombra projetada no chao (paralelogramo da obliqua). @param {number} w largura da peca */
export function desenharSombra(ctx, x, y, w, alfa, tema) {
  const prof = w * 0.36;
  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.fillStyle = tema.sombra;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.44, y + w * 0.04);
  ctx.lineTo(x + w * 0.56, y + w * 0.04);
  ctx.lineTo(x + w * 0.56 + OX * prof, y + w * 0.04 + OY * prof);
  ctx.lineTo(x - w * 0.44 + OX * prof, y + w * 0.04 + OY * prof);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Fole entre dois vagoes do mesmo bloco: mostra que estao engatados.
 * @param {number} xa borda direita do vagao da frente @param {number} xb borda esquerda do de tras
 */
export function desenharSanfona(ctx, xa, xb, y, L, cor, tema) {
  const w = xb - xa;
  if (w <= 0.5) return;
  const C = CORES[cor];
  ctx.fillStyle = C.escuro;
  ctx.fillRect(xa - 1, y - 0.52 * L, w + 2, 0.24 * L);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  const n = Math.max(2, Math.round(w / (L * 0.045)));
  for (let i = 1; i < n; i++) ctx.fillRect(xa + (w * i) / n - 0.5, y - 0.5 * L, 1, 0.2 * L);
  ctx.fillStyle = tema.tinta;
  caminhoRet(ctx, xa - 0.05 * L, y - 0.25 * L, w + 0.1 * L, 0.06 * L, 0.02 * L);
  ctx.fill();
}

/** Engate simples entre vagoes de cores diferentes (soltam-se na proxima jogada). */
export function desenharEngate(ctx, xa, xb, y, L) {
  const w = xb - xa;
  if (w <= 0) return;
  ctx.fillStyle = '#1E2235';
  caminhoRet(ctx, xa - 1, y - 0.245 * L, w + 2, 0.045 * L, 0.02 * L);
  ctx.fill();
}

// ------------------------------------------------------------ locomotiva
/**
 * @typedef {{ caldeira: string, caldeiraClaro: string, cabine: string, cabineClaro: string,
 *   teto: string, friso: string, roda: string }} Pintura
 */
/**
 * Colecao de pinturas da locomotiva (a garagem): a primeira nova ao completar
 * o nivel 3, depois uma a cada 4 niveis (ver ui/garagem.js).
 * @type {(Pintura & { id: string })[]}
 */
export const PINTURAS = [
  { id: 'classica', caldeira: '#2E3150', caldeiraClaro: '#4C5180', cabine: '#D63A3A', cabineClaro: '#F06A5E', teto: '#1E2235', friso: '#F4C430', roda: '#F4C430' },
  { id: 'esmeralda', caldeira: '#1F6B4A', caldeiraClaro: '#35A271', cabine: '#F3E7D3', cabineClaro: '#FFFFFF', teto: '#16452F', friso: '#F4C430', roda: '#F4C430' },
  { id: 'real', caldeira: '#22408F', caldeiraClaro: '#3F6AD4', cabine: '#1B2C63', cabineClaro: '#33509E', teto: '#121D42', friso: '#FFD45A', roda: '#FFD45A' },
  { id: 'cereja', caldeira: '#B3202E', caldeiraClaro: '#E64B58', cabine: '#2A2233', cabineClaro: '#4A3C56', teto: '#1A1420', friso: '#F7E3B5', roda: '#F7E3B5' },
  { id: 'girassol', caldeira: '#E58A1F', caldeiraClaro: '#FFB54D', cabine: '#F5C933', cabineClaro: '#FFE27A', teto: '#8C4A12', friso: '#FFFFFF', roda: '#3A86F2' },
  { id: 'lavanda', caldeira: '#6E4BB8', caldeiraClaro: '#9877E6', cabine: '#EF58AF', cabineClaro: '#FF8FCD', teto: '#3E2873', friso: '#FFE173', roda: '#FFE173' },
  { id: 'neve', caldeira: '#DCE6F2', caldeiraClaro: '#FFFFFF', cabine: '#5FB3EA', cabineClaro: '#A6DCFF', teto: '#3E6E99', friso: '#3E6E99', roda: '#A6DCFF' },
  { id: 'ouro', caldeira: '#1A1A22', caldeiraClaro: '#3D3D4D', cabine: '#D4A017', cabineClaro: '#F7CF5C', teto: '#0E0E14', friso: '#F7CF5C', roda: '#F7CF5C' },
];

/** @type {Pintura} */
export const PINTURA_CLASSICA = PINTURAS[0];

/** @param {CanvasRenderingContext2D} g @param {number} L @param {Tema} tema @param {Pintura} p */
function corpoLoco(g, L, tema, p) {
  const esc = misturar(p.cabine, '#000000', 0.38);
  // estrado e limpa-trilhos
  caixa3d(g, -0.64 * L, 0.64 * L, -0.24 * L, -0.17 * L, 0.46 * L, { frente: '#2B2F3F', topo: '#4A5064', lado: '#171A26' });
  g.fillStyle = misturar(p.friso, '#000000', 0.3);
  g.beginPath();
  g.moveTo(-0.5 * L, -0.2 * L);
  g.lineTo(-0.5 * L + OX * 0.46 * L, -0.2 * L + OY * 0.46 * L);
  g.lineTo(-0.5 * L + OX * 0.46 * L, -0.02 * L + OY * 0.46 * L);
  g.lineTo(-0.5 * L, -0.02 * L);
  g.closePath();
  g.fill();
  g.fillStyle = p.friso;
  g.beginPath();
  g.moveTo(-0.64 * L, -0.2 * L);
  g.lineTo(-0.79 * L, -0.02 * L);
  g.lineTo(-0.5 * L, -0.02 * L);
  g.lineTo(-0.5 * L, -0.2 * L);
  g.closePath();
  g.fill();
  // caldeira: cilindro deitado com sombra embaixo e brilho em cima
  const R = 0.2 * L, cy = -0.42 * L, x0 = -0.6 * L, x1 = 0.3 * L;
  const gr = g.createLinearGradient(0, cy - R, 0, cy + R);
  gr.addColorStop(0, p.caldeiraClaro);
  gr.addColorStop(0.4, p.caldeira);
  gr.addColorStop(1, misturar(p.caldeira, '#000000', 0.5));
  g.fillStyle = gr;
  caminhoRet(g, x0, cy - R, x1 - x0, 2 * R, R);
  g.fill();
  g.save();
  caminhoRet(g, x0, cy - R, x1 - x0, 2 * R, R);
  g.clip();
  g.fillStyle = 'rgba(14,16,28,0.8)';
  g.fillRect(x0, cy - R, 0.16 * L, 2 * R);
  g.fillStyle = p.friso;
  for (const q of [-0.3, -0.06]) g.fillRect(q * L, cy - R, 0.03 * L, 2 * R);
  g.fillStyle = 'rgba(255,255,255,0.3)';
  caminhoRet(g, x0 + 0.2 * L, cy - R * 0.75, 0.42 * L, R * 0.16, R * 0.08);
  g.fill();
  g.restore();
  // chamine (cilindro em pe) e domo
  g.fillStyle = '#1E2235';
  g.fillRect(-0.5 * L, -0.84 * L, 0.13 * L, 0.26 * L);
  g.fillStyle = '#3A3F55';
  g.beginPath();
  g.ellipse(-0.435 * L + OX * 0.065 * L, -0.84 * L + OY * 0.065 * L, 0.075 * L, 0.035 * L, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0F1119';
  g.beginPath();
  g.ellipse(-0.435 * L + OX * 0.065 * L, -0.84 * L + OY * 0.065 * L, 0.05 * L, 0.022 * L, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = p.friso;
  g.fillRect(-0.52 * L, -0.8 * L, 0.17 * L, 0.035 * L);
  g.beginPath();
  g.ellipse(-0.1 * L, cy - R + 0.01 * L, 0.09 * L, 0.075 * L, 0, Math.PI, 0);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(-0.13 * L, cy - R - 0.03 * L, 0.03 * L, 0.02 * L, 0, 0, Math.PI * 2);
  g.fill();
  // farol (caixa)
  caixa3d(g, -0.68 * L, -0.56 * L, -0.72 * L, -0.6 * L, 0.12 * L, { frente: '#2B2F3F', topo: '#4A5064', lado: '#171A26' });
  // cabine com janela e friso; teto em laje
  caixa3d(g, 0.2 * L, 0.66 * L, -0.92 * L, -0.24 * L, 0.46 * L, { frente: p.cabine, topo: p.cabineClaro, lado: esc });
  g.fillStyle = tema.janelaVagao;
  caminhoRet(g, 0.27 * L, -0.82 * L, 0.3 * L, 0.22 * L, 0.04 * L);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.beginPath();
  g.moveTo(0.66 * L + OX * 0.1 * L, -0.82 * L + OY * 0.1 * L);
  g.lineTo(0.66 * L + OX * 0.36 * L, -0.82 * L + OY * 0.36 * L);
  g.lineTo(0.66 * L + OX * 0.36 * L, -0.6 * L + OY * 0.36 * L);
  g.lineTo(0.66 * L + OX * 0.1 * L, -0.6 * L + OY * 0.1 * L);
  g.closePath();
  g.fill();
  g.fillStyle = p.friso;
  g.fillRect(0.2 * L, -0.37 * L, 0.46 * L, 0.035 * L);
  caixa3d(g, 0.14 * L, 0.72 * L, -0.97 * L, -0.91 * L, 0.52 * L, { frente: p.teto, topo: misturar(p.teto, '#FFFFFF', 0.25), lado: misturar(p.teto, '#000000', 0.3) });
}

/**
 * Locomotiva olhando para a esquerda (saida).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ roda?: number, aceso?: boolean, escalaY?: number, pintura?: Pintura }} o
 */
export function desenharLoco(ctx, x, y, L, tema, dpr, o = {}) {
  const p = o.pintura || PINTURA_CLASSICA;
  const ang = o.roda || 0;
  // farol: facho chapado para a frente
  if (o.aceso) {
    const gr = ctx.createLinearGradient(x - 0.6 * L, 0, x - 2.1 * L, 0);
    gr.addColorStop(0, 'rgba(255,240,170,0.45)');
    gr.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - 0.66 * L, y - 0.7 * L);
    ctx.lineTo(x - 2.1 * L, y - 1.0 * L);
    ctx.lineTo(x - 2.1 * L, y - 0.24 * L);
    ctx.lineTo(x - 0.66 * L, y - 0.62 * L);
    ctx.closePath();
    ctx.fill();
  }
  // rodas de tras (obliqua), depois o corpo, depois as da frente
  const motrizes = [0.0, 0.36];
  const R = 0.15 * L;
  ctx.fillStyle = '#0F1119';
  for (const q of [...motrizes, -0.46]) {
    const r = q === -0.46 ? 0.075 * L : R;
    ctx.beginPath();
    ctx.arc(x + q * L + OX * 0.46 * L, y - r + OY * 0.46 * L, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const pad = L * 0.1;
  const w = 1.8 * L + pad * 2;
  const h = 1.0 * L + pad * 2;
  const chave = `loco|${L.toFixed(2)}|${tema.nome}|${dpr}|${p.cabine}|${p.caldeira}`;
  const spr = sprite(chave, w, h, 0.85 * L + pad, h - pad, dpr, (g) => corpoLoco(g, L, tema, p));
  const ey = o.escalaY || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ey);
  ctx.drawImage(spr, -(0.85 * L + pad), -(h - pad), w, h);
  ctx.restore();
  for (const q of motrizes) {
    const cx = x + q * L;
    const cy = y - R;
    ctx.fillStyle = tema.tinta;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.roda;
    ctx.lineWidth = Math.max(1.2, L * 0.03);
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, L * 0.02);
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = ang + (k * Math.PI) / 3;
      ctx.moveTo(cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7);
      ctx.lineTo(cx - Math.cos(a) * R * 0.7, cy - Math.sin(a) * R * 0.7);
    }
    ctx.stroke();
    ctx.fillStyle = tema.tinta;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const rg = 0.075 * L;
  ctx.fillStyle = tema.tinta;
  ctx.beginPath();
  ctx.arc(x - 0.46 * L, y - rg, rg, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#CDD2DC';
  ctx.beginPath();
  ctx.arc(x - 0.46 * L, y - rg, rg * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // biela ligando as motrizes
  const bx = Math.cos(ang) * R * 0.5;
  const by = Math.sin(ang) * R * 0.5;
  ctx.strokeStyle = '#CDD2DC';
  ctx.lineWidth = Math.max(1.5, L * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + motrizes[0] * L + bx, y - R + by);
  ctx.lineTo(x + motrizes[1] * L + bx, y - R + by);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // lampada do farol
  if (o.aceso) {
    ctx.fillStyle = 'rgba(255,246,184,0.35)';
    ctx.beginPath();
    ctx.arc(x - 0.62 * L, y - 0.66 * L, 0.09 * L, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = o.aceso ? '#FFF6B8' : '#8A8799';
  ctx.beginPath();
  ctx.arc(x - 0.62 * L, y - 0.66 * L, 0.04 * L, 0, Math.PI * 2);
  ctx.fill();
}

/** Ponta da chamine (para a fumaca). */
export function pontaChamine(x, y, L) {
  return { x: x - 0.415 * L, y: y - 0.86 * L };
}

// ------------------------------------------------------------------ sinal
/** Lampada do sinal: vermelha (esperando) ou verde (trem pronto). O poste e do cenario. */
export function desenharLuzSinal(ctx, x, y, L, verde, tema) {
  const cy = y - 0.66 * L;
  const r = 0.075 * L;
  const cor = verde ? '#4CE36B' : '#FF5A5A';
  ctx.fillStyle = cor;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(x, cy, r * 2.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = tema.tinta;
  ctx.beginPath();
  ctx.arc(x, cy, r * 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------- mao
/** Mao do tutorial (ponta do dedo em x, y). */
export function desenharMao(ctx, x, y, s, apertando) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (apertando ? 0.92 : 1), s * (apertando ? 0.92 : 1));
  ctx.rotate(-0.25);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E2235';
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
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
