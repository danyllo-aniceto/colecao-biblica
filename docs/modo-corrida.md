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

### Etapa 1 — Sensação e treino (P) — feita (falta só o seu teste no celular)
- [ ] Você testa o novo ritmo e o pulo duplo no celular; ajusto `TIME_SCALE`, pulos, voo e gravidade.
- [x] **Treinar** (com checkpoints) × **Jogar** (a fase inteira, vale para o melhor resultado) × **Ver um bot jogar**. Checkpoint salvo a cada portal; ao cair, "Voltar ao
  checkpoint" (pede um toque para continuar) ou "Do começo". O treino não conta para o melhor resultado.
- [x] **Melhor resultado por fase** (`records.ts`, testado): maior porcentagem, mais palavras e "concluída", guardado no aparelho (`corrida-storage.ts`) até a campanha
  com servidor (etapa 5).
- [x] **Sons** sintetizados (sem arquivos, funcionam offline): pulo, pulo duplo, palavra, inverter gravidade, portal, queda e vitória (`RunnerSfxName` em `sfx.ts`).
  Seguem a configuração de som do jogador. Os sons por personagem entram na etapa 3/8.
- [x] **Fases mais confortáveis.** O bot agora joga com o **toque atrasado em 3 passos** (`TOUCH_DELAY`, como o dedo de verdade) e toda fase precisa terminar assim
  (teste em `bots.test.ts`). Isso achou e corrigiu trechos apertados do gerador: fileira de 3 espetos (só 5 passos de folga no pulo simples; agora 1 a 2), degraus de 3 colunas
  (às vezes impossíveis; agora 5), bloco com espeto em cima (espeto mais longe) e túneis de voo com vão de 3 linhas (agora 4; `flyGap` para fases difíceis).
  Regra de projeto: **o pulo simples precisa ter janela de pelo menos ~10 passos**; só fase marcada como difícil pode exigir pulo duplo cravado.

### Etapa 1b — Ajustes depois do seu teste (feita)
- [x] **Checkpoints de verdade:** objeto `checkpoint` nas fases (bandeira no cenário, cinza até passar e verde depois); a jornada tem uma **a cada ~12 s** e uma no começo de
  cada trecho (antes só havia nos portais, e quem caía antes do 1º portal ficava sem nenhum). Valem no **Jogar** e no **Treinar**. Teste confere que ficam em lugar livre e que
  nunca passam de ~25 s sem bandeira.
- [x] Ao cair: **"Voltar ao último checkpoint (X%)"** em destaque, "Do início" e "Sair". Voltar pede um toque para continuar. Concluir sem voltar a nenhum checkpoint vale
  "Concluída sem checkpoint ★" (`clean` em `records.ts`) — base das estrelas da campanha.
- [x] **Aviso nativo do navegador removido:** era o aviso de tela cheia ("pressione Esc"), que não dá para estilizar. O jogo não pede mais tela cheia (cobre o app inteiro;
  instalado como PWA usa a tela toda). O aviso "Checkpoint salvo" agora é uma cápsula estilizada de ~1 s.
- [x] **Mais altura de jogo** (`ZOOM` 0,82 → 0,95) e painel refeito: **porcentagem grande e colorida** (cor da forma), **barra** com marcas dos checkpoints, **tempo que falta**,
  versículo maior (cresce até caber, palavras pegas em amarelo). O painel agora respeita a densidade da tela (antes o texto saía com a metade do tamanho em celular).

### Etapa 2 — Estrutura do modo: página principal (M) — feita
Telas (aba Jogar → Corrida), no mesmo molde do Duelo/Tabuleiro, sem servidor (progresso guardado no aparelho até a etapa 5):
- [x] **Campanha** (solo): fases em sequência, a próxima só abre ao concluir a anterior (`Treino rápido` → `Jornada`); melhor resultado, "sem checkpoint ★". Só a campanha guarda resultado.
- [x] **Livre** ("jogar sem valer nada"): qualquer fase, com checkpoints, nada é guardado; também "Ver um bot jogar" (agora o bot joga **ao vivo**, sem travar a tela).
- [x] **Contra bots**: você + 1 a 3 bots **na mesma tela** (rivais translúcidos com nome, bolinhas na barra de progresso, "2º de 4" e placar no fim). Quem cai volta sozinho ao
  último checkpoint (o tempo não para); vence quem cruzar a linha primeiro. Dificuldade `BOT_LEVELS`: Aprendiz, Estudante e Mestre (medidos na jornada de 160 s: Mestre ~165–180 s,
  Estudante ~185–200 s, Aprendiz ~220–280 s). Os rivais são os outros personagens. As **faixas separadas** ficam para o modo local (etapa 6).
- [x] **Multijogador**: casca com "No mesmo aparelho" e "Online com amigos" (em breve; etapas 6 e 7).
- [x] **Personagens**: escolher o corredor (6 cores com nomes bíblicos; o escolhido fica salvo no aparelho e vale em todos os modos). Todos correm igual.
- [x] **Capa do modo:** chave `RUNNER` em Painel → Capas dos jogos (a coluna é texto: não precisou de migração).
- [x] **Ponto de volta limpo** (`respawnAt`): voltar a um checkpoint nunca recoloca no meio de um pulo; vale para o jogador e para os bots, e todo checkpoint das fases é testado (o bot segue 10 s sem cair).
- [ ] Guia curto de como jogar (fica para a etapa 8, junto com os sons e a arte).

### Etapa 3 — Personagens e sprites pelo Painel (M) — feita
- [x] Migração `runner_characters` (slug, nome, descrição, cor de reserva, ativo, ordem, fase que o abre `unlock_level`, `sprites` e `sounds` em JSON, `system`) com os 6 padrão do seed (Davi, Débora, Elias, Ester, Jonas, Daniel; só a cor).
- [x] Regras puras em `backend/src/runner/characters.ts` (testadas): 7 **poses** (retrato, correndo, no ar, voando, gravidade, caindo, vencendo), cada uma **uma tira horizontal de 1 a 12 quadros quadrados**;
  7 **sons** (pulo, pulo duplo, palavra, inverter gravidade, checkpoint, queda, vitória); `mergeSprites`/`mergeSounds` (ausente não altera, `null` limpa), `poseFor`, `frameFor`.
- [x] API `GET /api/runner/characters` (ativos, qualquer jogador logado; entra em `CACHEABLE_API_PATHS`: abre offline) e, só admin, `GET/POST/PUT/DELETE /api/runner/admin/characters` (paginado no servidor, busca por nome; os do seed só podem ser desativados). Testes de integração.
- [x] **Painel → Corrida: personagens:** lista paginada, busca, criar/editar/excluir; por pose, enviar imagem (`ImageUploadField`) + quadros + prévia animada; sons com `AudioUploadField`; validação no próprio campo.
- [x] **App:** escolha de personagem com o retrato do Painel (ou a cor), o jogo desenha o sprite da pose certa e anima os quadros (corrida, pulo, voo, gravidade de cabeça para baixo no teto, queda, vitória na tela de resultado), rivais com os próprios sprites, sons do personagem
  com o som padrão como reserva. Sem internet ou sem cadastro, valem os 6 padrão.
- [x] `docs/corrida-prompts-de-arte.md`: ficha técnica (256 × 256 por quadro, no máximo 6 quadros por imagem, fundo transparente, de perfil para a direita, pés na base), prompts por pose no padrão 3D e guia de sons.
- [x] **Montador de quadros no Painel** (`frame-strip-builder.tsx`, regras puras testadas em `runner/sprite-strip.ts`): em cada pose, "Quadro por quadro" recebe vários arquivos (ordem pelo nome, dá para reordenar/remover), prévia animada, opção de **remover o fundo verde #00FF00**, mesma escala em todos e pés na base; monta e envia a tira sozinho. "Tira pronta" continua existindo.
- [x] **Tiras no "Quadro por quadro"**: cada arquivo pode ser um quadro solto ou uma tira de N quadros quadrados ("Quadros nesta imagem", total até 12); por padrão o recorte é **pelo desenho** (`columnInk` + `detectFrames` em `runner/sprite-strip.ts`, testados: corta no maior vão vazio perto de cada divisa, centra cada quadro pelo centro de massa, mesma largura em todos) **e limpa os retalhos**: cada pedaço de desenho (mão ou espada soltas contam como parte do corpo mais próximo; `ownerMap`/`foreignPixels`) é atribuído ao quadro do corpo mais perto e apagado dos outros quadros, e fiapos soltos somem; "Partes iguais" (`cellRects`) fica como opção. O resultado continua uma tira só.
- [x] **Pose "Parado" (`idle`)**: personagem de perfil, em pé, respirando (2 a 6 quadros em ciclo; 4 por padrão; pés sempre no mesmo lugar). Enviada pelo Painel como as outras poses (quadro por quadro, prévia animada, fundo verde).
  O jogo usa "Parado" **antes da largada, esperando o toque (inclusive depois de voltar ao checkpoint), pausado (celular em pé) e ao chegar ao fim**, sempre no chão (no voo ele continua pairando; cair vence tudo); nos cartões e no hub o retrato
  é `retrato → parado → correndo`. **Sem arte "Parado", usa o 1º quadro de "Correndo", parado.** Só visual: motor e física não mudaram. **Sem migração:** os sprites são JSON (`runner_characters.sprites`) e a validação lê a lista `POSES`.
  A respiração leva 12 passos por quadro (mais lenta que o resto) e usa um relógio próprio, então anima mesmo com o jogo parado. Sprites ficam no cache de imagens do app (como as outras): quem abriu o hub/jogo uma vez vê offline; nada novo em `CACHEABLE_API_PATHS`.
- [ ] Você gera os primeiros sprites e sons e envia pelo Painel (o jogo já usa assim que salvar). O desbloqueio por fase concluída usa `unlock_level` na etapa 5.

### Etapa 3b — Poderes e caminhos diferentes (feita; falta só o seu teste no celular)
- [x] **Poderes no meio do caminho** (`runner/powers.ts`, testado): **Turbo** (laranja, 4 s: mais rápido e imune, atravessa blocos e espetos), **Escudo** (azul: absorve um erro e dá 1 s de imunidade), **Pulo triplo** (roxo, 10 s: um pulo a mais no ar) e **Ímã** (rosa, 10 s: puxa as palavras próximas). Objeto `power` nas fases; o jogador guarda os já pegos (`powers`) e os efeitos ativos (`effects`); voltar a um checkpoint zera os efeitos mas não repõe o poder já pego.
- [x] **Caminhos diferentes na Corrida** (`runner/forks.ts`): degraus levam a uma laje: **por cima** há o poder (com espetos), **por baixo** o caminho é seguro e vazio. As palavras do versículo ficam só no chão livre: palavra no caminho de risco podia ficar fora do alcance de quem vai pelo seguro (o teste do bot perfeito mostrou). **Na Gravidade**: duas pistas (chão e teto), uma segura e outra com espetos e poder; troca-se de pista invertendo a gravidade.
- [x] Gerador (`journey.ts`): bifurcações e poderes entram sozinhos (opções `forks`/`powers`), poderes saem em ordem embaralhada pela semente. **Regra de teste:** cada caminho é possível sozinho (com o outro fechado), a fase inteira passa sem nenhum poder (poder é bônus, nunca obrigação) e tudo vale também com o toque atrasado.
- [x] **Poderes só onde fazem sentido** (`POWERS_BY_FORM`, testado): Pulo triplo só na Corrida (e se apaga ao virar Voo/Gravidade), Ímã na Corrida e no Voo (onde há palavras), Turbo e Escudo em qualquer forma.
- [x] Bots (`planHold`) se atraem por palavras e poderes próximos, mas nunca arriscam a vida por eles.
- [x] App: itens desenhados no caminho, personagem translúcido com rastro (Turbo), bolha (Escudo), anel (Ímã) e pontos girando (triplo), cápsulas com o tempo restante embaixo, sons `rnPower`/`rnShield`.

### Etapa 3c — Campanha por cenários (feita no app; falta o servidor, etapa 5)
- [x] **Cenário = lugar com várias fases** (`runner/campaign.ts`, testado): 1. **Cidade de Davi** (5 fases), 2. **Mar Vermelho** (4), 3. **Vale dos Ossos Secos** (3). Fases geradas por semente, mais longas e com mais formas ao longo do cenário, cada uma com versículo; céu com a cor do cenário.
- [x] A fase abre ao concluir a anterior; o cenário abre ao concluir o último do anterior. Progresso guardado no aparelho por enquanto.
- [x] **Personagens por fase concluída** (coluna `unlock_level` = id da fase, migração `corrida_personagens_cenarios`): Davi já começa; Jônatas (cd-3), Joabe (cd-5), Moisés (mv-2), Arão (mv-3), Miriã (mv-4), Ezequiel (vo-3). Fechados aparecem com cadeado e "Conclua a fase…"; ao abrir um, aparece aviso. Editável no Painel.
- [ ] Crescer: novos cenários/fases entram em `SCENARIOS`; personagem novo = cadastro no Painel com `unlock_level` (id da fase). Os outros 5 padrão (Débora, Elias, Ester, Jonas, Daniel) ficam **desativados** (migração `corrida_personagens_inativos`); o Painel reativa quando quiser.

### Etapa 4 — Fases e cenários pelo Painel (G) — feita (falta a arte e a trilha de verdade)
- [x] Migração `corrida_cenarios_fases`: `runner_scenarios` (nome, história, céu, `art` = fundo em 3 camadas + espeto + bloco, trilha, ativo, ordem) e `runner_levels` (identificador, cenário, nome, semente, duração, ordem das formas, versículo, caminhos/poderes ligados, ativo, ordem). O seed é a campanha atual (3 cenários, 12 fases) e os identificadores das fases (`cd-1`...) são os do `unlock_level` dos personagens.
- [x] API: `GET /api/runner/campaign` (jogador; entra em `CACHEABLE_API_PATHS`, abre offline) e, só admin, CRUD paginado de `/runner/admin/scenarios` e `/runner/admin/levels` (+ `scenario-options` e `level-options` para os seletores). Regras: os do seed só desativam; cenário com fases e fase que abre personagem não saem; limites validados (semente 1–999999, 30–300 s, até 8 formas, versículo 2–40 palavras).
- [x] Painel → **Corrida: cenários** (céu com prévia, 5 imagens, trilha) e **Corrida: fases** (filtro por cenário, semente com "sortear", formas em ordem, versículo com contagem de palavras, caminhos/poderes). **Testar fase** roda num worker (`runner-level-test.worker.ts`, ~5 s para 90 s de fase): bot perfeito e bot de toque atrasado precisam terminar e pegar todas as palavras. Fase nova nasce inativa; **ativar exige teste aprovado** (ou fase já publicada sem mudar nada que a gere). O personagem escolhe a fase que o abre num seletor.
- [x] App: a campanha vem do Painel (`useRunnerCampaign`; sem internet vale a de partida em `SCENARIOS`); as fases são montadas pela semente no aparelho. Desenho com **fundo em 3 camadas** (paralaxe, cópias espelhadas), **espeto e bloco em imagem** e **trilha do cenário** no lugar da música do app (segue os ajustes de som).
- [ ] Você: criar a arte dos cenários (fundo em 3 camadas, espeto e bloco) e as trilhas; os prompts ficam em `docs/corrida-prompts-de-arte.md` (fundos e obstáculos) e `docs/corrida-prompts-de-musica.md` (trilhas) — ainda a escrever.
- [ ] Mais cenários e fases (lotes de 3): você escolhe a ordem e o versículo; cadastro direto pelo Painel.

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
