// Roda tools/sdkcheck.html no Chrome headless para cada cenario do SDK.
// Sobe o proprio servidor (porta 4341). Uso: node tools/sdkcheck.mjs [raiz]
//   raiz: '' testa o fonte; 'dist/' testa a build que vai para a Poki.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servir } from './servir.mjs';

/** Chrome sem travar o processo (o servidor deste mesmo processo precisa responder). */
function chrome(args, ms) {
  return new Promise((ok) => {
    const p = spawn('google-chrome', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), ms);
    p.on('close', () => { clearTimeout(t); ok(out); });
  });
}

const raiz = process.argv[2] || '';
const porta = 4341;
const fechar = await servir(porta);
const cenarios = ['normal', 'recusa', 'bloqueado', 'pendente', 'lsquebrado'];
let ok = true;
for (const c of cenarios) {
  const perfil = mkdtempSync(join(tmpdir(), 'ct-sdk-'));
  const stdout = await chrome([
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--host-resolver-rules=MAP game-cdn.poki.com 127.0.0.1:9',
    `--user-data-dir=${perfil}`, '--window-size=420,900', '--virtual-time-budget=30000',
    '--dump-dom', `http://127.0.0.1:${porta}/tools/sdkcheck.html?cenario=${c}&raiz=${encodeURIComponent(raiz)}`,
  ], 120000);
  rmSync(perfil, { recursive: true, force: true });
  const texto = (stdout || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const m = /RESULTADO (\{.*\})/.exec(texto);
  if (!m) {
    ok = false;
    process.stdout.write(`${c.padEnd(11)} SEM RESULTADO (o banco nao terminou)\n`);
    continue;
  }
  const res = JSON.parse(m[1]);
  ok = ok && res.passou;
  process.stdout.write(`${c.padEnd(11)} ${res.passou ? 'passou' : 'FALHOU: ' + res.falhas.join(' | ')}\n`);
  if (!res.passou || process.env.LOG) process.stdout.write('  ' + res.log.map((l) => l.slice(1).join(':')).join(' ') + '\n');
}
await fechar();
process.exit(ok ? 0 : 1);
