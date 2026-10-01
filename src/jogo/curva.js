// Curva de dificuldade do Color Train.
//
// Dente de serra: cada faixa aperta um pouco (mais cores, mais trilhos, trem
// mais longo, menos folga) e todo nivel multiplo de 5 e um respiro, mais
// leve que os vizinhos. Os 5 primeiros niveis resolvem em poucas jogadas
// (primeiros 3 minutos sem frustracao, regra do cofre POKI).
//
// n = trilhos, k = cores, cap = vagoes por trem, min/max = jogadas da
// solucao aceita, exato = mede o minimo real (busca em largura).

/** Nivel 1: duas jogadas, a primeira obrigatoriamente um bloco de 2. */
export const TUTORIAL = [{ cap: 4, t: ['AA', 'FF', 'FFAA'] }];

/**
 * @typedef {{ n: number, k: number, cap: number, min: number, max?: number,
 *   exato?: boolean, espalhar?: boolean }} Parametros
 */

/** @param {number} nivel @returns {Parametros|{fixo: {cap:number, t:string[]}}} */
export function parametros(nivel) {
  if (nivel <= TUTORIAL.length) return { fixo: TUTORIAL[nivel - 1] };
  switch (nivel) {
    case 2: return { n: 4, k: 3, cap: 3, min: 3, max: 4, exato: true, espalhar: true };
    case 3: return { n: 5, k: 3, cap: 3, min: 4, max: 6, exato: true, espalhar: true };
    case 4: return { n: 5, k: 3, cap: 4, min: 5, max: 8, exato: true };
    case 5: return { n: 5, k: 3, cap: 4, min: 4, max: 6, exato: true };
    default: break;
  }
  const respiro = nivel % 5 === 0;
  switch (nivel) {
    case 6: return { n: 5, k: 3, cap: 4, min: 6, max: 9, exato: true };
    case 7: return { n: 6, k: 4, cap: 3, min: 6, max: 10 };
    case 8: return { n: 6, k: 4, cap: 4, min: 8, max: 12 };
    case 9: return { n: 6, k: 4, cap: 4, min: 9, max: 14 };
    default: break;
  }
  if (nivel < 15) {
    if (respiro) return { n: 5, k: 3, cap: 4, min: 6 };
    return nivel < 13 ? { n: 6, k: 4, cap: 4, min: 10 } : { n: 7, k: 5, cap: 4, min: 12 };
  }
  if (nivel < 25) return respiro ? { n: 6, k: 4, cap: 4, min: 8 } : { n: 8, k: 6, cap: 4, min: 14 };
  if (nivel < 35) {
    if (respiro) return { n: 7, k: 5, cap: 4, min: 11 };
    return nivel % 2 ? { n: 8, k: 6, cap: 5, min: 16 } : { n: 9, k: 7, cap: 4, min: 16 };
  }
  if (nivel < 50) {
    if (respiro) return { n: 8, k: 6, cap: 4, min: 14 };
    return nivel % 2 ? { n: 9, k: 7, cap: 5, min: 20 } : { n: 10, k: 8, cap: 4, min: 20 };
  }
  if (respiro) return { n: 8, k: 6, cap: 5, min: 15 };
  const ciclo = nivel % 3;
  if (ciclo === 0) return { n: 9, k: 8, cap: 4, min: 20 };
  if (ciclo === 1) return { n: 10, k: 8, cap: 5, min: 24 };
  return { n: 10, k: 8, cap: 4, min: 22 };
}
