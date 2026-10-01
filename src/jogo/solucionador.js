// Solucionador do Color Train sobre a forma texto do tabuleiro (um trilho por
// string, indice 0 = frente). Usado pelo gerador de niveis e pela dica.
//
// exato = true: busca em largura, minimo de jogadas (so niveis pequenos).
// exato = false: A* ponderado, acha uma solucao boa rapido.
// Devolve [[a, b], ...] com os indices originais, ou null se estourar o orcamento.

/** @param {string} t */
function blocoTexto(t) {
  let k = t.length ? 1 : 0;
  while (k < t.length && t[k] === t[0]) k++;
  return k;
}

/** @param {string} t @param {number} cap */
function cheio(t, cap) {
  return t.length === cap && blocoTexto(t) === cap;
}

/** @param {string[]} ts @param {number} cap */
export function resolvidoTexto(ts, cap) {
  return ts.every((t) => !t.length || cheio(t, cap));
}

/** @param {string[]} ts @param {number} cap */
function* movimentos(ts, cap) {
  for (let a = 0; a < ts.length; a++) {
    const A = ts[a];
    if (!A.length || cheio(A, cap)) continue;
    const n = blocoTexto(A);
    for (let b = 0; b < ts.length; b++) {
      if (a === b) continue;
      const B = ts[b];
      if (cap - B.length < n || cheio(B, cap)) continue;
      if (B.length && B[B.length - 1] !== A[0]) continue;
      // trilho de uma cor so indo para um vazio so troca de lugar: inutil
      if (!B.length && n === A.length) continue;
      yield [a, b, n];
    }
  }
}

/** @param {string[]} ts @param {number} cap */
function heuristica(ts, cap) {
  let v = 0;
  /** @type {Map<string, number>} */
  const espalhada = new Map();
  for (const t of ts) {
    if (!t.length) continue;
    for (let k = 1; k < t.length; k++) if (t[k] !== t[k - 1]) v++;
    if (!cheio(t, cap)) v++;
    const vistas = new Set(t);
    for (const c of vistas) espalhada.set(c, (espalhada.get(c) || 0) + 1);
  }
  for (const n of espalhada.values()) v += n - 1;
  return v;
}

class Heap {
  constructor() {
    /** @type {{f:number}[]} */
    this.a = [];
  }
  get tamanho() {
    return this.a.length;
  }
  /** @param {{f:number}} x */
  por(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= x.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = x;
  }
  tirar() {
    const a = this.a;
    const topo = a[0];
    const x = /** @type {{f:number}} */ (a.pop());
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= a.length) break;
        const r = l + 1;
        const m = r < a.length && a[r].f < a[l].f ? r : l;
        if (a[m].f >= x.f) break;
        a[i] = a[m];
        i = m;
      }
      a[i] = x;
    }
    return topo;
  }
}

/**
 * @param {string[]} ts
 * @param {number} cap
 * @param {{ orcamento?: number, exato?: boolean }} [opcoes]
 * @returns {number[][]|null}
 */
export function resolver(ts, cap, { orcamento = 50000, exato = false } = {}) {
  if (resolvidoTexto(ts, cap)) return [];
  const chave = (/** @type {string[]} */ x) => x.slice().sort().join('|');
  const vistos = new Set([chave(ts)]);
  const heap = new Heap();
  let seq = 0;
  heap.por({ ts, g: 0, f: 0, cam: null });
  let expandidos = 0;
  while (heap.tamanho && expandidos < orcamento) {
    const no = /** @type {any} */ (heap.tirar());
    expandidos++;
    for (const [a, b, n] of movimentos(no.ts, cap)) {
      const nt = no.ts.slice();
      nt[b] = nt[b] + nt[a].slice(0, n);
      nt[a] = nt[a].slice(n);
      const k = chave(nt);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const cam = { a, b, pai: no.cam };
      if (resolvidoTexto(nt, cap)) {
        const out = [];
        for (let c = cam; c; c = c.pai) out.push([c.a, c.b]);
        return out.reverse();
      }
      const g = no.g + 1;
      seq++;
      heap.por({ ts: nt, g, f: exato ? g + seq * 1e-9 : g + 2.2 * heuristica(nt, cap), cam });
    }
  }
  return null;
}
