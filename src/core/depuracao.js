// Parametros de teste na URL. So valem em file://, localhost e 127.0.0.1:
// na Poki nada disso existe. Unico modulo que le a URL.
//   ?nivel=12   comeca no nivel 12
//   ?tema=festa  mundo fixo: campina, porto, deserto, serra, metropole, festa,
//               inverno, tropico, outono, aurora
//   ?auto=400   joga a solucao sozinho (uma jogada a cada 400 ms)
//   ?fixo       sem a animacao de chegada
//   ?semanuncio nao pede intervalo comercial (prints e testes longos)
//   ?garagem    abre a garagem ao carregar (prints)
//   ?tabuleiro=3:AF|AA|FF  carrega esse tabuleiro (vagoes por trem, trilhos
//               separados por '|', indice 0 = boca) no lugar do nivel
//   ?intervalo=10  primeiro intervalo comercial depois de 10 s de jogo (padrao 180)

// Fora disso, so o banco de testes de tools/sdkcheck.html liga os ganchos
// (window.__colortrainTeste = { nivel, fixo, intervaloMs }); nesse caso "local"
// continua falso, para o jogo se comportar como na Poki (sem premio sem SDK).

/** @param {string|null} s @returns {{ cap: number, t: string[] }|null} */
function lerTabuleiro(s) {
  const m = /^(\d):([A-H|]*)$/.exec(s || '');
  if (!m) return null;
  const cap = Number(m[1]);
  const t = m[2].split('|');
  if (cap < 2 || t.length < 2 || t.some((x) => x.length > cap)) return null;
  return { cap, t };
}

export function lerDepuracao() {
  let local = false;
  try {
    local = location.protocol === 'file:' || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  } catch {
    local = false;
  }
  const vazio = { local: false, ganchos: false, nivel: 0, tema: '', auto: 0, fixo: false, semAnuncio: false, garagem: false, tabuleiro: null, intervaloMs: 0 };
  const teste = /** @type {any} */ (globalThis).__colortrainTeste;
  if (!local && teste && typeof teste === 'object') {
    return { ...vazio, ganchos: true, nivel: Math.max(0, teste.nivel | 0), fixo: !!teste.fixo, intervaloMs: Math.max(0, teste.intervaloMs | 0) };
  }
  if (!local) return vazio;
  const q = new URLSearchParams(location.search);
  return {
    local: true,
    ganchos: true,
    nivel: q.has('nivel') ? Math.max(1, parseInt(q.get('nivel') || '1', 10) || 1) : 0,
    tema: q.get('tema') || '',
    auto: q.has('auto') ? Math.max(120, parseInt(q.get('auto') || '500', 10) || 500) : 0,
    fixo: q.has('fixo'),
    semAnuncio: q.has('semanuncio'),
    garagem: q.has('garagem'),
    tabuleiro: lerTabuleiro(q.get('tabuleiro')),
    intervaloMs: q.has('intervalo') ? Math.max(0, parseFloat(q.get('intervalo') || '0') || 0) * 1000 : 0,
  };
}
