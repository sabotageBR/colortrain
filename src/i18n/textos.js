// Textos do jogo. Quase tudo e icone; o que sobra cabe aqui.
// Ingles e o padrao (Poki e global); PT e ES pelo idioma do navegador.

const TEXTOS = {
  en: {
    nivel: 'Level', desfazer: 'Undo', recomecar: 'Restart', dica: 'Hint', extra: 'Extra track', som: 'Sound', garagem: 'Locomotives', nova: 'New locomotive!', desbloquear: 'Unlock now', fechar: 'Close',
    voltar: 'Go back', mundo: 'World', proxima: 'Next locomotive',
    campina: 'Meadow', porto: 'Harbor', deserto: 'Desert', serra: 'Mountains', metropole: 'Metropolis', festa: 'Carnival', inverno: 'Winter', tropico: 'Tropics', outono: 'Autumn', aurora: 'Aurora',
  },
  pt: {
    nivel: 'Nível', desfazer: 'Desfazer', recomecar: 'Recomeçar', dica: 'Dica', extra: 'Trilho extra', som: 'Som', garagem: 'Locomotivas', nova: 'Nova locomotiva!', desbloquear: 'Liberar agora', fechar: 'Fechar',
    voltar: 'Voltar', mundo: 'Mundo', proxima: 'Próxima locomotiva',
    campina: 'Campina', porto: 'Porto', deserto: 'Deserto', serra: 'Serra', metropole: 'Metrópole', festa: 'Festa', inverno: 'Inverno', tropico: 'Trópico', outono: 'Outono', aurora: 'Aurora',
  },
  es: {
    nivel: 'Nivel', desfazer: 'Deshacer', recomecar: 'Reiniciar', dica: 'Pista', extra: 'Vía extra', som: 'Sonido', garagem: 'Locomotoras', nova: '¡Nueva locomotora!', desbloquear: 'Desbloquear ya', fechar: 'Cerrar',
    voltar: 'Volver', mundo: 'Mundo', proxima: 'Próxima locomotora',
    campina: 'Pradera', porto: 'Puerto', deserto: 'Desierto', serra: 'Sierra', metropole: 'Metrópolis', festa: 'Fiesta', inverno: 'Invierno', tropico: 'Trópico', outono: 'Otoño', aurora: 'Aurora',
  },
};

/** @param {readonly string[]} [langs] */
export function escolherIdioma(langs = (typeof navigator !== 'undefined' && navigator.languages) || []) {
  for (const l of langs) {
    const p = String(l).slice(0, 2).toLowerCase();
    if (p in TEXTOS) return p;
  }
  return 'en';
}

/** @param {string} idioma */
export function textos(idioma) {
  return { ...TEXTOS.en, ...(TEXTOS[/** @type {'en'} */ (idioma)] || {}) };
}
