// Sons sintetizados com WebAudio: nenhum arquivo, nenhuma requisicao.
// O contexto so nasce no primeiro toque (politica de autoplay). O mudo do
// anuncio zera o ganho mestre ANTES de pedir o anuncio e suspende o contexto
// 80 ms depois (padrao do hexadrop: o onStart do SDK pode nao chegar).
//
// Musica: laco pentatonico de 8 compassos (I-V-vi-IV), baixo e melodia
// dedilhada, bem baixinho, num ganho proprio ligado ao mestre (mudo, anuncio
// e aba oculta valem para ela tambem). Cada mundo troca a tonica.

/** Graus da escala pentatonica maior, em semitons. */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
/** Melodia em colcheias (indice em PENTA, -1 = pausa): A e B, 4 compassos cada. */
const MELODIA = [
  0, -1, 2, 4, -1, 4, 2, -1, 3, -1, 4, 3, 2, -1, 1, -1, 2, -1, 4, 5, -1, 4, 3, -1, 2, -1, 1, 0, -1, -1, -1, -1,
  4, -1, 5, 4, 3, -1, 2, -1, 3, -1, 4, -1, 5, 6, 5, -1, 4, -1, 3, 2, -1, 1, 2, -1, 1, -1, 0, -1, -1, -1, -1, -1,
];
/** Acorde de cada compasso (semitons sobre a tonica): I V vi IV. */
const ACORDES = [0, 7, 9, 5];
/** Tonica de cada mundo, em semitons sobre do. */
const TONICAS = [0, 2, 4, 5, 7, -3, -1, 2, 0, 4];
const COLCHEIA = 0.3; // s (100 bpm)

export function criarAudio() {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let mestre = null;
  /** @type {AudioBuffer|null} */
  let ruidoBuf = null;
  let mudo = false;
  let mudoAnuncio = false;
  let abaOculta = false;
  const VOLUME = 0.6;
  /** @type {GainNode|null} */
  let musica = null;
  let musProxima = 0;
  let musPasso = 0;
  let tonica = 0;

  const ganhoAlvo = () => (mudo || mudoAnuncio || abaOculta ? 0 : VOLUME);

  function iniciar() {
    if (ctx) {
      if (ctx.state === 'suspended' && !mudoAnuncio) ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      ctx = new AC();
      mestre = ctx.createGain();
      mestre.gain.value = ganhoAlvo();
      mestre.connect(ctx.destination);
      musica = ctx.createGain();
      musica.gain.value = 0.35;
      musica.connect(mestre);
      setInterval(agendarMusica, 120);
    } catch {
      ctx = null;
    }
  }

  /** Nota da musica no tempo t do contexto. */
  function notaMus(f, t, dur, tipo, vol) {
    if (!ctx || !musica) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = /** @type {OscillatorType} */ (tipo);
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(musica);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  /** Agenda as colcheias dos proximos 0,3 s (nada calado ou suspenso; sem acumular). */
  function agendarMusica() {
    if (!ctx || ctx.state !== 'running' || ganhoAlvo() === 0) return;
    const limite = ctx.currentTime + 0.3;
    musProxima = Math.max(musProxima, ctx.currentTime + 0.02);
    while (musProxima < limite) {
      const passo = musPasso % MELODIA.length;
      const acorde = ACORDES[Math.floor(passo / 8) % ACORDES.length];
      const base = 261.63 * Math.pow(2, tonica / 12);
      if (passo % 4 === 0) notaMus((base / 2) * Math.pow(2, acorde / 12), musProxima, COLCHEIA * 1.8, 'sine', 0.2);
      const g = MELODIA[passo];
      if (g >= 0) notaMus(base * 2 * Math.pow(2, PENTA[g] / 12), musProxima, COLCHEIA * 0.9, 'triangle', 0.11);
      musProxima += COLCHEIA;
      musPasso++;
    }
  }

  function aplicarGanho() {
    if (!ctx || !mestre) return;
    try {
      mestre.gain.setTargetAtTime(ganhoAlvo(), ctx.currentTime, 0.02);
    } catch { /* ignora */ }
  }

  function tom(f, dur, tipo = 'sine', vol = 0.2, f2 = 0, atraso = 0) {
    if (!ctx || !mestre || mudo || mudoAnuncio) return;
    const t = ctx.currentTime + atraso;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = /** @type {OscillatorType} */ (tipo);
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(mestre);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function ruido(dur, freq, q, vol, atraso = 0, tipo = 'bandpass') {
    if (!ctx || !mestre || mudo || mudoAnuncio) return;
    if (!ruidoBuf) {
      ruidoBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.6), ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + atraso;
    const s = ctx.createBufferSource();
    s.buffer = ruidoBuf;
    const f = ctx.createBiquadFilter();
    f.type = /** @type {BiquadFilterType} */ (tipo);
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(mestre);
    s.start(t);
    s.stop(t + dur + 0.03);
  }

  return {
    iniciar,
    get mudo() {
      return mudo;
    },
    /** true se o som esta zerado agora (mudo, anuncio ou aba oculta) */
    get calado() {
      return ganhoAlvo() === 0;
    },
    /** @param {boolean} v */
    definirMudo(v) {
      mudo = v;
      aplicarGanho();
    },
    mudoParaAnuncio() {
      mudoAnuncio = true;
      aplicarGanho();
      setTimeout(() => {
        if (mudoAnuncio && ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
      }, 80);
    },
    /** @param {boolean} oculta */
    pausarAba(oculta) {
      abaOculta = oculta;
      aplicarGanho();
      if (!ctx) return;
      if (oculta) ctx.suspend().catch(() => {});
      else if (!mudoAnuncio) ctx.resume().catch(() => {});
    },
    voltarDoAnuncio() {
      mudoAnuncio = false;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      aplicarGanho();
    },
    pegar() {
      tom(620, 0.07, 'triangle', 0.14, 900);
    },
    voar() {
      ruido(0.22, 900, 0.8, 0.08, 0, 'lowpass');
    },
    engate() {
      ruido(0.06, 3000, 6, 0.5);
      tom(220, 0.07, 'square', 0.06, 110);
      ruido(0.05, 1800, 8, 0.25, 0.05);
    },
    erro() {
      tom(240, 0.09, 'square', 0.05, 180);
      tom(180, 0.12, 'square', 0.05, 130, 0.08);
    },
    apito(atraso = 0) {
      tom(880, 0.5, 'sine', 0.1, 932, atraso);
      tom(1108, 0.5, 'sine', 0.07, 1174, atraso);
      tom(1318, 0.5, 'triangle', 0.04, 1396, atraso);
    },
    chuchu(n = 10, atraso = 0) {
      let t = atraso;
      for (let i = 0; i < n; i++) {
        ruido(0.08, 380, 1.1, 0.3, t);
        ruido(0.05, 1400, 2, 0.08, t + 0.02);
        t += Math.max(0.075, 0.28 - i * 0.022);
      }
    },
    vitoria() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => tom(f, 0.26, 'triangle', 0.11, 0, i * 0.085));
    },
    tique() {
      tom(1200, 0.04, 'triangle', 0.07);
    },
    /** Tonica da musica pelo mundo. @param {number} i indice do mundo */
    definirMundo(i) {
      tonica = TONICAS[((i % TONICAS.length) + TONICAS.length) % TONICAS.length];
    },
  };
}
