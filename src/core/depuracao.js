// Parametros de teste na URL. So valem em file://, localhost e 127.0.0.1:
// na Poki nada disso existe. Unico modulo que le a URL.
//   ?nivel=12   comeca no nivel 12
//   ?tema=noite cenario noturno
//   ?auto=400   joga a solucao sozinho (uma jogada a cada 400 ms)
//   ?fixo       sem a animacao de chegada
//   ?semanuncio nao pede intervalo comercial (prints e testes longos)
//   ?garagem    abre a garagem ao carregar (prints)

// Fora disso, so o banco de testes de tools/sdkcheck.html liga os ganchos
// (window.__colortrainTeste = { nivel, ... }); nesse caso "local" continua
// falso, para o jogo se comportar como na Poki (sem premio sem SDK).

export function lerDepuracao() {
  let local = false;
  try {
    local = location.protocol === 'file:' || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  } catch {
    local = false;
  }
  const teste = /** @type {any} */ (globalThis).__colortrainTeste;
  if (!local && teste && typeof teste === 'object') {
    return { local: false, ganchos: true, nivel: Math.max(0, teste.nivel | 0), tema: '', auto: 0, fixo: !!teste.fixo, semAnuncio: false, garagem: false };
  }
  if (!local) return { local: false, ganchos: false, nivel: 0, tema: '', auto: 0, fixo: false, semAnuncio: false, garagem: false };
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
  };
}
