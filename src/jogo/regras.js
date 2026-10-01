// Regras puras do Color Train: fila com engate em bloco (tudo ou nada).
//
// Trilho = array de vagoes { id, c }, indice 0 = frente (lado da saida).
// - Sai sempre o bloco da frente: todos os vagoes seguidos da mesma cor.
// - O bloco engata no FIM de outro trilho, se ele estiver vazio ou terminar
//   na mesma cor, e so se couber INTEIRO (vagoes engatados nao se separam).
// - Trilho cheio de uma cor so e um trem pronto: trava e espera a partida.

/** @typedef {{ id: number, c: number }} Vagao */
/** @typedef {{ cap: number, trilhos: Vagao[][] }} Estado */

/** Tamanho do bloco da frente. @param {{c:number}[]} t */
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

/** @param {Estado} st @param {number} a @param {number} b */
export function pode(st, a, b) {
  if (a === b) return false;
  const A = st.trilhos[a];
  const B = st.trilhos[b];
  if (!A || !B || !A.length) return false;
  if (completo(A, st.cap) || completo(B, st.cap)) return false;
  const n = bloco(A);
  if (st.cap - B.length < n) return false;
  return !B.length || B[B.length - 1].c === A[0].c;
}

/**
 * Aplica a jogada (ja validada com pode).
 * @param {Estado} st @param {number} a @param {number} b
 */
export function mover(st, a, b) {
  const A = st.trilhos[a];
  const B = st.trilhos[b];
  const vagoes = A.splice(0, bloco(A));
  for (const v of vagoes) B.push(v);
  return { de: a, para: b, vagoes, cor: vagoes[0].c, completou: completo(B, st.cap) };
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

/** Trilhos onde o bloco da frente de a pode engatar. @param {Estado} st @param {number} a */
export function destinos(st, a) {
  const out = [];
  for (let b = 0; b < st.trilhos.length; b++) if (pode(st, a, b)) out.push(b);
  return out;
}

/** Texto compacto: um trilho por string, cor 0 = 'A'. @param {Estado} st */
export function paraTexto(st) {
  return st.trilhos.map((t) => t.map((v) => String.fromCharCode(65 + v.c)).join(''));
}
