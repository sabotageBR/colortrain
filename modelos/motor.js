'use strict';
/*
 * Motor puro dos 5 modelos do Color Train: regras, gerador de niveis e
 * solucionador. Nao toca em DOM, timers nem Math.random (usa RNG com semente),
 * para rodar igual no navegador e no node --test.
 *
 * Estado de um nivel:
 *   { m: modelo, cap, k, t: [[unidade]], chegada: [unidade]|null, pos, plat: [[unidade]]|null }
 * Unidade = { c: cor, n: vagoes (1 normal, 2+ grudados), id }.
 * Em todo trilho a unidade nova entra no FIM do array e casa com o ultimo.
 * O que muda entre os modelos e de onde a unidade sai:
 *   acesso 'frente' -> sai o indice 0 (fila: entra atras, sai na frente)
 *   acesso 'boca'   -> sai o ultimo  (pilha: entra e sai pela mesma ponta)
 */
globalThis.Motor = (() => {
  const LETRAS = 'ROGBPKYT';

  function rng(semente) {
    let a = semente >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function embaralhar(a, r) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let proxId = 1;
  const unid = (c, n) => ({ c, n, id: proxId++ });

  // ---------------------------------------------------------------- modelos
  const MODELOS = [
    {
      id: 'fila', nome: 'Fila', acesso: 'frente', bloco: false, anel: false, plat: false,
      regra: 'O vagão da frente (seta) sai e engata no fim de outro trem da mesma cor, ou num trilho vazio.',
      niveis: [
        { fixo: ['RR', 'BB', 'BR'], cap: 3 },
        { n: 4, k: 3, cap: 3, mm: [3, 6], esp: 2 },
        { n: 5, k: 3, cap: 4, min: 6 },
        { n: 6, k: 4, cap: 4, min: 9 },
        { n: 6, k: 4, cap: 4, g: 2, min: 8 },
        { n: 7, k: 5, cap: 4, g: 3, min: 11 },
      ],
      extra: (L) => {
        const k = Math.min(5 + ((L - 6) >> 1), 7);
        return { n: k + 2, k, cap: 4, g: Math.min(3 + ((L - 6) >> 1), k + 1), min: 12 };
      },
    },
    {
      id: 'ponta', nome: 'Ponta de linha', acesso: 'boca', bloco: false, anel: false, plat: false,
      regra: 'Trilhos sem saída: só o vagão junto à agulha sai, e entra pela mesma ponta em outro trem da mesma cor.',
      niveis: [
        { fixo: ['RR', 'BB', 'RB'], cap: 3 },
        { n: 4, k: 3, cap: 3, mm: [3, 6], esp: 2 },
        { n: 5, k: 3, cap: 4, min: 6 },
        { n: 6, k: 4, cap: 4, min: 9 },
        { n: 6, k: 4, cap: 4, g: 2, min: 8 },
        { n: 7, k: 5, cap: 4, g: 3, min: 11 },
      ],
      extra: (L) => {
        const k = Math.min(5 + ((L - 6) >> 1), 7);
        return { n: k + 2, k, cap: 4, g: Math.min(3 + ((L - 6) >> 1), k + 1), min: 12 };
      },
    },
    {
      id: 'giradouro', nome: 'Giradouro', acesso: 'boca', bloco: false, anel: true, plat: false,
      regra: 'O vagão junto à rotunda gira só para os trilhos vizinhos.',
      niveis: [
        { fixo: ['RR', 'RB', 'BB', ''], cap: 3 },
        { n: 5, k: 3, cap: 3, mm: [3, 7], esp: 2 },
        { n: 5, k: 3, cap: 4, min: 6 },
        { n: 6, k: 4, cap: 4, rev: 50, min: 8 },
        { n: 6, k: 4, cap: 4, g: 2, rev: 50, min: 8 },
        { n: 7, k: 5, cap: 4, g: 2, rev: 70, min: 10 },
      ],
      extra: (L) => {
        const k = Math.min(5 + ((L - 6) >> 1), 6);
        return { n: k + 2, k, cap: 4, g: Math.min(2 + ((L - 6) >> 1), k), rev: 60 + 6 * (L - 6), min: 10 };
      },
    },
    {
      id: 'plataforma', nome: 'Plataforma', acesso: 'frente', bloco: false, anel: false, plat: true,
      regra: 'Trem completo vai para a plataforma e libera o trilho. Toque na linha de chegada (embaixo) para trazer o próximo vagão.',
      niveis: [
        { fixo: ['RR', 'BB'], chegada: 'BR', cap: 3 },
        { n: 3, k: 3, cap: 3, ini: 4, mm: [3, 8] },
        { n: 3, k: 4, cap: 3, ini: 5, min: 8 },
        { n: 4, k: 5, cap: 4, ini: 9, min: 12 },
        { n: 4, k: 5, cap: 4, g: 2, ini: 9, min: 12 },
        { n: 4, k: 6, cap: 4, g: 3, ini: 10, min: 14 },
      ],
      extra: (L) => {
        const k = Math.min(6 + ((L - 6) >> 1), 8);
        return { n: 4, k, cap: 4, g: Math.min(3 + ((L - 6) >> 1), k), ini: 10, min: 14 };
      },
    },
    {
      id: 'bloco', nome: 'Engate em bloco', acesso: 'frente', bloco: true, anel: false, plat: false,
      regra: 'Todos os vagões da frente da mesma cor saem juntos e engatam no fim de outro trem (quantos couberem).',
      niveis: [
        { fixo: ['RR', 'BB', 'BBRR'], cap: 4 },
        { n: 4, k: 3, cap: 4, mm: [3, 6], esp: 2 },
        { n: 5, k: 3, cap: 5, min: 5 },
        { n: 6, k: 4, cap: 5, min: 7 },
        { n: 6, k: 4, cap: 5, g: 2, min: 7 },
        { n: 7, k: 5, cap: 5, g: 3, min: 9 },
      ],
      extra: (L) => {
        const k = Math.min(5 + ((L - 6) >> 1), 7);
        return { n: k + 2, k, cap: 5, g: Math.min(3 + ((L - 6) >> 1), k + 1), min: 10 };
      },
    },
  ];

  // ----------------------------------------------------------------- regras
  const ocup = (t) => {
    let s = 0;
    for (const u of t) s += u.n;
    return s;
  };
  const ultimo = (t) => t[t.length - 1];

  function completo(st, t) {
    if (!t.length || ocup(t) !== st.cap) return false;
    const c = t[0].c;
    for (const u of t) if (u.c !== c) return false;
    return true;
  }
  const travado = (st, i) => !st.m.plat && completo(st, st.t[i]);

  /** Unidades que sairiam do trilho i (i = -1: linha de chegada). */
  function saida(st, i) {
    if (i === -1) return st.chegada && st.pos < st.chegada.length ? [st.chegada[st.pos]] : [];
    const t = st.t[i];
    if (!t || !t.length || travado(st, i)) return [];
    if (st.m.acesso === 'frente') {
      if (!st.m.bloco) return [t[0]];
      const run = [t[0]];
      for (let k = 1; k < t.length && t[k].c === t[0].c; k++) run.push(t[k]);
      return run;
    }
    const L = t.length;
    if (!st.m.bloco) return [t[L - 1]];
    const run = [t[L - 1]];
    for (let k = L - 2; k >= 0 && t[k].c === t[L - 1].c; k--) run.push(t[k]);
    return run;
  }

  function vizinhos(st, a, b) {
    const n = st.t.length;
    const d = Math.abs(a - b);
    return d === 1 || d === n - 1;
  }

  function pode(st, a, b) {
    if (a === b || b < 0 || b >= st.t.length) return false;
    const s = saida(st, a);
    if (!s.length) return false;
    if (st.m.anel && a >= 0 && !vizinhos(st, a, b)) return false;
    if (travado(st, b)) return false;
    const T = st.t[b];
    if (T.length && ultimo(T).c !== s[0].c) return false;
    return st.cap - ocup(T) >= s[0].n;
  }

  /** Aplica a jogada (ja validada) e devolve o que aconteceu, para animar. */
  function mover(st, a, b) {
    const s = saida(st, a);
    const T = st.t[b];
    let livre = st.cap - ocup(T);
    const mov = [];
    for (const u of s) {
      if (u.n > livre) break;
      mov.push(u);
      livre -= u.n;
      if (!st.m.bloco) break;
    }
    if (a === -1) st.pos++;
    else if (st.m.acesso === 'frente') st.t[a].splice(0, mov.length);
    else st.t[a].splice(st.t[a].length - mov.length, mov.length);
    for (const u of mov) T.push(u);
    const ev = { mov, de: a, para: b, completou: -1, plataforma: -1 };
    if (completo(st, T)) {
      ev.completou = b;
      if (st.m.plat) {
        st.plat.push(T.slice());
        st.t[b] = [];
        ev.plataforma = st.plat.length - 1;
      }
    }
    return ev;
  }

  function resolvido(st) {
    if (st.m.plat) return st.pos >= st.chegada.length && st.t.every((t) => !t.length);
    return st.t.every((t) => !t.length || completo(st, t));
  }

  function jogadas(st) {
    const out = [];
    const n = st.t.length;
    for (let a = st.m.plat ? -1 : 0; a < n; a++) {
      if (!saida(st, a).length) continue;
      for (let b = 0; b < n; b++) if (pode(st, a, b)) out.push([a, b]);
    }
    return out;
  }

  function clonar(st) {
    return { ...st, t: st.t.map((t) => t.slice()), plat: st.plat ? st.plat.slice() : null };
  }

  // ------------------------------------------------------------ solucionador
  function chave(st) {
    const ts = st.t.map((t) => {
      let s = '';
      for (const u of t) s += String.fromCharCode(65 + u.c * 4 + u.n);
      return s;
    });
    if (!st.m.anel) ts.sort();
    return ts.join('|') + (st.m.plat ? '#' + st.pos : '');
  }

  function heur(st) {
    let v = 0;
    const onde = new Map();
    st.t.forEach((t, i) => {
      for (let k = 1; k < t.length; k++) if (t[k].c !== t[k - 1].c) v++;
      if (t.length && !completo(st, t)) v += 1;
      for (const u of t) {
        let s = onde.get(u.c);
        if (!s) onde.set(u.c, (s = new Set()));
        s.add(i);
      }
    });
    for (const s of onde.values()) v += s.size - 1;
    if (st.m.plat) v += (st.chegada.length - st.pos) * 0.6;
    return v;
  }

  // Trilho monocromatico indo para trilho vazio so divide a cor: nunca ajuda
  // fora do giradouro, onde o trilho vazio pode ser caminho.
  function inutil(st, a, b) {
    if (st.m.anel || a < 0 || st.t[b].length) return false;
    const t = st.t[a];
    for (const u of t) if (u.c !== t[0].c) return false;
    return true;
  }

  class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(x) {
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
    pop() {
      const a = this.a;
      const top = a[0];
      const x = a.pop();
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
      return top;
    }
  }

  /**
   * exato = true: busca em largura (minimo de jogadas, so para niveis pequenos).
   * exato = false: A* ponderado, acha uma solucao boa rapido.
   * Devolve [[a, b], ...] ou null se estourar o orcamento.
   */
  function resolver(st0, orcamento = 40000, exato = false) {
    const ini = clonar(st0);
    if (resolvido(ini)) return [];
    const vistos = new Set([chave(ini)]);
    const heap = new Heap();
    let seq = 0;
    heap.push({ st: ini, g: 0, f: 0, cam: null, s: seq++ });
    let exp = 0;
    while (heap.size && exp < orcamento) {
      const no = heap.pop();
      exp++;
      for (const [a, b] of jogadas(no.st)) {
        if (inutil(no.st, a, b)) continue;
        const s2 = clonar(no.st);
        mover(s2, a, b);
        const k = chave(s2);
        if (vistos.has(k)) continue;
        vistos.add(k);
        const cam = { a, b, pai: no.cam };
        if (resolvido(s2)) {
          const out = [];
          for (let c = cam; c; c = c.pai) out.push([c.a, c.b]);
          return out.reverse();
        }
        const g = no.g + 1;
        heap.push({ st: s2, g, f: exato ? g + seq++ * 1e-9 : g + 2.2 * heur(s2), cam });
      }
    }
    return null;
  }

  // ----------------------------------------------------------------- gerador
  function parse(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      const c = LETRAS.indexOf(s[i]);
      let n = 1;
      if (/[0-9]/.test(s[i + 1] || '')) {
        n = +s[i + 1];
        i++;
      }
      out.push(unid(c, n));
    }
    return out;
  }

  function unidadesDasCores(p, r) {
    const cores = embaralhar([0, 1, 2, 3, 4, 5, 6, 7], r).slice(0, p.k);
    const pares = new Array(p.k).fill(0);
    for (let i = 0; i < (p.g || 0); i++) pares[i % p.k]++;
    const us = [];
    cores.forEach((c, ci) => {
      let resto = p.cap;
      for (let j = 0; j < pares[ci] && resto >= 2; j++) {
        us.push(unid(c, 2));
        resto -= 2;
      }
      for (; resto > 0; resto--) us.push(unid(c, 1));
    });
    return embaralhar(us, r);
  }

  function aceitar(st, p) {
    if (st.t.some((t) => completo(st, t)) || resolvido(st)) return null;
    const sol = p.mm ? resolver(st, 30000, true) : resolver(st, 40000);
    if (!sol) return null;
    if (p.mm && (sol.length < p.mm[0] || sol.length > p.mm[1])) return null;
    if (p.min && sol.length < p.min) return null;
    return sol;
  }

  function gerarLinhas(m, p, r) {
    for (let tent = 0; tent < 120; tent++) {
      const us = unidadesDasCores(p, r);
      const t = Array.from({ length: p.k }, () => []);
      let ok = true;
      for (const u of us) {
        const cand = t.filter((x) => p.cap - ocup(x) >= u.n);
        if (!cand.length) { ok = false; break; }
        cand[Math.floor(r() * cand.length)].push(u);
      }
      if (!ok) continue;
      for (let i = p.k; i < p.n; i++) t.push([]);
      for (let e = 0; e < (p.esp || 0); e++) {
        const a = Math.floor(r() * p.n);
        const b = Math.floor(r() * p.n);
        if (a === b || !t[a].length) continue;
        const u = m.acesso === 'frente' ? t[a][0] : ultimo(t[a]);
        if (p.cap - ocup(t[b]) < u.n) continue;
        if (m.acesso === 'frente') t[a].shift();
        else t[a].pop();
        t[b].push(u);
      }
      embaralhar(t, r);
      const st = { m, cap: p.cap, k: p.k, t, chegada: null, pos: 0, plat: null };
      const sol = aceitar(st, p);
      if (sol) return { st, sol, tent };
    }
    return null;
  }

  // Embaralhamento reverso (giradouro): parte do resolvido e desfaz jogadas
  // legais, entao sempre tem solucao mesmo quando o solucionador nao acha a
  // tempo. Cada passo inverso so vale se a jogada direta correspondente fosse
  // legal: a origem direta nao podia estar completa e o destino direto
  // precisava casar a cor (ou estar vazio).
  function gerarReverso(m, p, r) {
    for (let tent = 0; tent < 60; tent++) {
      const porCor = new Map();
      for (const u of unidadesDasCores(p, r)) {
        if (!porCor.has(u.c)) porCor.set(u.c, []);
        porCor.get(u.c).push(u);
      }
      const t = [...porCor.values()];
      for (let i = p.k; i < p.n; i++) t.push([]);
      embaralhar(t, r);
      const st = { m, cap: p.cap, k: p.k, t, chegada: null, pos: 0, plat: null };
      let feitos = 0;
      let ultimoId = -1;
      for (let it = 0; it < p.rev * 80 && feitos < p.rev; it++) {
        const b = Math.floor(r() * p.n);
        const T = st.t[b];
        if (!T.length) continue;
        const a = m.anel ? (r() < 0.5 ? (b + 1) % p.n : (b - 1 + p.n) % p.n) : Math.floor(r() * p.n);
        if (a === b) continue;
        const u = ultimo(T);
        if (u.id === ultimoId) continue;
        if (T.length > 1 && T[T.length - 2].c !== u.c) continue;
        if (p.cap - ocup(st.t[a]) < u.n) continue;
        T.pop();
        st.t[a].push(u);
        if (completo(st, st.t[a])) {
          st.t[a].pop();
          T.push(u);
          continue;
        }
        ultimoId = u.id;
        feitos++;
      }
      if (st.t.some((x) => completo(st, x)) || resolvido(st)) continue;
      const sol = resolver(st, 40000);
      if (p.min && sol && sol.length < p.min) continue;
      return { st, sol, tent };
    }
    return null;
  }

  function gerarPlat(m, p, r) {
    for (let tent = 0; tent < 120; tent++) {
      const us = unidadesDasCores(p, r);
      const t = Array.from({ length: p.n }, () => []);
      const cheg = [];
      let ini = 0;
      for (const u of us) {
        if (ini + u.n <= p.ini) {
          const cand = t.filter((x) => p.cap - 1 - ocup(x) >= u.n);
          if (cand.length) {
            cand[Math.floor(r() * cand.length)].push(u);
            ini += u.n;
            continue;
          }
        }
        cheg.push(u);
      }
      const st = { m, cap: p.cap, k: p.k, t, chegada: cheg, pos: 0, plat: [] };
      const sol = aceitar(st, p);
      if (sol) return { st, sol, tent };
    }
    return null;
  }

  function especificacao(mi, nivel) {
    const m = MODELOS[mi];
    return nivel <= m.niveis.length ? m.niveis[nivel - 1] : m.extra(nivel);
  }

  /** Nivel deterministico: mesmo modelo + nivel = mesmo tabuleiro. */
  function novoNivel(mi, nivel) {
    const m = MODELOS[mi];
    const p = especificacao(mi, nivel);
    let res;
    if (p.fixo) {
      const t = p.fixo.map(parse);
      const chegada = p.chegada != null ? parse(p.chegada) : m.plat ? [] : null;
      const cores = new Set();
      for (const x of [...t, chegada || []]) for (const u of x) cores.add(u.c);
      const st = { m, cap: p.cap, k: cores.size, t, chegada, pos: 0, plat: m.plat ? [] : null };
      res = { st, sol: resolver(st, 20000, true), tent: 0 };
    } else {
      const base = hash(m.id + ':' + nivel);
      for (let tentativa = 0; !res && tentativa < 8; tentativa++) {
        const r = rng(base + tentativa * 7919);
        res = m.plat ? gerarPlat(m, p, r) : p.rev ? gerarReverso(m, p, r) : gerarLinhas(m, p, r);
      }
    }
    if (!res) throw new Error('nivel impossivel de gerar: ' + m.id + ' ' + nivel);
    res.st.nivel = nivel;
    res.st.grudados = res.st.t.some((t) => t.some((u) => u.n > 1)) ||
      (res.st.chegada || []).some((u) => u.n > 1);
    return res;
  }

  return {
    MODELOS, LETRAS, novoNivel, especificacao, saida, pode, mover, resolvido, jogadas,
    resolver, clonar, completo, travado, ocup, vizinhos, parse, rng, hash,
  };
})();
if (typeof module !== 'undefined') module.exports = globalThis.Motor;
