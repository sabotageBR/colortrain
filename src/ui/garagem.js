// Garagem: colecao de pinturas da locomotiva. Cada 5 niveis libera uma; o
// video recompensado libera a proxima na hora. Painel em DOM com previas
// desenhadas pelo proprio desenharLoco.

import { PINTURAS, desenharLoco, caminhoRet } from '../render/pecas.js';
import { temaPorNivel } from '../render/tema.js';

export const NIVEIS_POR_LOCO = 5;

/** Quantas pinturas ja estao liberadas. @param {number} nivel nivel atual @param {number} extras */
export function liberadas(nivel, extras) {
  return Math.min(PINTURAS.length, 1 + Math.floor((nivel - 1) / NIVEIS_POR_LOCO) + extras);
}

/** Nivel em que a pintura i libera sozinha. @param {number} i @param {number} extras */
export function nivelDaPintura(i, extras) {
  return 1 + (i - extras) * NIVEIS_POR_LOCO;
}

/**
 * Desenha a previa de uma pintura num canvas (bloqueada = silhueta).
 * @param {HTMLCanvasElement} cv @param {number} i @param {boolean} bloqueada
 * @param {import('../render/tema.js').Tema} [tema]
 */
export function desenharPrevia(cv, i, bloqueada, tema = temaPorNivel(1)) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth || 120;
  const h = cv.clientHeight || 72;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  g.scale(dpr, dpr);
  const L = Math.min(w / 1.7, h / 1.05);
  const y = h - 8;
  // trilho flat, como no patio (o fundo escuro vem do CSS)
  g.fillStyle = tema.dormente;
  caminhoRet(g, -4, y - L * 0.27, w + 8, L * 0.37, 4);
  g.fill();
  g.fillStyle = tema.trilho;
  g.fillRect(0, y - L * 0.16 - 2, w, 2);
  g.fillRect(0, y, w, 2);
  desenharLoco(g, w / 2 + L * 0.05, y, L, tema, dpr, { pintura: PINTURAS[i], aceso: !bloqueada, roda: 0.6 });
  if (bloqueada) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#3A4055';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }
}

/**
 * @param {{ textos: Record<string, string>, aoEscolher: (i: number) => void,
 *   aoLiberar: () => Promise<boolean>, aoAbrir: () => void, aoFechar: () => void,
 *   tema?: () => import('../render/tema.js').Tema }} o
 */
export function criarGaragem(o) {
  const painel = document.createElement('div');
  painel.id = 'garagem';
  painel.className = 'painel';
  painel.hidden = true;
  painel.innerHTML = `
    <div class="cartao" role="dialog" aria-modal="true" aria-labelledby="gTitulo">
      <div class="cabeca">
        <h2 id="gTitulo"></h2>
        <button id="gFechar" class="btn redondo pequeno"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
      <div class="grade" id="gGrade"></div>
      <button id="gLiberar" class="btn largo anuncio"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0"/></svg><span></span><i class="selo" aria-hidden="true"></i></button>
    </div>`;
  document.body.appendChild(painel);
  const grade = /** @type {HTMLElement} */ (painel.querySelector('#gGrade'));
  const btLiberar = /** @type {HTMLButtonElement} */ (painel.querySelector('#gLiberar'));
  const btFechar = /** @type {HTMLButtonElement} */ (painel.querySelector('#gFechar'));
  /** @type {{ nivel: number, extras: number, ativa: number, comAnuncio: boolean }} */
  let estado = { nivel: 1, extras: 0, ativa: 0, comAnuncio: true };

  function montar() {
    const T = o.textos;
    /** @type {HTMLElement} */ (painel.querySelector('#gTitulo')).textContent = T.garagem;
    btFechar.setAttribute('aria-label', T.fechar);
    /** @type {HTMLElement} */ (btLiberar.querySelector('span')).textContent = T.desbloquear;
    const n = liberadas(estado.nivel, estado.extras);
    grade.innerHTML = '';
    PINTURAS.forEach((p, i) => {
      const livre = i < n;
      const b = document.createElement('button');
      b.className = 'loco' + (i === estado.ativa ? ' ativa' : '') + (livre ? '' : ' bloqueada');
      b.disabled = !livre;
      b.setAttribute('aria-label', livre ? p.id : `${T.nivel} ${nivelDaPintura(i, estado.extras)}`);
      b.innerHTML = `<canvas></canvas>${livre ? '' : `<span class="cadeado"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0"/></svg>${nivelDaPintura(i, estado.extras)}</span>`}`;
      b.addEventListener('click', () => {
        if (!livre) return;
        estado.ativa = i;
        o.aoEscolher(i);
        montar();
      });
      grade.appendChild(b);
      const tema = o.tema ? o.tema() : temaPorNivel(1);
      requestAnimationFrame(() => desenharPrevia(/** @type {HTMLCanvasElement} */ (b.querySelector('canvas')), i, !livre, tema));
    });
    btLiberar.hidden = n >= PINTURAS.length || !estado.comAnuncio;
  }

  btLiberar.addEventListener('click', async () => {
    btLiberar.disabled = true;
    const ok = await o.aoLiberar();
    btLiberar.disabled = false;
    if (ok) montar();
  });
  btFechar.addEventListener('click', () => fechar());
  painel.addEventListener('pointerdown', (e) => {
    if (e.target === painel) fechar();
  });

  function abrir() {
    painel.hidden = false;
    o.aoAbrir();
    montar();
  }
  function fechar() {
    if (painel.hidden) return;
    painel.hidden = true;
    o.aoFechar();
  }

  return {
    abrir,
    fechar,
    get aberta() {
      return !painel.hidden;
    },
    /** @param {Partial<typeof estado>} e */
    atualizar(e) {
      estado = { ...estado, ...e };
      if (!painel.hidden) montar();
    },
  };
}
