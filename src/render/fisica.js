// Fisica leve das cargas, sem biblioteca: molas amortecidas (liquido que
// balanca, baloes que oscilam, pilhas que deslizam), impulsos no pouso e no
// engate, e a folga de engate na partida. Tudo e visual: as regras do jogo
// nao dependem disto.
//
// A aceleracao entra normalizada em L/s2 (L = comprimento do vagao), entao a
// resposta e a mesma em qualquer tamanho de tela.

/** Tipo de carga de cada cor: vermelho, laranja, amarelo, verde, turquesa, azul, roxo, rosa. */
export const TIPOS = ['tanque', 'laranjas', 'areia', 'bambu', 'conteiner', 'tanque', 'barris', 'baloes'];

/** @param {number} cor */
export const tipoDaCor = (cor) => TIPOS[cor % TIPOS.length];

/** Mola (k), amortecimento (c), ganho da aceleracao e inclinacao maxima (rad) por tipo. */
const PARAMS = {
  tanque: { k: 52, c: 4.2, ganho: 1.0, max: 0.6, chute: 3.4 },
  baloes: { k: 15, c: 1.3, ganho: 1.5, max: 0.95, chute: 2.2 },
  bambu: { k: 150, c: 13, ganho: 0.5, max: 0.35, chute: 1.4 },
  barris: { k: 80, c: 6.5, ganho: 0.9, max: 0.5, chute: 1.8 },
  conteiner: { k: 220, c: 19, ganho: 0.25, max: 0.2, chute: 1.0 },
  areia: { k: 220, c: 19, ganho: 0.3, max: 0.2, chute: 1.0 },
  laranjas: { k: 200, c: 16, ganho: 0.3, max: 0.22, chute: 1.2 },
};

/**
 * @typedef {{ tipo: string, cor: number, t: number, tilt: number, tiltV: number, bob: number, bobV: number,
 *   jolt: number, rot: number, joltT0: number, joltDir: number }} Carga
 * joltT0/joltDir: tranco agendado da onda de engate (dir +1 = para o para-choque)
 */

/** Estado inicial da carga de um vagao. @param {number} cor @returns {Carga} */
export function criarCarga(cor) {
  return { tipo: tipoDaCor(cor), cor, t: Math.random() * 10, tilt: 0, tiltV: 0, bob: 0, bobV: 0, jolt: 0, rot: 0, joltT0: 0, joltDir: -1 };
}

/** Agua (azul) e mais fluida que suco (vermelho): balanca mais tempo. */
const POR_COR = { 5: { k: 64, c: 2.9, ganho: 1.1, max: 0.65, chute: 3.8 } };
/** @param {Carga} f */
const params = (f) => POR_COR[f.cor] || PARAMS[f.tipo];

/**
 * Um passo da fisica. tilt e a inclinacao da carga (liquido, baloes) ou o
 * deslocamento relativo da pilha; bob e a suspensao (em L); jolt e a energia
 * do ultimo impacto (0..1), que some sozinha.
 * @param {Carga} f @param {number} axL aceleracao horizontal em L/s2 @param {number} dt segundos
 */
export function passoCarga(f, axL, dt) {
  const p = params(f);
  f.t += dt;
  const alvo = Math.max(-p.max, Math.min(p.max, (-axL / 30) * p.ganho));
  const a = (alvo - f.tilt) * p.k - f.tiltV * p.c;
  f.tiltV += a * dt;
  f.tilt += f.tiltV * dt;
  const b = -f.bob * 320 - f.bobV * 16;
  f.bobV += b * dt;
  f.bob += f.bobV * dt;
  f.jolt *= Math.exp(-7 * dt);
  if (f.tipo === 'barris') f.rot = f.tilt * 2.4;
}

/**
 * Impacto: pouso, engate ou arranque. dir e o sentido do tranco (+1 para a
 * direita), forca de 0 a 1.
 * @param {Carga} f @param {number} forca @param {number} [dir]
 */
export function impulsoCarga(f, forca, dir = 1) {
  const p = params(f);
  f.bobV -= forca * 1.3;
  f.tiltV += dir * forca * p.chute;
  f.jolt = Math.min(1, f.jolt + forca);
}

/** A carga esta quieta? (para desenhar a versao em repouso) @param {Carga} f */
export function quieta(f) {
  return Math.abs(f.tilt) < 0.004 && Math.abs(f.tiltV) < 0.02 && Math.abs(f.bob) < 0.002 && f.jolt < 0.02;
}
