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
- Cadastro via `POST /users` seguido de autenticação automática.
- Login via `POST /auth/login` com persistência local de tokens.
- Rota protegida em `/dashboard` com controle de sessão e logout.

## Componentes reutilizáveis

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/table.tsx`

## Próximos passos

- Criar cliente HTTP autenticado para endpoints protegidos.
- Implementar refresh de token automático.
- Montar primeiras telas de listagem com tabelas reutilizáveis.
