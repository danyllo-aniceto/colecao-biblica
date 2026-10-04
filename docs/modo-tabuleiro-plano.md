# Modo Tabuleiro — plano de produto e técnica

Jogo para **jogar com amigos**, separado do progresso do perfil: não dá XP, moedas, figurinhas, baús, nem mexe em
ranking/missões/estatísticas das perguntas. É uma "sala de brincadeira". O segundo jogo (estilo Kahoot) virá depois, mas
a camada de **sala** abaixo já nasce genérica para ele reaproveitar.

## 0. Decisões confirmadas

1. **Local sem conta**: quem joga no mesmo aparelho só digita o nome; só quem criou a partida precisa estar logado.
2. **Online**: amigos com conta entram por convite no app; quem não tem conta entra pelo link/código **e vê um convite para criar conta**
   (entra na etapa 4).
3. **Vitórias**: só um contador e **peões** como prêmio (cosmético). Nada de XP, moedas, figurinhas ou estatística de pergunta.
4. **Perguntas**: o mesmo banco do quiz, sorteadas como no quiz geral (`pickGeneralQuestionIds`: metade do cenário escolhido, o resto do
   banco inteiro). Por isso **não existe ajuste de dificuldade na sala**: a pergunta de movimento vem do sorteio normal e só a
   provação e a pergunta final puxam as difíceis.
5. **Forma de trabalho**: etapas pequenas, cada uma jogável e testada, sem deixar nada pendente (checklist na seção 8).

## 1. A ideia em uma frase

Corrida de peões por um caminho temático de um dos 10 cenários. Na sua vez: **rola o dado (1–6) → cai uma pergunta
aleatória → acertou, o peão anda o valor do dado; errou, fica parado.** Quem cruzar a linha de chegada primeiro vence.
2 a 6 jogadores, em **três formas de jogar**: local (um aparelho), online (amigos) e com **bots** (completam qualquer
sala).

### O que pesquisei do Ludo Club e o que vale trazer

| Ludo Club | No Coleção Bíblica |
|---|---|
| Dado + peão, corrida até o centro | Dado + peão, corrida até a chegada do cenário |
| **Captura**: cair na casa do rival o manda de volta | **Empurrão**: cair na casa de um rival (acertando) o recua 3 casas |
| Casas seguras (estrela) | **Casas de abrigo**: ninguém é empurrado nelas |
| Sala por código/link, 2–4 jogadores, bots | Código de 5 letras + convite por amigo, 2–6, bots |
| Emojis/reações rápidas na partida | As **reações** que o jogador já tem (cosmético REACTION) viram o chat da sala |
| Skins de dado/peão | Novo cosmético **Peão** |
| Exige 6 para sair da base | **Não copiamos**: aqui o freio é a pergunta, então todos já começam na largada |

Ajuste importante em relação à regra da pergunta: como só anda quem acerta, uma partida só com isso pode ficar longa e
frustrante. Mitigações: tabuleiros curtos (25/40/60 casas), **ajuda ao último colocado** (+1 no dado quando está 8+ casas
atrás), **Fôlego** (poder-up inicial grátis) e a casa **Provação** (abaixo) que dá chances de avançar mais rápido.

## 2. Regras do jogo (motor)

- **Turno**: dado → pergunta (tempo da sala, padrão 20 s; estourar o tempo = erro) → resolve → próximo.
- **Pergunta**: sorteada do banco ativo **sem repetir na partida** (se o banco acabar, o baralho recomeça). O lote da partida vem
  como no quiz geral, com metade das perguntas do cenário escolhido (`scenarioId`). Provação e pergunta final preferem as
  difíceis (`HARD`/`VERY_HARD`), com qualquer uma de reserva.
- **Acertou**: anda o valor do dado, resolve a casa onde caiu (ver tipos). **Errou**: não anda; a explicação
  (`explanation`/`bibleReference`) aparece para todos — vira momento de aprendizado em grupo.
- **Chegada**: para vencer, precisa **acertar a "pergunta final"** (difícil) ao alcançar ou passar a linha. Sem
  precisar de número exato.
- **Fim**: o primeiro a chegar vence; os demais seguem disputando 2º/3º (opcional) ou a sala encerra.
- **Sala sem pontos persistentes**: ao final só aparece o pódio, "estatísticas da partida" (acertos, maior
  sequência, empurrões) e o botão **Revanche** (mesma sala, mesmos jogadores).

### Tipos de casa (comuns a todos os cenários)

| Casa | Efeito |
|---|---|
| Normal | Só avança |
| **Abrigo** | Imune a empurrão |
| **Poder** 🎁 | Ganha um power-up do cenário (máx. 2 na mochila) |
| **Provação** ⚔️ | Pergunta difícil, "tudo ou nada": acerta → +2 casas extras; erra → recua 2 |
| **Atalho / Queda** | Sobe ou desce algumas casas (setas desenhadas no caminho) |
| **Evento do cenário** | Mecânica própria de cada cenário (tabela abaixo) |

### Power-ups comuns (usados no começo do turno ou ao responder)

Eliminar 2 alternativas (reaproveita a lógica do 50/50), Tempo extra, Trocar pergunta, Escudo (anula um recuo),
Dado dobrado (anda 2× o valor), Rerrolar dado. Cada cenário tem **1 power-up exclusivo** que vira a identidade dele.

## 3. Os 10 cenários — provação, evento e power-up

Tudo é dado em `backend/src/board/scenarios.ts` (o motor só lê); cenários criados no painel sem regra própria usam a provação genérica.
O que está **implementado e testado** (`scenarios.test.ts`, inclusive 120 partidas só de bots):

| # | Cenário | Provação | Evento do cenário | Power-up exclusivo |
|---|---|---|---|---|
| 1 | 🍎 Éden | **Tentação da serpente**: opcional, pergunta difícil por +3 (errou, recua 3) | **Árvores**: abrigos dão power-up | 🌳 **Árvore da Vida**: anula um recuo e avança 2 |
| 2 | 🌈 Arca | **Rumo ao Ararate**: tudo ou nada (±2) | **Dilúvio**: a cada 3 rodadas 4 casas ficam alagadas (recuo 2) | 🕊️ **Pomba**: tira 1 errada e mostra o versículo |
| 3 | ⛺ Canaã | **Poço de Isaque**: acertou, +2 e um power-up | **Bênção de Abraão** (o prêmio do poço) | ⛺ **Tenda**: atravessa uma provação sem arriscar, com o prêmio |
| 4 | 🐫 Egito | **Coração do Faraó**: tudo ou nada (±2) | **Pragas**: toda rodada 3 casas atingidas, com praga sorteada (recuo 2) | 🪄 **Cajado**: troca de lugar com um rival à escolha |
| 5 | ⛰️ Sinai | **Bezerro de ouro**: errou, recua 2 e perde um power-up | **Maná**: abrigos dão power-up | 🍞 **Maná**: rola de novo e não gasta a ajuda da vez |
| 6 | 📯 Jericó | **Sete voltas**: tudo ou nada (±2) | **Muros**: param o peão até acertar 2 seguidas; caem na rodada 7 | 📯 **Trombeta**: derruba o muro na hora |
| 7 | 🕎 Templo | **Juízo de Salomão**: acertou, +2 e adianta o último colocado 1 casa | **Ouro e cedro**: abrigos dão power-up | 📜 **Sabedoria**: troca a pergunta sem gastar a ajuda da vez |
| 8 | 🦁 Babilônia | **Sonho do rei**: tudo ou nada (±2) | **Fornalha** (fogo: recua 3) e **cova dos leões** (uma vez sem jogar, ganha escudo) | 🔥 **Quarto homem**: imune a recuos até o fim da próxima rodada |
| 9 | ⛵ Galileia | **Pesca milagrosa**: acertou, +2 e um power-up | **Tempestade**: em ~1/3 das rodadas, quem erra é levado 1 casa para trás | 🕸️ **Rede**: puxa um rival 2 casas para trás |
| 10 | 🕊️ Jerusalém | **Vigília no Getsêmani**: todos respondem à mesma pergunta; só quem acerta avança 2 | **Túmulo vazio**: todos começam com um escudo extra | 💡 **Luz**: elimina as três erradas |

Ajustes em relação ao rascunho inicial: o "dilúvio que sobe do começo" virou casas alagadas que mudam de lugar (não pune quem
está atrás); a "pesca em dobro", "pares de animais" e "estrelas de Abraão" foram trocadas por mecânicas mais claras acima.

## 4. Peão (cosmético editável) e imagem do tabuleiro

- `CosmeticType.PAWN`: o peão é um **emoji ou uma imagem enviada pelo admin** (como a reação). Não se equipa: escolhe-se em cada
  partida entre os 10 emojis básicos (de todos) e os peões que o jogador tem (loja, prêmio, painel).
- Painel → Itens visuais: tipo **Peão** com emoji ou upload de imagem, prévia do peão no tabuleiro, importação em lote
  (linha "Peão") e todas as formas de ganhar (loja, meta, prêmio). O seed traz 10 peões temáticos (um por cenário) na loja.
- Painel → Campanha → cenário: campo **Imagem do tabuleiro** (vertical, sem texto) com prévia; ela vira o fundo do caminho do
  jogo de tabuleiro daquele cenário (migração `20261018090000_tabuleiro_peao_imagem`).
- Contador de vitórias e peões por meta de vitória ficam para a etapa online (só vale vitória que o servidor confirma).

## 5. UX de criação de sala (a parte que a pessoa mais vai ver)

Entrada: card **"Tabuleiro"** na aba Jogar, com três botões grandes: **Jogar aqui (local)**, **Criar sala online**,
**Entrar com código**. Depois, o assistente em 3 passos, todos em tela cheia no celular (`Modal` em tela cheia, regras
do projeto):

1. **Escolha o cenário** — carrossel de cartas grandes (arte do cenário, nome, versículo). Ao tocar, a carta vira
   mostrando **Provação, evento e power-up** do cenário em linguagem simples ("Neste tabuleiro: Muros que caem
   quando…"). Botão **"Surpreenda-me"** sorteia um cenário. Fundo do app já usa o tema do cenário
   (`campaign-theme.tsx`).
2. **Jogadores** — grade de 6 vagas com o peão de cada um:
   - Local: tocar numa vaga digita o nome (sem conta) e escolhe o peão; botão **"+ Bot"** em cada vaga vazia.
   - Online: o criador ocupa a vaga 1; vagas vazias mostram "Convidar amigo" (lista paginada dos amigos do app) e
     "Compartilhar link/código". Vagas **"+ Bot"** podem completar a qualquer momento.
3. **Regras** — `Segmented`: estilo (Em família · Clássico · Desafio), tamanho (Rápido 25 · Clássico 40 · Épico 60), tempo por
   pergunta (15/20/30 s) e `Switch`es: power-ups, empurrão, ajuda ao último colocado. Mexer em qualquer regra vira
   "personalizado".

**Lobby online**: código grande + QR, vagas ao vivo (mostra quem entrou), o dono pode expulsar, trocar cenário e
iniciar com 2+. Quem não é dono vê "Aguardando o dono iniciar" com a regra resumida e a animação do cenário.

**Durante a partida** (mobile primeiro):
- Tabuleiro ocupando a tela com **câmera que segue o peão da vez**; zoom/arrastar para ver o caminho todo.
- Barra no rodapé: o **dado** (toque/balançar o celular), mochila de power-ups, reações rápidas.
- A pergunta sobe como folha sobre o tabuleiro; no online os outros veem "Fulano está respondendo…" e as
  reações em tempo real.
- Som e vibração (módulo de som já existe), dado com animação e acessibilidade (modo sem animação).

## 6. Bots

Possível e simples porque o motor é determinístico. Cada bot tem **nome e peão** próprios e uma **precisão** (Aprendiz
50%, Estudante 70%, Mestre 90%) e um atraso "humano" aleatório de 2–6 s. No local, o bot roda no navegador junto do
motor; no online, o servidor resolve a vez do bot **de forma preguiçosa** (veja abaixo). Bots podem ser adicionados e
removidos no lobby; se um humano sai no meio da partida online, o bot assume o peão dele (opção ligada por padrão).

## 7. Arquitetura

### 7.1 Motor puro (como pede o projeto: `game-rules.ts` + teste)

`backend/src/services/board-engine.ts` (regras puras: movimento, tipos de casa, power-ups, empurrão, vitória) +
`board-engine.test.ts`. O estado da partida é um **JSON serializável** e as transições são funções
`(estado, ação, aleatório) → estado`, com RNG com semente (replay e testes). Para o modo local rodar no navegador, o
motor fica num módulo sem dependências do servidor (`shared/board-engine.ts`) importado pelos dois lados.

### 7.2 Modelagem (migração obrigatória)

Tabelas de **vida curta**, apagadas após 24 h sem atividade:

```
BoardRoom   id, code (5 letras, único), hostUserId, scenarioId, status (LOBBY|PLAYING|FINISHED),
            config Json, state Json, version Int, turnDeadline DateTime?, updatedAt
BoardPlayer roomId, userId?, slot 0..5, displayName, pawn, isBot, botSkill?, connectedAt
BoardBoard  (opcional, depois) tabuleiros editáveis pelo painel: scenarioId, tiles Json, rules Json
Cosmetic    + tipo PAWN
```

**Local** não grava nada no servidor: a sala vive no navegador (e em `localStorage` para retomar partida interrompida).
Só busca perguntas via `GET /api/board/questions?scenarioId=&size=` (lote de 40, com `answers`; como não vale nada,
não precisa esconder a alternativa certa).

**Online**: servidor autoritativo — a alternativa certa **nunca** vai para os clientes antes do fim da resposta.

### 7.3 Tempo real na Vercel

O app roda em funções serverless (sem WebSocket, igual ao chat de hoje que usa `setInterval`). Plano:

- **Polling com versão**: `GET /api/board/rooms/:code?since=<version>` devolve `304` quando nada mudou (barato);
  intervalo de 1,5 s durante a partida, 3 s no lobby, pausa com a aba oculta (padrão do `chat-view.tsx`).
- **Ações**: `POST /rooms` (cria), `POST /rooms/:code/join`, `/leave`, `/kick`, `/config`, `/start`, `/roll`, `/answer`,
  `/powerup`, `/react`, `/rematch`. Cada ação roda em `transaction` com trava da sala (como o `lockUser`) e incrementa
  `version`, evitando duas jogadas ao mesmo tempo.
- **Prazos "preguiçosos"** (não há cron): toda leitura/ação verifica `turnDeadline`; se estourou, o servidor registra
  erro/pula a vez e resolve turnos de bot pendentes antes de responder. Um jogador desconectado por > 60 s tem a vez
  pulada ou entregue a um bot.
- Se mais tarde precisar de tempo real de verdade, trocar o polling por SSE/Pusher/Ably sem mexer no motor.

### 7.4 Segurança e abuso

Código de sala não adivinhável (sem letras ambíguas), `rateLimit` nas ações, só o dono altera a configuração, validação
com zod (`lib/validation.ts`), e reutilização do sistema de **moderação de nomes** nos nomes locais de convidados
(`moderation.ts`).

### 7.5 Frontend

Pasta nova `components/user/board/`: `board-hub.tsx` (entrada), `room-wizard.tsx` (3 passos), `lobby.tsx`,
`board-view.tsx` (SVG/CSS do caminho + peões), `dice.tsx`, `question-sheet.tsx`, `powerup-bar.tsx`,
`board-result.tsx`, `use-board-room.ts` (polling) e `use-local-board.ts` (motor no navegador). Usa só componentes do
app (`Modal`, `Select`, `Segmented`, `Switch`, `Tooltip`, `Spinner`, toasts), tokens de tema e `Pagination` na lista de
amigos do convite.

## 8. Roteiro por etapas (checklist)

Legenda: ✅ feito e testado · ⬜ a fazer.

**Etapa 1 — Motor + modo local + bots (com o Éden completo)** ✅
- ✅ Motor puro `backend/src/board/engine.ts` (tabuleiro sorteado com semente, dado, perguntas, movimento, empurrão, abrigo,
  atalho/queda, poder, provação, portão/pergunta final, escudo, ajuda ao último colocado, 6 power-ups + Árvore da Vida) e
  `bots.ts` (3 níveis), regras do cenário em `scenarios.ts`; 43 testes em `engine.test.ts` (inclui 40 partidas só de bots).
- ✅ `POST /api/board/questions`: sorteio como no quiz geral, sem mexer em estatísticas (teste de integração).
- ✅ Tela: card na aba Jogar, assistente de 3 passos (cenário paginado + "Surpreenda-me", jogadores/bots, regras com estilos),
  partida em tela cheia (trilha em serpente que segue o peão, dado, pergunta com cronômetro e gabarito, mochila, histórico,
  ajuda), pódio com revanche, partida guardada no aparelho para continuar.
- ✅ Qualquer cenário já é jogável com a provação genérica; o Éden já tem provação e power-up próprios.

**Etapa 2 — Os 10 cenários + peão e imagem editáveis pelo painel** ✅
- ✅ Motor: perigo que muda de lugar (dilúvio/pragas), muros, fornalha, cova dos leões (pular vez), tempestade, vigília, extras de
  provação (power-up de prêmio, perda de power-up, dividir com o último), 10 power-ups exclusivos (alvo para Cajado e Rede),
  imunidade e power-ups "grátis". 32 testes novos em `scenarios.test.ts`.
- ✅ Tela: legenda e ajuda por cenário, evento na escolha do cenário, faixa de tempestade/perigo e casas marcadas, escolha do rival,
  muro e vigília nas perguntas, dica da Pomba, histórico das novas jogadas.
- ✅ Peão cosmético (`PAWN`) com emoji ou imagem, loja, armário, importação em lote e seed; imagem do tabuleiro por cenário no painel.

**Etapa 3 — Peão: vitórias** ✅ (feita junto com a etapa 4)
- ✅ Contador de vitórias online no perfil do jogador (`users.board_wins`), meta `BOARD_WINS` nos itens visuais e dois peões por meta
  no seed (3 e 15 vitórias). Só conta vitória confirmada pelo servidor, em sala com 2 ou mais pessoas.

**Etapa 4 — Online** ✅
- ✅ Salas (`board_rooms`, `board_room_players`, `board_invites`, migração `20261019090000`) com código de 5 caracteres, lobby, regras
  editáveis pelo anfitrião, bots (3 níveis), peão por jogador (básicos + os do painel que a pessoa tem), expulsar, sair e revanche.
- ✅ Sem websocket: consulta com versão (`?since=`); o servidor responde "nada mudou" sem baixar o estado. 1,5 s em jogo, 3 s no lobby.
- ✅ Relógio "preguiçoso" no servidor: vez dos bots, tempo esgotado, gabarito (7 s, quem respondeu pode adiantar) e ausência
  (3 faltas seguidas passam o lugar a um bot) são resolvidos na próxima consulta ou jogada, em ordem.
- ✅ A alternativa certa e a explicação só chegam junto do gabarito; o sorteio e o baralho não saem do servidor.
- ✅ Quem sai no meio do jogo é substituído por um bot; sem pessoas na sala, ela é apagada. Salas com mais de um dia são limpas.
- ✅ Convite por amigo (lista paginada no servidor, aviso dentro do app a cada 12 s) e **link `/sala/CÓDIGO`**: quem não tem conta vê o
  convite, cria a conta e a sala abre sozinha. Prévia pública sem login (`/api/board-public/:code`).
- ✅ A tela da partida é a mesma do modo local (`board-screen.tsx`), alimentada pelo servidor; 13 testes de integração
  (`board-room.test.ts`) e partida completa testada com dois navegadores.

**Etapa 5 — Polimento** ⬜
- ⬜ **Caminho sinuoso** no lugar da grade colada (ver "Proposta de design do tabuleiro" abaixo) e arte por cenário
  (guia e prompts em `docs/tabuleiro-prompts-de-arte.md`).
- ⬜ Sons e vibração, reações rápidas (cosmético REACTION), animação do peão casa a casa, modo sem animação.

**Depois — modo estilo Kahoot**, reaproveitando a camada de sala da etapa 4 (`BoardRoom` → `PartyRoom`).

## 10. Proposta de design do tabuleiro (para decidir)

Hoje as casas formam uma grade de 6 colunas, quase coladas. Funciona, mas parece planilha e esconde a imagem de fundo. A proposta:

- **Caminho sinuoso** desenhado em SVG, com uma estrada de ~26 px que serpenteia (curvas em "S") e casas em círculos sobre ela.
- **Respiro**: ~64 px entre o centro de duas casas (hoje ~7 px de folga). Casas comuns pequenas (44 px) e especiais maiores (54 px),
  portão e chegada ainda maiores: o ritmo visual diz onde estão as provações.
- **Fundo = terreno visto de cima**, repetido e espelhado na vertical para qualquer tamanho de tabuleiro.
- **Peão que anda** casa a casa (em vez de pular), com a câmera acompanhando; mini-mapa fino na lateral mostrando onde cada um está.
- **Marcos do cenário** a cada abrigo (árvore, barco, tenda...), vindos da imagem ou de emojis.
