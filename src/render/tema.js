// Paleta das pecas e dos cenarios. As cores dos vagoes sao as mesmas nos dois
// temas (identidade do jogo); o cenario muda de dia para noite.

/** @param {string} h */
function rgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/** Mistura duas cores hex. @param {string} a @param {string} b @param {number} t */
export function misturar(a, b, t) {
  const x = rgb(a), y = rgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

// vermelho, laranja, amarelo, verde, turquesa, azul, roxo, rosa
const BASES = ['#E9434F', '#F8902C', '#F5C933', '#4FBA4C', '#1FBFB0', '#3A86F2', '#9657E0', '#EF58AF'];

export const CORES = BASES.map((base) => ({
  base,
  claro: misturar(base, '#ffffff', 0.3),
  teto: misturar(base, '#ffffff', 0.55),
  escuro: misturar(base, '#000000', 0.3),
  profundo: misturar(base, '#000000', 0.5),
}));

/**
 * @typedef {Object} Tema
 * @property {string} nome
 * @property {boolean} noite
 * @property {string[]} ceu        gradiente do topo para o horizonte
 * @property {string} nuvem
 * @property {string[]} morros     do mais longe para o mais perto
 * @property {string} grama
 * @property {string} gramaTufo
 * @property {string} patio        piso do patio de manobras
 * @property {string} patioJunta
 * @property {string} lastro
 * @property {string} lastroClaro
 * @property {string} lastroEscuro
 * @property {string} dormente
 * @property {string} dormenteTopo
 * @property {string} trilho
 * @property {string} trilhoBrilho
 * @property {string} parede       fachada da estacao
 * @property {string} paredeSombra
 * @property {string} telhado
 * @property {string} telhadoEscuro
 * @property {string} janelaEstacao
 * @property {string} plataforma
 * @property {string} faixaSeguranca
 * @property {string} vidroVagao   [topo, base] do vidro das janelas
 * @property {string} vidroVagao2
 * @property {string} contorno     contorno das pecas
 * @property {string} sombra
 * @property {string} copa         arvores
 * @property {string} copaClara
 */

/** @type {Record<string, Tema>} */
export const TEMAS = {
  dia: {
    nome: 'dia',
    noite: false,
    ceu: ['#5DB8F5', '#A8DDFA', '#DFF3FC'],
    nuvem: '#FFFFFF',
    morros: ['#A6D9A0', '#86C77F'],
    grama: '#7CC266',
    gramaTufo: '#68AD54',
    patio: '#E4D7BF',
    patioJunta: '#D3C4A8',
    lastro: '#ABA295',
    lastroClaro: '#C7BFB3',
    lastroEscuro: '#8C8377',
    dormente: '#7B4F31',
    dormenteTopo: '#9A6640',
    trilho: '#555C6B',
    trilhoBrilho: '#E8ECF2',
    parede: '#F3E7D3',
    paredeSombra: '#DCCBB0',
    telhado: '#C9533B',
    telhadoEscuro: '#9B3B28',
    janelaEstacao: '#4F72A8',
    plataforma: '#CFC8BC',
    faixaSeguranca: '#F4C430',
    vidroVagao: '#22314F',
    vidroVagao2: '#5B83BD',
    contorno: 'rgba(38,26,56,0.62)',
    sombra: 'rgba(48,34,20,0.26)',
    copa: '#3F9A4A',
    copaClara: '#5DBB5E',
  },
  noite: {
    nome: 'noite',
    noite: true,
    ceu: ['#0B0D2E', '#251B57', '#56307A'],
    nuvem: '#3A3170',
    morros: ['#2A2259', '#1E1A47'],
    grama: '#1C2747',
    gramaTufo: '#18213D',
    patio: '#2C2F4C',
    patioJunta: '#363A5A',
    lastro: '#4B4966',
    lastroClaro: '#5E5C7C',
    lastroEscuro: '#3A3852',
    dormente: '#3F3242',
    dormenteTopo: '#57455A',
    trilho: '#7C89A8',
    trilhoBrilho: '#9FF4FF',
    parede: '#3E3870',
    paredeSombra: '#332E5E',
    telhado: '#7A3696',
    telhadoEscuro: '#5A2471',
    janelaEstacao: '#FFD36B',
    plataforma: '#4A4A6E',
    faixaSeguranca: '#FFC94A',
    vidroVagao: '#FFE7A3',
    vidroVagao2: '#FFC85C',
    contorno: 'rgba(8,6,24,0.7)',
    sombra: 'rgba(0,0,0,0.38)',
    copa: '#24305E',
    copaClara: '#33427A',
  },
};
