# Frontend

Aplicação Next.js para a Coleção Bíblica.

## Setup

1. Instale o Node.js LTS.
2. Entre na pasta frontend.
3. Copie `.env.example` para `.env.local`.
4. Ajuste `NEXT_PUBLIC_API_BASE_URL` para a URL do backend (e `NEXT_PUBLIC_IMAGE_UPLOADS`: `inline` local, `blob` na Vercel).
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
- `npm run icons`: regenera os ícones do PWA a partir de `src/assets/logo.png`

## PWA

O app é instalável (Android, desktop e iPhone) e funciona offline com os dados já vistos.

| Arquivo | Papel |
| --- | --- |
| `src/app/manifest.ts` | Web App Manifest (nome, ícones, cores, `start_url: /dashboard`) |
| `public/sw.js` | Service worker (cache e modo offline) |
| `src/components/pwa/pwa-provider.tsx` | Registro do worker, aviso de nova versão, aviso de offline, prompt de instalação |
| `src/components/pwa/install-app-button.tsx` | Botão "Instalar app" (prompt nativo ou instruções no iPhone) |
| `src/app/offline/page.tsx` | Tela exibida sem rede quando a página não está em cache |
| `public/icons/` | Ícones gerados por `npm run icons` |

Estratégias de cache do service worker:

- **Páginas:** rede primeiro; sem rede, a última cópia salva ou `/offline`.
- **`/_next/static`:** cache primeiro (arquivos com hash).
- **Ícones e imagens:** cache, revalidando em segundo plano.
- **API:** somente leituras (personagens, coleção, ranking, loja, perfil, comentários,
  histórico e regras) com rede primeiro e cópia para uso offline. Quiz, compras e
  autenticação nunca usam cache. O cache da API é apagado no login e no logout.

Atualizações: cada build recebe um identificador (`APP_BUILD_ID` ou o commit atual)
que vai na URL do worker. Quando um deploy novo é detectado, o app mostra
"Uma nova versão do app está disponível" e troca de versão quando o usuário aceita.

O service worker só é registrado em produção (`npm run build && npm run start`);
em `npm run dev` qualquer worker antigo é removido para não atrapalhar o hot reload.

### Publicação

- O PWA exige **HTTPS** (exceto em `localhost`).
- `NEXT_PUBLIC_API_BASE_URL` é lida **no build**; defina a URL da API antes de `npm run build`.
- Inclua a origem do frontend em `CORS_ALLOWED_ORIGINS` no backend.

## Sistema visual

- Tokens em `src/app/globals.css` (temas Dia e Noite), expostos ao Tailwind como `bg-surface`,
  `text-ink`, `text-muted`, `bg-primary`, `bg-accent`, `border-edge` etc. Os nomes antigos
  (`--bg-primary`, `--text-primary`, `--gold`...) apontam para os novos.
- Fontes: Fredoka (`font-display`) e Nunito (texto).
- Classes de jogo: `panel`, `btn-3d`, `rarity` + `data-rarity` (`rarity-frame`, `rarity-text`,
  `rarity-bg`, `rarity-chip`) e animações `animate-fade-up`, `animate-pop-in`, `animate-float`.
- Componentes de jogo em `src/components/game/` (moedas, bônus, XP, nível, figurinha, modal)
  e seções do painel em `src/components/user/sections/`.

## Componentes reutilizáveis

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/table.tsx`

## Próximos passos

- Atalhos no ícone do app (manifest `shortcuts`) para Quiz e Figurinhas.
- Navegação inferior no celular quando instalado.
