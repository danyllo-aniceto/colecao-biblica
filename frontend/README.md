# Frontend

Aplicação Next.js para a Coleção Bíblica.

## Setup

1. Instale o Node.js LTS.
2. Entre na pasta frontend.
3. Copie `.env.example` para `.env.local`.
4. Ajuste `NEXT_PUBLIC_API_BASE_URL` para a URL do backend.
5. Execute `npm install`.
6. Rode `npm run dev`.

## Funcionalidades atuais

- Tela inicial com Login e Cadastro na mesma interface.
- Painel do usuário: figurinhas, quiz, loja, ranking e configurações da conta.
- Painel do admin: usuários, personagens, perguntas, recompensas, loja e configurações do jogo.
- Sessão com renovação automática: `src/lib/http.ts` renova o access token via
  `POST /auth/refresh` ao receber `401` e repete a requisição. Só desloga se o
  refresh for recusado (falha de rede não derruba a sessão).
- Quiz com cronômetro sincronizado com o servidor, envio automático ao fim do
  tempo e bônus (tempo extra, vida extra, XP em dobro).
- Tema claro/escuro aplicado antes da primeira pintura (sem "piscar"); a variante
  `dark:` do Tailwind segue o tema escolhido no app.

## Scripts

- `npm run dev`: ambiente de desenvolvimento
- `npm run build`: build de produção
- `npm run lint`: ESLint (config flat do Next)
- `npx tsc --noEmit`: checagem de tipos

## Componentes reutilizáveis

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/table.tsx`

## Próximos passos

- Transformar em PWA (manifest, service worker, página offline, instalação).
