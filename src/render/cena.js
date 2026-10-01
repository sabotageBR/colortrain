// Cena dinamica: os vagoes e locomotivas como objetos visuais que perseguem o
// estado do jogo com tweens. O estado muda na hora; o visual alcanca depois,
// entao toques rapidos funcionam. Tambem desenha destaques, mao do tutorial,
// fantasma do arraste e particulas.

import { desenharCenario } from './cenario.js';
import {
  desenharVagao, desenharLoco, desenharSanfona, desenharEngate, desenharSombra,
  desenharLuzSinal, desenharMao, desenharSimbolo, pontaChamine, limparCache, caminhoRet, PINTURA_CLASSICA,
} from './pecas.js';
import { completo, bloco } from '../jogo/regras.js';
import { CORES } from './tema.js';
import { criarCarga, passoCarga, impulsoCarga } from './fisica.js';

/** @typedef {import('./tema.js').Tema} Tema */
/** @typedef {ReturnType<typeof import('./layout.js').calcularLayout>} Layout */
/** @typedef {import('../jogo/regras.js').Estado} Estado */

const suave = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const saida = (p) => 1 - Math.pow(1 - p, 3);

/** @param {HTMLCanvasElement} canvas */
export function criarCena(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let W = 1, H = 1, dpr = 1;
  /** @type {Layout|null} */
  let lay = null;
  /** @type {Tema|null} */
  let tema = null;
  /** @type {HTMLCanvasElement|null} */
  let fundo = null;
  /** @type {Estado|null} */
  let st = null;
  let agora = 0;
  /** @type {import('./pecas.js').Pintura} */
  let pintura = PINTURA_CLASSICA;

  /** @type {Map<number, any>} */
  const carros = new Map();
  /** @type {Map<number, any>} */
  const locos = new Map();
  /** @type {any[]} */
  let parts = [];
  /** @type {Map<number, number>} */
  const tremores = new Map();
  /** @type {{ ids: number[], x: number, y: number }|null} */
  let arraste = null;

  // ---------------------------------------------------------- utilidades
  const alvoVaga = (i, s) => ({ x: /** @type {Layout} */ (lay).xVaga(i, s), y: /** @type {Layout} */ (lay).trilhos[i].yb });

  /**
   * Relogio unico: performance.now(), o mesmo tempo da agenda do jogo
   * (setTimeout). O carimbo do requestAnimationFrame nao serve: em alguns
   * navegadores (e no Chrome headless) ele anda separado e as animacoes
   * congelavam ou terminavam depois do que a agenda esperava.
   */
  const relogio = () => {
    const t = performance.now();
    if (t > agora) agora = t;
    return agora;
  };

  function tween(o, para, dur, atraso = 0, arco = 0, curva = suave) {
    relogio();
    o.tw = { dx: o.x, dy: o.y, px: para.x, py: para.y, t0: agora + atraso, dur, arco, curva };
    return atraso + dur;
  }

  function passo(o) {
    const w = o.tw;
    if (!w) return false;
    const p = (agora - w.t0) / w.dur;
    if (p < 0) return false;
    if (p >= 1) {
      o.x = w.px;
      o.y = w.py;
      o.tw = null;
      return true;
    }
    const e = w.curva(p);
    o.x = w.dx + (w.px - w.dx) * e;
    o.y = w.dy + (w.py - w.dy) * e - Math.sin(Math.PI * e) * w.arco;
    return false;
  }

  /** Posicao desenhada (com levantamento, partida e tremor). */
  function posDesenho(o) {
    let x = o.x, y = o.y;
    if (o.partida) {
      const t = (agora - o.partida.t0) / 1000;
      // o trem toma a folga dos engates: cada vagao so parte depois que o da
      // frente andou a folga acumulada
      if (t > 0) {
        const d = 0.5 * o.partida.acel * t * t + 20 * t - (o.partida.folga || 0);
        if (d > 0) x -= d;
      }
    }
    if (!o.tw && o.tr != null) {
      const t0 = tremores.get(o.tr);
      if (t0 != null) {
        const p = (agora - t0) / 340;
        if (p < 1) x += Math.sin(p * Math.PI * 7) * (lay ? lay.L * 0.07 : 4) * (1 - p);
      }
    }
    if (o.lift) y -= o.lift * (lay ? lay.L * 0.36 : 20);
    return { x, y };
  }

  // ------------------------------------------------------------ estado
  /**
   * Faz o visual perseguir o estado. Vagao que mudou de trilho voa em arco;
   * o que so andou dentro do trilho desliza. Devolve ms ate tudo assentar.
   * @param {{ instantaneo?: boolean }} [o]
   */
  function sincronizar(o = {}) {
    if (!st || !lay) return 0;
    let fim = 0;
    const vivos = new Set();
    st.trilhos.forEach((t, i) => {
      t.forEach((v, s) => {
        vivos.add(v.id);
        const alvo = alvoVaga(i, s);
        let c = carros.get(v.id);
        if (!c) {
          c = { id: v.id, c: v.c, x: alvo.x, y: alvo.y, tr: i, s, tw: null, roda: 0, xAnt: alvo.x, lift: 0, liftAlvo: 0, esmaga: -1e9, partida: null, vx: 0, ax: 0, fis: criarCarga(v.c) };
          carros.set(v.id, c);
          return;
        }
        if (o.instantaneo) {
          Object.assign(c, { x: alvo.x, y: alvo.y, tr: i, s, tw: null, lift: 0, xAnt: alvo.x });
          return;
        }
        const destino = c.tw ? { x: c.tw.px, y: c.tw.py } : c;
        const mudou = Math.abs(destino.x - alvo.x) > 0.5 || Math.abs(destino.y - alvo.y) > 0.5;
        if (!mudou) {
          c.tr = i;
          c.s = s;
          return;
        }
        // sai do levantamento/arraste a partir de onde esta sendo visto
        const vis = posDesenho(c);
        c.x = vis.x;
        c.y = vis.y;
        c.lift = 0;
        c.liftAlvo = 0;
        const trocou = c.tr !== i || Math.abs(c.y - alvo.y) > 2;
        if (trocou) {
          const dist = Math.hypot(alvo.x - c.x, alvo.y - c.y);
          const dur = Math.min(560, 300 + dist * 0.32);
          const arco = /** @type {Layout} */ (lay).L * 0.9 + Math.abs(alvo.x - c.x) * 0.06;
          fim = Math.max(fim, tween(c, alvo, dur, 0, arco));
          c.pousar = true;
        } else {
          fim = Math.max(fim, tween(c, alvo, 240, 0, 0));
        }
        c.tr = i;
        c.s = s;
      });
    });
    for (const id of [...carros.keys()]) if (!vivos.has(id)) carros.delete(id);
    // locomotiva so fica em trilho completo
    for (const [tr, l] of [...locos.entries()]) {
      if (!st.trilhos[tr] || !completo(st.trilhos[tr], st.cap)) locos.delete(tr);
    }
    if (o.instantaneo) {
      // novo layout (tela girou, barra do navegador sumiu): a locomotiva vai
      // junto, inclusive a que ja esta partindo (o deslocamento da partida e
      // relativo a posicao base)
      for (const l of locos.values()) {
        const tl = /** @type {Layout} */ (lay).trilhos[l.tr];
        if (tl) Object.assign(l, { x: tl.xLoco, y: tl.yb, xAnt: tl.xLoco, tw: null, chegando: false, aceso: true });
      }
      st.trilhos.forEach((t, i) => {
        if (completo(t, st.cap) && !locos.has(i)) {
          const tl = /** @type {Layout} */ (lay).trilhos[i];
          locos.set(i, { tr: i, x: tl.xLoco, y: tl.yb, tw: null, roda: 0, xAnt: tl.xLoco, aceso: true, esmaga: -1e9, partida: null });
        }
      });
    }
    return fim;
  }

  // ---------------------------------------------------------- particulas
  function particula(p) {
    if (parts.length < 400) parts.push(p);
  }
  function faiscas(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * Math.random();
      const v = 80 + Math.random() * 160;
      particula({ tipo: 'f', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 420, vida: 0.38, max: 0.38 });
    }
  }
  function poeira(x, y, L) {
    for (let i = 0; i < 6; i++) {
      particula({ tipo: 'p', x: x + (Math.random() - 0.5) * L * 0.6, y, vx: (Math.random() - 0.5) * 50, vy: -10 - Math.random() * 20, g: 0, vida: 0.5, max: 0.5, r: L * 0.08 });
    }
  }
  function vapor(x, y, L, n = 1, forte = false) {
    for (let i = 0; i < n; i++) {
      particula({ tipo: 'v', x: x + (Math.random() - 0.5) * L * 0.08, y, vx: (Math.random() - 0.3) * 30 + (forte ? 50 : 0), vy: -35 - Math.random() * 35, g: -6, vida: 0.9 + Math.random() * 0.6, max: 1.5, r: L * (0.05 + Math.random() * 0.04) });
    }
  }
  /** Graos (areia, cascalho, frutas) que pulam da carga no tranco. */
  function graos(x, y, L, cor, n, forca) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const v = (60 + Math.random() * 140) * forca;
      particula({ tipo: 'g', x: x + (Math.random() - 0.5) * L * 0.7, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 900, vida: 0.5 + Math.random() * 0.3, max: 0.8, cor, r: L * (0.018 + Math.random() * 0.02) });
    }
  }
  function confete(x, y, L) {
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 160 + Math.random() * 220;
      particula({ tipo: 'e', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, vida: 1.1, max: 1.1, cor: CORES[i % CORES.length].base, rot: Math.random() * 6, r: L * (0.06 + Math.random() * 0.05), k: i % 8 });
    }
  }

  // --------------------------------------------------------- animacoes
  /** Vagoes chegam pela direita, trilho por trilho. */
  function chegada() {
    if (!st || !lay) return 0;
    let fim = 0;
    const off = W - lay.xIni + lay.L;
    for (const c of carros.values()) {
      const alvo = { x: c.x, y: c.y };
      c.x += off + c.s * lay.L * 0.05;
      c.xAnt = c.x;
      fim = Math.max(fim, tween(c, alvo, 900, c.tr * 85, 0, saida));
    }
    return fim;
  }

  /** Locomotiva entra pela esquerda e engata no trem pronto. */
  function chegarLoco(tr) {
    if (!lay) return 0;
    const t = lay.trilhos[tr];
    const l = { tr, x: -lay.Lg, y: t.yb, tw: null, roda: 0, xAnt: -lay.Lg, aceso: false, esmaga: -1e9, partida: null, chegando: true };
    locos.set(tr, l);
    return tween(l, { x: t.xLoco, y: t.yb }, 700, 0, 0, saida);
  }

  /** Todos os trens partem para a esquerda, um apos o outro. */
  function partir() {
    if (!lay) return 0;
    relogio();
    const ordem = [...locos.values()].sort((a, b) => a.tr - b.tr);
    let fim = 0;
    ordem.forEach((l, i) => {
      const t0 = agora + 380 + i * 140;
      const vagoes = [...carros.values()].filter((c) => c.tr === l.tr).sort((a, b) => a.s - b.s);
      // trem pesado arranca devagar; a locomotiva patina nos primeiros metros
      const acel = Math.max(700, W * 1.4) / (1 + 0.09 * vagoes.length);
      l.partida = { t0, acel, folga: 0 };
      l.esforco = { t0, n: vagoes.length, proximaFaisca: t0 };
      l.aceso = true;
      vagoes.forEach((c) => { c.partida = { t0, acel, folga: (c.s + 1) * lay.L * 0.07 }; });
      // tempo ate sair da tela: x + 0.5 a t^2 > largura (mais a folga do ultimo)
      const dist = lay.xFim + lay.L * 2 + vagoes.length * lay.L * 0.07;
      fim = Math.max(fim, 380 + i * 140 + Math.sqrt((2 * dist) / acel) * 1000);
    });
    return fim;
  }

  // ------------------------------------------------------------- quadro
  function atualizar(dt) {
    if (!lay) return;
    for (const c of carros.values()) {
      const pousou = passo(c);
      c.lift += (c.liftAlvo - c.lift) * Math.min(1, dt * 14);
      const xv = posDesenho(c).x;
      c.roda += (xv - c.xAnt) / (lay.rw || 1);
      // velocidade e aceleracao do quadro, suavizadas, movem a carga
      if (dt > 0) {
        const vx = (xv - c.xAnt) / dt;
        const ax = (vx - c.vx) / dt;
        c.vx = vx;
        c.ax += (ax - c.ax) * Math.min(1, dt * 25);
      }
      c.xAnt = xv;
      if (pousou && c.pousar) {
        c.pousar = false;
        c.esmaga = agora;
        poeira(c.x, c.y, lay.L);
        impulsoCarga(c.fis, 0.9, c.vx >= 0 ? 1 : -1);
        if (c.fis.tipo === 'areia' || c.fis.tipo === 'laranjas') graos(c.x, c.y - lay.L * 0.7, lay.L, CORES[c.c].base, 10, 1);
      }
      if (c.fis.joltT0 && agora >= c.fis.joltT0) {
        c.fis.joltT0 = 0;
        c.esmaga = agora;
        impulsoCarga(c.fis, 0.55, -1);
        if (c.fis.tipo === 'areia' || c.fis.tipo === 'laranjas') graos(c.x, c.y - lay.L * 0.7, lay.L, CORES[c.c].base, 6, 0.7);
      }
      passoCarga(c.fis, c.ax / lay.L, dt);
    }
    for (const l of locos.values()) {
      const chegou = passo(l);
      if (chegou && l.chegando) {
        l.chegando = false;
        l.aceso = true;
        l.esmaga = agora;
        const pc = pontaChamine(l.x, l.y, lay.L);
        vapor(pc.x, pc.y, lay.L, 6);
      }
      const xv = posDesenho(l).x;
      const esforco = l.esforco && agora > l.esforco.t0 && agora < l.esforco.t0 + 500 + l.esforco.n * 90;
      // rodas patinam no arranque: giram mais do que o trem anda
      l.roda += (xv - l.xAnt) / (lay.L * 0.15) + (esforco ? dt * 9 : 0);
      l.xAnt = xv;
      if (esforco && agora >= l.esforco.proximaFaisca && l.esforco.n >= 2) {
        l.esforco.proximaFaisca = agora + 70;
        faiscas(xv + lay.L * 0.18, l.y);
      }
      // fumaca: forte na partida, tranquila parado
      const pc = pontaChamine(xv, l.y, lay.L);
      const andando = l.partida && agora > l.partida.t0;
      l.fum = (l.fum || 0) + dt * (andando ? (esforco ? 26 : 16) : l.aceso ? 1.2 : 0);
      while (l.fum >= 1) {
        l.fum -= 1;
        vapor(pc.x, pc.y, lay.L, 1, !!andando);
      }
    }
    for (const p of parts) {
      p.vida -= dt;
      p.vx *= 0.985;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    parts = parts.filter((p) => p.vida > 0);
  }

  function escalaEsmaga(o) {
    const p = (agora - o.esmaga) / 200;
    return p >= 0 && p < 1 ? 1 - 0.13 * Math.sin(Math.PI * p) : 1;
  }

  /** Realce chapado de um trilho (selecao, destino possivel, alvo do arraste). */
  function realce(i, cor, forca) {
    if (!lay) return;
    const t = lay.trilhos[i];
    const L = lay.L;
    ctx.save();
    caminhoRet(ctx, t.xIni - L * 0.04, t.yb - L * 0.3, t.xFim - t.xIni + L * 0.08, L * 0.44, L * 0.12);
    ctx.fillStyle = cor;
    ctx.globalAlpha = 0.12 + 0.18 * forca;
    ctx.fill();
    ctx.strokeStyle = cor;
    ctx.lineWidth = Math.max(1.5, L * 0.03);
    ctx.globalAlpha = 0.45 + 0.45 * forca;
    ctx.stroke();
    ctx.restore();
  }

  function desenharParticulas() {
    for (const p of parts) {
      const k = p.vida / p.max;
      if (p.tipo === 'f') {
        ctx.strokeStyle = `rgba(255,214,90,${k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.tipo === 'e') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot + (1 - k) * 8);
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.cor;
        desenharSimbolo(ctx, p.k, p.r);
        ctx.fill();
        ctx.restore();
      } else if (p.tipo === 'g') {
        ctx.fillStyle = p.cor;
        ctx.globalAlpha = Math.min(1, k * 2.5);
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.globalAlpha = 1;
      } else if (p.tipo === 'p') {
        ctx.fillStyle = tema && tema.noite ? `rgba(120,115,150,${0.45 * k})` : `rgba(205,190,165,${0.6 * k})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + (1 - k) * 1.5), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // fumaca: circulo chapado que cresce e some
        const a = 0.6 * Math.min(1, k * 1.8);
        const r = p.r * (1 + (1 - k) * 2.4);
        ctx.fillStyle = tema && tema.noite ? `rgba(205,200,235,${a})` : `rgba(255,255,255,${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * @param {number} t tempo (ms)
   * @param {{ sel?: number|null, destinos?: number[], alvo?: number, alvoValido?: boolean,
   *   mao?: { de: {x:number,y:number}, para: {x:number,y:number}, t0: number }|null,
   *   fantasma?: { tr: number, ids: number[] }|null }} [x]
   */
  function desenhar(_t, x = {}) {
    const antes = agora;
    const t = relogio();
    const dt = Math.min(0.05, Math.max(0, (t - antes) / 1000));
    atualizar(dt);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!lay || !tema || !st) return;
    if (!fundo) fundo = desenharCenario(lay, tema, dpr);
    ctx.drawImage(fundo, 0, 0, W, H);
    const L = lay.L;
    const pulso = 0.5 + 0.5 * Math.sin(t / 220);

    // destaques nos trilhos
    if (x.destinos) for (const d of x.destinos) if (d !== x.alvo) realce(d, '#7CFFB2', 0.35 + 0.4 * pulso);
    if (x.alvo != null && x.alvo >= 0) realce(x.alvo, x.alvoValido ? '#7CFFB2' : '#FF6B6B', 1);
    if (x.sel != null && x.sel >= 0) realce(x.sel, '#FFFFFF', 0.8);

    // sinais
    lay.trilhos.forEach((tl, i) => {
      const l = locos.get(i);
      desenharLuzSinal(ctx, tl.xSinal, tl.yb, L, !!(l && l.aceso && !l.chegando), tema);
    });

    // pares engatados (mesma cor encostada) e engates simples
    /** @type {Map<number, {prox: number, mesma: boolean}>} */
    const pares = new Map();
    st.trilhos.forEach((tr) => {
      for (let k = 0; k + 1 < tr.length; k++) pares.set(tr[k].id, { prox: tr[k + 1].id, mesma: tr[k].c === tr[k + 1].c });
    });
    const arrastados = new Set(arraste ? arraste.ids : []);
    const voando = (c) => !!(c.tw && c.tw.arco) || c.lift > 0.03 || arrastados.has(c.id);
    const vis = new Map();
    for (const c of carros.values()) {
      let p = posDesenho(c);
      if (arrastados.has(c.id) && arraste) {
        const k = arraste.ids.indexOf(c.id);
        p = { x: arraste.x + k * lay.P, y: arraste.y };
      }
      vis.set(c.id, p);
    }
    const ligacoes = (c, p) => {
      const par = pares.get(c.id);
      if (!par) return;
      const q = vis.get(par.prox);
      if (!q || Math.abs(q.y - p.y) > 2) return;
      const xa = p.x + L / 2, xb = q.x - L / 2;
      if (xb - xa < -1 || xb - xa > L * 0.4) return;
      if (par.mesma) desenharSanfona(ctx, xa, xb, p.y, L, c.c, tema);
      else desenharEngate(ctx, xa, xb, p.y, L);
    };

    // trilho por trilho, de cima para baixo (ordem de profundidade)
    for (let i = 0; i < lay.trilhos.length; i++) {
      const l = locos.get(i);
      const noTrilho = [...carros.values()].filter((c) => c.tr === i && !voando(c)).sort((a, b) => a.x - b.x);
      if (l) {
        const p = posDesenho(l);
        desenharSombra(ctx, p.x, l.y, lay.Lg, 1, tema);
      }
      for (const c of noTrilho) desenharSombra(ctx, vis.get(c.id).x, c.y, L, 1, tema);
      if (l) {
        const p = posDesenho(l);
        desenharLoco(ctx, p.x, p.y, L, tema, dpr, { aceso: l.aceso, roda: l.roda, escalaY: escalaEsmaga(l), pintura });
      }
      for (const c of noTrilho) ligacoes(c, vis.get(c.id));
      for (const c of noTrilho) {
        const p = vis.get(c.id);
        desenharVagao(ctx, p.x, p.y, c.c, L, tema, dpr, { roda: c.roda, escalaY: escalaEsmaga(c), fis: c.fis });
      }
    }

    // fantasma: onde o bloco arrastado vai engatar
    if (x.fantasma && x.fantasma.tr >= 0) {
      const f = x.fantasma;
      const ocup = st.trilhos[f.tr].length;
      f.ids.forEach((id, k) => {
        const c = carros.get(id);
        if (!c) return;
        const a = alvoVaga(f.tr, ocup + k);
        desenharVagao(ctx, a.x, a.y, c.c, L, tema, dpr, { alfa: 0.35 });
      });
    }

    // no ar: em voo, levantados ou arrastados (por cima de tudo)
    const noAr = [...carros.values()].filter(voando).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const c of noAr) {
      const p = vis.get(c.id);
      const chao = c.tw ? c.tw.py : arrastados.has(c.id) ? p.y + L * 0.5 : c.y;
      const alt = Math.max(0, chao - p.y);
      desenharSombra(ctx, p.x, chao, L, Math.max(0.25, 1 - alt / (L * 2)), tema);
    }
    for (const c of noAr) ligacoes(c, vis.get(c.id));
    for (const c of noAr) {
      const p = vis.get(c.id);
      desenharVagao(ctx, p.x, p.y, c.c, L, tema, dpr, { roda: c.roda, brilho: Math.min(1, c.lift + (arrastados.has(c.id) ? 1 : 0)), fis: c.fis, noAr: true });
    }

    desenharParticulas();

    if (x.mao) {
      const m = x.mao;
      const ciclo = ((t - m.t0) % 2000) / 2000;
      let px, py, ap = false;
      if (ciclo < 0.2) { px = m.de.x; py = m.de.y; ap = ciclo > 0.08; }
      else if (ciclo < 0.62) {
        const e = suave((ciclo - 0.2) / 0.42);
        px = m.de.x + (m.para.x - m.de.x) * e;
        py = m.de.y + (m.para.y - m.de.y) * e - Math.sin(Math.PI * e) * L * 0.9;
      } else if (ciclo < 0.86) { px = m.para.x; py = m.para.y; ap = ciclo > 0.7; }
      if (px != null) {
        if (ap) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, L * 0.32, 0, Math.PI * 2);
          ctx.stroke();
        }
        desenharMao(ctx, px, py, Math.max(0.8, L / 64), ap);
      }
    }
  }

  // --------------------------------------------------------------- api
  return {
    get layout() {
      return lay;
    },
    /** @param {number} w @param {number} h @param {number} d */
    redimensionar(w, h, d) {
      W = w;
      H = h;
      dpr = d;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      fundo = null;
      limparCache();
    },
    /**
     * Novo nivel ou novo layout.
     * @param {Estado} estado @param {Layout} l @param {Tema} t @param {{ novo?: boolean }} [o]
     */
    configurar(estado, l, t, o = {}) {
      st = estado;
      lay = l;
      if (tema !== t) limparCache();
      tema = t;
      fundo = null;
      if (o.novo) {
        carros.clear();
        locos.clear();
        parts = [];
        tremores.clear();
        arraste = null;
      }
      sincronizar({ instantaneo: true });
    },
    sincronizar,
    desenhar,
    /** @param {import('./pecas.js').Pintura} p */
    definirPintura(p) {
      pintura = p;
    },
    chegada,
    chegarLoco,
    partir,
    /** Bloco da frente de um trilho levanta (selecionado). @param {number|null} tr */
    selecionar(tr) {
      if (!st) return;
      const ids = tr != null && tr >= 0 ? new Set(st.trilhos[tr].slice(0, bloco(st.trilhos[tr])).map((v) => v.id)) : new Set();
      for (const c of carros.values()) c.liftAlvo = ids.has(c.id) ? 1 : 0;
    },
    /** @param {{ ids: number[], x: number, y: number }|null} a */
    arrastar(a) {
      arraste = a;
      if (a) for (const id of a.ids) {
        const c = carros.get(id);
        if (c) {
          c.lift = 0;
          c.liftAlvo = 0;
          c.x = a.x + a.ids.indexOf(id) * (lay ? lay.P : 0);
          c.y = a.y;
          c.tw = null;
        }
      }
    },
    /** @param {number} tr */
    tremer(tr) {
      tremores.set(tr, relogio());
    },
    /** @param {number} id */
    posVagao(id) {
      const c = carros.get(id);
      return c ? posDesenho(c) : null;
    },
    alvoVaga,
    /** Efeitos no ponto de engate do fim de um trilho. @param {number} tr */
    engatou(tr) {
      if (!st || !lay) return;
      const n = st.trilhos[tr].length;
      const a = alvoVaga(tr, Math.max(0, n - 1));
      faiscas(a.x - lay.P / 2, a.y - lay.L * 0.2);
      // o tranco corre do engate ate a frente do trem, vagao por vagao
      relogio();
      const fila = [...carros.values()].filter((c) => c.tr === tr).sort((x, y) => y.s - x.s);
      fila.forEach((c, k) => { if (k > 0 && !c.tw) c.fis.joltT0 = agora + k * 45; });
    },
    /** @param {number} tr */
    comemorar(tr) {
      if (!st || !lay) return;
      const a = alvoVaga(tr, (st.cap - 1) / 2);
      confete(a.x, a.y - lay.L * 0.5, lay.L);
    },
  };
}
