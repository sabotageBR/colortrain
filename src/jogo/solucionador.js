// Solucionador do Color Train sobre a forma texto do tabuleiro (um trilho por
// string, indice 0 = boca). Usado pelo gerador de niveis, pela dica e pela
// deteccao de beco sem saida durante o jogo.
//
// analisar: exato = true faz busca em largura (minimo de jogadas, so niveis
// pequenos); exato = false faz A* ponderado (solucao boa, rapido). Se a busca
// esvazia sem achar, o tabuleiro e um beco (prova); se estoura o orcamento, e
// incerto. resolver devolve so o caminho, ou null.
// explorar: grafo completo de estados (gerador), com os estados mortos, de
// onde nao se chega mais a solucao. riscoBeco: chance de um jogador que toca
// ao acaso cair num deles.

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
      if (B.length && B[0] !== A[0]) continue;
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

const chave = (/** @type {string[]} */ x) => x.slice().sort().join('|');

/** @param {string[]} ts @param {number} a @param {number} b @param {number} n */
function aplicar(ts, a, b, n) {
  const nt = ts.slice();
  nt[b] = nt[a].slice(0, n) + nt[b];
  nt[a] = nt[a].slice(n);
  return nt;
}

/**
 * @typedef {{ estado: 'resolve'|'morto'|'incerto', caminho: number[][]|null, expandidos: number }} Analise
 */

/**
 * @param {string[]} ts
 * @param {number} cap
 * @param {{ orcamento?: number, exato?: boolean }} [opcoes]
 * @returns {Analise}
 */
export function analisar(ts, cap, { orcamento = 50000, exato = false } = {}) {
  if (resolvidoTexto(ts, cap)) return { estado: 'resolve', caminho: [], expandidos: 0 };
  const vistos = new Set([chave(ts)]);
  const heap = new Heap();
  let seq = 0;
  heap.por({ ts, g: 0, f: 0, cam: null });
  let expandidos = 0;
  while (heap.tamanho) {
    if (expandidos >= orcamento) return { estado: 'incerto', caminho: null, expandidos };
    const no = /** @type {any} */ (heap.tirar());
    expandidos++;
    for (const [a, b, n] of movimentos(no.ts, cap)) {
      const nt = aplicar(no.ts, a, b, n);
      const k = chave(nt);
      if (vistos.has(k)) continue;
      vistos.add(k);
      const cam = { a, b, pai: no.cam };
      if (resolvidoTexto(nt, cap)) {
        const out = [];
        for (let c = cam; c; c = c.pai) out.push([c.a, c.b]);
        return { estado: 'resolve', caminho: out.reverse(), expandidos };
      }
      const g = no.g + 1;
      seq++;
      heap.por({ ts: nt, g, f: exato ? g + seq * 1e-9 : g + 2.2 * heuristica(nt, cap), cam });
    }
  }
  return { estado: 'morto', caminho: null, expandidos };
}

/**
 * Caminho da solucao [[a, b], ...] com os indices originais, ou null.
 * @param {string[]} ts
 * @param {number} cap
 * @param {{ orcamento?: number, exato?: boolean }} [opcoes]
 * @returns {number[][]|null}
 */
export function resolver(ts, cap, opcoes) {
  return analisar(ts, cap, opcoes).caminho;
}

/** Todas as jogadas legais (sem podar as inuteis), como o jogador ve. @param {string[]} ts @param {number} cap */
function* todas(ts, cap) {
  for (let a = 0; a < ts.length; a++) {
    const A = ts[a];
    if (!A.length || cheio(A, cap)) continue;
    const n = blocoTexto(A);
    for (let b = 0; b < ts.length; b++) {
      if (a === b) continue;
      const B = ts[b];
      if (cap - B.length < n || cheio(B, cap)) continue;
      if (B.length && B[0] !== A[0]) continue;
      yield aplicar(ts, a, b, n);
    }
  }
}

/**
 * @typedef {{ inicio: string, viz: Map<string, string[]>, solucao: Set<string>, mortos: number, estados: number, cap: number }} Grafo
 */

/**
 * Grafo completo dos estados alcancaveis (chave canonica), ou null se passar
 * do limite. solucao = estados de onde ainda da para resolver.
 * @param {string[]} ts @param {number} cap @param {{ limite?: number }} [opcoes]
 * @returns {Grafo|null}
 */
export function explorar(ts, cap, { limite = 60000 } = {}) {
  const inicio = chave(ts);
  /** @type {Map<string, string[]>} */
  const viz = new Map();
  /** @type {Map<string, string[]>} */
  const tabs = new Map([[inicio, ts]]);
  const fila = [ts];
  for (let i = 0; i < fila.length; i++) {
    const t = fila[i];
    const k = chave(t);
    const lista = [];
    for (const nt of todas(t, cap)) {
      const kn = chave(nt);
      lista.push(kn);
      if (!tabs.has(kn)) {
        if (tabs.size >= limite) return null;
        tabs.set(kn, nt);
        fila.push(nt);
      }
    }
    viz.set(k, lista);
  }
  // volta da solucao: quem alcanca um estado resolvido
  /** @type {Map<string, string[]>} */
  const antes = new Map();
  for (const [k, l] of viz) for (const kn of l) {
    const a = antes.get(kn);
    if (a) a.push(k);
    else antes.set(kn, [k]);
  }
  const solucao = new Set();
  const pilha = [];
  for (const [k, t] of tabs) if (resolvidoTexto(t, cap)) {
    solucao.add(k);
    pilha.push(k);
  }
  while (pilha.length) {
    const k = /** @type {string} */ (pilha.pop());
    for (const a of antes.get(k) || []) if (!solucao.has(a)) {
      solucao.add(a);
      pilha.push(a);
    }
  }
  return { inicio, viz, solucao, mortos: tabs.size - solucao.size, estados: tabs.size, cap };
}

/**
 * Fracao de passeios aleatorios (jogadas legais sorteadas) que caem num
 * estado morto antes de resolver. Deterministico pela rng.
 * @param {Grafo} g @param {() => number} rng @param {{ passeios?: number, passos?: number }} [opcoes]
 */
export function riscoBeco(g, rng, { passeios = 400, passos = 300 } = {}) {
  if (!g.solucao.has(g.inicio)) return 1;
  if (!g.mortos) return 0;
  let caiu = 0;
  for (let i = 0; i < passeios; i++) {
    let k = g.inicio;
    for (let p = 0; p < passos; p++) {
      if (!g.solucao.has(k)) {
        caiu++;
        break;
      }
      const l = /** @type {string[]} */ (g.viz.get(k));
      if (!l.length) break; // resolvido
      k = l[Math.floor(rng() * l.length)];
    }
  }
  return caiu / passeios;
}
