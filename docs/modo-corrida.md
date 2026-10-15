# Modo Corrida — proposta e checklist

Auto-runner bíblico de um toque, no estilo **G-Switch** e **Geometry Dash**. Modo **próprio** na aba Jogar (como Quiz, Tabuleiro e Duelo),
**não** é mini game. Atualize o checklist a cada etapa.

## Decisões já tomadas

- Jeitos de jogar: **campanha solo**, **treino**, **local (até 4 na mesma tela)** e **online (até 4 jogadores)**; bots podem completar as vagas
  no local e no online.
- Cada **fase é uma história bíblica**, com **música própria por cenário**.
- Cada **personagem tem sprites próprios e sons próprios** (arte do modo, separada das figurinhas do álbum).
- **Recompensas só do próprio modo**: personagens (e aparências) que se desbloqueiam, principalmente pela campanha solo. Nada de XP, moedas,
  figurinhas, ranking geral, missões ou estatísticas de perguntas.
- Mesmo molde do Tabuleiro e do Duelo: motor puro, estado serializável, sorteio com semente.

- **Nome:** Corrida. **Padrão de controles:** confirmado (abaixo). **Desbloqueio:** personagens se abrem **por fase concluída**, na campanha solo,
  no estilo da campanha do Quiz (vai passando de fase em fase e abrindo coisas).

## Padrão de jogo (confirmado)

- **Um único controle**: toque; segurar quando a forma da fase pedir.
- A **fase** (e o trecho dela) define a **forma** do personagem, como portais:
  - **Corrida** — o toque pula.
  - **Voo** — segurar sobe, soltar desce.
  - **Gravidade** — o toque inverte chão e teto.
- **Todos os personagens têm a mesma física.** Personagem muda só sprite, sons, animações de queda e comemoração. Isso mantém o local e o
  online justos e a conferência do servidor simples.
- **Pulo duplo** na forma Corrida: um novo toque no ar (depois de soltar) dá mais um impulso; segurar o dedo não gasta o extra. Vale para todos.
- **Ritmo:** `TIME_SCALE` em `types.ts` (hoje 0,72 do ritmo original, ~5,8 colunas por segundo). Velocidade, gravidade e pulos mudam juntos, então a
  geometria dos saltos não muda; é o botão para deixar o jogo mais lento ou rápido.
- **Só na tela deitada:** em pé, o jogo pausa e pede para girar o celular. A câmera usa `ZOOM` (personagem menor, mapa mais amplo), o que também abre
  espaço para várias corredoras no multijogador. Tenta tela cheia e travar na horizontal (Android/PWA); no iPhone só o aviso.
- **Fases longas (minutos):** `journey.ts` monta a fase por trechos sorteados com semente (corrida, voo e gravidade com portais e respiros) e espalha as
  palavras do versículo; o teste do bot perfeito garante que é possível. Jornada de teste: 2 min 30 s com Salmos 23:1.
- A fase pode trazer **condições do cenário** (vento, ondas, pouca visão), iguais para todos os jogadores.
- Poder por personagem, se um dia existir, fica só no solo/campanha (nunca online). Começamos sem.

## Jeitos de jogar

- **Campanha solo:** fases em sequência, porcentagem de progresso, checkpoints, 3 estrelas por fase (terminar, pegar todas as letras do versículo,
  terminar sem morrer). Estrelas e fases concluídas desbloqueiam personagens.
- **Treino:** qualquer fase já aberta, com checkpoint à vontade, sem prêmio.
- **Local (2 a 4):** a tela se divide em faixas, cada jogador toca na sua. Multitoque. Roda no aparelho (funciona offline).
- **Online (2 a 4):** corrida **paralela**. Cada celular roda a fase com a mesma semente; os jogadores **não colidem**, então não precisa de websocket.
  O cliente manda o progresso a cada ~1 s (`?since=<versão>`, como Tabuleiro/Duelo) e vê os rivais como corredores levemente atrasados. O início é
  marcado pelo horário do servidor. No fim, o servidor **simula de novo** as jogadas enviadas e confere o resultado.
- **Bots:** o bot "enxerga" os obstáculos à frente e toca com erro configurável; dificuldade = erro menor. Sem sorte escondida.

## Fases (primeiras ideias)

| Fase | Forma | Ideia |
|---|---|---|
| Mar Vermelho (Moisés) | Corrida | corredor entre paredes de água, carros do Egito atrás |
| Jonas | Voo | tempestade, ondas e o interior do peixe |
| Elias | Gravidade | carruagem de fogo alternando chão e teto das nuvens |
| Davi e Golias | Corrida | coletar 5 pedras, desviar de flechas; chefe no fim |
| Daniel | Gravidade | cova dos leões, chão e teto |
| Pedro sobre as águas | Corrida (ritmo) | saltar de onda em onda no tempo |
| Jericó (Josué) | Ritmo | tocar junto com as trombetas, 7 voltas, muralha cai no fim |
| Paulo no naufrágio | Voo + corrida | tempestade e tábuas flutuando |

Cada fase tem um **versículo escondido**: palavras/letras para coletar; ao final o versículo se completa na tela.

## Arquitetura

- Motor **puro e sem dependências** em `backend/src/runner/` (`engine.ts`, `segments.ts`, `levels.ts`, `bots.ts`), passo de tempo **fixo**, com semente e
  teste. O front importa pelo alias `@runner/*` (`vite.config.ts` e `tsconfig.json`); nunca importar nada de fora da pasta.
- **Fases = sequência de trechos** (biblioteca de padrões: três pulos, troca de gravidade, voo estreito...), escritos à mão ou combinados com semente;
  trechos de chefe são fixos. Dados em `levels.ts`; edição no painel fica para depois.
- **Entrada = lista de frames em que houve toque/soltura.** É o que o servidor guarda e simula de novo para conferir a partida.
- Online: `services/runner-room.ts` + `routes/runner-room.ts` (sala, lobby, convite, progresso), no molde de `board-room.ts`/`duel-room.ts`.
- Dados do modo (migração em `backend/prisma/migrations`): personagens do modo (nome, sprites, sons, regra de desbloqueio) editáveis no painel, e progresso
  do jogador (estrelas por fase, personagens abertos).
- Offline: solo, treino, local e bots no aparelho entram em `WORKS_OFFLINE`; leituras da API necessárias entram em `CACHEABLE_API_PATHS`.
- Regras de interface do projeto valem (paginação, `useToast`, `Modal`, `Spinner`, tokens de tema, mobile primeiro).

## Arte e som a produzir (por você, com prompts meus)

- Por personagem: poucas poses (corrida, pulo, queda, comemoração) — o giro e o achatamento saem em código. Sons: pulo, queda, vitória, voz curta.
  **Tudo enviado pelo Painel** (mesmo caminho de `ImageUploadField`/`AudioUploadField`); sem arte enviada, o app desenha formas (o que já temos).
- Por fase: fundo em 3 camadas (paralaxe), ~6 obstáculos, **uma trilha** (a batida alimenta o ritmo das fases de ritmo); também enviados pelo Painel.
- Prompts no padrão de `docs/prompts-3d-padrao.md`; criar `docs/corrida-prompts-de-arte.md` e `docs/corrida-prompts-de-musica.md` quando chegar a hora.

## Cronograma (etapas em ordem; P = pequena, M = média, G = grande)

Cada etapa termina com algo **jogável e publicado** para você testar. Marque `[x]` ao concluir e registre as decisões aqui. O tamanho é só uma
ideia de esforço relativo, não de prazo.

### Etapa 0 — Protótipo e ritmo (feita)
- [x] Padrão de controles e nome confirmados.
- [x] Motor puro e testado (`backend/src/runner/`: 3 formas, colisão, portais, palavras, toques que o servidor repete) e bot que prova que a fase é possível.
- [x] Protótipo na aba Jogar (`@runner/*`), com "Ver um bot jogar".
- [x] Rodada de ajustes depois do seu primeiro teste: ritmo mais lento (`TIME_SCALE`), **pulo duplo**, **tela deitada** (zoom, aviso para girar), **fase de
  minutos** (jornada de 2 min 30 s gerada por trechos), versículo escondido aparecendo no rodapé.

### Etapa 1 — Sensação e treino (P)
- [ ] Você testa o novo ritmo e o pulo duplo no celular; ajusto `TIME_SCALE`, pulos, voo e gravidade.
- [ ] Checkpoints e "recomeçar do checkpoint" no treino; porcentagem do melhor resultado por fase.
- [ ] Sons básicos (pulo, queda, palavra, chegada) com sons genéricos, para o motor de som já existir antes dos sons dos personagens.

### Etapa 2 — Estrutura do modo: página principal (M)
Telas (aba Jogar → Corrida), no mesmo molde do Duelo/Tabuleiro, sem servidor ainda:
- [ ] **Campanha** (jogar sozinho): mapa de fases em sequência (casca; o progresso de verdade vem na etapa 5).
- [ ] **Livre** ("jogar sem valer nada"): qualquer fase, treino, sem prêmio.
- [ ] **Contra bots**: você + 1 a 3 bots na mesma corrida (corrida paralela no aparelho); dificuldade do bot = erro menor.
- [ ] **Multijogador**: local (até 4 na tela) e online (etapas 6 e 7); por enquanto só a casca.
- [ ] **Personagens**: escolher o corredor (formas coloridas enquanto não há sprite).
- [ ] Capa do modo (`RUNNER` em Capas dos jogos, com a migração) e guia curto de como jogar.

### Etapa 3 — Personagens e sprites pelo Painel (M)
- [ ] Migração: `runner_characters` (nome, descrição, sprites por pose, sons, regra de desbloqueio por fase).
- [ ] Painel → Corrida → Personagens: criar/editar, enviar sprites e sons, pré-visualizar; lista com paginação.
- [ ] App: seleção de personagem com os sprites do Painel; sem sprite usa a forma colorida. Animação por quadros (poses: correr, pular, voar, gravidade, cair, vencer).
- [ ] `docs/corrida-prompts-de-arte.md`: prompts dos personagens (padrão 3D de `docs/prompts-3d-padrao.md`) e ficha técnica (tamanho, fundo transparente, nomes das poses).

### Etapa 4 — Fases e cenários pelo Painel (G)
- [ ] Migração: `runner_levels` (nome, história, versículo e referência, duração, semente/ordem das formas, cenário: fundo em 3 camadas, trilha, imagens dos obstáculos).
- [ ] Painel → Corrida → Fases: criar/editar, enviar arte e trilha, "testar a fase" com o bot (valida que é possível antes de publicar).
- [ ] App: desenho com a arte da fase (paralaxe em 3 camadas, obstáculos em imagem), trilha por cenário.
- [ ] `docs/corrida-prompts-de-arte.md` (fundos e obstáculos) e `docs/corrida-prompts-de-musica.md` (trilhas).
- [ ] Rotação das fases como **lugares/histórias** com o versículo de cada uma (você escolhe a ordem; lotes de 3).

### Etapa 5 — Campanha solo com progresso (G)
- [ ] Migração: progresso do jogador (fase concluída, estrelas, melhor %, palavras pegas) e personagens abertos.
- [ ] Servidor: `POST /runner/levels/:id/start` e `/finish` com a **lista de toques**; o servidor simula de novo, confere o resultado e calcula estrelas
  (terminar, todas as palavras, sem morrer). Partida vale uma vez; tempo do servidor.
- [ ] Mapa da campanha (fase a fase), estrelas, versículo completo ao terminar, desbloqueio de personagens por fase concluída.
- [ ] Offline: jogar a fase offline e enviar o resultado quando voltar (regras no `docs/offline.md`).

### Etapa 6 — Local: até 4 na mesma tela (M)
- [ ] Faixas por jogador na horizontal, multitoque, cada um com seu personagem; bots completam as vagas.
- [ ] Placar da rodada (quem chegou primeiro, quem foi mais longe, palavras), revanche.

### Etapa 7 — Online: até 4 jogadores (G)
- [ ] Migração e `services/runner-room.ts` + `routes/runner-room.ts` (sala, código de convite, lobby, bots completando), no molde do Tabuleiro/Duelo
  (sem websocket; `?since=<versão>`; `advance()` com a sala trancada).
- [ ] Corrida paralela: mesma fase e semente; progresso enviado a cada ~1 s; rivais aparecem como corredores levemente atrasados; início pelo relógio do servidor.
- [ ] Resultado final conferido pelo servidor (repete os toques de cada jogador); desconectado = fora da corrida.
- [ ] Convite por link (`/corrida/CÓDIGO`, mesma página de convite dos outros modos).

### Etapa 8 — Polimento e conteúdo (contínua)
- [ ] Sons e voz por personagem; trilhas por cenário (e fases de ritmo, como Jericó).
- [ ] Efeitos (poeira, estouro ao cair, brilho da palavra), vibração no toque.
- [ ] Fases bíblicas em lotes de 3 (Mar Vermelho, Jonas, Elias, Davi e Golias, Daniel, Pedro sobre as águas, Jericó, Paulo no naufrágio...), cada uma com arte, trilha e versículo.
- [ ] Acessibilidade: modo de ritmo mais lento, contraste, tamanho dos botões.

### O que cada etapa precisa de você
| Etapa | Preciso de você |
|---|---|
| 1 | Testar no celular e dizer o que sentiu |
| 2 | Aprovar a organização das telas; capa do modo (imagem) quando quiser |
| 3 | Sprites e sons dos primeiros personagens (eu escrevo os prompts) |
| 4 | Ordem das primeiras fases, versículo de cada uma, arte e trilha |
| 5 | Regra de estrelas e quais personagens abrem em qual fase |
| 6 e 7 | Testar com amigos |

## Perguntas em aberto

- Quantos personagens no lançamento e em qual fase cada um se abre.
- Sala online: só por convite/código (como o Tabuleiro) ou também sala aberta?
- Contra bots: o bot aparece como corredor "fantasma" na mesma tela (como o online) ou em faixas separadas (como o local)?
