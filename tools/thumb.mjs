// Renderiza as opcoes de thumb (tools/thumb.html) em 1256 e 628 px.
// Saida: marketing/thumb/opcoes/<opcao>-<tamanho>.png
// Uso: node tools/thumb.mjs [opcoes...]   (padrao: a b c)
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servir, RAIZ } from './servir.mjs';

function chrome(args, ms) {
  return new Promise((ok) => {
    const p = spawn('google-chrome', args, { stdio: 'ignore' });
    const t = setTimeout(() => p.kill('SIGKILL'), ms);
    p.on('close', () => { clearTimeout(t); ok(); });
  });
}

const opcoes = process.argv.slice(2).length ? process.argv.slice(2) : ['a', 'b', 'c'];
const porta = 4343;
const fechar = await servir(porta);
const dir = join(RAIZ, 'marketing/thumb/opcoes');
mkdirSync(dir, { recursive: true });
for (const o of opcoes) {
  for (const s of [1256, 628]) {
    const perfil = mkdtempSync(join(tmpdir(), 'ct-thumb-'));
    const arq = join(dir, `${o}-${s}.png`);
    await chrome(['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${perfil}`, `--window-size=${s},${s}`, '--virtual-time-budget=2000', `--screenshot=${arq}`,
      `http://127.0.0.1:${porta}/tools/thumb.html?opcao=${o}&s=${s}`], 90000);
    rmSync(perfil, { recursive: true, force: true });
    process.stdout.write(`thumb ${o} ${s} -> marketing/thumb/opcoes/${o}-${s}.png\n`);
  }
}
await fechar();
