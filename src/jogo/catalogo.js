// Definicao de cada nivel: os 150 primeiros vem prontos de niveis.js (gerados
// e validados no build); dali em diante o gerador roda no navegador.

import { NIVEIS } from './niveis.js';
import { gerarNivel } from './gerador.js';

/** @param {number} nivel @returns {{ cap: number, t: string[], jogadas: number }} */
export function definicaoNivel(nivel) {
  const pronto = NIVEIS[nivel - 1];
  if (pronto) return { cap: pronto[0], t: pronto[1] ? pronto[1].split('|') : [], jogadas: pronto[2] };
  return gerarNivel(nivel);
}
