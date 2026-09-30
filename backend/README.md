# Backend

API da Coleção Bíblica em Express + Prisma. Localmente roda em `http://localhost:3333/api`
(`npm run dev`); na Vercel roda como função serverless via `api/index.ts`.
Setup e deploy: veja o README da raiz.

## Rotas (todas sob `/api`)

Sem login: `POST /auth/login`, `POST /auth/refresh`, `POST /users` (cadastro), `GET /health`.
Todas as outras exigem `Authorization: Bearer <accessToken>`.

| Área | Rotas | Quem |
| --- | --- | --- |
| Conta | `GET /users/me`, `PUT /users/:id`, `DELETE /users/:id` (exclusão lógica) | dono ou admin |
| Usuários | `GET /users?page&size&name&email&role`, `GET /users/:id` | admin |
| Personagens | `GET /characters`, `GET /characters/:id` | todos |
| | `POST /characters/admin`, `PUT/DELETE /characters/admin/:id` | admin |
| Perguntas | `GET /questions`, `GET /questions/:id`, `.../random`, `POST/PUT/DELETE /questions/admin...` | admin |
| Recompensas | `GET /rewards`; `PUT /rewards/admin/:id` (chance e quantidades) | admin edita |
| Loja | `GET /shop`, `POST /shop/buy/:id`; `PUT /shop/admin/:id` | admin edita |
| Configurações | `GET /settings`; `PUT /settings/admin` | admin edita |
| Quiz | `POST /quiz/sessions/start`, `GET /quiz/sessions/active`, `GET /quiz/sessions/:id`, `POST /quiz/sessions/:id/answer`, `POST .../extra-time`, `POST .../abandon`, `GET /quiz/history` | jogador |
| Coleção | `GET /collection/my`, `GET /collection/my/progress` | jogador |
| Anotações | `GET /comments/my`, `POST /comments`, `PUT /comments/:id` | jogador |
| Ranking | `GET /ranking` (top 50) | todos |
| Upload | `POST /uploads` (token do Vercel Blob) | admin |

Erros seguem o formato `{ timestamp, status, error, message, fields? }`; `fields` traz o
problema de cada campo em erros de validação (400).

## Regras do jogo

Ficam em `src/services/game-rules.ts` (funções puras, com testes em
`game-rules.test.ts`), `src/services/quiz.ts` (partida e prêmio) e
`src/services/rewards.ts` (aplicação de recompensas e loja). Os valores ajustáveis
(vidas, limite diário, bônus...) vêm da tabela `game_settings`, editável no painel admin.

## Banco

- `prisma/schema.prisma` — modelos; migrações em `prisma/migrations/`.
- Nova migração no desenvolvimento: `npm run prisma:migrate -- --name descricao`.
- `npm run seed` é idempotente e roda em todo deploy.
