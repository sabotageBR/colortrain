// Geometria da cena (pura): onde fica cada trilho, cada vaga, a locomotiva,
// o sinal e a estacao, a partir do tamanho da tela e dos HUDs.
//
// Tudo e medido em L, o comprimento de um vagao em pixels CSS. Cada trilho,
// da esquerda para a direita:
//   sinal | vaga da locomotiva | vagas 0..cap-1 (passo P) | para-choque
// A boca (saida e entrada) fica a esquerda, no sinal; os vagoes ficam
// encostados no para-choque, entao o vagao j de um trilho com k vagoes ocupa
// a vaga cap-k+j (ver vaga).

export const PASSO = 1.1; // P / L
export const LOCO = 1.32; // comprimento da locomotiva / L
export const LINHA = 0.96; // distancia vertical minima entre trilhos / L
export const LINHA_MAX = 1.6; // no retrato os trilhos se espalham ate aqui
export const TOPO_CARRO = 0.8; // do trilho ate o topo do vagao / L
export const BASE_LEITO = 0.15; // do trilho ate a borda de baixo do leito / L

const SINAL = 0.42;
const FOLGA_LOCO = 0.1;
const PARA_CHOQUE = 0.42;

/** Largura de um trilho em L. @param {number} cap */
export const larguraTrilho = (cap) => SINAL + LOCO + FOLGA_LOCO + cap * PASSO + PARA_CHOQUE;

/**
 * Vaga do vagao j (0 = boca) num trilho com k vagoes: encostados no para-choque.
 * @param {number} cap @param {number} k @param {number} j
 */
export const vaga = (cap, k, j) => cap - k + j;

/**
 * @param {{ W: number, H: number, topo: number, base: number, n: number, cap: number, margem?: number, direita?: number }} e
 *   topo/base: faixa vertical livre entre os HUDs (px CSS); direita: faixa
 *   reservada para a coluna de botoes (paisagem)
 */
export function calcularLayout({ W, H, topo, base, n, cap, margem = 12, direita = 0 }) {
  const disponivel = Math.max(80, base - topo);
  const Wu = W - direita;
  const Lw = (Wu - margem * 2) / larguraTrilho(cap);
  // reserva para a estacao: some se a tela for baixa
  const reserva = Math.min(110, disponivel * 0.16);
  const Lh = (disponivel - reserva) / ((n - 1) * LINHA + TOPO_CARRO + BASE_LEITO + 0.1);
  const L = Math.max(18, Math.min(Lw, Lh, 110));
  // no retrato o vagao e limitado pela largura e sobra altura: os trilhos se
  // espalham (faixas de toque maiores) em vez de deixar o patio numa tira
  let linha = LINHA;
  if (H > W && n > 1) {
    const livre = (disponivel - reserva - (TOPO_CARRO + BASE_LEITO + 0.1) * L) / ((n - 1) * L);
    linha = Math.min(LINHA_MAX, Math.max(LINHA, livre));
  }
  const P = L * PASSO;
  const h = ((n - 1) * linha + TOPO_CARRO + BASE_LEITO) * L;
  const sobra = disponivel - h;
  // a estacao usa a sobra de cima (rampa, sem degrau); o resto centraliza o patio
  const fachadaAlt = Math.max(0, Math.min((sobra - 30) * 0.9, 150));
  const yTabuleiro = topo + fachadaAlt + (sobra - fachadaAlt) * 0.5;
  const largura = larguraTrilho(cap) * L;
  const xIni = (Wu - largura) / 2;
  const xFrente = xIni + (SINAL + LOCO + FOLGA_LOCO) * L + P / 2;
  const trilhos = [];
  for (let i = 0; i < n; i++) {
    const yb = yTabuleiro + TOPO_CARRO * L + i * linha * L;
    trilhos.push({
      yb,
      xFrente,
      xLoco: xFrente - P / 2 - FOLGA_LOCO * L - (LOCO * L) / 2,
      xSinal: xIni + SINAL * L * 0.5,
      xIni,
      xFim: xIni + largura,
    });
  }
  return {
    W, H, Wu, L, P, n, cap, linha,
    retrato: H > W,
    rw: 0.085 * L,
    Lg: LOCO * L,
    xIni,
    xFim: xIni + largura,
    yTabuleiro,
    yFimTabuleiro: yTabuleiro + h,
    /** faixa acima da placa para a estacao (alt 0 = sem predio) */
    fachada: { y0: topo, y1: yTabuleiro - 0.12 * L, alt: fachadaAlt },
    trilhos,
    /** centro x da vaga s do trilho i */
    xVaga: (/** @type {number} */ i, /** @type {number} */ s) => trilhos[i].xFrente + s * P,
  };
}

/** @typedef {ReturnType<typeof calcularLayout>} Layout */

/** Distancia vertical do ponto ao centro de toque do trilho i. @param {Layout} lay */
const distTrilho = (lay, i, y) => Math.abs(y - (lay.trilhos[i].yb - lay.L * 0.3));

/** O ponto esta na faixa horizontal do patio? (no retrato, a tela toda) @param {Layout} lay */
const naFaixa = (lay, x) => lay.retrato || (x >= lay.xIni - lay.L * 0.6 && x <= lay.xFim + lay.L * 0.6);

/**
 * Trilho sob o ponto (faixa vertical de cada trilho), ou -1. Os trilhos das
 * pontas ganham meia faixa a mais para fora.
 * @param {Layout} lay @param {number} x @param {number} y
 */
export function trilhoEm(lay, x, y) {
  if (!naFaixa(lay, x)) return -1;
  let melhor = -1;
  let md = Infinity;
  const meia = (lay.linha * lay.L) / 2 + lay.L * 0.08;
  lay.trilhos.forEach((_, i) => {
    const d = distTrilho(lay, i, y);
    const ponta = i === 0 || i === lay.trilhos.length - 1;
    if (d < meia + (ponta ? lay.L * 0.5 : 0) && d < md) {
      md = d;
      melhor = i;
    }
  });
  return melhor;
}

/**
 * Ima do arraste: o trilho valido mais perto do ponto, dentro do raio
 * (padrao: 0,75 da distancia entre trilhos), ou -1.
 * @param {Layout} lay @param {number} x @param {number} y @param {number[]} validos
 * @param {number} [raio]
 */
export function trilhoProximo(lay, x, y, validos, raio = 0.75 * lay.linha * lay.L) {
  if (!naFaixa(lay, x)) return -1;
  let melhor = -1;
  let md = raio;
  for (const i of validos) {
    const d = distTrilho(lay, i, y);
    if (d <= md) {
      md = d;
      melhor = i;
    }
  }
  return melhor;
}
