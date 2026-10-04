# Modo Tabuleiro — plano de produto e técnica

Jogo para **jogar com amigos**, separado do progresso do perfil: não dá XP, moedas, figurinhas, baús, nem mexe em
ranking/missões/estatísticas das perguntas. É uma "sala de brincadeira". O segundo jogo (estilo Kahoot) virá depois, mas
a camada de **sala** abaixo já nasce genérica para ele reaproveitar.

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
- **Pergunta**: sorteada do banco ativo, **sem repetir na sala**. Sala de um cenário prioriza perguntas com
  `scenarioId` daquele cenário (já existe o campo), completando com as gerais. Dificuldade acompanha a posição no
  tabuleiro (início fácil → fim difícil), ou fica fixa pela dificuldade escolhida.
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

Dados já existentes: `default-campaign.ts` (slug, nome, cor, emoji). Todos os cenários usam o mesmo motor; o que muda é
**dados de configuração** (efeitos nomeados), então dá para criar e editar pelo painel sem código novo.

| # | Cenário | Provação | Evento do cenário | Power-up exclusivo |
|---|---|---|---|---|
| 1 | 🍎 Jardim do Éden | **Tentação**: a serpente oferece o "fruto" — pode **arriscar uma pergunta difícil por +3 casas** ou recusar | Casas de **Árvore**: abrigo + 1 power-up | **Árvore da Vida** — escudo que também cura 2 casas |
| 2 | 🌈 Arca de Noé | **Dilúvio**: a cada 3 rodadas a água sobe e as 4 primeiras casas viram "alagadas" (recuo se parar nelas) | Casas **de pares** (animais): quem cair junto com outro avança 1 | **Pomba** — revela uma alternativa errada e uma dica de versículo |
| 3 | ⛺ Terra de Canaã | **Poço de Isaque**: pergunta; acerta → escolhe um jogador para dar +1 de dado | **Estrelas de Abraão**: contar 3 casas Poder seguidas dá bônus | **Tenda** — pula a próxima provação |
| 4 | 🐫 Egito | **Praga**: no início de cada rodada sorteia-se uma praga (rã, trevas, gafanhotos...) que afeta uma casa do tabuleiro | **Pão sem fermento**: 1 turno extra | **Cajado** — troca de lugar com um rival |
| 5 | ⛰️ Sinai | **Bezerro de ouro**: pergunta de "fidelidade"; erra → perde um power-up | **Maná**: casas que dão power-up automático | **Maná** — rerrolar o dado quantas vezes quiser neste turno (1 uso) |
| 6 | 📯 Jericó | **Muro**: o caminho tem muros que bloqueiam; só passa quem acertar 2 perguntas seguidas na casa | **Sete voltas**: ao 7º turno da sala, os muros caem para todos | **Trombeta** — derruba um muro |
| 7 | 🕎 Templo | **Juízo de Salomão**: pergunta de dilema (2 respostas); a dupla mais rápida divide casas | **Ouro e cedro**: casas de abrigo douradas | **Sabedoria** — troca a pergunta |
| 8 | 🦁 Babilônia | **Fornalha**: casas de fogo; sem Escudo, recua 3 (mas a casa seguinte é segura) | **Cova dos leões**: fique parado 1 turno se errar, mas ganhe Escudo | **Quarto homem** — imunidade por 1 rodada |
| 9 | ⛵ Mar da Galileia | **Tempestade**: ventos sorteados inverte o dado (anda para trás se errar) | **Pesca milagrosa**: acerto em casa-rede dá 2 power-ups | **Rede** — puxa um rival uma casa para trás ou para você |
| 10 | 🕊️ Jerusalém | **Getsêmani**: vigília — todos respondem a mesma pergunta; só quem acerta avança | **Túmulo vazio**: a chegada é mais perto, todos recebem Escudo no começo | **Luz** — vê a resposta certa de uma pergunta (1 uso) |

> Os detalhes são sugestões iniciais para podermos balancear; cada linha é um objeto de dados (`kind`, `params`).
> Arte e prompts por cenário ficam no guia de arte existente (`docs/campanha-prompts-de-arte.md`), com um tabuleiro
> desenhado por cenário (já temos `scenario-art.tsx` e `defaultNodePosition` como base de caminho).

## 4. Peão (novo cosmético)

- `CosmeticType.PAWN`: o **estilo é um emoji** (como `REACTION` hoje) e opcionalmente uma cor de base. Jogadores da
  sala podem escolher entre os peões que **possuem**; sem peão equipado, ganham um grátis (🐑 🕊️ 🐟 🌿 ⭐ 🦁).
- Vêm no seed: vários grátis, alguns na loja, alguns por **vitórias no tabuleiro** (a única "evolução" ligada ao
  modo, só cosmética) e alguns do passe/baú. Cada cenário ganha um peão temático.
- Painel: editor de cosméticos já suporta tipos; entra um tipo novo, sem tela nova.

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
3. **Regras** — `Segmented`: tamanho (Rápido 25 · Clássico 40 · Épico 60), dificuldade (Tranquilo · Médio · Difícil),
   tempo por pergunta (15/20/30 s), `Switch`es: bots, power-ups, empurrão, ajuda ao último colocado.
   Predefinições: **"Em família"** (tempo longo, sem empurrão), **"Desafio"** (difícil, empurrão ligado).

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

## 8. Fatiamento sugerido (entregas pequenas e jogáveis)

1. **Motor + testes** (casas comuns, power-ups comuns, empurrão, vitória) e **modo local** com 1 cenário (Éden) e
   perguntas reais. Já dá para jogar em um celular com amigos. (maior valor, menor risco)
2. **Bots** no modo local + os 10 cenários com provações/eventos/power-ups exclusivos (configuração em dados).
3. **Cosmético Peão** (migração, seed, loja, painel) e escolha do peão.
4. **Online**: salas, lobby, polling, ações e prazos preguiçosos; convite por amigo; reações.
5. **Polimento**: arte por cenário, sons, revanche, preferências salvas, tabuleiro editável pelo painel.
6. Depois: **modo estilo Kahoot** (host exibe pergunta, todos respondem em tempo real, ranking por velocidade) reutilizando
   `BoardRoom` renomeada para `PartyRoom` (código, lobby, jogadores, bots, polling).

## 9. Perguntas em aberto (preciso da sua decisão)

1. **Jogo local sem conta**: ok convidados digitarem só o nome (sem login) ou só quem tem conta joga?
2. **Online só para quem tem conta**, correto? Convidado entra por link/código sem conta?
3. **Vitórias contam em algum lugar?** Sugiro apenas um contador e **peões** como prêmio (cosmético), sem XP/moedas.
4. **Perguntas**: ok usar o banco atual (priorizando as do cenário) — ou quer um banco/tag específico de "amigos"
   (mais leves, de roda de conversa)?
5. **Tamanho do 1º corte**: começo pela fatia 1 (motor + local com Éden + 1 bot) ou por algo maior?
