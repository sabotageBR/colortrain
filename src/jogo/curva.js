// Curva de dificuldade do Color Train.
//
// Os 3 primeiros niveis sao desenhados a mao e ensinam uma coisa cada, com a
// jogada guiada (guia) e sem nenhum beco. Depois, dente de serra: cada faixa
// aperta um pouco (mais cores, mais trilhos) e todo nivel multiplo de 5 e um
// respiro. Trem de 3 vagoes ate o nivel 6, de 4 dali em diante. Ate o nivel
// 12 nenhum estado alcancavel e beco (semBeco); dali ao 150 o risco de um
// jogador que toca ao acaso cair num beco fica abaixo de riscoMax (0,15 ate o
// 40, 0,25 depois). Depois do 150 o gerador roda no navegador, sem filtro.
//
// n = trilhos, k = cores, cap = vagoes por trem, min/max = jogadas da
// solucao aceita, exato = mede o minimo real (busca em largura).

/**
 * Niveis de ensino. guia = jogadas que a mao conduz (so esses trilhos aceitam
 * toque enquanto houver passo); licao = o que o nivel ensina.
 * @type {{ cap: number, t: string[], guia: number[][], licao: string }[]}
 */
export const TUTORIAL = [
  // mesma cor encosta na mesma cor, pela boca
  { cap: 3, t: ['AF', 'AA', 'FF'], guia: [[0, 1], [0, 2]], licao: 'boca' },
  // tudo ou nada: o A sozinho nao cabe no trilho cheio (a jogada inversa mostra a sobra)
  { cap: 3, t: ['AAF', 'A', 'FF'], guia: [[0, 1], [0, 2]], licao: 'bloco' },
  // o trilho vazio aceita qualquer cor
  { cap: 3, t: ['AFF', 'FAA', ''], guia: [[0, 2]], licao: 'vazio' },
];

/**
 * @typedef {{ n: number, k: number, cap: number, min: number, max?: number,
 *   exato?: boolean, espalhar?: boolean, semBeco?: boolean, riscoMax?: number }} Parametros
 */

/** @param {number} nivel @returns {Parametros} */
function faixa(nivel) {
  const respiro = nivel % 5 === 0;
  switch (nivel) {
    // 3a cor, trem de 3
    case 4: return { n: 5, k: 3, cap: 3, min: 3, max: 5, exato: true, espalhar: true };
    case 5: return { n: 5, k: 3, cap: 3, min: 4, max: 6, exato: true, espalhar: true };
    case 6: return { n: 5, k: 3, cap: 3, min: 5, max: 7, exato: true, espalhar: true };
    // novidade: trem de 4
    case 7: return { n: 5, k: 3, cap: 4, min: 5, max: 8, exato: true };
    case 8: return { n: 5, k: 3, cap: 4, min: 6, max: 9, exato: true };
    // 4a cor
    case 9: return { n: 6, k: 4, cap: 4, min: 7, max: 11, exato: true };
    default: break;
  }
  if (nivel < 13) return respiro ? { n: 5, k: 3, cap: 4, min: 6 } : { n: 6, k: 4, cap: 4, min: 9, max: 13 };
  if (nivel < 16) return respiro ? { n: 6, k: 4, cap: 4, min: 8 } : { n: 7, k: 5, cap: 4, min: 11 };
  if (nivel < 21) return respiro ? { n: 6, k: 4, cap: 4, min: 9 } : { n: 7, k: 5, cap: 4, min: 13 };
  if (nivel < 26) return respiro ? { n: 7, k: 5, cap: 4, min: 11 } : { n: 8, k: 6, cap: 4, min: 14 };
  if (nivel < 36) {
    if (respiro) return { n: 7, k: 5, cap: 4, min: 12 };
    return nivel % 2 ? { n: 8, k: 6, cap: 4, min: 16 } : { n: 9, k: 7, cap: 4, min: 16 };
  }
  if (nivel < 50) {
    if (respiro) return { n: 8, k: 6, cap: 4, min: 14 };
    return nivel % 2 ? { n: 9, k: 7, cap: 4, min: 18 } : { n: 10, k: 8, cap: 4, min: 20 };
  }
  if (respiro) return { n: 8, k: 6, cap: 4, min: 15 };
  const ciclo = nivel % 3;
  if (ciclo === 0) return { n: 9, k: 7, cap: 4, min: 19 };
  return { n: 10, k: 8, cap: 4, min: 22 };
}

/** @param {number} nivel @returns {Parametros|{fixo: {cap:number, t:string[]}}} */
export function parametros(nivel) {
  if (nivel <= TUTORIAL.length) return { fixo: TUTORIAL[nivel - 1] };
  const p = faixa(nivel);
  if (nivel <= 12) p.semBeco = true;
  else if (nivel <= 40) p.riscoMax = 0.15;
  else if (nivel <= 150) p.riscoMax = 0.25;
  return p;
}

/**
 * Depois de quanto tempo parado (ms) a mao mostra a proxima jogada de graca;
 * 0 = nunca (dali em diante so a dica).
 * @param {number} nivel
 */
export function limiarMao(nivel) {
  if (nivel <= 6) return 4000;
  if (nivel <= 15) return 20000;
  return 0;
}
