# Coleção Bíblica — regras do projeto

Jogo bíblico (quiz + álbum de figurinhas). Front em `frontend/` (React + Vite + Tailwind), API em
`backend/` (Express + Prisma/PostgreSQL), publicados juntos na Vercel. Textos do app e comentários do
código em **português do Brasil**.

## Regras de interface (valem para toda tela nova ou alterada)

1. **Toda lista tem paginação.** Use `Pagination` (`components/ui/pagination.tsx`).
   - Listas que crescem (personagens, perguntas, usuários, ranking, histórico): paginação **no servidor**
     com `page`/`size` (helpers `readPage`/`pageOf` em `backend/src/lib/pagination.ts`; no painel,
     `usePagedList` em `components/admin/use-paged-list.ts`).
   - Listas pequenas que já vêm inteiras: `usePagination(items)` no navegador.
   - Nunca "mostrar mais" nem lista infinita sem paginação.
2. **Nada com a cara do navegador.** Sempre os componentes do app:
   - `window.alert/confirm/prompt` → `useToast()` (`ui/toast.tsx`) e `useDialogs()` (`ui/dialogs.tsx`).
   - Atributo `title` como dica → `Tooltip` (`ui/tooltip.tsx`).
   - `<select>` → `Select` (`ui/select.tsx`, com `searchable` para listas longas).
   - Checkbox/rádio nativos → `Switch`, `Checkbox` (`ui/switch.tsx`) ou `Segmented` (`ui/segmented.tsx`).
   - Janelas → `Modal` (`ui/modal.tsx`). Avisos inline → `Alert` (`game/game-ui.tsx`).
   - Barras de rolagem, autopreenchimento e setas de número já são estilizados em `globals.css`.
3. **Carregamento usa o ícone de loading.** `Spinner`/`LoadingState` (`ui/spinner.tsx`) e
   `<Button loading>`. Nada de só "Carregando..." em texto nem esqueleto pulsante.
4. Cores e fontes só pelos tokens do tema (`bg-surface`, `text-ink`, `text-muted`, `bg-primary`...),
   funcionando nos temas claro e escuro. Mobile primeiro (o app é PWA instalado no celular).
5. Formulários: `Field` (`ui/field.tsx`) para rótulo, dica e erro; validar antes de enviar e mostrar o erro
   no campo; sucesso e falha de ações em toast.

## Regras de backend

- Validação com zod (`lib/validation.ts`); em atualizações, campo ausente não altera e `null`/vazio limpa
  (`clearableText`).
- Regras puras do jogo em `services/game-rules.ts`, com teste em `game-rules.test.ts`.
- Dinheiro e bônus do jogador sempre dentro de `transaction` + `lockUser`.
- Recompensas/itens da loja com `system = true` são do seed (não excluíveis); os criados no painel têm
  `system = false`.
- Raridade `SPECIAL` (Jesus) é única e só vem da campanha: nunca em pacote, sorteio, loja, troca, venda ou fusão
  (`isCampaignOnlyRarity` em `game-rules.ts`). Cenários/paradas da campanha: `services/campaign.ts` e seed em
  `default-campaign.ts`; guia de arte em `docs/campanha-prompts-de-arte.md`.
- Campanha e passes são mundos separados: tema/arte de passe nunca é reutilizado em cenário (e vice-versa).
- Continuação da campanha (12 Pedras do Peitoral, cenários 11+ em trios): plano e checklist em `docs/campanha-12-pedras.md`; padrão de
  prompts de arte (3D Disney/Pixar) em `docs/prompts-3d-padrao.md`. **Todo cenário novo cadastrado já ganha a regra dele no Duelo**
  (`duel/scenarios.ts`, sem sorte, com teste) e entra no checklist.
- **Todo cenário da campanha é um lugar** (país, região, cidade, monte, templo...), nunca uma coisa ou acontecimento solto; a lista e o pool de lugares
  ficam em `docs/campanha-12-pedras.md` (o dono do jogo escolhe o próximo trio).
- Nível/XP: o custo é **por cenário** (`scenarios.xp_per_stop`, 500 +70 por cenário, teto 1.800), não por nível. Curva em `game-rules.ts`
  (`buildXpBands`/`calculateLevel`) carregada por `services/xp-curve.ts` e enviada ao app em `/campaign` (`xpBands`); mudou cenário/parada,
  `syncUserLevels` recalcula o nível de todos. Cenário novo tem **4 paradas** (a 4ª é a relíquia).
  Baú de nível a cada 3 níveis (`pendingLevelChests`). Economia: `docs/economia.md`.
  Moedas da parada = XP por parada ÷ 10 (de 5 em 5), relíquia em dobro (`nodeCoins`).
- 12 Pedras: `Stone` (12 no seed, `services/breastplate.ts`), cenários ligados por `scenarios.stone_id` (3 por pedra), resgate em
  `POST /campaign/stones/:id/claim` (moedas + cor do nome + brasão `BADGE`); a 12ª dá o Peitoral Completo. Cenários das Pedras não dão fragmento de Jesus.
- Toda mudança de schema vira migração em `backend/prisma/migrations` (o deploy roda `migrate deploy`).

## Modo Tabuleiro (jogo com amigos, sem progresso de perfil)

- Plano e checklist por etapas em `docs/modo-tabuleiro-plano.md`; atualize o checklist a cada etapa.
- O motor é **puro e sem dependências** em `backend/src/board/` (`engine.ts`, `bots.ts`, `scenarios.ts`) e roda igual no navegador
  (partida local) e no servidor (online). O front o importa pelo alias `@board/*` (`vite.config.ts` e `tsconfig.json`): nunca
  importe nada de fora dessa pasta dentro dela.
- Online: `services/board-room.ts` (salas, lobby, convites, jogadas) e `routes/board.ts`. Sem websocket: o cliente consulta com
  `?since=<versão>`; tudo que acontece "sozinho" (bots, tempo esgotado, gabarito, ausência) é resolvido de forma preguiçosa por
  `advance()` na próxima consulta/jogada, sempre com a linha da sala trancada (`FOR UPDATE`). Nunca devolva a alternativa certa nem o
  sorteio ao cliente antes do gabarito. A tela da partida é a mesma no local e no online (`board-screen.tsx`).
- O caminho do tabuleiro é desenhado pelo app (`board/layout.ts`: casas equidistantes ao longo de curvas, testado) sobre um terreno
  em imagem repetida e espelhada; marcos e curvas são dados do cenário editáveis no painel. A arte nunca desenha a estrada.
- Avisos animados: `board/callouts.ts` (puro, testado) transforma os eventos do motor em cartazes; local e online usam a mesma lista
  (`FeedEntry`, tocada uma vez por `id` em `use-callouts.ts`). Todo evento novo do motor que mereça aviso entra ali.
- Os peões básicos (grátis) são itens `PAWN` do painel (`unlock = FREE`); `FREE_PAWNS` do motor é só o reserva.
- O motor não vê a alternativa marcada, só se acertou. Toda regra nova tem teste em `engine.test.ts`; regras de cenário são
  dados em `scenarios.ts` (os 10 de lançamento) e `scenarios-pedras.ts` (os das 12 Pedras, montados com provação, perigos, muros, tempestade,
  vigília, power-up inicial/exclusivo e `density`: quantidade de atalhos, quedas, poder e provações). **Todo cenário novo cadastrado também ganha as
  regras dele no Tabuleiro** (sem repetir a combinação de outro; o teste confere) e entra no checklist. Nada do modo dá XP, moedas, figurinhas nem mexe nas estatísticas das perguntas.

## Modo Duelo (jogo de figurinhas com amigos, sem progresso de perfil)

- Proposta e fases em `docs/modo-duelo.md` (estilo Marvel Snap: 12 figurinhas, 6 turnos simultâneos, 3 cenários × 4 espaços, Dons). Atualize o
  checklist a cada etapa. Vocabulário: **Influência** (força), **Vigor** (energia do turno), **Dom** (habilidade), **Cenário**, **Time**.
  Não usar "Fé" nem "Fôlego" (o Tabuleiro já usa).
- Motor **puro e sem dependências** em `backend/src/duel/` (`engine.ts`, `cards.ts`, `dsl.ts`, `scenarios.ts`, `bots.ts`, `bot-team.ts`, `series.ts`; `starter.ts` é só exemplo de teste); o
  front o importa pelo alias `@duel/*`. Mesmo molde do Tabuleiro: estado serializável, sorteio com semente, nunca importar nada de fora da pasta.
- Figurinhas = personagens do painel (tabela `duel_cards`, Dom em texto: `docs/duelo-planilha.md`); cada jogador monta o próprio Time (`duel_decks`), sem Times prontos.
  Todo evento do motor leva a foto do tabuleiro (`snap`): a tela repete o turno passo a passo, então evento novo precisa de texto claro.
- Aposta: só vale em Melhor de 3 (pontos) e Vidas (dano); na rodada única `stakesMatter = false` e não dobra. Desistir após o dobro do rival neste turno custa o valor de antes (`retreatCost`).
  Dá para jogar em arena ainda fechada (às cegas): nunca vaze o nome do cenário nem a regra dele nos textos/visão (`arenaName`, `viewFor`).
- Movimento na mesa (voos, estouros, números flutuando): `use-card-motion.tsx`, guiado pelas fotos (`snap`) de cada evento; evento novo que mova figurinha precisa de `uid` e da foto certa.
- O guia *Poderes e arenas* (`components/user/duel/duel-guide.tsx`) explica os tipos de Dom e os efeitos e lista as arenas (lê `SCENARIOS`): **efeito ou tipo de Dom novo entra no texto do guia**.
- **Nenhum cenário nem Dom usa sorte.** Só decisão do jogador. Regras novas entram em `engine.test.ts`; bots só enxergam `viewFor(...)`.
- Informação escondida (mão e baralho do rival, jogadas não reveladas, cenários que não apareceram) nunca sai do servidor: o online manda só `viewFor`.
- Online: `services/duel-room.ts` + `routes/duel-room.ts` (mesmo molde do Tabuleiro: sem websocket, `?since=<versão>`, tudo "sozinho" resolvido por `advance()` com a sala trancada).
  Os bots jogam o turno ao começar; colocar figurinha não sobe a versão; o prazo só recomeça quando o turno muda. Convite/link: `/duelo/CÓDIGO` (a mesma página de convite do Tabuleiro).
- Nada do modo dá XP, moedas, figurinhas ou mexe em ranking/missões/estatísticas. Único prêmio previsto: versos de figurinha por vitórias online.

## Mini games (outro modo de jogo, sem progresso de perfil)

- Proposta, lista dos 12 jogos e ordem de construção em `docs/minigames.md`; atualize o checklist a cada jogo. Catálogo e liberação em `MINI_GAMES`
  (`services/game-rules.ts`, com teste): **cada pedra do Peitoral libera um ou dois jogos** (`stoneSlot`; o administrador vê todos liberados em Painel → Testar mini games) e o **Peitoral Completo libera o ranking semanal**
  (+ brasão, moldura, moedas e entrada na Galeria dos Peitorais). `ready: false` até o jogo existir no app.
- **Nada do modo dá XP** nem mexe em ranking geral, missões ou estatísticas de perguntas. Prêmios: pontos no ranking semanal (`mini_game_scores`, só quem
  completou o Peitoral) e moedas na **1ª vitória do dia em cada jogo, até 3 jogos por dia** (`MINI_GAME_WIN_COINS`/`MINI_GAME_DAILY_COIN_WINS`).
- Motores **puros** em `backend/src/minigames/` (sorteio com semente, sem dependências, com teste): cada jogo tem `generate` e `check`. A partida vive no
  servidor (`mini_game_runs`, `services/minigame-play.ts`): `POST /minigames/:jogo/start` guarda o gabarito, `POST /minigames/runs/:id/finish` confere a
  resposta e **calcula a pontuação no servidor** (a tela nunca manda pontos; partida vale uma vez; o tempo é o do servidor). A forca confere cada palpite no
  servidor (`/guess`) e nunca manda a palavra; anagrama e quem sou eu? conferem palpites, dicas e resposta em `/act`. Jogos de informação aberta (memória, labirinto, versículo...) mandam o jogo inteiro à tela: o servidor confere a
  solução, mas não impede quem lê a rede; por isso o prêmio é pequeno e limitado.
- A imagem do modo na aba Jogar é a capa `MINIGAMES` (Painel → Capas dos jogos), como Quiz, Tabuleiro e Duelo.

## Comandos

```bash
npm run dev                                   # API :3333 + app :5173
npm run build                                 # typecheck + build dos dois
cd backend && npx vitest run                  # testes puros
TEST_DATABASE_URL=postgresql://.../colecao_biblica_test npm test   # + testes de integração
```
