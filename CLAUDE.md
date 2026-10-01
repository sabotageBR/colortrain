# Color Train

Puzzle de trens por cor para a Poki. Feito **só com HTML + JavaScript**: ES modules nativos, canvas 2D, WebAudio. Nada de Vite, Pixi, three, TypeScript ou bundler. O jogo publicado não tem dependência nenhuma, e as ferramentas usam só Node 18 e o Chrome.

## Regra do jogo
- Cada trilho é uma fila. A frente fica à esquerda, no sinal. O **bloco** da frente (todos os vagões seguidos da mesma cor) sai junto e engata no **fim** de outro trilho, se ele estiver vazio ou terminar na mesma cor.
- O engate é **tudo ou nada**: vagões da mesma cor encostados nunca se separam. Se o bloco não cabe inteiro no destino, a jogada não vale.
- Um trilho cheio com uma cor só é um trem pronto: trava, a locomotiva chega e o sinal fica verde. Com todos prontos, os trens partem juntos e o próximo nível chega pela direita, sem tela no meio.
- Entrada: toque-toque ou arraste. Ao arrastar aparece um fantasma no destino e os trilhos válidos brilham.
- Não existe derrota. Num beco sem saída pulsam desfazer, recomeçar e trilho extra.

## Estrutura
- `src/jogo/`: lógica pura (`regras.js`, `solucionador.js`, `curva.js`, `gerador.js`, `catalogo.js`). `niveis.js` é **gerado** por `npm run niveis` (150 níveis validados); depois do 150 o gerador com semente roda no navegador.
- `src/render/`:
  - `layout.js`: geometria pura (`LINHA = 0.96`, teto de L 110, `Wu` = largura útil sem a coluna de botões);
  - `pecas.js`: peças em **quase 3D** (projeção oblíqua `OX = 0.33`, `OY = -0.40`): vagão, locomotiva, sinal e mão, com a parte fixa em sprite e a carga desenhada por quadro;
  - `fisica.js`: física própria das cargas (sem biblioteca): molas amortecidas, impulsos, folga de engate. **Cada cor é um tipo de carga**: vermelho e azul tanques de vidro com líquido, amarelo areia, laranja laranjas, verde bambu, turquesa contêiner, roxo barris, rosa balões;
  - `cenario.js`: camada estática na mesma oblíqua (plataforma com espessura e marquise, estação com volume, horizonte em silhueta, marco, placa do pátio, trilhos com relevo);
  - `cena.js`: objetos visuais, tweens, partículas e a integração da física (aceleração por quadro, onda de compressão no engate, arranque com folga e locomotiva patinando);
  - `tema.js`: os **10 mundos** (campina, porto, deserto, serra, metropole, festa, inverno, tropico, outono, aurora), 15 níveis cada; `temaPorNivel`.
- `src/core/`:
  - `poki.js`: cópia do wrapper do carimbador, com fila e prazos;
  - `audio.js`: síntese de som;
  - `armazenamento.js`;
  - `depuracao.js`;
  - `rng.js`.
- `src/ui/`: HUD em pílulas brancas (coluna de botões à direita em toda paisagem, embaixo no retrato; `--acento` e `--placa` vêm do mundo), garagem e fontes Fredoka locais (OFL em `LICENCAS.txt`).
- `src/main.js` liga tudo.
- `modelos/`: os 5 protótipos da Fase 1, só como histórico. Não entram na build.

## Convenções
- Código e comentários em português, comentários em ASCII. 2 espaços, aspas simples, ponto e vírgula, `catch { /* ignora */ }`. JSDoc no lugar de tipos.
- Fronteiras vigiadas por `test/estilo.test.js`:
  - só `main.js` importa `poki.js`;
  - só `armazenamento.js` toca o `localStorage`;
  - só `depuracao.js` lê a URL;
  - `src/jogo/` não usa `Math.random`, DOM nem relógio;
  - sem `console.log`;
  - a única URL externa é o SDK da Poki.
- Animações usam **um relógio só** (`performance.now()`), o mesmo da agenda (`setTimeout`). O carimbo do `requestAnimationFrame` andava separado e dessincronizava a partida.
- Texto quase todo em ícones. EN é o padrão, com PT e ES em `src/i18n/textos.js`.
- Direção de arte (decidida em 2026-10-01): **peças com física em quase 3D**. O usuário rejeitou reskins e as pranchas de `docs/propostas/` (guardadas só como histórico, como `modelos/`); toda proposta visual vai como imagem ou protótipo jogável, nunca como descrição.

## Poki
- O SDK entra por uma tag síncrona no `<head>`, com o comentário "Unico script externo permitido pela Poki".
- `gameLoadingFinished` dispara quando o primeiro nível aparece. `gameplayStart` só em pointerdown ou clique real, inclusive depois de anúncio. `gameplayStop` na partida dos trens e ao abrir a garagem.
- `commercialBreak` acontece só na troca de nível, a partir da entrada do nível 6 (`NIVEIS_SEM_INTERVALO = 5`), sem cooldown próprio.
- Rewarded (dica, trilho extra, liberar locomotiva) só por escolha do jogador, e o prêmio só vale com `=== true`. Sem SDK os botões de vídeo somem. No localhost o prêmio é liberado para testes.
- O som fica mudo antes do anúncio e quando a aba fica oculta.
- Os nomes de telemetria ficam fixos: `measure('level', N, 'start'|'complete')`.

## Comandos
- `npm test`: testes do node (regras, níveis, wrapper, estilo).
- `npm run servir`: servidor em http://127.0.0.1:5340/. Parâmetros locais: `?nivel=12&tema=festa&auto=300&fixo&semanuncio&garagem` (temas: campina, porto, deserto, serra, metropole, festa, inverno, tropico, outono, aurora).
- `tools/vitrine-pecas.html`: as 8 cargas em repouso e em movimento, mais a locomotiva (`?tema=`).
- `npm run sdkcheck`: banco do SDK falso (`tools/sdkcheck.html`) nos cenários normal, recusa, bloqueado, pendente e lsquebrado.
- `npm run poki`: testes, depois `dist/`, verificação, zip em `dist-poki/color-train-<versao>.zip`, o sdkcheck sobre a build e os prints nos tamanhos de iframe da Poki.
- Rode um Chrome headless por vez. Use `spawn` assíncrono nas ferramentas, porque o servidor delas roda no mesmo processo.

## Por que não é clone (catálogo consultado em 2026-10-01)
- **Na Poki:** os jogos de trem têm outras mecânicas (Train Master é tipo snake, Mini Train conserta trilhos, Pixel Express é de rotas). Os sort puzzles (Woody Sort, Family Sort) são de pilha, sem trem.
- **Nas lojas de app** já existem "Color Train Sort Puzzle", "Color Train Sort" e "Rail Frenzy: Color Sort Puzzle", que juntam vagões por cor. Diferenciais nossos:
  - a regra de fila (sai pela frente, engata atrás), quando o gênero é quase todo de pilha;
  - o engate em bloco tudo ou nada;
  - a partida dos trens como recompensa, sem tela entre níveis;
  - a coleção de locomotivas.
- **Risco aberto:** o nome "Color Train" quase coincide com esses apps. Vale avaliar outro nome antes de publicar.
