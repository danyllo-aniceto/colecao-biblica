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
- O motor não vê a alternativa marcada, só se acertou. Toda regra nova tem teste em `engine.test.ts`; regras de cenário são
  dados em `scenarios.ts`. Nada do modo dá XP, moedas, figurinhas nem mexe nas estatísticas das perguntas.

## Comandos

```bash
npm run dev                                   # API :3333 + app :5173
npm run build                                 # typecheck + build dos dois
cd backend && npx vitest run                  # testes puros
TEST_DATABASE_URL=postgresql://.../colecao_biblica_test npm test   # + testes de integração
```
