// Monta a build da Poki: copia so o jogo para dist/, confere e zipa em
// dist-poki/color-train-<versao>.zip (index.html na raiz do zip).
// Uso: node tools/empacotar.mjs
//
// Alvo californiagames.io (PlataformaSDK): node tools/empacotar.mjs --alvo=californiagames [--saida=pasta]
// Monta em dist-californiagames/: a tag da Poki vira a da SDK do portal (/sdk/v1/plataforma-sdk.js,
// servida pela origem de jogos, nunca copiada para o build), o src/core/poki.js sai e o adaptador
// portais/californiagames.js entra como src/core/plataforma.js (o import do src/main.js e trocado).
// Nenhuma URL externa. O zip vai para ../distribuicao/colortrain/californiagames/build/
// (color-train-californiagames-<versao>.zip e .sha256).
//
// Alvo Y8 (SDK 2-0): node tools/empacotar.mjs --alvo=y8 [--saida=pasta]  (ou npm run y8)
// Monta em dist-y8/: a tag da Poki vira a do SDK da Y8 (async, do CDN deles, com onerror que avisa o jogo
// para seguir na hora sem anuncios), o src/core/poki.js sai, portais/y8.js entra como
// src/core/plataforma.js (com os ids de package.json "portais.y8" gravados em IDS) e portais/fila-sdk.js
// como src/core/fila-sdk.js. Unica URL externa: o SDK da Y8. O zip vai para
// ../distribuicao/colortrain/y8/build/ (colortrain-y8-<versao>.zip e .sha256).
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { RAIZ } from './servir.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
const ALVO = args.alvo || 'poki';
if (!['poki', 'californiagames', 'y8'].includes(ALVO)) {
  process.stdout.write(`alvo desconhecido: ${ALVO} (poki | californiagames | y8)\n`);
  process.exit(2);
}
const CG = ALVO === 'californiagames';
const Y8 = ALVO === 'y8';
const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'));
const versao = pacote.version;
const dist = join(RAIZ, CG ? 'dist-californiagames' : Y8 ? 'dist-y8' : 'dist');
const saida = CG || Y8 ? resolve(args.saida || join(RAIZ, '..', 'distribuicao', 'colortrain', Y8 ? 'y8' : 'californiagames', 'build')) : join(RAIZ, 'dist-poki');
const nomeZip = CG ? `color-train-californiagames-${versao}` : Y8 ? `colortrain-y8-${versao}` : `color-train-${versao}`;
const zip = join(saida, `${nomeZip}.zip`);
const PERMITIDA = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
/** SDK da Y8 2-0 (sempre do CDN deles) e a tag que entra no lugar da Poki: async, e o onerror avisa o jogo. */
const SDK_Y8 = 'https://cdn.y8.com/minimal-sdk/2-0/y8.min.js';
// window.dispatchEvent, nao dispatchEvent: dentro de um onerror inline o nome resolve para o proprio <script>
// e o evento nao chegaria a janela
const SCRIPT_Y8 = `<script src="${SDK_Y8}" async onerror="window.__sdkFalhou=1;window.dispatchEvent(new Event('y8sdk.falhou'))"></script>`;
const TAG_Y8 = `<!-- SDK da Y8 2-0, do CDN deles: o unico script externo. Bloqueado, o onerror avisa e o jogo segue sem anuncios. -->\n${SCRIPT_Y8}`;
/** URL externa aceita na build: so o SDK do alvo (o californiagames serve a SDK pela origem). */
const URL_PERMITIDA = CG ? '' : Y8 ? SDK_Y8 : PERMITIDA;
/** A tag da Poki no index.html (com o comentario de cima) e a da SDK do californiagames que entra no lugar. */
const TAG_POKI = /<!-- Unico script externo permitido pela Poki\. -->\n<script src="https:\/\/game-cdn\.poki\.com\/scripts\/v2\/poki-sdk\.js"><\/script>/;
const TAG_SDK_CG = '<!-- SDK do portal: servida pela origem de jogos, nunca copiada para o build. -->\n<script src="/sdk/v1/plataforma-sdk.js"></script>';
const IMPORT_POKI = "from './core/poki.js';";
const IMPORT_CG = "from './core/plataforma.js';";

/** @param {string} d @returns {string[]} */
const listar = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const item of ['index.html', 'LICENCAS.txt', 'src']) cpSync(join(RAIZ, item), join(dist, item), { recursive: true });

const falhas = [];
if (CG) falhas.push(...prepararCalifornia(dist));
if (Y8) falhas.push(...prepararY8(dist));
const arquivos = listar(dist);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/viewport-fit=cover/.test(html)) falhas.push('index.html sem viewport-fit=cover');
if (!CG && !Y8 && !html.includes(PERMITIDA)) falhas.push('index.html sem o SDK da Poki');
if (CG) falhas.push(...conferirCalifornia(dist, html, arquivos));
if (Y8) falhas.push(...conferirY8(dist, html, arquivos));
let bruto = 0;
let gz = 0;
for (const p of arquivos) {
  const r = relative(dist, p);
  const dados = readFileSync(p);
  bruto += dados.length;
  gz += gzipSync(dados, { level: 9 }).length;
  if (extname(p) === '.map') falhas.push(`mapa de fonte na build: ${r}`);
  if (/\.(html|js|css)$/.test(p)) {
    const t = dados.toString('utf8');
    for (const u of t.match(/https?:\/\/[^\s"'`)<>]+/g) || []) if (u !== URL_PERMITIDA) falhas.push(`URL externa em ${r}: ${u}`);
    if (/console\.(log|info|debug)\s*\(/.test(t)) falhas.push(`console.log em ${r}`);
  }
}
if (gz > 5 * 1024 * 1024) falhas.push(`build acima de 5 MB gzip (${gz} bytes)`);
if (falhas.length) {
  process.stdout.write('FALHOU:\n  ' + falhas.join('\n  ') + '\n');
  process.exit(1);
}

mkdirSync(saida, { recursive: true });
rmSync(zip, { force: true });
const z = spawnSync('zip', CG || Y8 ? ['-qr', '-X', zip, '.', '-x', '*.DS_Store'] : ['-qr', '-X', zip, '.'], { cwd: dist, encoding: 'utf8' });
if (z.status !== 0) {
  process.stdout.write('zip falhou: ' + z.stderr + '\n');
  process.exit(1);
}
const teste = spawnSync('unzip', ['-tq', zip], { encoding: 'utf8' });
const lista = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).stdout.trim().split('\n');
if (teste.status !== 0 || !lista.includes('index.html')) {
  process.stdout.write('zip invalido ou sem index.html na raiz\n');
  process.exit(1);
}
const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
const tam = statSync(zip).size;
writeFileSync(join(saida, `${nomeZip}.sha256`), `${sha}  ${nomeZip}.zip\n`);
if (CG || Y8) {
  process.stdout.write(`build ${ALVO} ok: ${arquivos.length} arquivos, ${(bruto / 1024).toFixed(0)} KB (${(gz / 1024).toFixed(0)} KB gzip)\n`);
  process.stdout.write(`${zip}: ${(tam / 1024).toFixed(0)} KB, sha256 ${sha}\n`);
  process.exit(0);
}
process.stdout.write(`build ok: ${arquivos.length} arquivos, ${(bruto / 1024).toFixed(0)} KB (${(gz / 1024).toFixed(0)} KB gzip)\n`);
process.stdout.write(`${relative(RAIZ, zip)}: ${(tam / 1024).toFixed(0)} KB, sha256 ${sha}\n`);
if (!existsSync(zip)) process.exit(1);

/**
 * Alvo californiagames: troca a tag da Poki pela da SDK do portal e o wrapper da Poki pelo adaptador.
 * @param {string} d a pasta da build
 * @returns {string[]} falhas
 */
function prepararCalifornia(d) {
  const f = [];
  const caminhoHtml = join(d, 'index.html');
  const texto = readFileSync(caminhoHtml, 'utf8');
  if (!TAG_POKI.test(texto)) f.push('index.html: a tag da Poki (com o comentario) nao foi encontrada para trocar');
  else writeFileSync(caminhoHtml, texto.replace(TAG_POKI, TAG_SDK_CG));
  const caminhoMain = join(d, 'src/main.js');
  const main = readFileSync(caminhoMain, 'utf8');
  if (main.split(IMPORT_POKI).length !== 2) f.push('src/main.js: o import do poki.js nao aparece exatamente uma vez');
  else writeFileSync(caminhoMain, main.replace(IMPORT_POKI, IMPORT_CG));
  rmSync(join(d, 'src/core/poki.js'), { force: true });
  cpSync(join(RAIZ, 'portais/californiagames.js'), join(d, 'src/core/plataforma.js'));
  return f;
}

/**
 * Regras da documentacao da SDK que o build do portal precisa cumprir.
 * @param {string} d @param {string} texto o index.html @param {string[]} todos
 * @returns {string[]} falhas
 */
function conferirCalifornia(d, texto, todos) {
  const f = [];
  const head = texto.split(/<\/head>/i)[0];
  if (!/<script src="\/sdk\/v1\/plataforma-sdk\.js"><\/script>/.test(head)) f.push('index.html sem a tag da SDK no <head>');
  if (/poki/i.test(texto)) f.push('index.html ainda menciona a Poki');
  const iModulo = texto.search(/<script[^>]+type="module"/);
  if (iModulo >= 0 && texto.indexOf('plataforma-sdk.js') > iModulo) f.push('a SDK deve vir antes dos scripts do jogo');
  for (const p of todos) {
    const r = relative(d, p);
    if (/(^|\/)sdk\/v\d|plataforma-sdk\.js$/.test(r)) f.push(`a SDK nao vai no build: ${r}`);
    if (!/\.js$/.test(p)) continue;
    const js = readFileSync(p, 'utf8');
    if (/from\s+['"][^'"]*poki\.js['"]|import\(\s*['"][^'"]*poki\.js/.test(js)) f.push(`${r} ainda importa o poki.js`);
    if (/localStorage\.clear|sessionStorage\.clear/.test(js)) f.push(`${r} limpa o storage inteiro (a origem e compartilhada)`);
    if (/movePill|openExternalLink/.test(js)) f.push(`${r} usa recurso da Poki (movePill/openExternalLink)`);
  }
  return f;
}

/**
 * Alvo y8: troca a tag da Poki pela do SDK da Y8, o wrapper da Poki pelo adaptador (com os ids do painel)
 * e copia o fila-sdk.js que ele importa.
 * @param {string} d a pasta da build
 * @returns {string[]} falhas
 */
function prepararY8(d) {
  const f = [];
  const ids = (pacote.portais && pacote.portais.y8) || {};
  if (!ids.appId || !ids.gameId) f.push('package.json sem "portais.y8" com appId e gameId (aba SDK Initialization do Developer Portal da Y8)');
  const caminhoHtml = join(d, 'index.html');
  const texto = readFileSync(caminhoHtml, 'utf8');
  if (!TAG_POKI.test(texto)) f.push('index.html: a tag da Poki (com o comentario) nao foi encontrada para trocar');
  else writeFileSync(caminhoHtml, texto.replace(TAG_POKI, TAG_Y8));
  const caminhoMain = join(d, 'src/main.js');
  const main = readFileSync(caminhoMain, 'utf8');
  const IMPORT_INTEIRO = "import { poki } from './core/poki.js';";
  // no zip da Y8 o objeto do portal se chama portal (o nome poki fica so no codigo-fonte e na build da Poki)
  if (main.split(IMPORT_INTEIRO).length !== 2) f.push('src/main.js: o import do poki.js nao aparece exatamente uma vez');
  else writeFileSync(caminhoMain, main.replace(IMPORT_INTEIRO, "import { portal } from './core/plataforma.js';").replace(/\bpoki\b/g, 'portal'));
  rmSync(join(d, 'src/core/poki.js'), { force: true });
  const adaptador = readFileSync(join(RAIZ, 'portais/y8.js'), 'utf8');
  const vazio = 'export const IDS = {};';
  if (adaptador.split(vazio).length !== 2) f.push(`portais/y8.js sem "${vazio}" (uma vez) para gravar os ids`);
  const gravados = JSON.stringify({ appId: String(ids.appId || ''), gameId: String(ids.gameId || '') });
  writeFileSync(join(d, 'src/core/plataforma.js'), adaptador.replace(vazio, `export const IDS = ${gravados};`));
  cpSync(join(RAIZ, 'portais/fila-sdk.js'), join(d, 'src/core/fila-sdk.js'));
  // os comentarios do jogo citam a Poki e outros portais: no zip da Y8 eles saem dos .js
  for (const p of listar(d).filter((x) => x.endsWith('.js'))) writeFileSync(p, tirarComentarios(readFileSync(p, 'utf8')));
  return f;
}

/**
 * Tira os comentarios que ocupam linhas inteiras: // ... e os blocos /* ... *\/ (JSDoc) que comecam no
 * inicio da linha. O codigo fica igual, linha por linha (comentario no fim de uma linha de codigo e o
 * JSDoc de tipo no meio do codigo ficam). Seguro aqui porque nenhuma linha de template ou string do jogo
 * comeca por // ou /* (e uma linha de codigo JS nao comeca assim).
 * @param {string} t
 * @returns {string}
 */
function tirarComentarios(t) {
  const saida = [];
  let emBloco = false;
  for (const linha of t.split('\n')) {
    const s = linha.trim();
    if (emBloco) {
      const i = linha.indexOf('*/');
      if (i < 0) continue;
      emBloco = false;
      if (linha.slice(i + 2).trim()) saida.push(linha.slice(i + 2));
      continue;
    }
    if (s.startsWith('//')) continue;
    if (s.startsWith('/*')) {
      const fim = s.indexOf('*/', 2);
      if (fim < 0) { emBloco = true; continue; }
      if (fim === s.length - 2) continue;
    }
    saida.push(linha);
  }
  return saida.join('\n');
}

/**
 * Regras da Y8 (docs.y8.com: Game Requirements e Ad Placement Guidelines) que a build precisa cumprir.
 * @param {string} d @param {string} texto o index.html @param {string[]} todos
 * @returns {string[]} falhas
 */
function conferirY8(d, texto, todos) {
  const f = [];
  const head = texto.split(/<\/head>/i)[0];
  if (!head.includes(SCRIPT_Y8)) f.push('index.html sem a tag do SDK da Y8 (async, com onerror) no <head>');
  if (texto.split(SDK_Y8).length !== 2) f.push('index.html deve carregar o SDK da Y8 uma vez so');
  if (/poki/i.test(texto)) f.push('index.html ainda menciona a Poki');
  const iModulo = texto.search(/<script[^>]+type="module"/);
  if (iModulo >= 0 && texto.indexOf(SDK_Y8) > iModulo) f.push('o SDK deve vir antes dos scripts do jogo');
  const rels = todos.map((p) => relative(d, p));
  for (const r of ['src/core/plataforma.js', 'src/core/fila-sdk.js']) if (!rels.includes(r)) f.push(`falta ${r}`);
  const ids = (pacote.portais && pacote.portais.y8) || {};
  const plataforma = existsSync(join(d, 'src/core/plataforma.js')) ? readFileSync(join(d, 'src/core/plataforma.js'), 'utf8') : '';
  if (!plataforma.includes(`export const IDS = ${JSON.stringify({ appId: String(ids.appId || ''), gameId: String(ids.gameId || '') })};`)) f.push('src/core/plataforma.js sem os ids da Y8 gravados');
  for (const p of todos) {
    const r = relative(d, p);
    if (/(^|\/)poki\.js$|plataforma-sdk\.js$|y8\.min\.js$/.test(r)) f.push(`SDK ou wrapper de portal dentro da build: ${r}`);
    if (!/\.(html|js|css|txt)$/.test(p)) continue;
    const codigo = readFileSync(p, 'utf8');
    // nada de outro portal no zip da Y8, nem em comentario: SDK, script, nome ou identificador
    const outro = codigo.match(/poki|crazygames|californiagames|PlataformaSDK|plataforma-sdk/i);
    if (outro) f.push(`outro portal em ${r}: ${outro[0]}`);
    if (/movePill|openExternalLink|window\.open\s*\(|location\.(assign|replace)\s*\(|location\.href\s*=|<a\s[^>]*href=/i.test(codigo)) f.push(`${r} abre link ou recurso de fora`);
    if (/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket/.test(codigo)) f.push(`${r} faz pedido de rede (so o SDK da Y8 pode)`);
  }
  return f;
}
