// Regras puras do Color Train: desvio sem saida ("boca do trilho") com
// engate em bloco (tudo ou nada).
//
// Trilho = array de vagoes { id, c }, indice 0 = boca (lado do sinal). Os
// vagoes ficam encostados no para-choque, do outro lado.
// - Sai sempre o bloco da boca: todos os vagoes seguidos da mesma cor.
// - O bloco entra pela boca de outro trilho, se ele estiver vazio ou se a
//   frente dele for da mesma cor, e so se couber INTEIRO (vagoes engatados
//   nao se separam).
// - Trilho cheio de uma cor so e um trem pronto: trava e espera a partida.

/** @typedef {{ id: number, c: number }} Vagao */
/** @typedef {{ cap: number, trilhos: Vagao[][] }} Estado */
/** @typedef {null|'mesmo'|'vazio'|'travado'|'cor'|'cap'} Motivo */

/** Tamanho do bloco da boca. @param {{c:number}[]} t */
export function bloco(t) {
  if (!t.length) return 0;
  let k = 1;
  while (k < t.length && t[k].c === t[0].c) k++;
  return k;
}

/** @param {{c:number}[]} t @param {number} cap */
export function completo(t, cap) {
  return t.length === cap && bloco(t) === cap;
}

/**
 * Por que o bloco de a nao entra em b (null = entra). Na ordem: mesmo trilho,
 * origem vazia, trem travado, cor diferente na boca, falta de vaga.
 * @param {Estado} st @param {number} a @param {number} b @returns {Motivo}
 */
export function motivo(st, a, b) {
  if (a === b) return 'mesmo';
  const A = st.trilhos[a];
  const B = st.trilhos[b];
  if (!A || !B || !A.length) return 'vazio';
  if (completo(A, st.cap) || completo(B, st.cap)) return 'travado';
  if (B.length && B[0].c !== A[0].c) return 'cor';
  if (st.cap - B.length < bloco(A)) return 'cap';
  return null;
}

/** @param {Estado} st @param {number} a @param {number} b */
export function pode(st, a, b) {
  return motivo(st, a, b) === null;
}

/**
 * Aplica a jogada (ja validada com pode).
 * @param {Estado} st @param {number} a @param {number} b
 */
export function mover(st, a, b) {
  const A = st.trilhos[a];
  const B = st.trilhos[b];
  const vagoes = A.splice(0, bloco(A));
  B.unshift(...vagoes);
  return { de: a, para: b, vagoes, n: vagoes.length, cor: vagoes[0].c, completou: completo(B, st.cap) };
}

/** @param {Estado} st */
export function resolvido(st) {
  return st.trilhos.every((t) => !t.length || completo(t, st.cap));
}

/** Jogadas legais [a, b]. @param {Estado} st */
export function jogadas(st) {
  const out = [];
  for (let a = 0; a < st.trilhos.length; a++) {
    for (let b = 0; b < st.trilhos.length; b++) if (pode(st, a, b)) out.push([a, b]);
  }
  return out;
}

/** Trilhos onde o bloco da boca de a pode entrar. @param {Estado} st @param {number} a */
export function destinos(st, a) {
  const out = [];
  for (let b = 0; b < st.trilhos.length; b++) if (pode(st, a, b)) out.push(b);
  return out;
}

/** Texto compacto: um trilho por string, cor 0 = 'A'. @param {Estado} st */
export function paraTexto(st) {
  return st.trilhos.map((t) => t.map((v) => String.fromCharCode(65 + v.c)).join(''));
}
