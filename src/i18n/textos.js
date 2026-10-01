// Textos do jogo. Quase tudo e icone; o que sobra cabe aqui.
// Ingles e o padrao (Poki e global); PT e ES pelo idioma do navegador.

const TEXTOS = {
  en: { nivel: 'Level', desfazer: 'Undo', recomecar: 'Restart', dica: 'Hint', extra: 'Extra track', som: 'Sound' },
  pt: { nivel: 'Nível', desfazer: 'Desfazer', recomecar: 'Recomeçar', dica: 'Dica', extra: 'Trilho extra', som: 'Som' },
  es: { nivel: 'Nivel', desfazer: 'Deshacer', recomecar: 'Reiniciar', dica: 'Pista', extra: 'Vía extra', som: 'Sonido' },
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
