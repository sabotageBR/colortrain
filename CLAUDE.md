# Color Train

Puzzle de trens por cor para a Poki. Feito **só com HTML + JavaScript**: ES modules nativos, canvas 2D, WebAudio. Nada de Vite, Pixi, three, TypeScript ou bundler. O jogo publicado não tem dependência nenhuma, e as ferramentas usam só Node 18 e o Chrome.

## Regra do jogo ("boca do trilho", desde a 1.2.0)
- Cada trilho é um desvio sem saída: os vagões ficam encostados no para-choque, à direita, e a **boca** fica à esquerda, no sinal. O **bloco** da boca (todos os vagões seguidos da mesma cor) sai junto e entra pela boca de outro trilho, se ele estiver vazio ou se a frente dele for da mesma cor. Até a 1.1.0 era uma fila (engatava no fim); os playtests mostraram que os jogadores tentavam casar com a frente, e a regra mudou.
- O engate é **tudo ou nada**: vagões da mesma cor encostados nunca se separam. Se o bloco não cabe inteiro no destino, a jogada não vale.
- Um trilho cheio com uma cor só é um trem pronto: trava, a locomotiva chega e o sinal fica verde. Com todos prontos, os trens partem juntos e o próximo nível chega pela direita, sem tela no meio. Um toque durante a partida adianta a troca.
- Entrada: toque-toque ou arraste. Ao arrastar aparece um fantasma na boca do destino, os trilhos válidos brilham e soltar perto de um destino válido engata nele (ímã). Com um bloco na mão, tocar outro trilho de cor diferente troca a seleção.
- Jogada recusada mostra o motivo: ✗ na boca de cor diferente, ou a sobra do bloco em vermelho quando falta vaga. As vagas livres aparecem tracejadas.
- Não existe derrota. Num beco sem saída (provado pelo solucionador a cada jogada) aparece o botão "voltar" com quantas jogadas desfazer até o último estado com solução; parado 5 s, o jogo volta sozinho e mostra a mão. A dica nunca cobra sem entregar: no beco, ela volta primeiro.
- Níveis 1 a 3 são de ensino, com jogada guiada (`TUTORIAL` em `curva.js`): só os trilhos do passo aceitam toque e dica, extra e recomeçar ficam escondidos. A mão volta de graça depois de 4 s parado até o nível 6 e de 20 s até o 15.
- Recomeçar entra no histórico: desfazer traz o progresso de volta.

## Estrutura
- `src/jogo/`: lógica pura.
  - `regras.js`: `pode`, `mover` e `motivo` (por que a jogada não vale: `cor`, `cap`, `travado`...).
  - `solucionador.js`: `analisar` (resolve, morto ou incerto; o jogo chama a cada jogada com orçamento de 4000), `explorar` (grafo completo e estados mortos) e `riscoBeco` (chance de quem toca ao acaso cair num beco).
  - `curva.js`: `TUTORIAL` (3 níveis guiados), `parametros` (trem de 3 até o nível 6, de 4 depois; `semBeco` até o 12, `riscoMax` 0,15 até o 40 e 0,25 até o 150) e `limiarMao`.
  - `gerador.js` e `catalogo.js`. `niveis.js` é **gerado** por `npm run niveis` (150 níveis validados, cerca de 1 min); depois do 150 o gerador com semente roda no navegador, sem filtro de becos.
- `src/render/`:
  - `layout.js`: geometria pura (teto de L 110, `Wu` = largura útil sem a coluna de botões). `vaga(cap,k,j)` põe os vagões encostados no para-choque. No retrato a distância entre trilhos (`linha`) cresce de 0,96 até 1,6 L para usar a altura. `trilhoProximo` é o ímã do arraste;
  - `pecas.js`: peças em **quase 3D** (projeção oblíqua `OX = 0.33`, `OY = -0.40`): vagão, locomotiva, sinal e mão, com a parte fixa em sprite e a carga desenhada por quadro;
  - `fisica.js`: física própria das cargas (sem biblioteca): molas amortecidas, impulsos, folga de engate. **Cada cor é um tipo de carga**: vermelho e azul tanques de vidro com líquido, amarelo areia, laranja laranjas, verde bambu, turquesa contêiner, roxo barris, rosa balões;
  - `cenario.js`: camada estática na mesma oblíqua (plataforma com espessura e marquise, estação com volume, horizonte em silhueta, marco, placa do pátio, trilhos com relevo);
  - `cena.js`: objetos visuais, tweens, partículas e a integração da física (aceleração por quadro, onda de compressão no engate, arranque com folga e locomotiva patinando);
  - `tema.js`: os **10 mundos** (campina, porto, deserto, serra, metropole, festa, inverno, tropico, outono, aurora), curtos no começo e crescendo (`INICIO_MUNDOS = [1, 6, 13, 22, 33, 46, 61, 78, 97, 118]`; depois do 150, ciclos de 15). Um cartão anuncia o mundo novo; `temaPorNivel`, `mundoPorNivel`.
- `src/core/`:
  - `poki.js`: cópia do wrapper do carimbador, com fila e prazos;
  - `audio.js`: síntese de som e música de fundo (laço pentatônico, a tônica muda por mundo);
  - `telemetria.js`: eventos extras sobre o `measure` (recebido por injeção), com lista fixa e um envio por nível;
  - `armazenamento.js`;
  - `depuracao.js`;
  - `rng.js`.
- `src/ui/`: HUD em pílulas brancas (coluna de botões à direita em toda paisagem, embaixo no retrato; `--acento` e `--placa` vêm do mundo), garagem e fontes Fredoka locais (OFL em `LICENCAS.txt`). Recomeçar fica no topo, ao lado do som, longe do desfazer. A placa mostra o nível e a meta: segmentos até a próxima locomotiva e a cara dela. A garagem libera uma locomotiva ao completar o nível 3 e depois a cada 4 (`liberadas`, `progressoLoco`).
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
- `commercialBreak` acontece só na troca de nível e só depois de 3 min de jogo contados do primeiro toque (`MS_SEM_INTERVALO`), sem cooldown próprio. A recompensa de locomotiva nova aparece depois do anúncio, nunca junto.
- Rewarded (dica, trilho extra, liberar locomotiva) só por escolha do jogador, e o prêmio só vale com `=== true`. A dica calcula a jogada antes de pedir o vídeo: sem jogada a mostrar, não cobra. Sem SDK os botões de vídeo somem. No localhost o prêmio é liberado para testes.
- O som fica mudo antes do anúncio e quando a aba fica oculta.
- Os nomes de telemetria ficam fixos: `measure('level', N, 'start'|'complete')` e, por `telemetria.js` (no máximo um envio por nível para cada par): `stuck` (dead, button, auto), `invalid` (color, capacity), `undo` (manual), `restart` (manual, undone), `hint` (free, ad), `extra` (ad), `tutorial` (wrong, hand, done).

## Comandos
- `npm test`: testes do node (regras, solucionador, níveis, layout, temas, garagem, telemetria, wrapper, estilo).
- `npm run servir`: servidor em http://127.0.0.1:5340/. Parâmetros locais: `?nivel=12&tema=festa&auto=300&fixo&semanuncio&garagem` (temas: campina, porto, deserto, serra, metropole, festa, inverno, tropico, outono, aurora), `?tabuleiro=3:AF|AA|FF` (carrega um tabuleiro; índice 0 = boca) e `?intervalo=10` (primeiro anúncio depois de 10 s de jogo).
- `tools/vitrine-pecas.html`: as 8 cargas em repouso e em movimento, mais a locomotiva (`?tema=`).
- `node tools/thumb.mjs`: thumbs da Poki (`tools/thumb.html`) em 1256 e 628, nas opções a, b e c em `marketing/thumb/opcoes/`. A oficial (`marketing/thumb/color-train-*`) é a b, e o JPG sai com `convert -quality 90`. A thumb mostra o puzzle (bloco no ar, destino com fantasma, trem pronto), não só um trem. `node tools/thumb.mjs modelo-1 modelo-2` gera as thumbs em estilo ícone (`tools/thumb-icone.html`), feitas a partir dos modelos do usuário: trem cartum em 3D projetado, cena sangrada e sem moldura.
- `npm run sdkcheck`: banco do SDK falso (`tools/sdkcheck.html`) nos cenários normal, recusa, bloqueado, pendente e lsquebrado.
- `npm run poki`: testes, depois `dist/`, verificação, zip em `dist-poki/color-train-<versao>.zip`, o sdkcheck sobre a build e os prints nos tamanhos de iframe da Poki.
- Rode um Chrome headless por vez. Use `spawn` assíncrono nas ferramentas, porque o servidor delas roda no mesmo processo.

## Por que não é clone (catálogo consultado em 2026-10-01)
- **Na Poki:** os jogos de trem têm outras mecânicas (Train Master é tipo snake, Mini Train conserta trilhos, Pixel Express é de rotas). Os sort puzzles (Woody Sort, Family Sort) são de pilha, sem trem.
- **Nas lojas de app** já existem "Color Train Sort Puzzle", "Color Train Sort" e "Rail Frenzy: Color Sort Puzzle", que juntam vagões por cor. Diferenciais nossos:
  - o engate em bloco tudo ou nada (o water sort derrama o que cabe; o ball sort move um por vez);
  - a física das cargas em quase 3D;
  - a partida dos trens como recompensa, sem tela entre níveis;
  - a coleção de locomotivas.
- **Riscos abertos:**
  - o nome "Color Train" quase coincide com esses apps. Vale avaliar outro nome antes de publicar;
  - desde a 1.2.0 a regra é uma pilha (entra e sai pela boca), como no gênero. A regra de fila saiu porque os jogadores não a entendiam (Player Fit Test da 1.1.0: média de 1m52s, 29% a 34% de abandono no meio dos níveis 2 a 5). `modelos/README.md` já apontava a pilha como parecida demais com os sort puzzles da Poki.
