// Telemetria do jogo sobre o measure da Poki, recebido por injecao (so o
// main.js importa o poki.js). Nomes fixos, em ingles como o 'level': so passa
// o que esta na lista, e cada par (categoria, acao) vai no maximo uma vez por
// nivel, para nao estourar a fila do wrapper nem a cardinalidade do painel.
//
//   stuck     dead | button | auto   caiu num beco / voltou pelo botao / voltou sozinho
//   invalid   color | capacity       jogada recusada pela cor da boca / por falta de vaga
//   undo      manual
//   restart   manual | undone        recomecou / desfez o recomeco
//   hint      free | ad              mao por ociosidade / dica paga com video
//   extra     ad
//   tutorial  wrong | hand | done    toque fora da guia / mao mostrada / nivel ensinado concluido

/** @type {Record<string, string[]>} */
export const EVENTOS = {
  stuck: ['dead', 'button', 'auto'],
  invalid: ['color', 'capacity'],
  undo: ['manual'],
  restart: ['manual', 'undone'],
  hint: ['free', 'ad'],
  extra: ['ad'],
  tutorial: ['wrong', 'hand', 'done'],
};

/** @param {(categoria: string, oque: string, acao: string) => void} measure */
export function criarTelemetria(measure) {
  let nivel = 1;
  const enviados = new Set();
  return {
    /** Novo nivel: zera o filtro de repetidos. @param {number} n */
    nivel(n) {
      nivel = n;
      enviados.clear();
    },
    /** @param {string} categoria @param {string} acao */
    evento(categoria, acao) {
      const ok = EVENTOS[categoria];
      if (!ok || !ok.includes(acao)) return false;
      const chave = categoria + ':' + acao;
      if (enviados.has(chave)) return false;
      enviados.add(chave);
      measure(categoria, String(nivel), acao);
      return true;
    },
  };
}
