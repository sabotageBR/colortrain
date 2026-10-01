// Gerador de niveis com semente: mesmo numero de nivel = mesmo tabuleiro.
// Sorteia os vagoes e so aceita o tabuleiro que o solucionador resolve dentro
// da faixa de jogadas da curva. Roda no node (tools/gerar-niveis.mjs grava os
// 150 primeiros em niveis.js) e no navegador para os niveis seguintes.

import { criarRng, hashTexto, embaralhar } from '../core/rng.js';
import { resolver } from './solucionador.js';
import { parametros } from './curva.js';

// Cores mais distintas primeiro: os niveis iniciais usam so estas.
const ORDEM_CORES = [0, 5, 2, 3, 6, 1, 7, 4];

/** @param {string} t @param {number} cap */
function completoTexto(t, cap) {
  if (t.length !== cap) return false;
  for (let i = 1; i < t.length; i++) if (t[i] !== t[0]) return false;
  return true;
}

/**
 * @param {number} nivel
 * @returns {{ cap: number, t: string[], jogadas: number }}
 */
export function gerarNivel(nivel) {
  const p = parametros(nivel);
  if ('fixo' in p) {
    const sol = resolver(p.fixo.t, p.fixo.cap, { exato: true });
    return { cap: p.fixo.cap, t: p.fixo.t.slice(), jogadas: sol ? sol.length : 0 };
  }
  const base = hashTexto('colortrain:' + nivel);
  for (let tentativa = 0; tentativa < 600; tentativa++) {
    const r = criarRng(base + tentativa * 7919);
    const paleta = nivel < 15 ? ORDEM_CORES.slice(0, Math.max(p.k + 1, 5)) : ORDEM_CORES.slice();
    const cores = embaralhar(paleta, r).slice(0, p.k);
    const vagoes = [];
    for (const c of cores) for (let j = 0; j < p.cap; j++) vagoes.push(String.fromCharCode(65 + c));
    embaralhar(vagoes, r);
    /** @type {string[]} */
    let t;
    if (p.espalhar) {
      t = Array.from({ length: p.n }, () => '');
      for (const v of vagoes) {
        const livres = t.map((x, i) => i).filter((i) => t[i].length < p.cap);
        const i = livres[Math.floor(r() * livres.length)];
        t[i] += v;
      }
    } else {
      t = [];
      for (let i = 0; i < p.k; i++) t.push(vagoes.slice(i * p.cap, (i + 1) * p.cap).join(''));
      for (let i = p.k; i < p.n; i++) t.push('');
      embaralhar(t, r);
    }
    if (t.some((x) => completoTexto(x, p.cap))) continue;
    if (!t.some((x) => x.length === 0) && p.espalhar) continue;
    const sol = resolver(t, p.cap, { exato: !!p.exato, orcamento: p.exato ? 40000 : 60000 });
    if (!sol) continue;
    if (sol.length < p.min || (p.max && sol.length > p.max)) continue;
    return { cap: p.cap, t, jogadas: sol.length };
  }
  throw new Error('nao consegui gerar o nivel ' + nivel);
}
