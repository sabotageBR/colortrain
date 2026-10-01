// Parametros de teste na URL. So valem em file://, localhost e 127.0.0.1:
// na Poki nada disso existe. Unico modulo que le a URL.
//   ?nivel=12   comeca no nivel 12
//   ?tema=noite cenario noturno
//   ?auto=400   joga a solucao sozinho (uma jogada a cada 400 ms)
//   ?fixo       sem a animacao de chegada

export function lerDepuracao() {
  let local = false;
  try {
    local = location.protocol === 'file:' || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  } catch {
    local = false;
  }
  if (!local) return { local: false, nivel: 0, tema: '', auto: 0, fixo: false };
  const q = new URLSearchParams(location.search);
  return {
    local: true,
    nivel: q.has('nivel') ? Math.max(1, parseInt(q.get('nivel') || '1', 10) || 1) : 0,
    tema: q.get('tema') || '',
    auto: q.has('auto') ? Math.max(120, parseInt(q.get('auto') || '500', 10) || 500) : 0,
    fixo: q.has('fixo'),
  };
}
