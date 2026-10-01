// Geometria da cena (pura): onde fica cada trilho, cada vaga, a locomotiva,
// o sinal e a estacao, a partir do tamanho da tela e dos HUDs.
//
// Tudo e medido em L, o comprimento de um vagao em pixels CSS. Cada trilho,
// da esquerda para a direita:
//   sinal | vaga da locomotiva | vagas 0..cap-1 (passo P) | para-choque
// A frente do trem (saida) fica a esquerda; o vagao novo engata a direita.

export const PASSO = 1.1; // P / L
export const LOCO = 1.32; // comprimento da locomotiva / L
export const LINHA = 0.96; // distancia vertical entre trilhos / L
export const TOPO_CARRO = 0.8; // do trilho ate o topo do vagao / L
export const BASE_LEITO = 0.15; // do trilho ate a borda de baixo do leito / L

const SINAL = 0.42;
const FOLGA_LOCO = 0.1;
const PARA_CHOQUE = 0.42;

/** Largura de um trilho em L. @param {number} cap */
export const larguraTrilho = (cap) => SINAL + LOCO + FOLGA_LOCO + cap * PASSO + PARA_CHOQUE;

/**
 * @param {{ W: number, H: number, topo: number, base: number, n: number, cap: number, margem?: number, direita?: number }} e
 *   topo/base: faixa vertical livre entre os HUDs (px CSS); direita: faixa
 *   reservada para a coluna de botoes (paisagem)
 */
export function calcularLayout({ W, H, topo, base, n, cap, margem = 12, direita = 0 }) {
  const disponivel = Math.max(80, base - topo);
  const altura = (/** @type {number} */ L) => ((n - 1) * LINHA + TOPO_CARRO + BASE_LEITO) * L;
  const Wu = W - direita;
  const Lw = (Wu - margem * 2) / larguraTrilho(cap);
  // reserva para a estacao: some se a tela for baixa
  const reserva = Math.min(110, disponivel * 0.16);
  const Lh = (disponivel - reserva) / ((n - 1) * LINHA + TOPO_CARRO + BASE_LEITO + 0.1);
  const L = Math.max(18, Math.min(Lw, Lh, 110));
  const P = L * PASSO;
  const h = altura(L);
  const sobra = disponivel - h;
  // a estacao usa a sobra de cima (rampa, sem degrau); o resto centraliza o patio
  const fachadaAlt = Math.max(0, Math.min((sobra - 30) * 0.9, 150));
  const yTabuleiro = topo + fachadaAlt + (sobra - fachadaAlt) * 0.5;
  const largura = larguraTrilho(cap) * L;
  const xIni = (Wu - largura) / 2;
  const xFrente = xIni + (SINAL + LOCO + FOLGA_LOCO) * L + P / 2;
  const trilhos = [];
  for (let i = 0; i < n; i++) {
    const yb = yTabuleiro + TOPO_CARRO * L + i * LINHA * L;
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
    W, H, Wu, L, P, n, cap,
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

/**
 * Trilho sob o ponto (faixa vertical de cada trilho), ou -1.
 * @param {ReturnType<typeof calcularLayout>} lay @param {number} x @param {number} y
 */
export function trilhoEm(lay, x, y) {
  if (x < lay.xIni - lay.L * 0.6 || x > lay.xFim + lay.L * 0.6) return -1;
  let melhor = -1;
  let md = Infinity;
  lay.trilhos.forEach((t, i) => {
    const centro = t.yb - lay.L * 0.3;
    const d = Math.abs(y - centro);
    if (d < (LINHA * lay.L) / 2 + lay.L * 0.08 && d < md) {
      md = d;
      melhor = i;
    }
  });
  return melhor;
}
