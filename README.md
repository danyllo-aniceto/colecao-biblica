# Coleção Bíblica

Jogo para aprender a Bíblia: quizzes com tempo, álbum de figurinhas dos personagens,
loja de bônus e ranking. Funciona como app instalável (PWA), inclusive offline.

Front e back ficam no mesmo repositório e são publicados juntos em **um único projeto
na Vercel**, no mesmo formato do projeto Louvor.

| Parte | Tecnologia |
| --- | --- |
| `frontend/` | React 19 + Vite + Tailwind 4, PWA com service worker próprio (Workbox) |
| `backend/` | Node + Express + Prisma (PostgreSQL), autenticação JWT |
| `api/index.ts` | Função serverless da Vercel que roda o Express do backend |
| Banco | PostgreSQL (Neon em produção, Docker no desenvolvimento) |
| Imagens | Vercel Blob em produção; no desenvolvimento ficam no próprio banco |

Na Vercel, `/api/*` vai para a função serverless e todo o resto é o app estático
(`frontend/dist`), então front e API ficam no mesmo domínio (sem CORS).

## Rodando localmente

Requisitos: Node 20+ e Docker (para o Postgres).

```bash
npm install                      # instala tudo (workspaces backend e frontend)
cp backend/.env.example backend/.env
npm run db:up                    # sobe o Postgres do docker-compose
npm run prisma:migrate           # cria as tabelas
npm run seed                     # regras, recompensas, loja e dados de demonstração
npm run dev                      # API em :3333 e app em http://localhost:5173
```

Contas de demonstração (criadas com `SEED_DEMO_DATA="true"`): `admin2@email.com` e
`user@email.com`, senha `123456`.

Outros comandos:

- `npm run create-user` — cria/atualiza uma conta pelo terminal (ex.: um admin).
- `npm test` — testes do backend. Os de integração da API só rodam com um banco
  descartável: `TEST_DATABASE_URL="postgresql://.../colecao_biblica_test" npm test`.
- `npm run build` — compila backend e frontend.
- `npm run icons -w frontend` — regenera os ícones do PWA a partir de `frontend/src/assets/logo.png`.

## Deploy na Vercel (front + back juntos)

### 1. Criar o projeto na Vercel

1. **Add New → Project** e importe este repositório.
2. **Root Directory**: a raiz do repositório (não escolha `frontend` nem `backend`).
3. Framework Preset: **Other**. Build, output e rotas já vêm do `vercel.json`.
4. Em **Environment Variables**, cadastre à mão:

| Variável | Obrigatória | Valor |
| --- | --- | --- |
| `JWT_SECRET` | sim | Texto aleatório com 32+ caracteres: `openssl rand -base64 48` |
| `ADMIN_EMAIL` | recomendado | Seu e-mail; o deploy cria esse admin se ainda não existir |
| `ADMIN_PASSWORD` | recomendado | Senha do admin (mínimo 8 caracteres) |
| `ADMIN_NAME` | não | Nome exibido do admin (padrão: `Administrador`) |
| `BLOB_READ_WRITE_TOKEN` | recomendado | Token do Blob store (passo 3) |
| `APP_TIMEZONE` | não | Fuso do limite diário de prêmios (padrão `America/Sao_Paulo`) |
| `SEED_DEMO_DATA` | não | Não cadastre em produção (só `true` cria as contas de teste) |

5. **Deploy**. Este primeiro deploy falha na etapa do banco, porque o banco ainda não existe (passo 2).

### 2. Banco: integração Neon da Vercel

1. No projeto: **Storage → Create Database → Neon** (região São Paulo, se houver) e conecte ao
   projeto, marcando Production e Preview.
2. A integração cria sozinha as variáveis que o app usa:
   - `DATABASE_URL` — conexão com pooler (usada pelo app);
   - `DATABASE_URL_UNPOOLED` — conexão direta (usada só pelas migrações).
   Ela cria outras (`PGHOST`, `POSTGRES_URL`...) que o app ignora.
3. **Deployments → ⋯ → Redeploy**.

### 3. Imagens (Vercel Blob)

**Storage → Create Database → Blob**. Para cadastrar o token à mão, copie o
`BLOB_READ_WRITE_TOKEN` (começa com `vercel_blob_rw_`) na página do store e salve como
variável do projeto; ou clique em **Connect** e a Vercel cadastra sozinha. Depois,
**Redeploy**: o build detecta o token e o painel admin passa a enviar as imagens para o Blob.

### O que acontece em cada deploy

`npm run vercel-build`:

1. `prisma migrate deploy` — aplica migrações novas no Neon (usa `DATABASE_URL_UNPOOLED`);
2. `prisma generate`;
3. `npm run seed` — garante configurações, recompensas, itens da loja e o admin de
   `ADMIN_EMAIL` (não duplica nada nem desfaz ajustes feitos no painel);
4. build do frontend em `frontend/dist`.

Depois do primeiro deploy, entre com o `ADMIN_EMAIL`/`ADMIN_PASSWORD` e cadastre
personagens e perguntas pelo painel.

## Estrutura

```
api/index.ts              função serverless (chama createApp do backend)
backend/
  prisma/                 schema e migrações
  src/app.ts              monta o Express com todas as rotas em /api
  src/routes/             auth, users, characters, questions, rewards, shop,
                          settings, quiz, collection, comments, ranking, uploads
  src/services/           regras do jogo, quiz, recompensas, configurações, seed
  src/scripts/            seed e create-user
frontend/
  src/pages/              início (login), painel e detalhe da figurinha
  src/components/         telas do jogador (user/), do admin (admin/) e do jogo (game/)
  src/sw.ts               service worker (cache offline e atualização)
  vite.config.ts          build, manifest do PWA e proxy /api no desenvolvimento
vercel.json               build, rotas e cabeçalhos na Vercel
```
