// Gera src/jogo/niveis.js com os 150 primeiros niveis ja validados pelo
// solucionador. Uso: node tools/gerar-niveis.mjs [quantidade]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gerarNivel } from '../src/jogo/gerador.js';

const total = Number(process.argv[2]) || 150;
const linhas = [];
const inicio = Date.now();
let pior = 0;
for (let n = 1; n <= total; n++) {
  const t0 = Date.now();
  const d = gerarNivel(n);
  pior = Math.max(pior, Date.now() - t0);
  linhas.push(`  [${d.cap}, '${d.t.join('|')}', ${d.jogadas}],`);
}
const destino = fileURLToPath(new URL('../src/jogo/niveis.js', import.meta.url));
writeFileSync(destino, `// Gerado por tools/gerar-niveis.mjs. Nao editar a mao.
// [vagoes por trem, trilhos separados por '|' (indice 0 = frente), jogadas da solucao]
export const NIVEIS = [
${linhas.join('\n')}
];
`);
process.stdout.write(`${total} niveis em ${Date.now() - inicio} ms (pior ${pior} ms) -> src/jogo/niveis.js\n`);
