# Mini games — decisões e checklist

Ideia do dono do jogo: ao completar o Peitoral (ou ao longo dele), liberar um **outro modo de jogo** com mini games que usam os
personagens, cenários e versículos que o app já tem. Vale também para a próxima campanha.

## Regras que já valem (CLAUDE.md)

- Toda lista tem `Pagination`; nada com a cara do navegador; carregamento com `Spinner`; tokens de tema; mobile primeiro.
- Como no Tabuleiro e no Duelo: o modo **não mexe** no ranking, nas missões nem nas estatísticas das perguntas. Prêmio pequeno e limitado por dia.
- Regra pura do mini game em arquivo sem dependências (testável), como `board/` e `duel/`.

## Como liberar (decidido)

**Cada pedra libera um ou dois mini games** (17 jogos no catálogo, todos jogáveis). Pedra 1: caça-palavras e anagrama · 2: forca e antigo ou novo · 3: quebra-cabeça e
livros em ordem · 4: memória e relâmpago · 5: versículo em pedaços e complete o versículo · 6: quem sou eu? · 7: labirinto · 8: linha do tempo · 9: palavras cruzadas · 10: mapa bíblico · 11: árvore genealógica · 12: interconexão. O **administrador** vê todos liberados em Painel → Testar mini games. O **Peitoral Completo** libera o **ranking semanal** dos mini games e a
entrada na **Galeria dos Peitorais**. **Mini games não dão XP.** Sem baú no final.

## Os jogos

| Jogo | Como funciona | O que precisa de dado novo |
|---|---|---|
| Caça-palavras | Grade gerada com nomes de personagens/lugares do tema escolhido; tempo e dicas. | Nada (usa os nomes). |
| Forca | Palavra = personagem, lugar ou livro; dica = descrição da figurinha. | Nada. |
| Quebra-cabeça | Peças da figurinha, do mapa do cenário ou da arte do álbum; 9/16/25 peças. | Nada (a arte já existe). |
| Labirinto | Labirinto gerado; em cada bifurcação uma pergunta decide o caminho certo. | Nada (usa as perguntas). |
| Quem sou eu? | Dicas que aparecem uma a uma; menos dicas = mais pontos. | Dicas por personagem (a descrição serve no começo). |
| Memória | Pares: personagem ↔ feito, lugar ↔ versículo. | Nada. |
| Complete o versículo | Lacunas para preencher com palavras embaralhadas. | Nada (versículos dos cenários e das perguntas). |
| Versículo embaralhado | Ordenar as palavras do versículo. | Nada. |
| Quem disse isso? | Uma frase ou versículo; escolher o personagem. | Fala por personagem. |
| Linha do tempo | Chegam personagens/cenários aleatórios na mão; encaixar na linha; quanto mais perto da posição certa, mais pontos. | Ordem cronológica (campo novo em personagem e cenário). |
| Mapa | Posicionar o cenário num mapa; pontos pela proximidade. | Coordenadas por cenário. |
| Árvore genealógica | Montar a linhagem (Adão → Noé → Abraão → Davi → Jesus). | Pai/mãe por personagem. |
| Interconexão | Ligar duas figurinhas por uma corrente de relações (Isaías profetizou a Ezequias, Ezequias governou Jerusalém, Jesus pregou em Jerusalém); menos elos = mais pontos. | Grafo de relações (tabela nova, o maior trabalho de conteúdo). |
| Palavras cruzadas | Grade gerada com as dicas das figurinhas. | Dica curta por personagem. |
| Pescaria | Arcade: pescar só os peixes certos no mar da Galileia (reflexo). | Nada. |
| Torre de Babel | Arcade de empilhar blocos no tempo certo. | Nada. |

## Ordem sugerida

1. **Base:** hub do modo, liberação, desafio diário (1 por dia), prêmio limitado, ranking semanal só do modo.
2. **Sem conteúdo novo:** caça-palavras, forca, quebra-cabeça, memória, versículo embaralhado/complete o versículo, labirinto com perguntas.
3. **Com campo novo no painel:** linha do tempo (cronologia), mapa (coordenadas), quem sou eu (dicas), árvore genealógica.
4. **Com grafo de relações:** interconexão e palavras cruzadas.

## Recompensas do final do Peitoral (além do que já dá)

Decidido: 2.000 moedas, brasão, moldura, ranking semanal dos mini games e Galeria dos Peitorais (sem baú). Ideias ainda abertas: título "Sumo Sacerdote";
fundo de perfil; Galeria dos Peitorais (quem completou, e quando); baú temático; figurinha lendária do Arão (nunca `SPECIAL`, que é só de Jesus);
liberar o hub de mini games. Evitar bônus permanente de moedas (mexe na economia).

## Checklist

- [x] Base: catálogo e liberação por pedra, ranking semanal (tabela `mini_game_scores`, só quem completou o Peitoral), Galeria dos Peitorais, telas (cartão na aba Jogar,
  Jogos/Ranking/Galeria), capa `MINIGAMES` no painel.
- [x] Prêmio: pontos no ranking semanal e 10 moedas na 1ª vitória do dia em cada jogo (até 3 jogos por dia).
- [x] Jogos sem conteúdo novo: caça-palavras, forca, quebra-cabeça (3 × 3, trocar peças), memória (cenário ↔ referência), versículo em pedaços (ordenar), labirinto (sem perguntas ainda).
- [x] Mais 6 jogos sem conteúdo novo: anagrama (3 tentativas), antigo ou novo (10 itens), livros em ordem (6 livros), relâmpago (verdadeiro ou falso das perguntas do quiz), complete o versículo (3 lacunas), quem sou eu? (dicas uma a uma com os campos do personagem).
- [x] Painel → Testar mini games: o administrador joga todos, com tudo liberado.
- [ ] (Pendente) Versículo: variante com lacunas já feita à parte. Labirinto: perguntas nas bifurcações. Memória: pares personagem ↔ figurinha.
- [ ] Jogos com campo novo no painel: quem sou eu (dicas), linha do tempo (cronologia), mapa (coordenadas), árvore genealógica (pai/mãe).
- [ ] Jogos com grafo de relações: interconexão e palavras cruzadas.
- [x] Os 5 últimos: linha do tempo (26 acontecimentos com datas aproximadas, 6 por partida), mapa bíblico (26 lugares com coordenadas, toque no mapa; vale a distância), árvore genealógica (ligar pai e filho, Gn 5 / Mt 1), interconexão (grafo de ~50 relações; ligar dois nomes a 3 ou 4 passos) e palavras cruzadas (gerada com nomes e descrições).
  Os dados são fixos no código (`backend/src/minigames/{timeline,places,lineage,graph}.ts`) e o mapa é um desenho simplificado (`frontend/src/lib/map-shapes.ts`).
- [ ] Melhorias, jogo a jogo: datas/lugares/relações editáveis no painel; mapa com imagem enviada; perguntas no labirinto; figurinhas no quebra-cabeça; pares personagem ↔ figurinha na memória.

## Enriquecimento jogo a jogo (padrão)

Cada mini game passa por: lógica (dificuldade, pontuação, variedade), UX/UI (tela de preparo, retorno visual), imagens que o app já tem (retratos de personagens e mapas de cenários),
sons próprios (`lib/sound/sfx.ts`, nomes `ws*` etc.) e imagens do painel. Padrão técnico:

- **Tela de preparo** opcional: `setup` na `MiniGameFrame`; as escolhas vão no corpo de `POST /minigames/:jogo/start` e o servidor valida. "Jogar de novo" repete as escolhas; "Mudar dificuldade" volta ao preparo.
- **Imagens por jogo** (Painel → Visual dos mini games, tabela `mini_game_designs`): capa do cartão 16:9 (1600 × 900) e fundo da tela de jogo 9:16 (1080 × 1920). Vêm em `/minigames` (`coverUrl`, `backgroundUrl`).
- **Gabarito depois do fim**: o `Outcome.reveal` do servidor vai ao resultado (ex.: onde estavam as palavras que faltaram).
- **Pontuação**: máximo de 1.000 por partida (700 precisão + 300 tempo) vezes o fator da dificuldade, para o ranking premiar quem joga o difícil.

### Caça-palavras (feito)

- Dificuldades: fácil (5 palavras, 8×8, → ↓, bônus até 1:10, vale até 600) · médio (7, 10×10, + diagonais, 2:00, até 800) · difícil (10, 12×12 ou mais, 8 direções, 3:30, até 1.000). A grade cresce até 14×14 conforme as letras.
- Palavras: personagens (nome inteiro e cada nome de um composto), lugares da campanha e os 66 livros da Bíblia; temas: mistura, Antigo, Novo, lugares, livros. As palavras das últimas 8 partidas do jogador (guardadas por 2 dias) ficam por último no sorteio.
- Dicas: até 3 por partida (`/act` com `hint`), mostram a primeira letra; cada uma desconta 40 pontos (antes do fator). Sem dica de graça no cliente: o servidor guarda as posições.
- Interação: arrastar (encaixa nas 8 direções) ou tocar na primeira e na última letra; teclado com setas + Enter. Cores diferentes por palavra achada; ao desistir/terminar, as que faltaram aparecem em vermelho, uma a uma.
- Sons: pegar a letra, tique que sobe um semitom por letra arrastada, achou, errou, dica, vitória, fim sem sucesso, palavras reveladas.
- [ ] (Depois) Música de fundo própria do modo; mais sons nos demais jogos; dicas por imagem (retrato borrado → nítido).

### Anagrama (feito)

- Preparo: dificuldade (fácil 4–6 letras e retrato borrado · médio 5–8 e retrato bem borrado · difícil 7–11 e sem retrato; vale 60% / 80% / 100%), turnos (3, 5, 8 ou 10 nomes) e tempo por nome opcional (20, 30, 45, 60 ou 90 s). Sem tempo, cada nome vale 85%.
- Cada turno é um nome com 3 tentativas; a fatia de 1.000 pontos do turno vai 70% pelas tentativas (1ª: 100%, 2ª: 60%, 3ª: 30%) e 30% pela rapidez (`par` = 3 s por letra). Vence a partida quem acerta metade dos nomes ou mais.
- Servidor (`/act`): `check`, `skip`, `timeout` e `begin` (o relógio do nome só corre depois do `begin`, para o jogador ver o resultado sem perder tempo); o tempo vence no servidor com 3 s de folga. As palavras das últimas 8 partidas ficam por último no sorteio.
- Dicas sem HTML: `plainText` (`minigames/common.ts`) limpa tags e entidades dos textos do painel antes de virarem dica (vale para forca, cruzadas e quem sou eu?).
- Sons próprios (`an*`); teclado no computador (letras, Backspace, Enter); retrato do personagem/lugar se revela ao acertar.

### Seção A — Forca, Antigo ou Novo?, Livros em ordem (feito)

Base compartilhada: `backend/src/minigames/turns.ts` (dificuldade, fator 60/80/100%, relógio por turno conferido no servidor com folga de 3 s, `begin` para o tempo não correr no resultado) e, no app, `games/turn-kit.tsx` (preparo, bolinhas de turnos, barra de tempo, cartão de resultado, `useTurnAct`). Os jogos em turnos passam por `TURN_GAMES` em `services/minigame-play.ts` (`POST /runs/:id/act` com `action`: `guess`, `reveal`, `classify`, `order`, `skip`, `timeout`, `begin`...). O eventos voltam em `turn`.

- **Forca**: fácil (3–6 letras, 8 vidas, 2 dicas de letra, retrato que clareia a cada acerto) · médio (5–9, 6 vidas) · difícil (7–14, 5 vidas, 1 dica, sem retrato). 1, 3 ou 5 palavras; tempo por palavra opcional (30–120 s). Letra revelada desconta 15% do turno.
- **Antigo ou Novo?**: fácil (livros conhecidos) · médio (66 livros) · difícil (livros menos conhecidos); 40% personagens. 10, 15 ou 20 itens; tempo por item opcional (5–15 s). O servidor confere cada resposta e devolve o certo (e o retrato do personagem); sequência de acertos; vence com 80%.
- **Livros em ordem**: fácil (4 livros espalhados, com AT/NT) · médio (6) · difícil (8 próximos). 1, 3 ou 5 conjuntos; tempo opcional (30–180 s). Ao conferir mostra a ordem certa e onde errou.

### Seção B — Relâmpago, Versículo em pedaços, Complete o versículo (feito)

Mesmo molde da seção A (turnos via `act`, preparo, `turns.ts`).

- **Relâmpago**: a dificuldade escolhe a dificuldade das perguntas do quiz (fácil: EASY · médio: MEDIUM+EASY · difícil: HARD/VERY_HARD; completa com outras se faltar). 10, 15 ou 20 afirmações; tempo por afirmação opcional (8–20 s). Cada julgamento é conferido no servidor (`judge`) e volta com a explicação e a referência da pergunta; sequência de acertos; vence com 80%.
- **Versículo em pedaços**: fácil (6–11 palavras, 3 dicas) · médio (9–16, 2) · difícil (14–22, 1). 1, 3 ou 5 versículos; tempo opcional (30–180 s). A ordem não vai mais para a tela: cada toque (`tap`) é conferido; `hint` destaca a próxima ficha (−12%), erro −8%. Ao terminar mostra o versículo, o cenário e a imagem do mapa.
- **Complete o versículo**: fácil (2 lacunas, 2 enfeites) · médio (3, 3) · difícil (4 lacunas, 5 enfeites de tamanho parecido, versículos longos). 1, 3 ou 5 versículos; tempo opcional (30–120 s). Uma tentativa por versículo (`fill`); ao conferir mostra o que acertou, o que digitou e o versículo inteiro.

### Seção C — Quem sou eu?, Palavras cruzadas (feito)

- **Quem sou eu?** em turnos: fácil (3 nomes, abre com 2 dicas) · médio (4 nomes, 1 dica) · difícil (6 nomes parecidos do mesmo Testamento, 1 dica). 1, 3 ou 5 personagens; tempo por personagem opcional (30–120 s). Cada dica extra tira 15% dos pontos do turno (mínimo 40% de precisão); uma resposta por turno. **No fim de cada turno aparece a foto do personagem e o resumo.** A foto só vem no `end` (nunca no puzzle).
- **Palavras cruzadas**: fácil (5 palavras, grade até 9×9, 3 conferências, 5 letras reveladas) · médio (7, 11×11, 3, 4) · difícil (10, 13×13, nomes de 4 a 11 letras, 2, 3). Tempo total opcional (3, 5, 8 ou 10 min); ao zerar envia o que está preenchido. Ajudas contadas no servidor: `verify` (marca as erradas, −50) e `peek` (revela uma letra, −30). No fim aparecem os nomes com a foto (`reveal`).
- Fator de pontos dos níveis em todos os jogos: 60% / 80% / 100% de 1.000.

### Seção D — Quebra-cabeça e Memória (feito)

Os dois ganham o nível **Mestre** além de fácil/médio/difícil (`SizeLevel` em `turns.ts`, fatores 60 / 80 / 90 / 100%) e usam as imagens do álbum e da campanha.

- **Quebra-cabeça**: 9 (3×3) · 16 · 25 · 36 peças. Imagem = retrato de personagem, mapa de cenário ou os dois (`kind`: `personagens` | `cenarios` | `mix`); os já usados nas últimas partidas ficam por último. Fácil mostra números e a imagem sempre; os outros têm espiadas limitadas e com custo (`reference`: −30/−50/−70); **dica "colocar uma peça"** (`hint` com as trocas já feitas; o servidor refaz a ordem, devolve a troca e desconta 40). Tempo total opcional (2–15 min). Toque ou arraste uma peça sobre a outra. Montou: até 700 por trocas (mínimo = pontos cheios) + 300 de rapidez; não montou: só as peças que o jogador pôs no lugar (até 250). No fim aparece a imagem inteira, o nome e o resumo (`reveal`).
- **Memória**: 6 · 8 · 12 · 18 pares (12 a 36 cartas, 3/4/4/6 colunas). Pares de imagens iguais (a mesma foto/mapa duas vezes; o nome aparece ao achar o par). Tipos: personagens, cenários e mistura (o par cenário ↔ referência bíblica saiu). Prévia de 4/3/2/2 s com todas as cartas viradas. Tempo total opcional (1,5–6 min). Sequência de pares, nome do par ao achar; sem achar todos, vale só os pares (até 250).
- Memória e quebra-cabeça seguem como jogos de informação aberta (o baralho/ordem vai à tela, o servidor confere o resultado); o prêmio continua pequeno e limitado.

- **Verso das cartas da Memória**: Painel → Visual dos mini games → Memória → "Verso das cartas" (3:4, 768 × 1024 px; coluna `mini_game_designs.back_url`). Sem imagem, usa o ✦ desenhado por código.
