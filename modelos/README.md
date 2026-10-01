# Color Train — 5 modelos jogáveis

Abra `modelos/index.html` direto no navegador. Funciona por `file://` e também no celular, se a pasta for servida na rede local. Cada aba é um modelo com 6 níveis:
- **1–2:** tutorial com a mão animada;
- **3–4:** mais trilhos e cores;
- **5–6:** vagões grudados (moldura dourada com corrente).

Do nível 7 em diante a geração continua sem fim e fica mais difícil, para sentir a curva.

O que vale para todos os modelos:
- Toque num trilho e depois em outro, ou arraste de um para o outro.
- Trem de uma cor completo: o trilho fica dourado, a locomotiva chega, o farol acende e ela apita.
- Quando todos estão prontos, os trens partem e o próximo nível chega sem tela intermediária.
- Desfazer e recomeçar são livres. 💡 mostra a próxima jogada. ⏩ pula o nível.

Arquivos:
- `motor.js`: regras, gerador e solucionador, puros. Testes em `test/modelos.test.js` (`npm test`).
- `index.html`: canvas 2D desenhado em código e sons WebAudio. Nenhum asset.
- `prints/`: retrato 390×844 e paisagem 1280×720 de cada modelo, mais as folhas de comparação.

Parâmetros de URL para teste:
- `#m=3&n=5`: abre o modelo 3 no nível 5;
- `&fixo`: sem animação de chegada nem banner;
- `&auto=400`: joga a solução sozinho.

## Comparação para a Poki

| # | Modelo | Regra | A favor | Contra |
|---|---|---|---|---|
| 1 | **Fila** | O vagão da frente (seta) sai e engata no fim de outro trem | Regra rara no gênero, o que é um diferencial contra clones de ball sort e water sort. Fiel ao protótipo. A ficção do trem é coerente: sai pela frente, engata atrás | FIFO pede um "clique" mental a mais que a pilha. O nível 1 força a ordem certa para ensinar |
| 2 | **Ponta de linha** | Só o vagão junto à agulha sai, e entra pela mesma ponta | A regra mais familiar (ball sort), com o onboarding mais rápido. Agulha e para-choque deixam a regra legível | O mais parecido com os sort puzzles que a Poki já tem. Corre o risco de "overlaps too much", com o tema como único diferencial |
| 3 | **Giradouro** | O vagão só gira para os trilhos vizinhos | O visual mais marcante (ótimo para thumb). Planejamento espacial novo | Vagões pequenos no celular em retrato. A regra de vizinhos endurece rápido, e "puzzle complexo demais" é um risco listado no cofre |
| 4 | **Plataforma** | Trem completo vai para a plataforma e libera o trilho; vagões novos chegam por uma linha | Muitas recompensas por nível (cada trem parte). A linha de chegada cria antecipação, como os hits tipo Bus Jam | Duas zonas de toque e mais informação na tela. É o mais difícil de ensinar sem texto |
| 5 | **Engate em bloco** | Toda a sequência da mesma cor da frente sai junta (quantos couberem) | Continua FIFO (diferencial), com menos toques e jogadas grandes e satisfatórias. Trens mais longos | Se a curva não subir, o nível acaba rápido. "Quantos couberem" pode se confundir com os grudados (tudo ou nada) |
