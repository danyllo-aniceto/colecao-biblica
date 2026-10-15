# Modo Corrida (nome provisório) — proposta e checklist

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

## Padrão de jogo (proposta, a confirmar)

- **Um único controle**: toque; segurar quando a forma da fase pedir.
- A **fase** (e o trecho dela) define a **forma** do personagem, como portais:
  - **Corrida** — o toque pula.
  - **Voo** — segurar sobe, soltar desce.
  - **Gravidade** — o toque inverte chão e teto.
- **Todos os personagens têm a mesma física.** Personagem muda só sprite, sons, animações de queda e comemoração. Isso mantém o local e o
  online justos e a conferência do servidor simples.
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
- Por fase: fundo em 3 camadas (paralaxe), ~6 obstáculos, **uma trilha** (a batida alimenta o ritmo das fases de ritmo).
- Prompts no padrão de `docs/prompts-3d-padrao.md`; criar `docs/corrida-prompts-de-arte.md` e `docs/corrida-prompts-de-musica.md` quando chegar a hora.

## Checklist

- [ ] Confirmar o padrão de controles (acima) e o nome do modo.
- [ ] Motor puro + testes (física das 3 formas, colisão, semente, repetição por frames) e protótipo jogável solo **só com formas**, 1 fase.
- [ ] Formato de fases e biblioteca de trechos; as 3 primeiras fases sem arte.
- [ ] Campanha solo: progresso, estrelas, versículo escondido, checkpoints, treino.
- [ ] Antitrapaça: o servidor simula de novo e valida o fim da partida.
- [ ] Bots.
- [ ] Local com 2 a 4 jogadores (faixas, multitoque).
- [ ] Online até 4 (sala, convite, progresso, corrida paralela, resultado conferido).
- [ ] Personagens do modo no painel e desbloqueio pela campanha.
- [ ] Arte, sons e trilhas; capa do modo em Painel → Capas dos jogos; guia curto de como jogar.
- [ ] Demais fases bíblicas.
- [ ] Seção do modo no `CLAUDE.md`.

## Perguntas em aberto

- Nome final do modo.
- Quantos personagens no lançamento e como se desbloqueiam (estrelas totais, fase concluída, ambos).
- Sala online: só por convite/código (como o Tabuleiro) ou também sala aberta?
