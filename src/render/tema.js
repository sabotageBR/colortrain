// Paleta dos mundos. As cores dos vagoes sao as mesmas em todos (identidade
// do jogo); o que muda e o lugar: ceu, horizonte em silhueta, marco, estacao,
// placa do patio e cor de acento do HUD. Estilo flat: poucas formas, dois
// tons, sem textura.

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
/** Luminancia relativa (WCAG). @param {string} h */
export function luminancia(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Razao de contraste entre duas cores hex. @param {string} a @param {string} b */
export function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Cor hex em CIE Lab (D65). @param {string} h */
function lab(h) {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Distancia perceptual entre duas cores hex (CIE76; acima de ~25 le-se como cor diferente). */
export function distanciaCor(a, b) {
  const p = lab(a), q = lab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

// vermelho, laranja, amarelo, verde, turquesa, azul, roxo, rosa
const BASES = ['#E9434F', '#F8902C', '#F5C933', '#4FBA4C', '#1FBFB0', '#3A86F2', '#9657E0', '#EF58AF'];

export const CORES = BASES.map((base) => ({
  base,
  claro: misturar(base, '#ffffff', 0.3),
  escuro: misturar(base, '#000000', 0.22),
  profundo: misturar(base, '#000000', 0.45),
}));

/**
 * @typedef {Object} Tema
 * @property {string} nome          chave em TEMAS (a chave do cache de sprites usa isto)
 * @property {boolean} noite
 * @property {string[]} ceu         gradiente do topo para o horizonte (3 paradas)
 * @property {{ tipo: 'sol'|'lua', cor: string, x: number, y: number, r: number }|null} astro
 *   x, y em fracao da largura util e da altura do ceu; r em fracao do menor lado
 * @property {number} nuvens        quantas nuvens-pilula
 * @property {boolean} estrelas
 * @property {boolean} aurora
 * @property {{ forma: string, longe: string, perto: string }} horizonte  silhuetas em 2 camadas
 * @property {boolean} luzes        janelas e luzinhas acesas
 * @property {string|null} marco    silhueta a direita do centro
 * @property {string} estacao       estilo do predio sobre a plataforma
 * @property {string} predio
 * @property {string} predioEscuro
 * @property {string} telhado
 * @property {string} janela        janelas da estacao e do skyline
 * @property {string} plataforma
 * @property {string} faixa         linha de seguranca da plataforma
 * @property {string} placa         chao do patio (fundo das pecas)
 * @property {string} lastro        leito de brita de cada trilho, um tom abaixo do chao
 * @property {string} dormente      madeira dos dormentes
 * @property {string} trilho
 * @property {string} chao          chao chapado abaixo da placa
 * @property {string} acento        HUD, selo de video, realce
 * @property {string} janelaVagao   janela corrida dos vagoes e da cabine
 * @property {string} sombra        sombra chapada das pecas
 * @property {string} tinta         chassi, rodas, postes
 * @property {boolean} guia         trilho como guia luminosa, sem dormentes
 */

/**
 * Completa um mundo com os campos derivados, para todos terem o mesmo conjunto.
 * @param {Partial<Tema> & { nome: string, ceu: string[], horizonte: Tema['horizonte'], placa: string, acento: string }} d
 * @returns {Tema}
 */
function mundo(d) {
  const noite = !!d.noite;
  return {
    nome: d.nome,
    noite,
    ceu: d.ceu,
    astro: d.astro === undefined ? null : d.astro,
    nuvens: d.nuvens || 0,
    estrelas: d.estrelas === undefined ? noite : d.estrelas,
    aurora: !!d.aurora,
    horizonte: d.horizonte,
    luzes: d.luzes === undefined ? noite : d.luzes,
    marco: d.marco === undefined ? null : d.marco,
    estacao: d.estacao || 'casa',
    predio: d.predio || '#F3EBDD',
    predioEscuro: d.predioEscuro || misturar(d.predio || '#F3EBDD', '#000000', 0.28),
    telhado: d.telhado || '#D9553F',
    janela: d.janela || (noite ? '#FFD36B' : '#8FC3E8'),
    plataforma: d.plataforma || (noite ? '#8F89B4' : '#E8E1D1'),
    faixa: d.faixa || d.acento,
    placa: d.placa,
    lastro: d.lastro || misturar(d.placa, '#000000', 0.16),
    dormente: d.dormente || (noite ? '#4E4048' : '#7E5F43'),
    trilho: d.trilho || (noite ? '#B4BCCC' : '#ECE8E0'),
    chao: d.chao || misturar(d.placa, '#ffffff', 0.2),
    acento: d.acento,
    janelaVagao: d.janelaVagao || (noite ? 'rgba(255,226,160,0.78)' : 'rgba(255,255,255,0.4)'),
    sombra: d.sombra || (noite ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.3)'),
    tinta: d.tinta || '#1E2235',
    guia: !!d.guia,
  };
}

/** @type {Record<string, Tema>} */
export const TEMAS = {
  campina: mundo({
    nome: 'campina',
    ceu: ['#4C9FE6', '#8FCBF2', '#DCEFF8'],
    astro: { tipo: 'sol', cor: '#FFE68A', x: 0.66, y: 0.3, r: 0.09 },
    nuvens: 3,
    horizonte: { forma: 'morros', longe: '#A9D9AE', perto: '#6DB873' },
    marco: 'moinho',
    estacao: 'casa',
    predio: '#F3EBDD',
    telhado: '#D9553F',
    janela: '#7FB8E6',
    plataforma: '#E8E1D1',
    placa: '#A39A88',
    chao: '#79B86A',
    acento: '#FF6B57',
  }),
  porto: mundo({
    nome: 'porto',
    ceu: ['#E88C4A', '#F2B478', '#F8D9B4'],
    astro: { tipo: 'sol', cor: '#FFD37A', x: 0.6, y: 0.62, r: 0.11 },
    nuvens: 2,
    horizonte: { forma: 'mar', longe: '#3E8FA8', perto: '#5E6F7E' },
    marco: 'farol',
    estacao: 'galpao',
    predio: '#E2CDAE',
    telhado: '#8A5A3C',
    janela: '#8FC9DC',
    plataforma: '#E4D7C2',
    placa: '#8F9490',
    chao: '#C9B088',
    acento: '#F5A623',
  }),
  deserto: mundo({
    nome: 'deserto',
    ceu: ['#E9674B', '#F29A6E', '#F7C7A8'],
    astro: { tipo: 'sol', cor: '#FFE0A0', x: 0.22, y: 0.36, r: 0.12 },
    horizonte: { forma: 'mesas', longe: '#D8906C', perto: '#A95C45' },
    marco: 'caixa',
    estacao: 'adobe',
    predio: '#E8C39E',
    telhado: '#B2563F',
    janela: '#F6E3C8',
    plataforma: '#EAD3B4',
    placa: '#B08364',
    chao: '#D6B088',
    acento: '#2ED3C4',
  }),
  serra: mundo({
    nome: 'serra',
    ceu: ['#9DB0C4', '#BFCCDA', '#DCE4EC'],
    horizonte: { forma: 'montanhas', longe: '#8FA3B5', perto: '#4E6878' },
    marco: 'teleferico',
    estacao: 'chale',
    predio: '#C7B29A',
    telhado: '#5A4636',
    janela: '#F2D7A2',
    plataforma: '#DADDE0',
    placa: '#86929A',
    chao: '#5F7D6C',
    acento: '#E9434F',
  }),
  metropole: mundo({
    nome: 'metropole',
    ceu: ['#5CAFF0', '#A8D5F7', '#E5F1FB'],
    astro: { tipo: 'sol', cor: '#FFF2B0', x: 0.18, y: 0.22, r: 0.07 },
    nuvens: 2,
    horizonte: { forma: 'skyline', longe: '#B8C7D6', perto: '#7E92A5' },
    marco: 'torre',
    estacao: 'vidro',
    predio: '#F4F6F8',
    telhado: '#5C6878',
    janela: '#9CC9EC',
    plataforma: '#E3E6EA',
    placa: '#9298A2',
    chao: '#8C96A2',
    acento: '#F5C933',
  }),
  festa: mundo({
    nome: 'festa',
    noite: true,
    ceu: ['#120F33', '#2B1E5C', '#5B3B7C'],
    astro: { tipo: 'lua', cor: '#FFF1C4', x: 0.62, y: 0.28, r: 0.08 },
    horizonte: { forma: 'morros', longe: '#352C62', perto: '#221C48' },
    marco: 'roda',
    estacao: 'casa',
    predio: '#3A3160',
    telhado: '#2A2450',
    janela: '#FFD36B',
    plataforma: '#8F89B4',
    placa: '#3E4168',
    chao: '#1E2446',
    acento: '#FF5FA8',
  }),
  inverno: mundo({
    nome: 'inverno',
    ceu: ['#B4BFE4', '#D3DBEF', '#EDF0F8'],
    astro: { tipo: 'sol', cor: '#FFF6E0', x: 0.64, y: 0.3, r: 0.07 },
    horizonte: { forma: 'colinas', longe: '#E6EBF3', perto: '#CBD5E3' },
    marco: 'abeto',
    estacao: 'chale',
    predio: '#8E6B52',
    telhado: '#F4F7FB',
    janela: '#FFD9A0',
    plataforma: '#F1F4F8',
    placa: '#9AA6B6',
    chao: '#E7ECF3',
    acento: '#5FB9EC',
  }),
  tropico: mundo({
    nome: 'tropico',
    ceu: ['#2BB0D2', '#7ED4E5', '#CFF0F2'],
    astro: { tipo: 'sol', cor: '#FFF0A8', x: 0.64, y: 0.26, r: 0.1 },
    nuvens: 2,
    horizonte: { forma: 'praia', longe: '#1E9BB6', perto: '#2E7A5A' },
    marco: 'coqueiro',
    estacao: 'palhoca',
    predio: '#F5E6C8',
    telhado: '#C58B52',
    janela: '#6FC8D8',
    plataforma: '#F3E2BE',
    placa: '#AE9774',
    chao: '#EFD9A8',
    acento: '#F8902C',
  }),
  outono: mundo({
    nome: 'outono',
    ceu: ['#E9A95C', '#F3C98C', '#F9E6C6'],
    astro: { tipo: 'sol', cor: '#FFE9B0', x: 0.2, y: 0.3, r: 0.1 },
    nuvens: 1,
    horizonte: { forma: 'floresta', longe: '#D9904F', perto: '#A65A33' },
    marco: 'celeiro',
    estacao: 'celeiro',
    predio: '#A8402F',
    telhado: '#4A2E26',
    janela: '#F7D9A0',
    plataforma: '#E6D2B2',
    placa: '#95735C',
    chao: '#C8884E',
    acento: '#F2C14E',
  }),
  aurora: mundo({
    nome: 'aurora',
    noite: true,
    ceu: ['#070B20', '#0F1A3A', '#1E3050'],
    astro: { tipo: 'lua', cor: '#E8F2FF', x: 0.2, y: 0.22, r: 0.05 },
    aurora: true,
    horizonte: { forma: 'montanhas', longe: '#1F2F50', perto: '#101B33' },
    luzes: false,
    marco: 'observatorio',
    estacao: 'cupula',
    predio: '#2A3758',
    telhado: '#C9D8EC',
    janela: '#9AF0D0',
    plataforma: '#7D8AA8',
    placa: '#2F3B58',
    chao: '#1C2742',
    acento: '#7CFFB2',
    guia: true,
  }),
};

/** Um mundo novo a cada tantos niveis, nesta ordem (10 x 15 = os 150 niveis prontos). */
export const NIVEIS_POR_MUNDO = 15;

/** @type {string[]} */
export const ORDEM_MUNDOS = ['campina', 'porto', 'deserto', 'serra', 'metropole', 'festa', 'inverno', 'tropico', 'outono', 'aurora'];

/** Tema do nivel, ciclando a campanha. @param {number} nivel */
export function temaPorNivel(nivel) {
  const i = Math.floor((Math.max(1, nivel) - 1) / NIVEIS_POR_MUNDO) % ORDEM_MUNDOS.length;
  return TEMAS[ORDEM_MUNDOS[i]];
}
